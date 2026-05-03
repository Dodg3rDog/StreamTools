const express = require("express");
const { requireBearerToken } = require("../middleware/auth");

const router = express.Router();

const timers = new Map();

router.get("/", (req, res) => {
  const now = Date.now();

  const activeTimers = Array.from(timers.values())
    .filter(timer => timer.state === "active" && new Date(timer.expiresAt).getTime() > now)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));

  res.json({
    ok: true,
    count: activeTimers.length,
    timers: activeTimers
  });
});

router.post("/upsert", requireBearerToken, (req, res) => {
  const {
    id,
    source = "streamerbot",
    title,
    subtitle = "",
    group = "default",
    icon = "",
    username = "",
    createdAt,
    expiresAt,
    state = "active"
  } = req.body || {};

  if (!id || !title || !expiresAt) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields: id, title, expiresAt"
    });
  }

  const timer = {
    id,
    source,
    title,
    subtitle,
    group,
    icon,
    username,
    createdAt: createdAt || new Date().toISOString(),
    expiresAt,
    state
  };

  timers.set(id, timer);

  res.json({
    ok: true,
    timer
  });
});

router.post("/remove", requireBearerToken, (req, res) => {
  const { id } = req.body || {};

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: "Missing required field: id"
    });
  }

  const existed = timers.delete(id);

  res.json({
    ok: true,
    removed: existed,
    id
  });
});

router.post("/expire", requireBearerToken, (req, res) => {
  const { id } = req.body || {};

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: "Missing required field: id"
    });
  }

  const timer = timers.get(id);

  if (!timer) {
    return res.status(404).json({
      ok: false,
      error: "Timer not found"
    });
  }

  timer.state = "expired";
  timers.set(id, timer);

  res.json({
    ok: true,
    timer
  });
});

module.exports = router;
