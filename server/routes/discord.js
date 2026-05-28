const express = require("express");
const {
  handleDiscordMessageEvent,
  handleDiscordRedeemEvent
} = require("../services/discordEvents");

const router = express.Router();

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
