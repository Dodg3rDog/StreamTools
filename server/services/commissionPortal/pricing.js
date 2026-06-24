const crypto = require("crypto");
const fs = require("fs");
const { EmbedBuilder } = require("discord.js");
const {
  appendSyncLog,
  deletePricingMessage,
  getPricingMessages,
  upsertPricingMessage
} = require("./db");

let watcherStarted = false;
let lastPublishedHash = "";
let publishTimer = null;

async function publishCommissionPricing(client, config, input = {}) {
  const { catalog, sourceHash } = readPricingCatalog(config.pricingCatalogPath);
  const channel = await client.channels.fetch(config.pricingChannelId).catch(() => null);
  if (!channel?.send || !channel.messages?.fetch) {
    throw new Error("Configured pricing channel could not be found or does not support messages.");
  }

  const embeds = buildPricingEmbeds(catalog);
  const records = new Map(getPricingMessages().map((record) => [record.messageIndex, record]));
  const publishedMessageIds = [];

  for (let index = 0; index < embeds.length; index += 1) {
    const messageIndex = index + 1;
    const record = records.get(messageIndex);
    let message = record?.messageId
      ? await channel.messages.fetch(record.messageId).catch(() => null)
      : null;

    if (message) {
      await message.edit({ content: "", embeds: [embeds[index]] });
    } else {
      message = await channel.send({ embeds: [embeds[index]] });
    }

    upsertPricingMessage({
      messageIndex,
      channelId: channel.id,
      messageId: message.id,
      sourceHash
    });
    publishedMessageIds.push(message.id);
  }

  for (const record of records.values()) {
    if (record.messageIndex <= embeds.length) {
      continue;
    }

    const message = await channel.messages.fetch(record.messageId).catch(() => null);
    await message?.delete?.().catch(() => null);
    deletePricingMessage(record.messageIndex);
  }

  lastPublishedHash = sourceHash;
  appendSyncLog({
    source: "discord",
    action: "pricing_channel_published",
    payload: {
      channelId: channel.id,
      sourcePath: config.pricingCatalogPath,
      sourceHash,
      embedCount: embeds.length,
      messageIds: publishedMessageIds,
      reason: input.reason || "manual"
    }
  });

  return {
    channelId: channel.id,
    embedCount: embeds.length,
    sourceHash,
    messageIds: publishedMessageIds
  };
}

function startCommissionPricingPublisher(client, config) {
  if (watcherStarted || !config.enabled || !config.pricingCatalogPath) {
    return;
  }

  watcherStarted = true;
  schedulePricingPublish(client, config, "startup");

  fs.watchFile(config.pricingCatalogPath, { interval: config.pricingWatchIntervalMs }, () => {
    schedulePricingPublish(client, config, "catalog_changed");
  });
}

function schedulePricingPublish(client, config, reason) {
  if (publishTimer) {
    clearTimeout(publishTimer);
  }

  publishTimer = setTimeout(async () => {
    publishTimer = null;

    try {
      const { sourceHash } = readPricingCatalog(config.pricingCatalogPath);
      if (reason !== "startup" && sourceHash === lastPublishedHash) {
        return;
      }

      await publishCommissionPricing(client, config, { reason });
      console.log("[Commission Portal] Published pricing channel from catalog.");
    } catch (error) {
      console.warn("[Commission Portal] Failed to publish pricing channel:", error.message);
    }
  }, 1000);
}

function readPricingCatalog(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return {
    catalog: JSON.parse(raw),
    sourceHash: crypto.createHash("sha256").update(raw).digest("hex")
  };
}

function buildPricingEmbeds(catalog) {
  return [
    buildCommissionPricingEmbed(catalog),
    buildAddOnsEmbed(catalog),
    buildProcessEmbed(catalog),
    buildPaymentPolicyEmbed(catalog),
    buildYchPolicyEmbed(catalog),
    buildCopyrightEmbed(catalog),
    buildGeneralInformationEmbed(catalog)
  ];
}

