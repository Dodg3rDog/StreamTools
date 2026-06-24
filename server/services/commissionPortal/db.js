const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { getCommissionConfig } = require("./config");

let db = null;

function getDb() {
  if (db) {
    return db;
  }

  const config = getCommissionConfig();
  fs.mkdirSync(path.dirname(config.dataPath), { recursive: true });

  db = new Database(config.dataPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);

  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS commission_clients (
      discord_user_id TEXT PRIMARY KEY,
      preferred_name TEXT NOT NULL,
      client_role_id TEXT NOT NULL,
      forum_channel_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT NOT NULL,
      forum_channel_id TEXT NOT NULL,
      thread_id TEXT UNIQUE NOT NULL,
      trello_card_id TEXT,
      trello_card_url TEXT,
      commission_type TEXT NOT NULL,
      completion_level TEXT NOT NULL,
      content_rating TEXT NOT NULL,
      private_commission INTEGER NOT NULL DEFAULT 0,
      availability_days TEXT NOT NULL DEFAULT '',
      availability_start_time TEXT NOT NULL DEFAULT '',
      availability_end_time TEXT NOT NULL DEFAULT '',
      availability_timezone TEXT NOT NULL DEFAULT '',
      request_details TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approved_at TEXT,
      rejected_at TEXT,
      rejection_reason TEXT,
      FOREIGN KEY (discord_user_id) REFERENCES commission_clients(discord_user_id)
    );

    CREATE TABLE IF NOT EXISTS commission_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commission_id INTEGER,
      source TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (commission_id) REFERENCES commissions(id)
    );

    CREATE TABLE IF NOT EXISTS commission_pricing_messages (
      message_index INTEGER PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS commission_quote_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commission_id INTEGER NOT NULL,
      catalog_item_id TEXT NOT NULL,
      catalog_item_type TEXT NOT NULL,
      label TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_amount_cents INTEGER,
      pricing_type TEXT NOT NULL DEFAULT 'fixed',
      percentage_rate REAL,
      base_amount_cents INTEGER,
      computed_amount_cents INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (commission_id) REFERENCES commissions(id)
    );
  `);

  ensureColumn(database, "commissions", "private_commission", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "commissions", "availability_days", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "commissions", "availability_start_time", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "commissions", "availability_end_time", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "commissions", "availability_timezone", "TEXT NOT NULL DEFAULT ''");
}

function upsertClient(input) {
  const now = new Date().toISOString();
  const existing = getClient(input.discordUserId);

  if (existing) {
    getDb().prepare(`
      UPDATE commission_clients
      SET preferred_name = ?, client_role_id = ?, forum_channel_id = COALESCE(?, forum_channel_id), updated_at = ?
      WHERE discord_user_id = ?
    `).run(
      input.preferredName,
      input.clientRoleId,
      input.forumChannelId || null,
      now,
      input.discordUserId
    );

    return getClient(input.discordUserId);
  }

  getDb().prepare(`
    INSERT INTO commission_clients (
      discord_user_id,
      preferred_name,
      client_role_id,
      forum_channel_id,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.discordUserId,
    input.preferredName,
    input.clientRoleId,
    input.forumChannelId || null,
    now,
    now
  );

  return getClient(input.discordUserId);
}

function setClientForum(discordUserId, forumChannelId) {
  getDb().prepare(`
    UPDATE commission_clients
    SET forum_channel_id = ?, updated_at = ?
    WHERE discord_user_id = ?
  `).run(forumChannelId, new Date().toISOString(), discordUserId);

  return getClient(discordUserId);
}

function getClient(discordUserId) {
  return getDb().prepare(`
    SELECT
      discord_user_id AS discordUserId,
      preferred_name AS preferredName,
      client_role_id AS clientRoleId,
      forum_channel_id AS forumChannelId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM commission_clients
    WHERE discord_user_id = ?
  `).get(discordUserId);
}

