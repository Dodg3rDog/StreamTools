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

function getPricingCatalogItems(catalog) {
  const items = [];

  for (const group of catalog.baseCommissions || []) {
    for (const option of group.options || []) {
      items.push({
        id: option.id,
        type: "base_commission",
        groupId: group.id || "",
        groupLabel: group.label || "",
        label: option.label || "",
        displayLabel: (group.label ? group.label + " - " : "") + (option.label || ""),
        pricingType: "fixed",
        amountCents: option.amountCents ?? 0,
        currency: catalog.currency || "USD",
        source: option
      });
    }
  }

  for (const item of catalog.specialtyCommissions || []) {
    items.push({
      id: item.id,
      type: "specialty_commission",
      groupId: "specialty_commissions",
      groupLabel: "Specialty Commissions",
      label: item.label || "",
      displayLabel: item.label || "",
      pricingType: "fixed",
      amountCents: item.amountCents ?? 0,
      currency: catalog.currency || "USD",
      notes: item.notes || "",
      source: item
    });
  }

  for (const item of catalog.upgrades || []) {
    items.push({
      id: item.id,
      type: "upgrade",
      groupId: normalizeCatalogId(item.category || "upgrades"),
      groupLabel: item.category || "Upgrades",
      label: item.label || "",
      displayLabel: item.label || "",
      pricingType: item.pricingType || "fixed",
      amountCents: item.amountCents ?? null,
      percent: item.percent ?? null,
      unitLabel: item.unitLabel || "",
      currency: catalog.currency || "USD",
      examples: item.examples || [],
      source: item
    });
  }

  return items;
}

function findPricingCatalogItem(catalog, itemId) {
  return getPricingCatalogItems(catalog).find((item) => item.id === itemId) || null;
}

function createQuoteLineItemFromCatalog(catalog, itemId, input = {}) {
  const item = findPricingCatalogItem(catalog, itemId);
  if (!item) {
    throw new Error("Unknown pricing catalog item: " + itemId);
  }

  const quantity = Math.max(1, Number.parseInt(input.quantity || 1, 10));
  const baseAmountCents = input.baseAmountCents ?? null;
  const customAmountCents = input.customAmountCents ?? null;
  const pricingType = item.pricingType || "fixed";
  const line = {
    catalogItemId: item.id,
    catalogItemType: item.type,
    label: item.displayLabel || item.label,
    quantity,
    unitAmountCents: item.amountCents ?? null,
    pricingType,
    percentageRate: item.percent ?? null,
    baseAmountCents,
    computedAmountCents: 0,
    notes: input.notes || item.notes || ""
  };

  if (pricingType === "fixed") {
    line.computedAmountCents = Number(item.amountCents || 0) * quantity;
    return line;
  }

  if (pricingType === "percent_of_base") {
    if (!Number.isFinite(Number(baseAmountCents))) {
      throw new Error("Base amount is required for percent-based pricing item: " + itemId);
    }

    line.unitAmountCents = null;
    line.computedAmountCents = Math.round(Number(baseAmountCents) * Number(item.percent || 0) / 100) * quantity;
    return line;
  }

  if (pricingType === "quote_required") {
    line.unitAmountCents = customAmountCents ?? null;
    line.computedAmountCents = Number(customAmountCents || 0) * quantity;
    line.notes = line.notes || "Quote required.";
    return line;
  }

  throw new Error("Unsupported pricing type for catalog item " + itemId + ": " + pricingType);
}

function calculateQuoteTotal(lineItems) {
  return (lineItems || []).reduce((total, item) => total + Number(item.computedAmountCents || 0), 0);
}

function formatQuoteLineItem(lineItem, currency = "USD") {
  const quantity = Number(lineItem.quantity || 1);
  const prefix = quantity > 1 ? quantity + "x " : "";
  return prefix + lineItem.label + " - " + formatMoney(lineItem.computedAmountCents, currency);
}

function buildPricingEmbeds(catalog) {
  return buildPricingSections(catalog).map((section) => createEmbed(section.title, section.body, 0x7c5cff));
}

function buildPricingSections(catalog) {
  if (Array.isArray(catalog.sections) && catalog.sections.length > 0) {
    return catalog.sections.map((section, index) => ({
      id: section.id || "pricing-section-" + (index + 1),
      title: section.title || "Pricing Section " + (index + 1),
      body: Array.isArray(section.body) ? section.body.join("\n\n") : String(section.body || ""),
      references: Array.isArray(section.references) ? section.references : []
    }));
  }

  return [
    buildCommissionPricingSection(catalog),
    buildAddOnsSection(catalog),
    buildProcessSection(catalog),
    buildPaymentPolicySection(catalog),
    buildYchPolicySection(catalog),
    buildCopyrightSection(catalog),
    buildGeneralInformationSection(catalog)
  ];
}

function buildCommissionPricingSection(catalog) {
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

  return { id: "character-commissions", title: "Character Commissions", body: lines.join("\n") };
}

function buildAddOnsSection(catalog) {
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
  return { id: "addons-extras", title: "Add-Ons & Extras", body: lines.join("\n") };
}

function buildProcessSection(catalog) {
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

  return { id: "commission-process", title: "Commission Process", body: lines.join("\n") };
}

function buildPaymentPolicySection(catalog) {
  const policy = catalog.paymentPolicy || {};
  const lines = [];
  addHeadingList(lines, "Payment Schedule", policy.schedule);
  addHeadingList(lines, "Refund Policy", policy.refund);
  addHeadingList(lines, "Accepted Payment Methods", policy.acceptedMethods);
  if (policy.note) {
    lines.push(policy.note);
  }

  return { id: "payment-policy", title: "Payment Policy", body: lines.join("\n") };
}

function buildYchPolicySection(catalog) {
  return { id: "ych-policy", title: "YCH Policy", body: toBulletList(catalog.ychPolicy) };
}

function buildCopyrightSection(catalog) {
  const usage = catalog.copyrightUsage || {};
  const lines = [];
  addHeadingList(lines, "Artist Rights", usage.artistRights);
  addHeadingList(lines, "Watermarks", usage.watermarks);
  addHeadingList(lines, "Final Deliverables", usage.finalDeliverables);

  return { id: "copyright-usage", title: "Copyright & Usage", body: lines.join("\n") };
}

function buildGeneralInformationSection(catalog) {
  return { id: "general-information", title: "General Information", body: toBulletList(catalog.generalInformation) };
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

function normalizeCatalogId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function limitEmbedDescription(value) {
  const text = String(value || "").trim();
  return text.length <= 4096 ? text : text.slice(0, 4093) + "...";
}

module.exports = {
  buildPricingEmbeds,
  buildPricingSections,
  calculateQuoteTotal,
  createQuoteLineItemFromCatalog,
  findPricingCatalogItem,
  formatMoney,
  formatQuoteLineItem,
  getPricingCatalogItems,
  publishCommissionPricing,
  readPricingCatalog,
  startCommissionPricingPublisher
};
