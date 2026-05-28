const path = require("path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials
} = require("discord.js");
const {
  BOARD_CONFIG,
  getRedeemConfig,
  getRedeemIdFromCustomId,
  getVisibleRedeemEntries
} = require("./redeems");

require("dotenv").config({
  path: path.join(__dirname, "../.env")
});

const token = process.env.DISCORD_TOKEN;
const streamToolsBaseUrl = (process.env.STREAMTOOLS_BASE_URL || "http://127.0.0.1:3030").replace(/\/+$/, "");
const streamToolsBotSecret = process.env.STREAMTOOLS_BOT_SECRET || "";
const commandPrefix = process.env.DISCORD_COMMAND_PREFIX || "!";
const forwardAllMessages = parseBoolean(process.env.DISCORD_FORWARD_ALL_MESSAGES, false);
const forwardCommands = parseBoolean(process.env.DISCORD_FORWARD_COMMANDS, true);

if (!token) {
  console.error("[Discord Redeem Bot] Missing DISCORD_TOKEN.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log("[Discord Redeem Bot] Logged in as " + readyClient.user.tag + ".");
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "redeems") {
      await interaction.reply({
        embeds: [createRedeemBoardEmbed()],
        components: createRedeemButtonRows()
      });

      return;
    }

    if (interaction.isButton()) {
      await handleRedeemButton(interaction);
    }
  } catch (error) {
    console.error("[Discord Redeem Bot] Interaction failed:", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Redeem received, but the stream bridge did not respond.",
        ephemeral: true
      });
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) {
      return;
    }

    const content = String(message.content || "").trim();
    const mediaInfo = getMessageMediaInfo(message);

    if (!content && !mediaInfo.hasMedia) {
      return;
    }

    const isCommand = content.startsWith(commandPrefix);
    const allowedChannelIds = parseCsv(process.env.DISCORD_RELAY_CHANNEL_IDS || "");

    if (allowedChannelIds.length > 0 && !allowedChannelIds.includes(message.channelId)) {
      return;
    }

    if (!forwardAllMessages && !(forwardCommands && isCommand)) {
      return;
    }

    const commandText = isCommand ? content.slice(commandPrefix.length).trim() : "";
    const command = commandText ? commandText.split(/\s+/)[0].toLowerCase() : "";
    const commandArgs = commandText ? commandText.split(/\s+/).slice(1).join(" ") : "";

    const payload = {
      source: "discord",
      type: isCommand ? "command" : "message",
      content,
      hasMedia: mediaInfo.hasMedia,
      attachmentCount: mediaInfo.attachmentCount,
      stickerCount: mediaInfo.stickerCount,
      embedCount: mediaInfo.embedCount,
      mediaTypes: mediaInfo.mediaTypes.join(","),
      isCommand,
      command,
      commandArgs,
      userName: message.member?.displayName || message.author.globalName || message.author.username,
      userId: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
      messageId: message.id,
      timestamp: new Date().toISOString()
    };

    console.log("[Discord Redeem Bot] Message forwarded:", payload);
    await postMessageToStreamTools(payload);
  } catch (error) {
    console.error("[Discord Redeem Bot] Message relay failed:", error);
  }
});

async function handleRedeemButton(interaction) {
  const redeemId = getRedeemIdFromCustomId(interaction.customId);
  const redeemConfig = getRedeemConfig(redeemId);

  if (!redeemConfig || !redeemConfig.visible) {
    await interaction.reply({
      content: "Unknown redeem.",
      ephemeral: true
    });

    return;
  }

  const payload = {
    source: "discord",
    type: "redeem",
    redeemId,
    redeemLabel: redeemConfig.label,
    redeemStyle: redeemConfig.style,
    userName: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: interaction.message.id,
    timestamp: new Date().toISOString()
  };

  console.log("[Discord Redeem Bot] Redeem clicked:", payload);

  try {
    const streamToolsResponse = await postRedeemToStreamTools(payload);
    console.log("[Discord Redeem Bot] StreamTools redeem response:", streamToolsResponse);

    await interaction.reply({
      content: "Redeem received: " + redeemConfig.label,
      ephemeral: true
    });
  } catch (error) {
    console.error("[Discord Redeem Bot] StreamTools POST failed:", error);

    await interaction.reply({
      content: "Redeem received, but the stream bridge did not respond.",
      ephemeral: true
    });
  }
}

