const fs = require("fs");
const path = require("path");
const { triggerStreamerBot } = require("./streamerbot");

const logDir = path.join(__dirname, "../data/discord");
const redeemLogPath = path.join(logDir, "redeem-events.ndjson");
const messageLogPath = path.join(logDir, "message-events.ndjson");

async function handleDiscordRedeemEvent(payload) {
  const event = {
    ...(payload || {}),
    receivedAt: new Date().toISOString()
  };

  console.log("[Discord] Redeem Received", event);
  appendEventLog(redeemLogPath, event, "redeem");

  const streamerBot = await triggerStreamerBot(
    process.env.STREAMERBOT_DISCORD_REDEEM_ACTION_NAME || "Discord Redeem",
    {
      discordEventType: "redeem",
      discordRedeemId: event.redeemId || "",
      discordRedeemLabel: event.redeemLabel || "",
      discordRedeemStyle: event.redeemStyle || "",
      discordRedeemPointCost: Number(event.redeemPointCost) || 0,
      discordRedeemRequiresInput: event.redeemRequiresInput === true,
      discordRedeemInput: event.redeemInput || "",
      discordRedeemInputLabel: event.redeemInputLabel || "",
      discordUserName: event.userName || "",
      discordUserId: event.userId || "",
      discordGuildId: event.guildId || "",
      discordChannelId: event.channelId || "",
      discordMessageId: event.messageId || "",
      discordTimestamp: event.timestamp || "",
      discordRawPayload: safeJson(event)
    },
    "[Discord]"
  );

  return {
    event,
    streamerBot
  };
}

async function handleDiscordMessageEvent(payload) {
  const event = {
    ...(payload || {}),
    receivedAt: new Date().toISOString()
  };

  console.log("[Discord] Message Received", event);
  appendEventLog(messageLogPath, event, "message");

  const streamerBot = await triggerStreamerBot(
    process.env.STREAMERBOT_DISCORD_MESSAGE_ACTION_NAME || "Discord Chat Message",
    {
      discordEventType: event.isCommand ? "command" : "message",
      discordUserName: event.userName || "",
      discordUserId: event.userId || "",
      discordGuildId: event.guildId || "",
      discordChannelId: event.channelId || "",
      discordMessageId: event.messageId || "",
      discordMessage: event.content || "",
      discordHasMedia: event.hasMedia === true,
      discordAttachmentCount: Number(event.attachmentCount) || 0,
      discordStickerCount: Number(event.stickerCount) || 0,
      discordEmbedCount: Number(event.embedCount) || 0,
      discordMediaTypes: event.mediaTypes || "",
      discordIsCommand: event.isCommand === true,
      discordCommand: event.command || "",
      discordCommandArgs: event.commandArgs || "",
      discordTimestamp: event.timestamp || "",
      discordRawPayload: safeJson(event)
    },
    "[Discord]"
  );

  return {
    event,
    streamerBot
  };
}

function appendEventLog(logPath, event, eventType) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      logPath,
      JSON.stringify(event) + "\n",
      "utf8"
    );
  } catch (error) {
    console.warn("[Discord] Failed to write " + eventType + " log:", error.message);
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
  handleDiscordMessageEvent,
  handleDiscordRedeemEvent
};
