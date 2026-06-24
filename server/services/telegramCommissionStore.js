const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

let db = null;

function getTelegramDb() {
  if (db) {
    return db;
  }

  const dataPath = process.env.TELEGRAM_SQLITE_PATH ||
    path.join(__dirname, "../data/telegram/telegram-bot.sqlite");
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });

  db = new Database(dataPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS telegram_commission_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT NOT NULL,
      telegram_username TEXT NOT NULL DEFAULT '',
      telegram_display_name TEXT NOT NULL DEFAULT '',
      source_chat_id TEXT NOT NULL DEFAULT '',
      source_chat_title TEXT NOT NULL DEFAULT '',
      commission_type TEXT NOT NULL,
      completion_level TEXT NOT NULL,
      content_rating TEXT NOT NULL,
      private_commission INTEGER NOT NULL DEFAULT 0,
      request_details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_discord_import',
      discord_commission_id TEXT NOT NULL DEFAULT '',
      discord_forum_channel_id TEXT NOT NULL DEFAULT '',
      discord_thread_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function createTelegramCommissionRequest(input) {
  const now = new Date().toISOString();
  const result = getTelegramDb().prepare(`
    INSERT INTO telegram_commission_requests (
      telegram_user_id,
      telegram_username,
      telegram_display_name,
      source_chat_id,
      source_chat_title,
      commission_type,
      completion_level,
      content_rating,
      private_commission,
      request_details,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.telegramUserId,
    input.telegramUsername || "",
    input.telegramDisplayName || "",
    input.sourceChatId || "",
    input.sourceChatTitle || "",
    input.commissionType,
    input.completionLevel,
    input.contentRating,
    input.privateCommission ? 1 : 0,
    input.requestDetails,
    input.status || "pending_discord_import",
    now,
    now
  );

  return getTelegramCommissionRequest(result.lastInsertRowid);
}

function getTelegramCommissionRequest(id) {
  return getTelegramDb().prepare(requestSelectSql("id = ?")).get(id);
}

function getPendingTelegramCommissionRequests(limit = 25) {
  return getTelegramDb().prepare(requestSelectSql("status = 'pending_discord_import'") + " ORDER BY created_at ASC LIMIT ?").all(limit);
}

function markTelegramCommissionImported(id, input) {
  getTelegramDb().prepare(`
    UPDATE telegram_commission_requests
    SET
      status = 'imported_to_discord',
      discord_commission_id = ?,
      discord_forum_channel_id = ?,
      discord_thread_id = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.discordCommissionId || "",
    input.discordForumChannelId || "",
    input.discordThreadId || "",
    new Date().toISOString(),
    id
  );

  return getTelegramCommissionRequest(id);
}

function requestSelectSql(whereClause) {
  return `
    SELECT
      id,
      telegram_user_id AS telegramUserId,
      telegram_username AS telegramUsername,
      telegram_display_name AS telegramDisplayName,
      source_chat_id AS sourceChatId,
      source_chat_title AS sourceChatTitle,
      commission_type AS commissionType,
      completion_level AS completionLevel,
      content_rating AS contentRating,
      private_commission AS privateCommission,
      request_details AS requestDetails,
      status,
      discord_commission_id AS discordCommissionId,
      discord_forum_channel_id AS discordForumChannelId,
      discord_thread_id AS discordThreadId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM telegram_commission_requests
    WHERE ${whereClause}
  `;
}

module.exports = {
  createTelegramCommissionRequest,
  getPendingTelegramCommissionRequests,
  getTelegramCommissionRequest,
  markTelegramCommissionImported
};
