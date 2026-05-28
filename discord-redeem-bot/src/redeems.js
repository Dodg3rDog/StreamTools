// NOTE: The consolidated StreamTools server reads the active redeem board from:
// server/services/discordRedeems.js
//
// This file is kept only for the older standalone prototype.

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
const REDEEMS = {
  hydrate: {
    label: "Hydrate",
    emoji: "🥤",
    style: "primary",
    visible: true,
    disabled: false
  },

  join_queue: {
    label: "Join Queue",
    emoji: "",
    style: "success",
    visible: true,
    disabled: false
  },

  trigger_howl: {
    label: "Trigger Howl",
    emoji: "",
    style: "danger",
    visible: true,
    disabled: false
  },

  summon_hr: {
    label: "Summon HR",
    emoji: "",
    style: "secondary",
    visible: true,
    disabled: false
  },

  make_it_sus: {
    label: "Make It Sus",
    emoji: "",
    style: "secondary",
    visible: true,
    disabled: false
  },

  change_overlay_color: {
    label: "Change Overlay Color",
    emoji: "",
    style: "primary",
    visible: true,
    disabled: false
  }
};

function getRedeemIdFromCustomId(customId) {
  const prefix = "redeem:";

  if (!customId || !customId.startsWith(prefix)) {
    return "";
  }

  return customId.slice(prefix.length);
}

function getRedeemConfig(redeemId) {
  const config = REDEEMS[redeemId];

  if (typeof config === "string") {
    return {
      label: config,
      emoji: "",
      style: "secondary",
      visible: true,
      disabled: false
    };
  }

  if (!config) {
    return null;
  }

  return {
    label: config.label || redeemId,
    emoji: config.emoji || "",
    style: config.style || "secondary",
    visible: config.visible !== false,
    disabled: config.disabled === true
  };
}

function getVisibleRedeemEntries() {
  return Object.keys(REDEEMS)
    .map((redeemId) => [redeemId, getRedeemConfig(redeemId)])
    .filter((entry) => entry[1] && entry[1].visible);
}

module.exports = {
  BOARD_CONFIG,
  REDEEMS,
  getRedeemConfig,
  getVisibleRedeemEntries,
  getRedeemIdFromCustomId
};
