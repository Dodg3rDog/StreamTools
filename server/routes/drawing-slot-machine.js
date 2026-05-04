const express = require("express");
const fs = require("fs");
const path = require("path");
const { requireBearerToken } = require("../middleware/auth");

const router = express.Router();

const DATA_DIR = path.join(__dirname, "../data/drawing-slot-machine");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const JACKPOT_FILE = path.join(DATA_DIR, "jackpot.json");
const HISTORY_MAX = Number(process.env.DRAWING_SLOT_HISTORY_MAX || 100);

const BASE_CHANCE = Number(process.env.DRAWING_SLOT_BASE_CHANCE || 8);
const CAP_CHANCE = Number(process.env.DRAWING_SLOT_CAP_CHANCE || 100);
const BITS_PER_STEP = Number(process.env.DRAWING_SLOT_BITS_PER_STEP || 100);
const STEP_INCREMENT = Number(process.env.DRAWING_SLOT_STEP_INCREMENT || 1);
const DECAY_PER_MIN = Number(process.env.DRAWING_SLOT_DECAY_PER_MIN || 0.75);
const IDLE_GRACE_MS = Number(process.env.DRAWING_SLOT_IDLE_GRACE_MS || 30000);

let runtimeState = {
  spinRequestId: 0,
  spinPayload: null,
  modifier: { type: null, ts: 0 },
  status: { spinning: false, by: null, ts: 0 }
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function defaultJackpot() {
  return {
    totalBits: 0,
    chance: BASE_CHANCE,
    lastReset: Date.now(),
    lastActivity: Date.now(),
    lastDecay: Date.now()
  };
}

function loadHistory() {
  const history = readJson(HISTORY_FILE, []);
  return Array.isArray(history) ? history : [];
}

function saveHistory(history) {
  writeJson(HISTORY_FILE, history.slice(-HISTORY_MAX));
}

function loadJackpot() {
  const jackpot = { ...defaultJackpot(), ...readJson(JACKPOT_FILE, {}) };
  jackpot.totalBits = finiteNumber(jackpot.totalBits, 0);
  jackpot.chance = clamp(finiteNumber(jackpot.chance, BASE_CHANCE), BASE_CHANCE, CAP_CHANCE);
  jackpot.lastReset = finiteNumber(jackpot.lastReset, Date.now());
  jackpot.lastActivity = finiteNumber(jackpot.lastActivity, Date.now());
  jackpot.lastDecay = finiteNumber(jackpot.lastDecay, Date.now());
  return jackpot;
}

function saveJackpot(jackpot) {
  writeJson(JACKPOT_FILE, jackpot);
}

function applyJackpotDecay(jackpot) {
  const now = Date.now();
  const idleMs = now - jackpot.lastActivity;
  const elapsedMs = now - jackpot.lastDecay;
  jackpot.lastDecay = now;

  if (idleMs >= IDLE_GRACE_MS && jackpot.chance > BASE_CHANCE && elapsedMs > 0) {
    const decay = (DECAY_PER_MIN / 60000) * elapsedMs;
    jackpot.chance = clamp(jackpot.chance - decay, BASE_CHANCE, CAP_CHANCE);
  }

  saveJackpot(jackpot);
  return jackpot;
}

function jackpotPayload() {
  const jackpot = applyJackpotDecay(loadJackpot());
  return {
    ...jackpot,
    lastResetIso: new Date(jackpot.lastReset).toISOString()
  };
}

function finiteNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pickSpinPayload(req) {
  return {
    source: req.body?.source || req.query.source || "streamtools",
    user: req.body?.user || req.query.user || "",
    reason: req.body?.reason || req.query.reason || "",
    ts: Date.now()
  };
}

router.get("/state", (req, res) => {
  res.json({
    ok: true,
    state: {
      ...runtimeState,
      jackpot: jackpotPayload()
    }
  });
});

router.get("/status", (req, res) => {
  res.json({ ok: true, status: runtimeState.status });
});

router.post("/status", (req, res) => {
  runtimeState.status = {
    spinning: Boolean(req.body?.spinning),
    by: typeof req.body?.by === "string" ? req.body.by : "slot",
    ts: finiteNumber(req.body?.ts, Date.now())
  };
  res.json({ ok: true, status: runtimeState.status });
});

router.get("/trigger-spin", requireBearerToken, (req, res) => {
  runtimeState.spinRequestId += 1;
  runtimeState.spinPayload = pickSpinPayload(req);
  res.json({ ok: true, spinRequestId: runtimeState.spinRequestId });
});

router.post("/trigger-spin", requireBearerToken, (req, res) => {
  runtimeState.spinRequestId += 1;
  runtimeState.spinPayload = pickSpinPayload(req);
  res.json({ ok: true, spinRequestId: runtimeState.spinRequestId });
});

router.get("/history", (req, res) => {
  res.json({ ok: true, history: loadHistory() });
});

router.post("/history", (req, res) => {
  const spin = req.body || {};

  if (
    typeof spin.species !== "string" ||
    typeof spin.theme !== "string" ||
    typeof spin.pose !== "string"
  ) {
    return res.status(400).json({ ok: false, error: "Missing spin result fields" });
  }

  const history = loadHistory();
  history.push({
    species: spin.species,
    theme: spin.theme,
    pose: spin.pose,
    ts: Date.now()
  });
  saveHistory(history);
  res.json({ ok: true, history: history.slice(-HISTORY_MAX) });
});

router.get("/jackpot", (req, res) => {
  res.json({ ok: true, state: jackpotPayload() });
});

router.get("/jackpot/increment", requireBearerToken, (req, res) => {
  incrementJackpot(req, res, req.query.delta);
});

router.post("/jackpot/increment", requireBearerToken, (req, res) => {
  incrementJackpot(req, res, req.body?.delta);
});

router.post("/jackpot/reset", (req, res) => {
  const jackpot = defaultJackpot();
  saveJackpot(jackpot);
  res.json({ ok: true, state: jackpotPayload() });
});

router.get("/modifier", (req, res) => {
  res.json({ ok: true, modifier: runtimeState.modifier });
});

router.get("/modifier/set", requireBearerToken, (req, res) => {
  setModifier(req, res, req.query.type);
});

router.post("/modifier/set", requireBearerToken, (req, res) => {
  setModifier(req, res, req.body?.type);
});

router.get("/modifier/clear", requireBearerToken, (req, res) => {
  clearModifier(res);
});

router.post("/modifier/clear", requireBearerToken, (req, res) => {
  clearModifier(res);
});

function incrementJackpot(req, res, value) {
  const delta = finiteNumber(value, 0);
  if (delta <= 0) {
    return res.status(400).json({ ok: false, error: "bad-delta" });
  }

  const jackpot = loadJackpot();
  const steps = Math.floor(delta / BITS_PER_STEP);
  jackpot.totalBits += Math.floor(delta);
  jackpot.chance = clamp(jackpot.chance + steps * STEP_INCREMENT, BASE_CHANCE, CAP_CHANCE);
  jackpot.lastActivity = Date.now();
  jackpot.lastDecay = Date.now();
  saveJackpot(jackpot);
  res.json({ ok: true, state: jackpotPayload() });
}

function setModifier(req, res, typeValue) {
  const type = String(typeValue || "").trim().toLowerCase();
  if (!type) {
    return res.status(400).json({ ok: false, error: "missing-type" });
  }

  runtimeState.modifier = { type, ts: Date.now() };
  res.json({ ok: true, modifier: runtimeState.modifier });
}

function clearModifier(res) {
  runtimeState.modifier = { type: null, ts: Date.now() };
  res.json({ ok: true, modifier: runtimeState.modifier });
}

module.exports = router;
