const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const {
  createCommissionCleanupCommand,
  createCommissionManualEntryCommand,
  createCommissionPublishPricingCommand,
  createCommissionSetupCommand,
  handleCommissionPortalInteraction,
  handleCommissionPortalMessageCreate,
  handleCommissionPortalReactionAdd,
  handleCommissionPortalThreadUpdate
} = require("./commissionPortal");
const { getCommissionConfig } = require("./commissionPortal/config");
const { startCommissionPricingPublisher } = require("./commissionPortal/pricing");
const { triggerStreamerBot } = require("./streamerbot");
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

const redeemInputModalPrefix = "redeem_input:";
const redeemInputFieldId = "redeemInput";

let client = null;
let voicePointTimer = null;
let voicePointTickActive = false;
let voicePointSkipLogged = false;

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
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log("[Discord Bot] Logged in as " + readyClient.user.tag + ".");

    if (parseBoolean(process.env.DISCORD_REGISTER_COMMANDS_ON_START, true)) {
      await registerDiscordCommands().catch((error) => {
        console.warn("[Discord Bot] Slash command registration failed:", error.message);
      });
    }

    startCommissionPricingPublisher(readyClient, getCommissionConfig());
    startVoicePointTimer();
  });

  client.on(Events.InteractionCreate, onInteractionCreate);
  client.on(Events.MessageCreate, onMessageCreate);
  client.on(Events.MessageReactionAdd, onMessageReactionAdd);
  client.on(Events.ThreadUpdate, onThreadUpdate);

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
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel to allow. Defaults to the current channel.")
          .setRequired(false)
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("howlerstop")
      .setDescription("Stop this channel from relaying Discord messages into StreamTools.")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel to remove. Defaults to the current channel.")
          .setRequired(false)
      )
      .toJSON(),
    createCommissionSetupCommand(),
    createCommissionCleanupCommand(),
    createCommissionManualEntryCommand(),
    createCommissionPublishPricingCommand()
  ];

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log("[Discord Bot] Registered Discord slash commands.");
}

