const express = require("express");
const { requireBearerToken } = require("../middleware/auth");
const {
  handleDiscordMessageEvent,
  handleDiscordRedeemEvent
} = require("../services/discordEvents");
const {
  getDiscordBotStatus,
  getDiscordGuildAssets,
  sendDiscordMessage
} = require("../services/discordBot");
const {
  BOARD_CONFIG,
  getDiscordTriggerDefinitions,
  getRedeemList,
  removeRedeem,
  reorderRedeems,
  resetRedeems,
  upsertRedeem
} = require("../services/discordRedeems");

const router = express.Router();
const { getVoiceConfinementStatus, releaseVoiceConfinementFromAdmin } = require("../services/voiceConfinement");

router.put("/admin/howler/settings", requireBearerToken, (req, res) => {
  try {
    require("../services/voiceConfinementSettings").settingsStore.save(req.body);
    res.json({ ok: true, howler: getVoiceConfinementStatus() });
  } catch (error) {
    res.status(error.code ? 500 : 400).json({ ok: false, error: error.code ? "Could not save Howler settings." : error.message });
  }
});

router.get("/admin/status", requireBearerToken, (req, res) => {
  res.set("Cache-Control", "no-store").json({ ok: true, bot: getDiscordBotStatus(), howler: getVoiceConfinementStatus() });
});

router.post("/admin/howler/release", requireBearerToken, async (req, res) => {
  const { guildId, userId } = req.body || {};
  if (!/^\d{17,20}$/.test(String(guildId || "")) || !/^\d{17,20}$/.test(String(userId || ""))) {
    return res.status(400).json({ ok: false, error: "Valid guild and user IDs are required." });
  }
  try {
    const result = await releaseVoiceConfinementFromAdmin(String(guildId), String(userId));
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(409).json({ ok: false, error: error.message });
  }
});

router.get("/triggers", (req, res) => {
  const triggers = getDiscordTriggerDefinitions();

  res.json({
    ok: true,
    triggers
  });
});

router.get("/triggers.txt", (req, res) => {
  const lines = getDiscordTriggerDefinitions().map((trigger) =>
    trigger.name.replace(/\|/g, "-") + "|" + trigger.eventName.replace(/\|/g, "-")
  );

  res.type("text/plain").send(lines.join("\n") + "\n");
});

router.get("/redeems", (req, res) => {
  res.json({
    ok: true,
    boardConfig: BOARD_CONFIG,
    redeems: getRedeemList()
  });
});

router.get("/guild-assets", requireBearerToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      assets: await getDiscordGuildAssets(req.query.guildId || undefined)
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

router.post("/redeems/upsert", requireBearerToken, (req, res) => {
  try {
    const redeem = upsertRedeem(req.body || {});

    res.json({
      ok: true,
      redeem,
      redeems: getRedeemList()
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

router.post("/redeems/remove", requireBearerToken, (req, res) => {
  const redeemId = req.body?.redeemId || req.body?.id;

  if (!redeemId) {
    return res.status(400).json({
      ok: false,
      error: "Missing required field: redeemId"
    });
  }

  res.json({
    ok: true,
    removed: removeRedeem(redeemId),
    redeems: getRedeemList()
  });
});

router.post("/redeems/reorder", requireBearerToken, (req, res) => {
  try {
    res.json({
      ok: true,
      redeems: reorderRedeems(req.body?.redeemIds || [])
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

router.post("/redeems/reset", requireBearerToken, (req, res) => {
  res.json({
    ok: true,
    redeems: resetRedeems()
  });
});

router.post("/send-message", requireBearerToken, async (req, res) => {
  try {
    const message = await sendDiscordMessage(req.body || {});

    res.json({
      ok: true,
      message
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

router.post("/redeem", async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  const result = await handleDiscordRedeemEvent(req.body || {});

  res.json({
    ok: true,
    received: true,
    streamerBot: result.streamerBot
  });
});

router.post("/message", async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  const result = await handleDiscordMessageEvent(req.body || {});

  res.json({
    ok: true,
    received: true,
    streamerBot: result.streamerBot
  });
});

function isAuthorized(req) {
  const expectedSecret = process.env.STREAMTOOLS_BOT_SECRET || "";
  const providedSecret = req.headers["x-streamtools-bot-secret"] || "";

  return !expectedSecret || providedSecret === expectedSecret;
}

module.exports = router;
