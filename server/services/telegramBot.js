const { createTelegramCommissionRequest, getPendingTelegramCommissionRequests } = require("./telegramCommissionStore");

const sessions = new Map();

let polling = false;
let updateOffset = 0;
let botInfo = null;

const commissionTypeChoices = [
  { id: "headshot_profile", label: "Headshot / Profile photo" },
  { id: "half_body", label: "Half-body" },
  { id: "full_body", label: "Full-body" },
  { id: "emote", label: "Emote" },
  { id: "reference_sheet", label: "Reference Sheet" },
  { id: "character_creation", label: "Character Creation" },
  { id: "ych", label: "YCH" },
  { id: "other", label: "Other" }
];

const completionLevelChoices = [
  { id: "line_art", label: "Line Art" },
  { id: "flats_shading", label: "Flats w/ Shading" },
  { id: "full_render", label: "Full Render" },
  { id: "painted_illustration", label: "Painted Illustration" },
  { id: "other", label: "Other" }
];

const ratingChoices = [
  { id: "sfw", label: "SFW" },
  { id: "nsfw", label: "NSFW" }
];

const privacyChoices = [
  { id: "public_ok", label: "Public work OK", privateCommission: false },
  { id: "private", label: "Keep private", privateCommission: true }
];

async function startTelegramBot() {
  const config = getTelegramConfig();
  if (!config.enabled) {
    console.log("[Telegram Bot] Disabled. Set ENABLE_TELEGRAM_BOT=true to start it.");
    return null;
  }

  if (!config.token) {
    console.warn("[Telegram Bot] ENABLE_TELEGRAM_BOT=true but TELEGRAM_BOT_TOKEN is missing.");
    return null;
  }

  if (polling) {
    return botInfo;
  }

  botInfo = await telegramRequest(config, "getMe", {});
  polling = true;
  pollTelegramUpdates(config).catch((error) => {
    polling = false;
    console.error("[Telegram Bot] Polling stopped:", error);
  });

  console.log("[Telegram Bot] Logged in as @" + botInfo.username + ".");
  return botInfo;
}

async function pollTelegramUpdates(config) {
  while (polling) {
    try {
      const updates = await telegramRequest(config, "getUpdates", {
        offset: updateOffset || undefined,
        timeout: config.pollTimeoutSeconds,
        allowed_updates: ["message", "callback_query"]
      });

      for (const update of updates || []) {
        updateOffset = update.update_id + 1;
        await handleTelegramUpdate(config, update);
      }
    } catch (error) {
      console.warn("[Telegram Bot] Update polling failed:", error.message);
      await wait(5000);
    }
  }
}

async function handleTelegramUpdate(config, update) {
  if (update.callback_query) {
    await handleCallbackQuery(config, update.callback_query);
    return;
  }

  if (update.message) {
    await handleMessage(config, update.message);
  }
}

async function handleMessage(config, message) {
  const chat = message.chat || {};
  const user = message.from || {};
  const text = String(message.text || "").trim();
  const command = parseCommand(text);

  if (command) {
    await handleCommand(config, message, command);
    return;
  }

  const session = sessions.get(String(user.id));
  if (!session || chat.type !== "private") {
    return;
  }

  if (session.awaitingCustomField) {
    await handleCustomFieldText(config, message, session, text);
    return;
  }

  if (session.step === "details") {
    await completeCommissionRequest(config, message, session, text);
  }
}

async function handleCommand(config, message, command) {
  const chat = message.chat || {};
  const user = message.from || {};

  if (command.name === "start") {
    if (command.argument === "commission") {
      if (chat.type !== "private") {
        await sendCommissionDmPrompt(config, chat.id);
        return;
      }

      await beginCommissionFlow(config, message);
      return;
    }

    await sendMessage(config, chat.id, "Hi! I can help with art commission requests. Use /commission to start a request.");
    return;
  }

  if (command.name === "help") {
    await sendMessage(config, chat.id, [
      "Available commands:",
      "/commission - start a commission request",
      "/chatid - show this chat ID",
      "/ping - check whether the bot is responding"
    ].join("\n"));
    return;
  }

  if (command.name === "ping") {
    await sendMessage(config, chat.id, "Pong.");
    return;
  }

  if (command.name === "chatid") {
    await sendMessage(config, chat.id, "Chat ID: " + chat.id);
    return;
  }

  if (command.name === "pendingcommissions") {
    if (!isTelegramAdmin(config, user.id)) {
      return;
    }

    const pending = getPendingTelegramCommissionRequests(10);
    await sendMessage(config, chat.id, formatPendingRequests(pending));
    return;
  }

  if (command.name === "commission") {
    if (chat.type !== "private") {
      await sendCommissionDmPrompt(config, chat.id);
      return;
    }

    await beginCommissionFlow(config, message);
  }
}