function createCommission(input) {
  const now = new Date().toISOString();
  const result = getDb().prepare(`
    INSERT INTO commissions (
      discord_user_id,
      forum_channel_id,
      thread_id,
      commission_type,
      completion_level,
      content_rating,
      private_commission,
      availability_days,
      availability_start_time,
      availability_end_time,
      availability_timezone,
      request_details,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.discordUserId,
    input.forumChannelId,
    input.threadId,
    input.commissionType,
    input.completionLevel,
    input.contentRating,
    input.privateCommission === true ? 1 : 0,
    (input.availabilityDays || []).join(","),
    input.availabilityStartTime || "",
    input.availabilityEndTime || "",
    input.availabilityTimezone || "",
    input.requestDetails,
    input.status || "pending_review",
    now,
    now
  );

  return getCommissionById(result.lastInsertRowid);
}

function getCommissionById(id) {
  return getDb().prepare(commissionSelectSql("id = ?")).get(id);
}

function getCommissionByThreadId(threadId) {
  return getDb().prepare(commissionSelectSql("thread_id = ?")).get(threadId);
}

function markCommissionApproved(id, trelloCard) {
  getDb().prepare(`
    UPDATE commissions
    SET trello_card_id = ?, trello_card_url = ?, status = ?, approved_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    trelloCard.id || "",
    trelloCard.shortUrl || trelloCard.url || "",
    "approved",
    new Date().toISOString(),
    new Date().toISOString(),
    id
  );

  return getCommissionById(id);
}

