const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../../.env")
});

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

let pmi;
try {
  pmi = require("pmi.js");
} catch (error) {
  console.error("[PicartoBridge] Missing dependency: pmi.js");
  console.error("[PicartoBridge] Install it from the server folder with: npm install pmi.js");
  process.exit(1);
}

const BOT_USERNAME = process.env.PICARTO_BOT_USERNAME;
const OAUTH_TOKEN = process.env.PICARTO_OAUTH_TOKEN;
const STREAMERBOT_HTTP_URL = process.env.STREAMERBOT_HTTP_URL || "http://127.0.0.1:7474";
const STREAMERBOT_ACTION_NAME = process.env.STREAMERBOT_PICARTO_ACTION_NAME || "Picarto Chat Message";
const COMMAND_PREFIX = process.env.PICARTO_COMMAND_PREFIX || "!";
const FORWARD_ALL = parseBoolean(process.env.PICARTO_FORWARD_ALL, true);
const ENABLE_PING_REPLY = parseBoolean(process.env.PICARTO_ENABLE_PING_REPLY, true);
const DEBUG = parseBoolean(process.env.PICARTO_BRIDGE_DEBUG, false);
const sentByBridge = new Map();

if (!BOT_USERNAME || !OAUTH_TOKEN) {
  console.error("[PicartoBridge] PICARTO_BOT_USERNAME and PICARTO_OAUTH_TOKEN are required.");
  process.exit(1);
}

const client = new pmi.client({
  identity: {
    username: BOT_USERNAME,
    password: OAUTH_TOKEN
  }
});

client.on("message", onMessage);
client.on("connecting", (address, port) => {
  console.log(`[PicartoBridge] Connecting to Picarto chat at ${address}:${port}`);
});
client.on("connected", (address, port) => {
  console.log(`[PicartoBridge] Connected to Picarto chat at ${address}:${port}`);
});
client.on("unauthenticated", (reason) => {
  console.error("[PicartoBridge] Picarto authentication failed:", reason);
  console.error("[PicartoBridge] Check PICARTO_BOT_USERNAME and PICARTO_OAUTH_TOKEN in server/bridges/.env");
});
client.on("closed", (reason) => {
  console.warn("[PicartoBridge] Picarto chat connection closed:", reason);
});
client.on("disconnected", (reason) => {
  console.warn("[PicartoBridge] Disconnected from Picarto chat:", reason);
});

client.connect();

setTimeout(() => {
  if (!client.ws || client.ws.readyState !== 1) {
    console.warn("[PicartoBridge] Still not connected after 15 seconds.");
    console.warn("[PicartoBridge] Check network access, bot OAuth token, and Picarto chat availability.");
  }
}, 15000);

if (DEBUG) {
  setInterval(() => {
    const readyState = client.ws?.readyState;
    console.log(`[PicartoBridge] debug readyState=${readyState}`);
  }, 10000);
}

async function onMessage(target, context, message, self) {
  if (self) return;

  const text = String(message || "").trim();
  if (!text) return;

  if (wasSentByBridge(text)) {
    if (DEBUG) console.log(`[PicartoBridge] Suppressed bridge echo: ${text}`);
    return;
  }

  const isCommand = text.startsWith(COMMAND_PREFIX);
  const command = isCommand ? text.split(/\s+/)[0].slice(COMMAND_PREFIX.length).toLowerCase() : "";
  const user = pickUser(context);

  console.log(`[PicartoBridge] ${user}: ${text}`);

  if (ENABLE_PING_REPLY && isCommand && command === "ping") {
    saySafe(target, "AnthroCorp relay online.");
  }

  if (!FORWARD_ALL && !isCommand) return;

  await triggerStreamerBot({
    picartoUser: user,
    picartoMessage: text,
    picartoTarget: target,
    picartoIsCommand: isCommand,
    picartoCommand: command,
    picartoRawContext: safeJson(context)
  });
}

async function triggerStreamerBot(args) {
  const url = `${STREAMERBOT_HTTP_URL.replace(/\/$/, "")}/DoAction`;
  const body = {
    action: {
      name: STREAMERBOT_ACTION_NAME
    },
    args
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok && response.status !== 204) {
      console.warn(`[PicartoBridge] Streamer.bot returned ${response.status}`);
    }
  } catch (error) {
    console.warn("[PicartoBridge] Streamer.bot action trigger failed:", error.message);
  }
}

function saySafe(target, message) {
  try {
    rememberBridgeMessage(message);
    client.say(target, message);
  } catch (error) {
    console.warn("[PicartoBridge] Failed to send Picarto chat message:", error.message);
  }
}

function rememberBridgeMessage(message) {
  const key = normalizeMessage(message);
  if (!key) return;

  sentByBridge.set(key, Date.now() + 15000);
}

function wasSentByBridge(message) {
  const now = Date.now();

  for (const [key, expiresAt] of sentByBridge.entries()) {
    if (expiresAt <= now) sentByBridge.delete(key);
  }

  const key = normalizeMessage(message);
  if (!sentByBridge.has(key)) return false;

  sentByBridge.delete(key);
  return true;
}

function normalizeMessage(message) {
  return String(message || "").trim().toLowerCase();
}

function pickUser(context) {
  return (
    context?.username ||
    context?.userName ||
    context?.displayName ||
    context?.nick ||
    "picarto-user"
  );
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return "{}";
  }
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