async function beginCommissionFlow(config, message) {
  const user = message.from || {};
  sessions.set(String(user.id), {
    telegramUserId: String(user.id),
    telegramUsername: user.username || "",
    telegramDisplayName: getTelegramDisplayName(user),
    sourceChatId: String(message.chat?.id || ""),
    sourceChatTitle: message.chat?.title || "",
    step: "type",
    createdAt: new Date().toISOString()
  });

  await sendChoiceMessage(config, message.chat.id, "What kind of commission are you interested in?", "tg_commission:type:", commissionTypeChoices);
}

async function handleCallbackQuery(config, query) {
  const data = String(query.data || "");
  const user = query.from || {};
  const session = sessions.get(String(user.id));

  if (!session || !data.startsWith("tg_commission:")) {
    await answerCallbackQuery(config, query.id, "This request session is no longer active.");
    return;
  }

  const [, field, choiceId] = data.split(":");
  const chatId = query.message?.chat?.id;

  if (field === "type") {
    const choice = commissionTypeChoices.find((item) => item.id === choiceId);
    if (!choice) {
      await answerCallbackQuery(config, query.id, "Unknown commission type.");
      return;
    }

    if (choice.id === "other" || choice.id === "ych") {
      session.awaitingCustomField = "commissionType";
      session.commissionType = choice.label;
      sessions.set(String(user.id), session);
      await answerCallbackQuery(config, query.id, "Selected " + choice.label + ".");
      await sendMessage(config, chatId, choice.id === "ych"
        ? "Please paste the YCH link or describe which YCH you mean."
        : "Please describe the commission type you have in mind.");
      return;
    }

    session.commissionType = choice.label;
    session.step = "level";
    sessions.set(String(user.id), session);
    await answerCallbackQuery(config, query.id, "Selected " + choice.label + ".");
    await sendChoiceMessage(config, chatId, "What level of completion are you looking for?", "tg_commission:level:", completionLevelChoices);
    return;
  }

  if (field === "level") {
    const choice = completionLevelChoices.find((item) => item.id === choiceId);
    if (!choice) {
      await answerCallbackQuery(config, query.id, "Unknown completion level.");
      return;
    }

    if (choice.id === "other") {
      session.awaitingCustomField = "completionLevel";
      session.completionLevel = choice.label;
      sessions.set(String(user.id), session);
      await answerCallbackQuery(config, query.id, "Selected Other.");
      await sendMessage(config, chatId, "Please describe the completion level or medium you have in mind.");
      return;
    }

    session.completionLevel = choice.label;
    session.step = "rating";
    sessions.set(String(user.id), session);
    await answerCallbackQuery(config, query.id, "Selected " + choice.label + ".");
    await sendChoiceMessage(config, chatId, "Should this request be SFW or NSFW?", "tg_commission:rating:", ratingChoices);
    return;
  }

  if (field === "rating") {
    const choice = ratingChoices.find((item) => item.id === choiceId);
    if (!choice) {
      await answerCallbackQuery(config, query.id, "Unknown rating.");
      return;
    }

    session.contentRating = choice.label;
    session.step = "privacy";
    sessions.set(String(user.id), session);
    await answerCallbackQuery(config, query.id, "Selected " + choice.label + ".");
    await sendChoiceMessage(config, chatId, "Can this commission be shown publicly?", "tg_commission:privacy:", privacyChoices);
    return;
  }

  if (field === "privacy") {
    const choice = privacyChoices.find((item) => item.id === choiceId);
    if (!choice) {
      await answerCallbackQuery(config, query.id, "Unknown privacy option.");
      return;
    }

    session.privateCommission = choice.privateCommission;
    session.step = "details";
    sessions.set(String(user.id), session);
    await answerCallbackQuery(config, query.id, "Selected " + choice.label + ".");
    await sendMessage(config, chatId, "Please send the commission details in one message. Include pose ideas, character notes, links, color notes, and anything else I should review.");
  }
}

