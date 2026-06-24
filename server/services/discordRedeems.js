const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "../data/discord");
const redeemsPath = path.join(dataDir, "redeems.json");

const BOARD_CONFIG = {
  title: "Night Howlers Redeem Board",
  description: "Choose a Discord redeem to trigger a stream interaction.",
  color: 0x8f5cff,
  footerText: "",
  thumbnailUrl: "",
  maxButtonsPerRow: 5
};

// Button style options:
// primary = blue, secondary = gray, success = green, danger = red
//
// Emoji options:
// - Unicode emoji character: emoji: "<unicode emoji>"
// - Custom static emoji: emoji: { id: "123456789012345678", name: "howl" }
// - Custom animated emoji: emoji: { id: "123456789012345678", name: "howl", animated: true }
const DEFAULT_REDEEMS = {
  hydrate: {
    label: "Hydrate",
    emoji: "🥤",
    order: 10,
    style: "primary",
    visible: true,
    disabled: false
  },

  join_queue: {
    label: "Join Queue",
    emoji: "",
    order: 20,
    style: "success",
    visible: true,
    disabled: false
  },

  trigger_howl: {
    label: "Trigger Howl",
    emoji: "",
    order: 30,
    style: "danger",
    visible: true,
    disabled: false
  },

  summon_hr: {
    label: "Summon HR",
    emoji: "",
    order: 40,
    style: "secondary",
    visible: true,
    disabled: false
  },

  make_it_sus: {
    label: "Make It Sus",
    emoji: "",
    order: 50,
    style: "secondary",
    visible: true,
    disabled: false
  },

  change_overlay_color: {
    label: "Change Overlay Color",
    emoji: "",
    order: 60,
    style: "primary",
    visible: true,
    disabled: false
  }
};

function getRedeems() {
  try {
    const data = JSON.parse(fs.readFileSync(redeemsPath, "utf8"));

    if (data && data.redeems && typeof data.redeems === "object") {
      return normalizeRedeems(data.redeems);
    }
  } catch { }

  return normalizeRedeems(DEFAULT_REDEEMS);
}

function getRedeemList() {
  return getSortedRedeemEntries(getRedeems()).map(([redeemId, redeemConfig]) => ({
    redeemId,
    ...redeemConfig
  }));
}

function upsertRedeem(input) {
  const label = String(input?.label || input?.redeemLabel || input?.name || "").trim();
  const requestedId = String(input?.redeemId || input?.id || label || "").trim();
  const redeemId = normalizeEventKey(requestedId);

  if (!redeemId || !label) {
    throw new Error("Redeem name is required");
  }

  const redeems = getRedeems();
  const existingRedeem = redeems[redeemId] || {};
  redeems[redeemId] = {
    label,
    emoji: input?.emoji || "",
    order: normalizeOrder(input?.order, normalizeOrder(existingRedeem.order, getNextOrder(redeems))),
    pointCost: normalizePointCost(input?.pointCost || input?.cost || 0),
    style: normalizeStyle(input?.style || "secondary"),
    visible: input?.visible !== false,
    disabled: input?.disabled === true,
    requiresInput: input?.requiresInput === true,
    inputTitle: limitText(input?.inputTitle || label, 45),
    inputLabel: limitText(input?.inputLabel || "Details", 45),
    inputPlaceholder: limitText(input?.inputPlaceholder || "", 100),
    inputRequired: input?.inputRequired !== false,
    inputStyle: normalizeInputStyle(input?.inputStyle || "short")
  };

  saveRedeems(redeems);

  return {
    redeemId,
    ...getRedeemConfig(redeemId)
  };
}

function reorderRedeems(redeemIds) {
  if (!Array.isArray(redeemIds)) {
    throw new Error("redeemIds must be an array");
  }

  const redeems = getRedeems();
  const seen = {};
  const orderedIds = redeemIds
    .map((redeemId) => normalizeEventKey(redeemId))
    .filter((redeemId) => {
      if (!redeemId || seen[redeemId] || !redeems[redeemId]) {
        return false;
      }

      seen[redeemId] = true;
      return true;
    });

  getSortedRedeemEntries(redeems).forEach(([redeemId]) => {
    if (!seen[redeemId]) {
      orderedIds.push(redeemId);
    }
  });

  orderedIds.forEach((redeemId, index) => {
    redeems[redeemId].order = (index + 1) * 10;
  });

  saveRedeems(redeems);

  return getRedeemList();
}

function removeRedeem(redeemId) {
  const normalizedRedeemId = normalizeEventKey(redeemId);
  const redeems = getRedeems();
  const existed = Object.prototype.hasOwnProperty.call(redeems, normalizedRedeemId);

  if (existed) {
    delete redeems[normalizedRedeemId];
    saveRedeems(redeems);
  }

  return existed;
}

function resetRedeems() {
  saveRedeems(DEFAULT_REDEEMS);
  return getRedeemList();
}

function getRedeemIdFromCustomId(customId) {
  const prefix = "redeem:";

  if (!customId || !customId.startsWith(prefix)) {
    return "";
  }

  return customId.slice(prefix.length);
}

function getRedeemConfig(redeemId) {
  const config = getRedeems()[redeemId];

  return normalizeRedeemConfig(redeemId, config);
}

