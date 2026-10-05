const crypto = require("crypto");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");
const {
  appendSyncLog,
  deletePricingMessage,
  getDocumentMessage,
  getPricingMessages,
  upsertDocumentMessage
} = require("./db");
const {
  buildPricingSections,
  readPricingCatalog
} = require("./pricing");

const EPHEMERAL_FLAGS = 64;
const EPHEMERAL_DELETE_AFTER_MS = 10 * 60 * 1000;
const ids = {
  openPrefix: "commission:docs:open:",
  navPrefix: "commission:docs:nav:",
  selectPrefix: "commission:docs:select:",
  pdfPrefix: "commission:docs:pdf:",
  pdfOptionPrefix: "commission:docs:pdf-option:",
  characterPermissionPdf: "commission:docs:character-permission-pdf"
};

const CHARACTER_PERMISSION_TITLE = "Client Character Permission Affirmation";
const THIRD_PARTY_CHARACTER_PERMISSION_TITLE = "Third-Party Character Permission Confirmation";
const COMMISSION_REQUEST_TITLE = "Commission Request Submission";

let watcherStarted = false;
let publishTimer = null;
let lastPublishedHashes = {};
const ephemeralCleanupTimers = new Map();

async function publishCommissionDocument(client, config, documentType, input = {}) {
  const document = loadCommissionDocument(config, documentType);
  const channelId = getDocumentChannelId(config, documentType);
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.send || !channel.messages?.fetch) {
    throw new Error("Configured " + documentType + " channel could not be found or does not support messages.");
  }

  const record = getDocumentMessage(documentType);
  let message = record?.messageId
    ? await channel.messages.fetch(record.messageId).catch(() => null)
    : null;

  const payload = createDocumentEntryPayload(document);
  if (message) {
    await message.edit(payload);
  } else {
    message = await channel.send(payload);
  }

  upsertDocumentMessage({
    documentType,
    channelId: channel.id,
    messageId: message.id,
    sourceHash: document.sourceHash
  });

  if (documentType === "pricing") {
    await deleteTrackedPricingEmbedMessages(channel, message.id);
  }

  appendSyncLog({
    source: "discord",
    action: "commission_document_entry_published",
    payload: {
      documentType,
      channelId: channel.id,
      messageId: message.id,
      sourceHash: document.sourceHash,
      reason: input.reason || "manual",
      staffUserId: input.staffUserId || ""
    }
  });

  return {
    documentType,
    channelId: channel.id,
    messageId: message.id,
    sourceHash: document.sourceHash
  };
}

async function deleteTrackedPricingEmbedMessages(channel, keepMessageId) {
  const records = getPricingMessages();
  for (const record of records) {
    if (record.messageId === keepMessageId) {
      deletePricingMessage(record.messageIndex);
      continue;
    }

    const message = await channel.messages.fetch(record.messageId).catch(() => null);
    await message?.delete?.().catch(() => null);
    deletePricingMessage(record.messageIndex);
  }
}

async function publishCommissionDocuments(client, config, input = {}) {
  const results = [];
  results.push(await publishCommissionDocument(client, config, "pricing", input));
  results.push(await publishCommissionDocument(client, config, "tos", input));
  return results;
}

function startCommissionDocumentPublisher(client, config) {
  if (watcherStarted || !config.enabled) {
    return;
  }

  watcherStarted = true;
  scheduleDocumentPublish(client, config, "startup");

  if (config.pricingCatalogPath) {
    fs.watchFile(config.pricingCatalogPath, { interval: config.pricingWatchIntervalMs }, () => {
      scheduleDocumentPublish(client, config, "pricing_changed");
    });
  }

  if (config.tosCatalogPath) {
    fs.watchFile(config.tosCatalogPath, { interval: config.pricingWatchIntervalMs }, () => {
      scheduleDocumentPublish(client, config, "tos_changed");
    });
  }
}

function scheduleDocumentPublish(client, config, reason) {
  if (publishTimer) {
    clearTimeout(publishTimer);
  }

  publishTimer = setTimeout(async () => {
    publishTimer = null;

    try {
      const documentTypes = reason === "pricing_changed"
        ? ["pricing"]
        : reason === "tos_changed"
          ? ["tos"]
          : ["pricing", "tos"];

      for (const documentType of documentTypes) {
        const document = loadCommissionDocument(config, documentType);
        if (reason !== "startup" && lastPublishedHashes[documentType] === document.sourceHash) {
          continue;
        }

        await publishCommissionDocument(client, config, documentType, { reason });
        lastPublishedHashes[documentType] = document.sourceHash;
      }

      console.log("[Commission Portal] Published commission document navigator entries.");
    } catch (error) {
      console.warn("[Commission Portal] Failed to publish commission document entries:", error.message);
    }
  }, 1000);
}