function markCommissionRejected(id, reason) {
  getDb().prepare(`
    UPDATE commissions
    SET status = ?, rejected_at = ?, rejection_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(
    "rejected",
    new Date().toISOString(),
    reason,
    new Date().toISOString(),
    id
  );

  return getCommissionById(id);
}

function markCommissionCanceled(id, reason) {
  getDb().prepare(`
    UPDATE commissions
    SET status = ?, rejected_at = ?, rejection_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(
    "canceled",
    new Date().toISOString(),
    reason,
    new Date().toISOString(),
    id
  );

  return getCommissionById(id);
}

function markCommissionRejectionReasonRequested(id) {
  getDb().prepare(`
    UPDATE commissions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    "rejection_reason_requested",
    new Date().toISOString(),
    id
  );

  return getCommissionById(id);
}

function markCommissionCancellationReasonRequested(id) {
  getDb().prepare(`
    UPDATE commissions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    "cancellation_reason_requested",
    new Date().toISOString(),
    id
  );

  return getCommissionById(id);
}

function appendSyncLog(input) {
  getDb().prepare(`
    INSERT INTO commission_sync_log (
      commission_id,
      source,
      action,
      payload_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    input.commissionId || null,
    input.source || "discord",
    input.action || "unknown",
    safeJson(input.payload || {}),
    new Date().toISOString()
  );
}

function getPricingMessages() {
  return getDb().prepare(`
    SELECT
      message_index AS messageIndex,
      channel_id AS channelId,
      message_id AS messageId,
      source_hash AS sourceHash,
      updated_at AS updatedAt
    FROM commission_pricing_messages
    ORDER BY message_index ASC
  `).all();
}

function upsertPricingMessage(input) {
  getDb().prepare(`
    INSERT INTO commission_pricing_messages (
      message_index,
      channel_id,
      message_id,
      source_hash,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(message_index) DO UPDATE SET
      channel_id = excluded.channel_id,
      message_id = excluded.message_id,
      source_hash = excluded.source_hash,
      updated_at = excluded.updated_at
  `).run(
    input.messageIndex,
    input.channelId,
    input.messageId,
    input.sourceHash || "",
    new Date().toISOString()
  );
}

function deletePricingMessage(messageIndex) {
  getDb().prepare("DELETE FROM commission_pricing_messages WHERE message_index = ?").run(messageIndex);
}

function addCommissionQuoteLineItem(input) {
  const now = new Date().toISOString();
  const result = getDb().prepare(`
    INSERT INTO commission_quote_line_items (
      commission_id,
      catalog_item_id,
      catalog_item_type,
      label,
      quantity,
      unit_amount_cents,
      pricing_type,
      percentage_rate,
      base_amount_cents,
      computed_amount_cents,
      notes,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.commissionId,
    input.catalogItemId || "",
    input.catalogItemType || "item",
    input.label || "",
    input.quantity || 1,
    input.unitAmountCents ?? null,
    input.pricingType || "fixed",
    input.percentageRate ?? null,
    input.baseAmountCents ?? null,
    input.computedAmountCents || 0,
    input.notes || "",
    now,
    now
  );

  return getCommissionQuoteLineItem(result.lastInsertRowid);
}

function getCommissionQuoteLineItem(id) {
  return getDb().prepare(quoteLineItemSelectSql("id = ?")).get(id);
}

function getCommissionQuoteLineItems(commissionId) {
  return getDb().prepare(quoteLineItemSelectSql("commission_id = ?") + " ORDER BY id ASC").all(commissionId);
}

function deleteCommissionQuoteLineItem(id) {
  return getDb().prepare("DELETE FROM commission_quote_line_items WHERE id = ?").run(id).changes;
}

function quoteLineItemSelectSql(whereClause) {
  return `
    SELECT
      id,
      commission_id AS commissionId,
      catalog_item_id AS catalogItemId,
      catalog_item_type AS catalogItemType,
      label,
      quantity,
      unit_amount_cents AS unitAmountCents,
      pricing_type AS pricingType,
      percentage_rate AS percentageRate,
      base_amount_cents AS baseAmountCents,
      computed_amount_cents AS computedAmountCents,
      notes,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM commission_quote_line_items
    WHERE ${whereClause}
  `;
}

function commissionSelectSql(whereClause) {
  return `
    SELECT
      id,
      discord_user_id AS discordUserId,
      forum_channel_id AS forumChannelId,
      thread_id AS threadId,
      trello_card_id AS trelloCardId,
      trello_card_url AS trelloCardUrl,
      commission_type AS commissionType,
      completion_level AS completionLevel,
      content_rating AS contentRating,
      private_commission AS privateCommission,
      availability_days AS availabilityDays,
      availability_start_time AS availabilityStartTime,
      availability_end_time AS availabilityEndTime,
      availability_timezone AS availabilityTimezone,
      request_details AS requestDetails,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt,
      approved_at AS approvedAt,
      rejected_at AS rejectedAt,
      rejection_reason AS rejectionReason
    FROM commissions
    WHERE ${whereClause}
  `;
}

function deleteClientRecords(discordUserId) {
  const database = getDb();
  const transaction = database.transaction(() => {
    database.prepare("DELETE FROM commission_sync_log WHERE commission_id IN (SELECT id FROM commissions WHERE discord_user_id = ?)").run(discordUserId);
    const commissions = database.prepare("DELETE FROM commissions WHERE discord_user_id = ?").run(discordUserId);
    const clients = database.prepare("DELETE FROM commission_clients WHERE discord_user_id = ?").run(discordUserId);

    return {
      deletedClients: clients.changes,
      deletedCommissions: commissions.changes
    };
  });

  return transaction();
}

function ensureColumn(database, tableName, columnName, definition) {
  const columns = database.prepare("PRAGMA table_info(" + tableName + ")").all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    database.exec("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + definition);
  }
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return "{}";
  }
}

module.exports = {
  addCommissionQuoteLineItem,
  appendSyncLog,
  createCommission,
  deleteClientRecords,
  deleteCommissionQuoteLineItem,
  deletePricingMessage,
  getClient,
  getCommissionById,
  getCommissionByThreadId,
  getCommissionQuoteLineItem,
  getCommissionQuoteLineItems,
  getDb,
  getPricingMessages,
  markCommissionApproved,
  markCommissionCanceled,
  markCommissionCancellationReasonRequested,
  markCommissionRejectionReasonRequested,
  markCommissionRejected,
  setClientForum,
  upsertPricingMessage,
  upsertClient
};