function normalizeRedeemConfig(redeemId, config) {

  if (typeof config === "string") {
    return {
      label: config,
      emoji: "",
      order: getFallbackOrder(redeemId),
      pointCost: 0,
      style: "secondary",
      visible: true,
      disabled: false,
      requiresInput: false,
      inputTitle: config,
      inputLabel: "Details",
      inputPlaceholder: "",
      inputRequired: true,
      inputStyle: "short"
    };
  }

  if (!config) {
    return null;
  }

  return {
    label: config.label || redeemId,
    emoji: config.emoji || "",
    order: normalizeOrder(config.order, getFallbackOrder(redeemId)),
    pointCost: normalizePointCost(config.pointCost || config.cost || 0),
    style: config.style || "secondary",
    visible: config.visible !== false,
    disabled: config.disabled === true,
    requiresInput: config.requiresInput === true,
    inputTitle: limitText(config.inputTitle || config.label || redeemId, 45),
    inputLabel: limitText(config.inputLabel || "Details", 45),
    inputPlaceholder: limitText(config.inputPlaceholder || "", 100),
    inputRequired: config.inputRequired !== false,
    inputStyle: normalizeInputStyle(config.inputStyle || "short")
  };
}

function getVisibleRedeemEntries() {
  return getSortedRedeemEntries(getRedeems())
    .filter((entry) => entry[1] && entry[1].visible);
}

function getDiscordTriggerDefinitions() {
  const triggers = [
    {
      name: "Discord Redeem",
      eventName: "streamtools.discord.redeem",
      type: "redeem"
    },
    {
      name: "Discord Chat Message",
      eventName: "streamtools.discord.message",
      type: "message"
    },
    {
      name: "Discord Command",
      eventName: "streamtools.discord.command",
      type: "command"
    }
  ];

  getVisibleRedeemEntries().forEach(([redeemId, redeemConfig]) => {
    triggers.push({
      name: "Discord Redeem: " + redeemConfig.label,
      eventName: "streamtools.discord.redeem." + normalizeEventKey(redeemId),
      type: "redeem",
      redeemId,
      redeemLabel: redeemConfig.label
    });
  });

  parseCsv(process.env.DISCORD_COMMAND_TRIGGER_NAMES || "").forEach((commandName) => {
    const normalizedCommand = normalizeEventKey(commandName);
    if (!normalizedCommand) {
      return;
    }

    triggers.push({
      name: "Discord Command: " + commandName,
      eventName: "streamtools.discord.command." + normalizedCommand,
      type: "command",
      command: normalizedCommand
    });
  });

  return triggers;
}

function normalizeEventKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRedeems(redeems) {
  const normalized = {};

  Object.keys(redeems || {}).forEach((redeemId) => {
    const config = redeems[redeemId];
    const normalizedId = normalizeEventKey(redeemId);

    if (!normalizedId || !config) {
      return;
    }

    if (typeof config === "string") {
      normalized[normalizedId] = {
        label: config,
        emoji: "",
        order: getFallbackOrder(normalizedId),
        pointCost: 0,
        style: "secondary",
        visible: true,
        disabled: false,
        requiresInput: false,
        inputTitle: config,
        inputLabel: "Details",
        inputPlaceholder: "",
        inputRequired: true,
        inputStyle: "short"
      };

      return;
    }

    normalized[normalizedId] = {
      label: config.label || normalizedId,
      emoji: config.emoji || "",
      order: normalizeOrder(config.order, getFallbackOrder(normalizedId)),
      pointCost: normalizePointCost(config.pointCost || config.cost || 0),
      style: normalizeStyle(config.style || "secondary"),
      visible: config.visible !== false,
      disabled: config.disabled === true,
      requiresInput: config.requiresInput === true,
      inputTitle: limitText(config.inputTitle || config.label || normalizedId, 45),
      inputLabel: limitText(config.inputLabel || "Details", 45),
      inputPlaceholder: limitText(config.inputPlaceholder || "", 100),
      inputRequired: config.inputRequired !== false,
      inputStyle: normalizeInputStyle(config.inputStyle || "short")
    };
  });

  return normalized;
}

function getSortedRedeemEntries(redeems) {
  return Object.keys(redeems || {})
    .map((redeemId) => [redeemId, normalizeRedeemConfig(redeemId, redeems[redeemId])])
    .filter((entry) => entry[1])
    .sort((a, b) => {
      if (a[1].order !== b[1].order) {
        return a[1].order - b[1].order;
      }

      return a[0].localeCompare(b[0]);
    });
}

function getNextOrder(redeems) {
  const orders = Object.keys(redeems || {}).map((redeemId) =>
    normalizeOrder(redeems[redeemId]?.order, 0)
  );

  return orders.length > 0 ? Math.max(...orders) + 10 : 10;
}

function getFallbackOrder(redeemId) {
  const ids = Object.keys(DEFAULT_REDEEMS);
  const index = ids.indexOf(redeemId);

  return index >= 0 ? (index + 1) * 10 : 9990;
}

function normalizeOrder(order, fallback) {
  const parsed = Number.parseInt(order, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStyle(style) {
  const normalized = String(style || "").trim().toLowerCase();
  const allowed = ["primary", "secondary", "success", "danger"];

  return allowed.includes(normalized) ? normalized : "secondary";
}

function normalizePointCost(value) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeInputStyle(style) {
  return String(style || "").trim().toLowerCase() === "paragraph" ? "paragraph" : "short";
}

function limitText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function saveRedeems(redeems) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    redeemsPath,
    JSON.stringify({
      redeems: normalizeRedeems(redeems),
      updatedAt: new Date().toISOString()
    }, null, 2),
    "utf8"
  );
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  BOARD_CONFIG,
  DEFAULT_REDEEMS,
  getDiscordTriggerDefinitions,
  getRedeemList,
  getRedeemConfig,
  getVisibleRedeemEntries,
  getRedeemIdFromCustomId,
  removeRedeem,
  reorderRedeems,
  resetRedeems,
  upsertRedeem
};