function buildCommissionPricingEmbed(catalog) {
  const lines = [];
  for (const group of catalog.baseCommissions || []) {
    lines.push("### " + group.label);
    for (const option of group.options || []) {
      lines.push("- " + option.label + " — " + formatMoney(option.amountCents, catalog.currency));
    }
    lines.push("");
  }

  lines.push("### Specialty Commissions");
  for (const item of catalog.specialtyCommissions || []) {
    lines.push("- " + item.label + " — " + formatMoney(item.amountCents, catalog.currency));
  }

  lines.push("");
  if (catalog.baseCommissionNote) {
    lines.push("*" + catalog.baseCommissionNote + "*");
  }

  for (const item of catalog.specialtyCommissions || []) {
    if (item.notes) {
      lines.push("*" + item.notes + "*");
    }
  }

  return createEmbed("🎨 Character Commissions", lines.join("\n"), 0x7c5cff);
}

function buildAddOnsEmbed(catalog) {
  const grouped = new Map();
  for (const upgrade of catalog.upgrades || []) {
    const items = grouped.get(upgrade.category) || [];
    items.push(upgrade);
    grouped.set(upgrade.category, items);
  }

  const lines = [];
  for (const [category, items] of grouped.entries()) {
    lines.push("### " + category);
    for (const item of items) {
      if (item.pricingType === "fixed") {
        lines.push("- " + item.label + " — +" + formatMoney(item.amountCents, catalog.currency));
      } else if (item.pricingType === "percent_of_base") {
        lines.push("- " + item.label + " — +" + item.percent + "% of the base price" + (item.unitLabel ? " " + item.unitLabel : ""));
      } else if (item.pricingType === "quote_required") {
        lines.push("The following may require an additional quote:");
        for (const example of item.examples || []) {
          lines.push("- " + example);
        }
      }
    }
    lines.push("");
  }

  lines.push("All add-ons are optional and may be combined.");
  return createEmbed("➕ Add-Ons & Extras", lines.join("\n"), 0x7c5cff);
}

function buildProcessEmbed(catalog) {
  const lines = [];
  (catalog.process || []).forEach((step, index) => {
    lines.push("### " + (index + 1) + ". " + step.title);
    for (const detail of step.details || []) {
      lines.push("- " + detail);
    }
    lines.push("");
  });

  if (Array.isArray(catalog.deliveryFormats) && catalog.deliveryFormats.length > 0) {
    lines.push("### Delivery Formats");
    for (const format of catalog.deliveryFormats) {
      lines.push("- " + format);
    }
  }

  return createEmbed("📋 Commission Process", lines.join("\n"), 0x7c5cff);
}

function buildPaymentPolicyEmbed(catalog) {
  const policy = catalog.paymentPolicy || {};
  const lines = [];
  addHeadingList(lines, "Payment Schedule", policy.schedule);
  addHeadingList(lines, "Refund Policy", policy.refund);
  addHeadingList(lines, "Accepted Payment Methods", policy.acceptedMethods);
  if (policy.note) {
    lines.push(policy.note);
  }

  return createEmbed("💰 Payment Policy", lines.join("\n"), 0x7c5cff);
}

function buildYchPolicyEmbed(catalog) {
  return createEmbed("📌 YCH Policy", toBulletList(catalog.ychPolicy), 0x7c5cff);
}

function buildCopyrightEmbed(catalog) {
  const usage = catalog.copyrightUsage || {};
  const lines = [];
  addHeadingList(lines, "Artist Rights", usage.artistRights);
  addHeadingList(lines, "Watermarks", usage.watermarks);
  addHeadingList(lines, "Final Deliverables", usage.finalDeliverables);

  return createEmbed("⚖️ Copyright & Usage", lines.join("\n"), 0x7c5cff);
}

function buildGeneralInformationEmbed(catalog) {
  return createEmbed("✅ General Information", toBulletList(catalog.generalInformation), 0x7c5cff);
}

function createEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(limitEmbedDescription(description))
    .setColor(color);
}

function addHeadingList(lines, heading, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  lines.push("### " + heading);
  for (const item of items) {
    lines.push("- " + item);
  }
  lines.push("");
}

function toBulletList(items) {
  return (items || []).map((item) => "- " + item).join("\n");
}

function formatMoney(amountCents, currency) {
  const amount = Number(amountCents || 0) / 100;
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return "$" + rounded + (currency && currency !== "USD" ? " " + currency : "");
}

function limitEmbedDescription(value) {
  const text = String(value || "").trim();
  return text.length <= 4096 ? text : text.slice(0, 4093) + "...";
}

module.exports = {
  buildPricingEmbeds,
  publishCommissionPricing,
  readPricingCatalog,
  startCommissionPricingPublisher
};