async function onInteractionCreate(interaction) {
  try {
    if (await handleCommissionPortalInteraction(interaction)) {
      return;
    }

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
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith(redeemInputModalPrefix)) {
      await handleRedeemInputModal(interaction);
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

async function onThreadUpdate(oldThread, newThread) {
  try {
    await handleCommissionPortalThreadUpdate(oldThread, newThread);
  } catch (error) {
    console.error("[Discord Bot] Thread update handling failed:", error);
  }
}

async function onMessageReactionAdd(reaction, user) {
  try {
    await handleCommissionPortalReactionAdd(reaction, user);
  } catch (error) {
    console.error("[Discord Bot] Reaction handling failed:", error);
  }
}

async function onMessageCreate(message) {
  try {
    if (message.author.bot) {
      return;
    }

    if (await handleCommissionPortalMessageCreate(message)) {
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

  const targetChannel = interaction.options?.getChannel("channel");
  const targetChannelId = targetChannel?.id || interaction.channelId;
  const channelIds = addRelayChannel(targetChannelId);

  await interaction.reply({
    content: "Howler relay enabled for <#" + targetChannelId + ">. Voice points also use this channel list. Active channels: " + channelIds.join(", "),
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

  const targetChannel = interaction.options?.getChannel("channel");
  const targetChannelId = targetChannel?.id || interaction.channelId;
  const channelIds = removeRelayChannel(targetChannelId);
  const activeText = channelIds.length > 0 ? channelIds.join(", ") : "none";

  await interaction.reply({
    content: "Howler relay disabled for <#" + targetChannelId + ">. Voice points also use this channel list. Active channels: " + activeText,
    ephemeral: true
  });
}

function startVoicePointTimer() {
  if (!parseBoolean(process.env.ENABLE_DISCORD_VOICE_POINTS, false)) {
    return;
  }

  if (voicePointTimer) {
    return;
  }

  const intervalSeconds = clampNumber(process.env.DISCORD_VOICE_POINT_INTERVAL_SECONDS || 300, 30, 86400);

  voicePointTimer = setInterval(() => {
    awardVoicePoints().catch((error) => {
      console.error("[Discord Bot] Voice point award failed:", error);
    });
  }, intervalSeconds * 1000);

  console.log("[Discord Bot] Voice point timer enabled. Interval=" + intervalSeconds + "s Amount=" + getVoicePointAmount());
}

async function awardVoicePoints() {
  if (!client || !client.isReady() || voicePointTickActive) {
    return;
  }

  const allowedChannelIds = getRelayChannelIds();
  if (allowedChannelIds.length === 0) {
    if (!voicePointSkipLogged) {
      console.warn("[Discord Bot] Voice points are enabled, but no allowed channel IDs are configured. Use /howlerstream in a channel or set DISCORD_RELAY_CHANNEL_IDS.");
      voicePointSkipLogged = true;
    }

    return;
  }

  voicePointSkipLogged = false;
  voicePointTickActive = true;

  try {
    const amount = getVoicePointAmount();
    const actionName = process.env.STREAMERBOT_POINTS_ACTION_NAME || "StreamTools Points";
    const voiceStates = [];

    client.guilds.cache.forEach((guild) => {
      guild.voiceStates.cache.forEach((voiceState) => {
        if (shouldAwardVoiceState(voiceState, allowedChannelIds)) {
          voiceStates.push(voiceState);
        }
      });
    });

    for (const voiceState of voiceStates) {
      const member = voiceState.member;
      await triggerStreamerBot(
        actionName,
        {
          source: "discord-voice",
          pointOperation: "add",
          pointUserKey: "discord:" + member.id,
          points: amount,
          amount,
          discordUserName: member.displayName || member.user?.globalName || member.user?.username || "",
          discordUserId: member.id,
          discordGuildId: voiceState.guild.id,
          discordChannelId: voiceState.channelId,
          discordVoiceChannelId: voiceState.channelId
        },
        "[Discord Voice Points]"
      );
    }

    if (voiceStates.length > 0) {
      console.log("[Discord Bot] Awarded voice points to " + voiceStates.length + " user(s). Amount=" + amount);
    }
  } finally {
    voicePointTickActive = false;
  }
}

function shouldAwardVoiceState(voiceState, allowedChannelIds) {
  if (!voiceState || !voiceState.channelId || !voiceState.member) {
    return false;
  }

  if (!allowedChannelIds.includes(String(voiceState.channelId))) {
    return false;
  }

  if (voiceState.member.user?.bot) {
    return false;
  }

  if (parseBoolean(process.env.DISCORD_VOICE_POINTS_REQUIRE_UNMUTED, false) && (voiceState.serverMute || voiceState.selfMute)) {
    return false;
  }

  if (parseBoolean(process.env.DISCORD_VOICE_POINTS_REQUIRE_UNDEAFENED, false) && (voiceState.serverDeaf || voiceState.selfDeaf)) {
    return false;
  }

  return true;
}

function getVoicePointAmount() {
  return clampNumber(process.env.DISCORD_VOICE_POINT_AMOUNT || 1, 1, 100000);
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

  if (redeemConfig.requiresInput) {
    await showRedeemInputModal(interaction, redeemId, redeemConfig);
    return;
  }

  await submitRedeemEvent(interaction, redeemId, redeemConfig, "");
}

async function handleRedeemInputModal(interaction) {
  const redeemId = interaction.customId.slice(redeemInputModalPrefix.length);
  const redeemConfig = getRedeemConfig(redeemId);

  if (!redeemConfig || !redeemConfig.visible) {
    await interaction.reply({
      content: "Unknown redeem.",
      ephemeral: true
    });

    return;
  }

  const inputValue = interaction.fields.getTextInputValue(redeemInputFieldId) || "";
  await submitRedeemEvent(interaction, redeemId, redeemConfig, inputValue);
}

async function showRedeemInputModal(interaction, redeemId, redeemConfig) {
  const input = new TextInputBuilder()
    .setCustomId(redeemInputFieldId)
    .setLabel(limitText(redeemConfig.inputLabel || "Details", 45))
    .setStyle(redeemConfig.inputStyle === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(redeemConfig.inputRequired !== false);

  if (redeemConfig.inputPlaceholder) {
    input.setPlaceholder(limitText(redeemConfig.inputPlaceholder, 100));
  }

  const modal = new ModalBuilder()
    .setCustomId(redeemInputModalPrefix + redeemId)
    .setTitle(limitText(redeemConfig.inputTitle || redeemConfig.label, 45))
    .addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

async function submitRedeemEvent(interaction, redeemId, redeemConfig, inputValue) {
  const result = await handleDiscordRedeemEvent({
    source: "discord",
    type: "redeem",
    redeemId,
    redeemLabel: redeemConfig.label,
    redeemStyle: redeemConfig.style,
    redeemPointCost: Number(redeemConfig.pointCost) || 0,
    redeemRequiresInput: redeemConfig.requiresInput === true,
    redeemInput: inputValue || "",
    redeemInputLabel: redeemConfig.inputLabel || "",
    userName: interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: interaction.message?.id || "",
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

async function sendDiscordMessage(payload) {
  if (!client || !client.isReady()) {
    throw new Error("Discord bot is not connected");
  }

  const channelId = String(payload?.channelId || "").trim();
  const replyToMessageId = String(payload?.replyToMessageId || payload?.messageId || "").trim();
  const content = limitText(payload?.message || payload?.content || "", 2000);

  if (!channelId) {
    throw new Error("Missing required field: channelId");
  }

  if (!content) {
    throw new Error("Missing required field: message");
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel || (typeof channel.isTextBased === "function" && !channel.isTextBased())) {
    throw new Error("Discord channel is not text based");
  }

  let sentMessage = null;

  if (replyToMessageId && channel.messages?.fetch) {
    const sourceMessage = await channel.messages.fetch(replyToMessageId).catch(() => null);
    if (sourceMessage) {
      sentMessage = await sourceMessage.reply({
        content,
        allowedMentions: {
          repliedUser: false
        }
      });
    }
  }

  if (!sentMessage) {
    sentMessage = await channel.send({ content });
  }

  return {
    channelId: sentMessage.channelId,
    messageId: sentMessage.id
  };
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

function limitText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
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
  sendDiscordMessage,
  startDiscordBot
};