async function handleCommissionDocumentInteraction(interaction, config) {
  if (interaction.isButton() && interaction.customId.startsWith(ids.openPrefix)) {
    const documentType = interaction.customId.slice(ids.openPrefix.length);
    await interaction.reply({
      ...createNavigatorPayload(config, documentType, 0),
      flags: EPHEMERAL_FLAGS
    });
    const replyMessage = await interaction.fetchReply().catch(() => null);
    scheduleEphemeralCleanup(interaction, getDocumentEphemeralKey(interaction, documentType), replyMessage?.id || interaction.id);
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith(ids.navPrefix)) {
    const payload = parseActionPayload(interaction.customId, ids.navPrefix);
    if (!payload) {
      return false;
    }

    const document = loadCommissionDocument(config, payload.documentType);
    const nextPage = resolvePage(document, payload.action);
    await interaction.update(createNavigatorPayload(config, payload.documentType, nextPage));
    scheduleEphemeralCleanup(interaction, getDocumentEphemeralKey(interaction, payload.documentType), interaction.message?.id || interaction.id);
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(ids.selectPrefix)) {
    const documentType = interaction.customId.slice(ids.selectPrefix.length);
    const document = loadCommissionDocument(config, documentType);
    const sectionId = interaction.values?.[0] || "";
    const sectionIndex = document.sections.findIndex((section) => section.id === sectionId);
    await interaction.update(createNavigatorPayload(config, documentType, Math.max(0, sectionIndex + 1)));
    scheduleEphemeralCleanup(interaction, getDocumentEphemeralKey(interaction, documentType), interaction.message?.id || interaction.id);
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith(ids.pdfPrefix)) {
    const documentType = interaction.customId.slice(ids.pdfPrefix.length);
    const document = loadCommissionDocument(config, documentType);

    if (document.type === "tos" && hasMatureContentPolicy(document)) {
      await interaction.reply({
        content: "Would you like the Mature Content Policy included in your PDF copy?",
        components: [createMatureContentPolicyChoiceRow(document.type)],
        flags: EPHEMERAL_FLAGS
      });
      const replyMessage = await interaction.fetchReply().catch(() => null);
      scheduleEphemeralCleanup(interaction, getDocumentEphemeralKey(interaction, documentType) + ":pdf-choice:" + interaction.id, replyMessage?.id || interaction.id);
      return true;
    }

    await sendPdfReply(interaction, document, config, { includeMatureContentPolicy: false });
    const replyMessage = await interaction.fetchReply().catch(() => null);
    scheduleEphemeralCleanup(interaction, getDocumentEphemeralKey(interaction, documentType) + ":pdf:" + interaction.id, replyMessage?.id || interaction.id);
    return true;
  }

  if (interaction.isButton() && interaction.customId === ids.characterPermissionPdf) {
    await sendCharacterPermissionPdfReply(interaction, config);
    const replyMessage = await interaction.fetchReply().catch(() => null);
    scheduleEphemeralCleanup(interaction, getDocumentEphemeralKey(interaction, "character-permission") + ":pdf:" + interaction.id, replyMessage?.id || interaction.id);
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith(ids.pdfOptionPrefix)) {
    const payload = parseActionPayload(interaction.customId, ids.pdfOptionPrefix);
    if (!payload) {
      return false;
    }

    const document = loadCommissionDocument(config, payload.documentType);
    const includeMatureContentPolicy = payload.action === "include-mature";
    await updateWithPdfReply(interaction, document, config, { includeMatureContentPolicy });
    scheduleEphemeralCleanup(interaction, getDocumentEphemeralKey(interaction, payload.documentType) + ":pdf-choice:" + interaction.message?.id, interaction.message?.id || interaction.id);
    return true;
  }

  return false;
}

function loadCommissionDocument(config, documentType) {
  if (documentType === "pricing") {
    const { catalog, sourceHash } = readPricingCatalog(config.pricingCatalogPath);
    return {
      type: "pricing",
      title: catalog.title || "Commission Pricing",
      description: catalog.description || "Review current commission pricing, add-ons, process, payment policy, and usage notes privately.",
      updatedAt: catalog.updatedAt || "",
      sourceHash,
      sections: buildPricingSections(catalog)
    };
  }

  if (documentType === "tos") {
    return readTosDocument(config.tosCatalogPath);
  }

  throw new Error("Unknown commission document type: " + documentType);
}

function readTosDocument(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const catalog = JSON.parse(raw);
  const allSections = (catalog.sections || []).map((section, index) => ({
    id: section.id || "section-" + (index + 1),
    title: section.title || "Section " + (index + 1),
    body: Array.isArray(section.body) ? section.body.join("\n\n") : String(section.body || ""),
    references: Array.isArray(section.references) ? section.references : []
  }));
  const sections = allSections.filter((section) => !isMatureContentPolicySection(section));

  return {
    type: "tos",
    title: catalog.title || "Commission Terms of Service",
    description: catalog.description || "Review commission terms privately.",
    updatedAt: catalog.updatedAt || "",
    sourceHash: crypto.createHash("sha256").update(raw).digest("hex"),
    sections,
    matureContentPolicy: normalizeMatureContentPolicy(catalog.matureContentPolicy, allSections)
  };
}

