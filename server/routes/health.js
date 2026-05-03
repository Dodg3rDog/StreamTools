const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "streamtools-server",
    version: "0.1.0",
    uptimeSec: Math.floor(process.uptime())
  });
});

module.exports = router;