async function handleCustomFieldText(config, message, session, text) {
  if (!text) {
    await sendMessage(config, message.chat.id, "Please send a text response for this part.");
    return;
  }

  if (session.awaitingCustomField === "commissionType") {
    session.commissionType = session.commissionType + ": " + text;
    session.awaitingCustomField = "";
    session.step = "level";
    sessions.set(session.telegramUserId, session);
    await sendChoiceMessage(config, message.chat.id, "What level of completion are you looking for?", "tg_commission:level:", completionLevelChoices);
    return;
  }

  if (session.awaitingCustomField === "completionLevel") {
    session.completionLevel = session.completionLevel + ": " + text;
    session.awaitingCustomField = "";
    session.step = "rating";
    sessions.set(session.telegramUserId, session);
    await sendChoiceMessage(config, message.chat.id, "Should this request be SFW or NSFW?", "tg_commission:rating:", ratingChoices);
  }
}

async function completeCommissionRequest(config, message, session, text) {
  if (!text) {
    await sendMessage(config, message.chat.id, "Please send the commission details as text. Links are fine.");
    return;
  }

  const request = createTelegramCommissionRequest({
    telegramUserId: session.telegramUserId,
    telegramUsername: session.telegramUsername,
    telegramDisplayName: session.telegramDisplayName,
    sourceChatId: session.sourceChatId,
    sourceChatTitle: session.sourceChatTitle,
    commissionType: session.commissionType,
    completionLevel: session.completionLevel,
    contentRating: session.contentRating,
    privateCommission: session.privateCommission === true,
    requestDetails: text
  });

  sessions.delete(session.telegramUserId);
  await sendMessage(config, message.chat.id, [
    "Thanks! Your commission request was recorded.",
    "",
    "Request ID: " + request.id,
    "This will be carried into my Discord commission tracking queue for review."
  ].join("\n"));
}

async function sendCommissionDmPrompt(config, chatId) {
  const username = botInfo?.username || "";
  const link = username ? "https://t.me/" + username + "?start=commission" : "";

  await sendMessage(config, chatId, [
    "Commission requests are collected in a private bot chat so your details are not posted in the group.",
    link ? "Start here: " + link : "Open a private chat with this bot and send /commission."
  ].join("\n"));
}

function formatPendingRequests(pending) {
  if (pending.length === 0) {
    return "No pending Telegram commission requests.";
  }

  return pending.map((request) => [
    "#" + request.id + " - " + request.telegramDisplayName,
    request.commissionType + " | " + request.completionLevel + " | " + request.contentRating,
    "Status: " + request.status
  ].join("\n")).join("\n\n");
}

async function sendChoiceMessage(config, chatId, text, callbackPrefix, choices) {
  const rows = [];
  for (let index = 0; index < choices.length; index += 2) {
    rows.push(choices.slice(index, index + 2).map((choice) => ({
      text: choice.label,
      callback_data: callbackPrefix + choice.id
    })));
  }

  await sendMessage(config, chatId, text, {
    reply_markup: { inline_keyboard: rows }
  });
}

async function sendMessage(config, chatId, text, input = {}) {
  return telegramRequest(config, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: false,
    ...input
  });
}

async function answerCallbackQuery(config, callbackQueryId, text) {
  return telegramRequest(config, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text
  });
}

async function telegramRequest(config, method, payload) {
  const response = await fetch("https://api.telegram.org/bot" + config.token + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.ok === false) {
    throw new Error(body.description || "Telegram API request failed: " + method);
  }

  return body.result;
}

function parseCommand(text) {
  const match = text.match(/^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+(.+))?$/);
  if (!match) {
    return null;
  }

  return {
    name: match[1].toLowerCase(),
    argument: String(match[2] || "").trim()
  };
}

function getTelegramDisplayName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || String(user.id || "");
}

function isTelegramAdmin(config, userId) {
  return config.adminUserIds.includes(String(userId));
}

function getTelegramConfig() {
  return {
    enabled: parseBoolean(process.env.ENABLE_TELEGRAM_BOT, false),
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    artGroupId: process.env.TELEGRAM_ART_GROUP_ID || "",
    adminUserIds: parseCsv(process.env.TELEGRAM_ADMIN_USER_IDS),
    pollTimeoutSeconds: parseInteger(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS, 30)
  };
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  startTelegramBot
};