function getDocumentChannelId(config, documentType) {
  return documentType === "tos" ? config.tosChannelId : config.pricingChannelId;
}

function getCommissionDocumentOpenCustomId(documentType) {
  return ids.openPrefix + documentType;
}

function createDocumentEntryPayload(document) {
  const embed = new EmbedBuilder()
    .setTitle(document.title)
    .setDescription(document.description + "\n\nUse the button below to open a private navigator.")
    .setColor(document.type === "tos" ? 0x5865f2 : 0x7c5cff);

  if (document.updatedAt) {
    embed.setFooter({ text: "Updated " + document.updatedAt });
  }

  return {
    content: "",
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.openPrefix + document.type)
          .setLabel("Open " + (document.type === "tos" ? "ToS" : "Pricing"))
          .setStyle(ButtonStyle.Primary)
      )
    ]
  };
}

function createNavigatorPayload(config, documentType, page) {
  const document = loadCommissionDocument(config, documentType);
  const pageIndex = clamp(Number(page || 0), 0, document.sections.length);

  return {
    embeds: [pageIndex === 0 ? createIndexEmbed(document) : createSectionEmbed(document, pageIndex)],
    components: createNavigatorRows(document, pageIndex)
  };
}

function createIndexEmbed(document) {
  const lines = [
    document.description,
    "",
    "Sections:"
  ];

  document.sections.forEach((section, index) => {
    lines.push((index + 1) + ". " + section.title);
  });

  lines.push("");
  lines.push("You can request a PDF copy from this page or the final section.");

  return new EmbedBuilder()
    .setTitle(document.title + " - Index")
    .setDescription(limitEmbedDescription(lines.join("\n")))
    .setColor(document.type === "tos" ? 0x5865f2 : 0x7c5cff)
    .setFooter({ text: "Page 0 of " + document.sections.length });
}

function createSectionEmbed(document, pageIndex) {
  const section = document.sections[pageIndex - 1];
  return new EmbedBuilder()
    .setTitle(section.title)
    .setDescription(limitEmbedDescription(section.body))
    .setColor(document.type === "tos" ? 0x5865f2 : 0x7c5cff)
    .setFooter({ text: document.title + " - Page " + pageIndex + " of " + document.sections.length });
}

function createNavigatorRows(document, pageIndex) {
  const rows = [];
  const sectionOptions = document.sections.slice(0, 25).map((section, index) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(String(index + 1) + ". " + limitComponentLabel(section.title))
      .setValue(section.id)
  );

  if (sectionOptions.length > 0) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(ids.selectPrefix + document.type)
          .setPlaceholder("Jump to a section")
          .addOptions(sectionOptions)
      )
    );
  }

  const previousPage = Math.max(0, pageIndex - 1);
  const nextPage = Math.min(document.sections.length, pageIndex + 1);
  const navButtons = [
    new ButtonBuilder()
      .setCustomId(ids.navPrefix + document.type + ":index")
      .setLabel("Index")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId(ids.navPrefix + document.type + ":" + previousPage)
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId(ids.navPrefix + document.type + ":" + nextPage)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex >= document.sections.length)
  ];

  if (pageIndex === 0 || pageIndex === document.sections.length) {
    navButtons.push(
      new ButtonBuilder()
        .setCustomId(ids.pdfPrefix + document.type)
        .setLabel("Request PDF")
        .setStyle(ButtonStyle.Primary)
    );

    if (document.type === "tos") {
      navButtons.push(
        new ButtonBuilder()
          .setCustomId(ids.characterPermissionPdf)
          .setLabel("Affirmation Form")
          .setStyle(ButtonStyle.Secondary)
      );
    }
  }

  rows.push(new ActionRowBuilder().addComponents(navButtons));

  const referenceButtons = createReferenceButtons(document, pageIndex);
  if (referenceButtons.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(referenceButtons));
  }

  return rows;
}

function createMatureContentPolicyChoiceRow(documentType) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.pdfOptionPrefix + documentType + ":include-mature")
      .setLabel("Include Policy")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ids.pdfOptionPrefix + documentType + ":skip-mature")
      .setLabel("Skip Policy")
      .setStyle(ButtonStyle.Secondary)
  );
}

function createReferenceButtons(document, pageIndex) {
  if (pageIndex <= 0) {
    return [];
  }

  const section = document.sections[pageIndex - 1];
  return (section.references || [])
    .map((sectionId) => {
      const targetIndex = document.sections.findIndex((item) => item.id === sectionId);
      if (targetIndex < 0) {
        return null;
      }

      return new ButtonBuilder()
        .setCustomId(ids.navPrefix + document.type + ":" + (targetIndex + 1))
        .setLabel("See " + limitComponentLabel(document.sections[targetIndex].title, 70))
        .setStyle(ButtonStyle.Secondary);
    })
    .filter(Boolean)
    .slice(0, 5);
}