function createRedeemBoardEmbed() {
  const embed = new EmbedBuilder()
    .setTitle(BOARD_CONFIG.title)
    .setDescription(BOARD_CONFIG.description)
    .setColor(BOARD_CONFIG.color);

  if (BOARD_CONFIG.footerText) {
    embed.setFooter({ text: BOARD_CONFIG.footerText });
  }

  if (BOARD_CONFIG.thumbnailUrl) {
    embed.setThumbnail(BOARD_CONFIG.thumbnailUrl);
  }

  return embed;
}

function createRedeemButtonRows() {
  const buttons = getVisibleRedeemEntries().map(([redeemId, redeemConfig]) => {
    const button = new ButtonBuilder()
      .setCustomId("redeem:" + redeemId)
      .setLabel(redeemConfig.label)
      .setStyle(resolveButtonStyle(redeemConfig.style))
      .setDisabled(redeemConfig.disabled);

    const emoji = normalizeEmoji(redeemConfig.emoji);
    if (emoji) {
      button.setEmoji(emoji);
    }

    return button;
  });

  const rows = [];
  const maxButtonsPerRow = clampNumber(BOARD_CONFIG.maxButtonsPerRow, 1, 5);

  for (let i = 0; i < buttons.length && rows.length < 5; i += maxButtonsPerRow) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + maxButtonsPerRow)));
  }

  return rows;
}

function resolveButtonStyle(style) {
  const normalized = String(style || "").trim().toLowerCase();

  if (normalized === "primary" || normalized === "blue") {
    return ButtonStyle.Primary;
  }

  if (normalized === "success" || normalized === "green") {
    return ButtonStyle.Success;
  }

  if (normalized === "danger" || normalized === "red") {
    return ButtonStyle.Danger;
  }

  return ButtonStyle.Secondary;
}

function normalizeEmoji(emoji) {
  if (!emoji) {
    return null;
  }

  if (typeof emoji === "object") {
    return emoji;
  }

  const text = String(emoji).trim();
  const customEmojiMatch = text.match(/^<(?:(a):)?([^:>]+):(\d+)>$/);

  if (customEmojiMatch) {
    return {
      animated: customEmojiMatch[1] === "a",
      name: customEmojiMatch[2],
      id: customEmojiMatch[3]
    };
  }

  if (/^\d+$/.test(text)) {
    return {
      id: text
    };
  }

  return {
    name: text
  };
}

function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return max;
  }

  return Math.min(Math.max(number, min), max);
}

async function postMessageToStreamTools(payload) {
  return postJsonToStreamTools("/api/discord/message", payload);
}

async function postRedeemToStreamTools(payload) {
  return postJsonToStreamTools("/api/discord/redeem", payload);
}

async function postJsonToStreamTools(pathname, payload) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (streamToolsBotSecret) {
    headers["X-StreamTools-Bot-Secret"] = streamToolsBotSecret;
  }

  const response = await fetch(streamToolsBaseUrl + pathname, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error("StreamTools responded " + response.status + ": " + responseText);
  }

  return response.json();
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function getMessageMediaInfo(message) {
  const attachments = Array.from(message.attachments?.values?.() || []);
  const stickers = Array.from(message.stickers?.values?.() || []);
  const embeds = Array.isArray(message.embeds) ? message.embeds : [];
  const mediaTypes = [];

  if (attachments.length > 0) {
    mediaTypes.push("attachment");
  }

  if (stickers.length > 0) {
    mediaTypes.push("sticker");
  }

  if (embeds.length > 0) {
    mediaTypes.push("embed");
  }

  return {
    hasMedia: mediaTypes.length > 0,
    attachmentCount: attachments.length,
    stickerCount: stickers.length,
    embedCount: embeds.length,
    mediaTypes
  };
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

client.login(token);
