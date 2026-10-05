const express = require("express");
const { randomUUID } = require("node:crypto");
const { requireBearerToken } = require("../middleware/auth");
const router = express.Router();
const instanceId = randomUUID();
let restarting = false;

router.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store").json({
    ok: !restarting,
    service: "streamtools-server",
    version: "0.1.0",
    uptimeSec: Math.floor(process.uptime()),
    instanceId,
    restartSupported: process.env.STREAMTOOLS_SUPERVISED === "1" && process.connected === true,
    restarting
  });
});

router.post("/server/restart", requireBearerToken, (req, res) => {
  if (process.env.STREAMTOOLS_SUPERVISED !== "1" || !process.connected || !req.app.locals.restartServer) {
    return res.status(503).json({ ok: false, error: "Launch the server with npm start to enable restarts." });
  }
  if (restarting) return res.status(409).json({ ok: false, error: "A restart is already in progress." });
  restarting = true;
  res.on("finish", () => req.app.locals.restartServer());
  res.status(202).json({ ok: true, instanceId, message: "Restart accepted" });
});

module.exports = router;