function parseActionPayload(customId, prefix) {
  const rest = customId.slice(prefix.length);
  const separatorIndex = rest.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  return {
    documentType: rest.slice(0, separatorIndex),
    action: rest.slice(separatorIndex + 1)
  };
}

function resolvePage(document, action) {
  if (action === "index") {
    return 0;
  }

  const page = Number.parseInt(action, 10);
  return clamp(Number.isFinite(page) ? page : 0, 0, document.sections.length);
}

async function sendPdfReply(interaction, document, config, options = {}) {
  const attachment = new AttachmentBuilder(await createPdfBuffer(document, config, options), {
    name: getPdfFileName(document, options)
  });

  await interaction.reply({
    content: "Here is your copy of " + document.title + ".",
    files: [attachment],
    flags: EPHEMERAL_FLAGS
  });
}

async function sendCharacterPermissionPdfReply(interaction, config, input = {}) {
  const attachment = new AttachmentBuilder(await createCharacterPermissionPdfBuffer(input, config), {
    name: getCharacterPermissionPdfFileName(input)
  });

  await interaction.reply({
    content: "Here is a printable " + CHARACTER_PERMISSION_TITLE + ".",
    files: [attachment],
    flags: EPHEMERAL_FLAGS
  });
}

async function updateWithPdfReply(interaction, document, config, options = {}) {
  const attachment = new AttachmentBuilder(await createPdfBuffer(document, config, options), {
    name: getPdfFileName(document, options)
  });
  const matureText = options.includeMatureContentPolicy ? " with the Mature Content Policy included" : "";

  await interaction.update({
    content: "Here is your copy of " + document.title + matureText + ".",
    embeds: [],
    components: [],
    files: [attachment]
  });
}

function getPdfFileName(document, options = {}) {
  const suffix = options.includeMatureContentPolicy ? "-with-mature-content-policy" : "";
  return slugify(document.title + suffix) + ".pdf";
}

function getCharacterPermissionPdfFileName(input = {}) {
  const suffix = input.characterName ? "-" + input.characterName : "";
  return slugify(CHARACTER_PERMISSION_TITLE + suffix) + ".pdf";
}

function getThirdPartyCharacterPermissionPdfFileName(input = {}) {
  const suffix = input.characterName ? "-" + input.characterName : "";
  return slugify(THIRD_PARTY_CHARACTER_PERMISSION_TITLE + suffix) + ".pdf";
}

function getCommissionRequestPdfFileName(input = {}) {
  const commission = input.commission || input;
  const suffix = commission.id ? "-" + commission.id : "";
  return slugify(COMMISSION_REQUEST_TITLE + suffix) + ".pdf";
}

function getDocumentEphemeralKey(interaction, documentType) {
  const userId = interaction.user?.id || "unknown";
  return "commission-doc:" + userId + ":" + documentType;
}

function scheduleEphemeralCleanup(interaction, key, messageId) {
  const existing = ephemeralCleanupTimers.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    if (existing.messageId && messageId && existing.messageId !== messageId) {
      existing.deleteReply().catch(() => null);
    }
  }

  const timer = setTimeout(() => {
    ephemeralCleanupTimers.delete(key);
    interaction.deleteReply().catch(() => null);
  }, EPHEMERAL_DELETE_AFTER_MS);

  timer.unref?.();
  ephemeralCleanupTimers.set(key, {
    timer,
    messageId,
    deleteReply: () => interaction.deleteReply().catch(() => null)
  });
}

function createPdfBuffer(document, config, options = {}) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "LETTER",
      margin: 54,
      bufferPages: true,
      info: {
        Title: document.title,
        Subject: document.description || ""
      }
    });
    const chunks = [];

    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    try {
      const logoPath = getPdfLogoPath(pdf, config);
      const watermarkOptions = getPdfWatermarkOptions(pdf, logoPath);
      writePdfDocument(pdf, document, options);
      addPdfPageOverlays(pdf, watermarkOptions);
      pdf.end();
    } catch (error) {
      reject(error);
    }
  });
}

function createCharacterPermissionPdfBuffer(input = {}, config = {}) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "LETTER",
      margin: 54,
      bufferPages: true,
      info: {
        Title: CHARACTER_PERMISSION_TITLE,
        Subject: "Client character permission affirmation"
      }
    });
    const chunks = [];

    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    try {
      const logoPath = getPdfLogoPath(pdf, config);
      const watermarkOptions = getPdfWatermarkOptions(pdf, logoPath);
      writeCharacterPermissionPdf(pdf, input);
      addPdfPageOverlays(pdf, watermarkOptions);
      pdf.end();
    } catch (error) {
      reject(error);
    }
  });
}

