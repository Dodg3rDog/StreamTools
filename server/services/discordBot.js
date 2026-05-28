const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");
const {
  BOARD_CONFIG,
  getRedeemConfig,
  getRedeemIdFromCustomId,
  getVisibleRedeemEntries
} = require("./discordRedeems");
const {
  handleDiscordMessageEvent,
  handleDiscordRedeemEvent
} = require("./discordEvents");
const {
  addRelayChannel,
  getRelayChannelIds,
  isRelayChannelAllowed,
  removeRelayChannel
} = require("./discordRelayChannels");

let client = null;

async function startDiscordBot() {
  if (!parseBoolean(process.env.ENABLE_DISCORD_BOT, false)) {
    console.log("[Discord Bot] Disabled. Set ENABLE_DISCORD_BOT=true to start it with StreamTools.");
    return null;
  }

  const token = process.env.DISCORD_TOKEN;

  if (!token) {
    console.warn("[Discord Bot] ENABLE_DISCORD_BOT=true but DISCORD_TOKEN is missing.");
    return null;
  }

  if (client) {
    return client;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log("[Discord Bot] Logged in as " + readyClient.user.tag + ".");

    if (parseBoolean(process.env.DISCORD_REGISTER_COMMANDS_ON_START, true)) {
      await registerDiscordCommands().catch((error) => {
        console.warn("[Discord Bot] Slash command registration failed:", error.message);
      });
    }
  });

  client.on(Events.InteractionCreate, onInteractionCreate);
  client.on(Events.MessageCreate, onMessageCreate);

  await client.login(token);
  return client;
}

async function registerDiscordCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId || !guildId) {
    console.warn("[Discord Bot] Skipping command registration. DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID is missing.");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("redeems")
      .setDescription("Post the Night Howlers redeem board.")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("howlerstream")
      .setDescription("Allow this channel to relay Discord messages into StreamTools.")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("howlerstop")
      .setDescription("Stop this channel from relaying Discord messages into StreamTools.")
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log("[Discord Bot] Registered /redeems.");
}

async function onInteractionCreate(interaction) {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "redeems") {
      await interaction.reply({
        embeds: [createRedeemBoardEmbed()],
        components: createRedeemButtonRows()
      });

      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "howlerstream") {
      await handleHowlerStreamCommand(interaction);
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "howlerstop") {
      await handleHowlerStopCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleRedeemButton(interaction);
    }
  } catch (error) {
    console.error("[Discord Bot] Interaction failed:", error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Redeem received, but the stream bridge did not respond.",
        ephemeral: true
      });
    }
  }
}

async function onMessageCreate(message) {
  try {
    if (message.author.bot) {
      return;
    }

    const content = String(message.content || "").trim();
    const mediaInfo = getMessageMediaInfo(message);

    if (!content && !mediaInfo.hasMedia) {
      return;
    }

    const commandPrefix = process.env.DISCORD_COMMAND_PREFIX || "!";
    const forwardAllMessages = parseBoolean(process.env.DISCORD_FORWARD_ALL_MESSAGES, false);
    const forwardCommands = parseBoolean(process.env.DISCORD_FORWARD_COMMANDS, true);

    if (!isRelayChannelAllowed(message.channelId)) {
      return;
    }

    const isCommand = content.startsWith(commandPrefix);

    if (!forwardAllMessages && !(forwardCommands && isCommand)) {
      return;
    }

    const commandText = isCommand ? content.slice(commandPrefix.length).trim() : "";
    const command = commandText ? commandText.split(/\s+/)[0].toLowerCase() : "";
    const commandArgs = commandText ? commandText.split(/\s+/).slice(1).join(" ") : "";

    await handleDiscordMessageEvent({
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
    });
  } catch (error) {
    console.error("[Discord Bot] Message relay failed:", error);
  }
}

async function handleHowlerStreamCommand(interaction) {
  if (!memberCanControlRelay(interaction.member)) {
    await interaction.reply({
      content: "You do not have permission to change the Howler relay channels.",
      ephemeral: true
    });

    return;
  }

  const channelIds = addRelayChannel(interaction.channelId);

  await interaction.reply({
    content: "Howler relay enabled for this channel. Active relay channels: " + channelIds.join(", "),
    ephemeral: true
  });
}

async function handleHowlerStopCommand(interaction) {
  if (!memberCanControlRelay(interaction.member)) {
    await interaction.reply({
      content: "You do not have permission to change the Howler relay channels.",
      ephemeral: true
    });

    return;
  }

  const channelIds = removeRelayChannel(interaction.channelId);
  const activeText = channelIds.length > 0 ? channelIds.join(", ") : "none";

  await interaction.reply({
    content: "Howler relay disabled for this channel. Active relay channels: " + activeText,
    ephemeral: true
  });
}

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

  const result = await handleDiscordRedeemEvent({
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
  });

  console.log("[Discord Bot] Redeem handled:", result.streamerBot);

  await interaction.reply({
    content: result.streamerBot.ok
      ? "Redeem received: " + redeemConfig.label
      : "Redeem received, but the stream bridge did not respond.",
    ephemeral: true
  });
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

function memberCanControlRelay(member) {
  const allowedRoleNames = parseCsv(process.env.DISCORD_RELAY_CONTROL_ROLE_NAMES || "");
  const allowedRoleIds = parseCsv(process.env.DISCORD_RELAY_CONTROL_ROLE_IDS || "");

  if (allowedRoleNames.length === 0 && allowedRoleIds.length === 0) {
    return false;
  }

  const roles = member?.roles?.cache;
  if (!roles) {
    return false;
  }

  return roles.some((role) =>
    allowedRoleIds.includes(role.id) ||
    allowedRoleNames.includes(role.name)
  );
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  registerDiscordCommands,
  startDiscordBot
};