function createThirdPartyCharacterPermissionPdfBuffer(input = {}, config = {}) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "LETTER",
      margin: 54,
      bufferPages: true,
      info: {
        Title: THIRD_PARTY_CHARACTER_PERMISSION_TITLE,
        Subject: "Commission character owner permission release"
      }
    });
    const chunks = [];

    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    try {
      const logoPath = getPdfLogoPath(pdf, config);
      const watermarkOptions = getPdfWatermarkOptions(pdf, logoPath);
      writeThirdPartyCharacterPermissionPdf(pdf, input);
      addPdfPageOverlays(pdf, watermarkOptions);
      pdf.end();
    } catch (error) {
      reject(error);
    }
  });
}

function createCommissionRequestPdfBuffer(input = {}, config = {}) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "LETTER",
      margin: 54,
      bufferPages: true,
      info: {
        Title: COMMISSION_REQUEST_TITLE,
        Subject: "Commission request submission"
      }
    });
    const chunks = [];

    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    try {
      const logoPath = getPdfLogoPath(pdf, config);
      const watermarkOptions = getPdfWatermarkOptions(pdf, logoPath);
      writeCommissionRequestPdf(pdf, input);
      addPdfPageOverlays(pdf, watermarkOptions);
      pdf.end();
    } catch (error) {
      reject(error);
    }
  });
}

function writeCharacterPermissionPdf(pdf, input = {}) {
  const ownerName = pdfFillValue(input.ownerName, 34);
  const characterName = pdfFillValue(input.characterName, 32);
  const clientName = pdfFillValue(input.clientName, 32);
  const contentType = pdfFillValue(input.contentType, 42);
  const date = pdfFillValue(input.date, 22);
  const typedAgreement = String(input.typedAgreement || "").trim();
  const submittedBy = String(input.submittedBy || "").trim();
  const submittedUserId = String(input.submittedUserId || "").trim();

  pdf.fillColor("#111827");
  pdf.font("Helvetica-Bold").fontSize(20).text(CHARACTER_PERMISSION_TITLE, {
    lineGap: 2
  });
  pdf.moveDown(1.4);

  writeConsentParagraph(
    pdf,
    "I affirm that I have permission from the owner of any character, design, or concept included in this commission that I do not personally own."
  );
  pdf.moveDown(0.35);
  pdf.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("For any third-party character included in this request, I confirm that:");
  pdf.moveDown(0.35);
  writePdfBody(pdf, [
    "- The character owner has given me permission to include their character in this commission.",
    "- The character owner understands the general nature of the requested artwork.",
    "- I have not misrepresented the character, the owner's consent, or the intended use of the finished artwork.",
    "- I understand that Anthro-Corp Studios / Dodger may request additional confirmation from the character owner if needed."
  ].join("\n"));
  pdf.moveDown(0.8);

  pdf.font("Helvetica").fontSize(11).fillColor("#1f2937").text("Character owner name or screen name: " + ownerName, {
    lineGap: 4
  });
  pdf.moveDown(0.4);
  pdf.text("Character name: " + characterName, { lineGap: 4 });
  pdf.moveDown(0.4);
  pdf.text("Requested content type: " + contentType, { lineGap: 4 });
  pdf.moveDown(0.4);
  pdf.text("Client name or screen name: " + clientName, { lineGap: 4 });
  pdf.moveDown(0.4);
  pdf.text("Date: " + date, { lineGap: 4 });

  pdf.moveDown(1.4);
  if (typedAgreement) {
    pdf.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text("Typed agreement / signature");
    pdf.moveDown(0.25);
    pdf.font("Helvetica").fontSize(10).fillColor("#1f2937").text("Typed value: " + typedAgreement);
    if (submittedBy || submittedUserId) {
      pdf.text("Submitted by Discord user: " + [submittedBy, submittedUserId ? "ID " + submittedUserId : ""].filter(Boolean).join(" / "));
    }
    if (input.signedAt) {
      pdf.text("Signed at: " + input.signedAt);
    }
  } else {
    pdf.font("Helvetica").fontSize(11).fillColor("#1f2937").text("Client signature: " + "_".repeat(42), { lineGap: 4 });
  }
}

function writeThirdPartyCharacterPermissionPdf(pdf, input = {}) {
  const ownerName = pdfFillValue(input.ownerName, 34);
  const characterName = pdfFillValue(input.characterName, 32);
  const clientName = pdfFillValue(input.clientName, 32);
  const contentType = pdfFillValue(input.contentType, 42);
  const ownerContact = pdfFillValue(input.ownerContact, 42);
  const date = pdfFillValue(input.date, 22);

  pdf.fillColor("#111827");
  pdf.font("Helvetica-Bold").fontSize(20).text(THIRD_PARTY_CHARACTER_PERMISSION_TITLE, {
    lineGap: 2
  });
  pdf.moveDown(1.4);

  writeConsentParagraph(
    pdf,
    "I, " + ownerName + ", confirm that I own or control the character/design known as " + characterName + "."
  );
  writeConsentParagraph(
    pdf,
    "I give permission for " + clientName + " to commission artwork of this character from Anthro-Corp Studios / Dodger."
  );
  writeConsentParagraph(
    pdf,
    "I understand that the commissioned artwork may include the following general content type: " + contentType + "."
  );
  writeConsentParagraph(
    pdf,
    "I understand that this permission applies only to this specific commission unless otherwise agreed in writing."
  );

  pdf.moveDown(0.6);
  pdf.font("Helvetica").fontSize(11).fillColor("#1f2937").text("Character owner contact or handle: " + ownerContact, {
    lineGap: 4
  });
  pdf.moveDown(0.6);
  pdf.text("Date: " + date, { lineGap: 4 });

  pdf.moveDown(2);
  pdf.text("Character owner signature: " + "_".repeat(38), { lineGap: 4 });
}

function writeCommissionRequestPdf(pdf, input = {}) {
  const commission = input.commission || input;
  const characterPermission = parseJsonObject(commission.characterPermissionJson) || commission.characterPermission || null;
  const characterDetails = parseJsonObject(commission.characterDetailsJson) || commission.characterDetails || {};

  pdf.fillColor("#111827");
  pdf.font("Helvetica-Bold").fontSize(20).text(COMMISSION_REQUEST_TITLE, {
    lineGap: 2
  });
  pdf.moveDown(0.45);
  pdf.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Generated " + new Date().toISOString());
  pdf.moveDown(1);

  writePdfSectionTitle(pdf, "Client and Terms Agreement");
  writePdfKeyValue(pdf, "Client", input.preferredHandle || commission.preferredHandle || "Not provided");
  writePdfKeyValue(pdf, "Discord user", [commission.termsAcceptedUserName, commission.termsAcceptedUserId ? "ID " + commission.termsAcceptedUserId : ""].filter(Boolean).join(" / ") || "Not provided");
  writePdfKeyValue(pdf, "Terms accepted", commission.termsAcceptedAt || "Not provided");
  writePdfKeyValue(pdf, "Acceptance method", "Typed AGREE to accept the commission Terms of Service in Discord.");

  writePdfSectionTitle(pdf, "Commission Details");
  writePdfKeyValue(pdf, "Commission type", commission.commissionType);
  writePdfKeyValue(pdf, "Completion level", commission.completionLevel);
  writePdfKeyValue(pdf, "Content rating", commission.contentRating);
  writePdfKeyValue(pdf, "Private commission", truthyValue(commission.privateCommission) ? "Yes" : "No");
  writePdfKeyValue(pdf, "Availability", input.availabilityText || commission.availabilityText || "Not provided");

  writePdfSectionTitle(pdf, "Character Ownership");
  writePdfKeyValue(pdf, "Ownership answer", commission.characterOwnershipLabel || "Not provided");
  writePdfKeyValue(pdf, "Total characters", valueOrFallback(commission.characterCount, characterDetails.characterCount, "Not provided"));
  writePdfKeyValue(pdf, "Owned by commissioner", valueOrFallback(commission.ownedCharacterCount, characterDetails.ownedCharacterCount, "Not provided"));
  if (Array.isArray(characterDetails.ownedCharacterNames) && characterDetails.ownedCharacterNames.length > 0) {
    writePdfKeyValue(pdf, "Commissioner-owned characters", characterDetails.ownedCharacterNames.join(", "));
  }
  if (characterDetails.thirdPartyCharacters) {
    pdf.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text("Third-party character details:");
    writePdfBody(pdf, characterDetails.thirdPartyCharacters);
  }
  if (isGeneratedCharacterPermission(characterPermission)) {
    writePdfKeyValue(pdf, "Client affirmation", "Signed through Discord");
    writePdfKeyValue(pdf, "Client name", characterPermission.clientName);
    writePdfKeyValue(pdf, "Requested content type", characterPermission.contentType);
    writePdfKeyValue(pdf, "Typed agreement", characterPermission.typedAgreement);
    writePdfKeyValue(pdf, "Permission submitted by", [characterPermission.submittedBy, characterPermission.submittedUserId ? "ID " + characterPermission.submittedUserId : ""].filter(Boolean).join(" / "));
    writePdfKeyValue(pdf, "Signed at", characterPermission.signedAt || "Not provided");
  } else if (hasLegacyCharacterPermission(characterPermission)) {
    writePdfKeyValue(pdf, "Client affirmation", "Completed through Discord");
    writePdfKeyValue(pdf, "Character owner", characterPermission.ownerName);
    writePdfKeyValue(pdf, "Character", characterPermission.characterName);
    writePdfKeyValue(pdf, "Requested content type", characterPermission.contentType);
    writePdfKeyValue(pdf, "Client name", characterPermission.clientName);
    writePdfKeyValue(pdf, "Typed agreement", characterPermission.typedAgreement);
    writePdfKeyValue(pdf, "Permission submitted by", [characterPermission.submittedBy, characterPermission.submittedUserId ? "ID " + characterPermission.submittedUserId : ""].filter(Boolean).join(" / "));
  }

  writePdfSectionTitle(pdf, "Request Details");
  writePdfBody(pdf, commission.requestDetails || "Not provided");
}

function writePdfSectionTitle(pdf, title) {
  pdf.moveDown(0.9);
  pdf.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text(title, { lineGap: 2 });
  pdf.moveDown(0.3);
}

function writePdfKeyValue(pdf, label, value) {
  pdf.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(label + ": ", {
    continued: true
  });
  pdf.font("Helvetica").fontSize(10).fillColor("#1f2937").text(cleanPdfText(value) || "Not provided", {
    lineGap: 3
  });
}

function valueOrFallback(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function hasLegacyCharacterPermission(permission) {
  if (!permission || typeof permission !== "object") {
    return false;
  }

  return Boolean(permission.ownerName || permission.characterName || permission.clientName || permission.typedAgreement || permission.submittedUserId);
}

function isGeneratedCharacterPermission(permission) {
  return Boolean(permission && typeof permission === "object" && permission.generatedIntakeAffirmation);
}

function truthyValue(value) {
  return value === true || value === 1 || value === "1";
}

function parseJsonObject(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeConsentParagraph(pdf, text) {
  pdf.font("Helvetica").fontSize(11).fillColor("#1f2937").text(text, {
    lineGap: 5
  });
  pdf.moveDown(0.85);
}

function pdfFillValue(value, blankLength) {
  const text = cleanPdfText(value).trim();
  return text || "_".repeat(blankLength);
}

function writePdfDocument(pdf, document, options = {}) {
  pdf.fillColor("#111827");
  pdf.font("Helvetica-Bold").fontSize(20).text(document.title, {
    lineGap: 2
  });

  if (document.updatedAt) {
    pdf.moveDown(0.25);
    pdf.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Updated " + document.updatedAt);
  }

  if (document.description) {
    pdf.moveDown(1);
    pdf.font("Helvetica").fontSize(10).fillColor("#374151").text(cleanPdfText(document.description), {
      lineGap: 3
    });
  }

  pdf.moveDown(1.25);

  getPrintableSections(document, options).forEach((section, index) => {
    pdf.font("Helvetica-Bold").fontSize(13).fillColor("#111827").text((index + 1) + ". " + section.title, {
      lineGap: 2
    });
    pdf.moveDown(0.35);
    writePdfBody(pdf, section.body);
    pdf.moveDown(0.9);
  });
}

function getPrintableSections(document, options = {}) {
  const sections = Array.isArray(document.sections) ? document.sections.slice() : [];
  if (options.includeMatureContentPolicy && hasMatureContentPolicy(document)) {
    sections.push(...getMatureContentPolicySections(document.matureContentPolicy));
  }

  return sections;
}

function normalizeMatureContentPolicy(policy, documentSections = []) {
  const sourceSections = policy && typeof policy === "object" && Array.isArray(policy.sections)
    ? policy.sections
    : documentSections.filter(isMatureContentPolicySection);

  if ((!policy || typeof policy !== "object") && sourceSections.length === 0) {
    return null;
  }

  const sections = Array.isArray(sourceSections)
    ? sourceSections.map((section, index) => ({
      id: section.id || "mature-content-policy-" + (index + 1),
      title: section.title || "Mature Content Policy",
      body: Array.isArray(section.body) ? section.body.join("\n\n") : String(section.body || ""),
      references: []
    }))
    : [];

  return {
    title: policy?.title || sourceSections[0]?.title || "Mature Content Policy",
    description: policy?.description || "",
    sections
  };
}

function isMatureContentPolicySection(section) {
  const id = String(section?.id || "").trim().toLowerCase();
  const title = String(section?.title || "").trim().toLowerCase();
  return id === "mature-content-policy" || title === "mature content policy";
}

function hasMatureContentPolicy(document) {
  const policy = document?.matureContentPolicy;
  if (!policy) {
    return false;
  }

  return Boolean(policy.description || policy.sections?.some((section) => section.title || section.body));
}

function getMatureContentPolicySections(policy) {
  const sections = [];
  const lines = [];

  if (policy.description) {
    lines.push(policy.description);
  }

  if (lines.length > 0) {
    sections.push({
      id: "mature-content-policy-overview",
      title: policy.title || "Mature Content Policy",
      body: lines.join("\n\n")
    });
  }

  for (const section of policy.sections || []) {
    sections.push({
      id: section.id,
      title: section.title,
      body: section.body
    });
  }

  return sections;
}

function writePdfBody(pdf, value) {
  const lines = String(value || "").split(/\r?\n/);

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      pdf.moveDown(0.45);
      return;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      pdf.moveDown(0.25);
      pdf.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(cleanPdfText(headingMatch[2]), {
        lineGap: 2
      });
      pdf.moveDown(0.2);
      return;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    const numberedMatch = line.match(/^(\d+\.)\s+(.+)$/);
    const quoteMatch = line.match(/^>\s+(.+)$/);
    const multilineQuoteMatch = line.match(/^>>>\s+(.+)$/);
    const subtextMatch = line.match(/^-#\s+(.+)$/);

    pdf.font(quoteMatch || multilineQuoteMatch || subtextMatch ? "Helvetica-Oblique" : "Helvetica")
      .fontSize(subtextMatch ? 8 : 10)
      .fillColor(quoteMatch || multilineQuoteMatch || subtextMatch ? "#4b5563" : "#1f2937");

    if (bulletMatch) {
      pdf.text("- " + cleanPdfText(bulletMatch[1]), { lineGap: 3, indent: 12 });
      return;
    }

    if (numberedMatch) {
      pdf.text(numberedMatch[1] + " " + cleanPdfText(numberedMatch[2]), { lineGap: 3, indent: 12 });
      return;
    }

    pdf.text(cleanPdfText((quoteMatch || multilineQuoteMatch || subtextMatch)?.[1] || line), { lineGap: 3 });
  });
}

function addPdfPageOverlays(pdf, watermarkOptions) {
  const range = pdf.bufferedPageRange();

  for (let index = 0; index < range.count; index++) {
    pdf.switchToPage(range.start + index);
    drawPdfWatermark(pdf, watermarkOptions);
    drawPdfFooter(pdf, index + 1, range.count);
  }
}

function drawPdfWatermark(pdf, watermarkOptions) {
  if (!watermarkOptions) {
    return;
  }

  pdf.save();
  pdf.opacity(0.15);
  pdf.image(watermarkOptions.logoPath, watermarkOptions.x, watermarkOptions.y, {
    width: watermarkOptions.width,
    height: watermarkOptions.height
  });
  pdf.restore();
}

function drawPdfFooter(pdf, pageNumber, pageCount) {
  const margin = 54;
  const y = pdf.page.height - 38;

  pdf.save();
  pdf.font("Helvetica").fontSize(8).fillColor("#9ca3af").text("Page " + pageNumber + " of " + pageCount, margin, y, {
    lineBreak: false
  });
  pdf.restore();
}

function getPdfLogoPath(pdf, config) {
  const logoPath = String(config?.pdfLogoPath || "").trim();
  if (!logoPath) {
    return "";
  }

  let stats;
  try {
    stats = fs.statSync(logoPath);
  } catch {
    return "";
  }

  if (!stats.isFile()) {
    return "";
  }

  try {
    pdf.openImage(logoPath);
  } catch (error) {
    console.warn("[Commission Portal] PDF logo is not usable and will be skipped:", error.message);
    return "";
  }

  return logoPath;
}

function getPdfWatermarkOptions(pdf, logoPath) {
  if (!logoPath) {
    return null;
  }

  let image;
  try {
    image = pdf.openImage(logoPath);
  } catch (error) {
    console.warn("[Commission Portal] Failed to prepare PDF watermark:", error.message);
    return null;
  }

  const maxWidth = pdf.page.width * 0.72;
  const maxHeight = pdf.page.height * 0.62;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  return {
    logoPath,
    width,
    height,
    x: (pdf.page.width - width) / 2,
    y: (pdf.page.height - height) / 2
  };
}

function cleanPdfText(value) {
  return String(value || "")
    .replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, ":$1:")
    .replace(/```[a-zA-Z0-9_-]*\s*/g, "")
    .replace(/```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\|\|([^|]+)\|\|/g, "$1");
}

function limitEmbedDescription(value) {
  const text = String(value || "").trim();
  return text.length <= 4096 ? text : text.slice(0, 4093) + "...";
}

function limitComponentLabel(value, maxLength = 92) {
  const text = String(value || "").trim();
  return text.length <= maxLength ? text : text.slice(0, maxLength - 3) + "...";
}

function slugify(value) {
  return String(value || "document")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  createCharacterPermissionPdfBuffer,
  createCommissionRequestPdfBuffer,
  createThirdPartyCharacterPermissionPdfBuffer,
  getCommissionRequestPdfFileName,
  getCharacterPermissionPdfFileName,
  getThirdPartyCharacterPermissionPdfFileName,
  getCommissionDocumentOpenCustomId,
  handleCommissionDocumentInteraction,
  publishCommissionDocument,
  publishCommissionDocuments,
  startCommissionDocumentPublisher
};
