const express = require("express");
const fs = require("fs");
const path = require("path");
const { requireBearerToken } = require("../middleware/auth");

const router = express.Router();
const logDir = path.join(__dirname, "../data/pishock");
const statusLogPath = path.join(logDir, "status-events.ndjson");

let relayStatus = {
  online: true,
  chargePool: 0,
  pressureGauge: 0,
  maxPressureGauge: 100,
  hypeLevel: 0,
  overloadArmed: false,
  overloadActive: false,
  overloadVenting: false,
  lastIntensity: 0,
  chancePercent: 0,
  missCount: 0,
  cooldownRemaining: 0,
  cooldownTotal: 0,
  cooldownUntilUtc: "",
  overloadRemaining: 0,
  overloadUntilUtc: "",
  currentViewerName: "",
  currentViewerImageUrl: "",
  eventMessage: "",
  eventType: "",
  eventValueBits: 0,
  lastDischargeAt: null,
  mode: "idle"
};

router.get("/status", (req, res) => {
  res.json({
    ok: true,
    status: getLiveStatus()
  });
});

router.post("/status", requireBearerToken, (req, res) => {
  const body = req.body || {};
  const { mode } = body;

  relayStatus = {
    ...relayStatus,
    ...pickNumeric(body, [
      "chargePool",
      "pressureGauge",
      "maxPressureGauge",
      "hypeLevel",
      "lastIntensity",
      "chancePercent",
      "missCount",
      "cooldownRemaining",
      "cooldownTotal",
      "overloadRemaining",
      "eventValueBits"
    ]),
    ...pickBoolean(body, [
      "overloadArmed",
      "overloadActive",
      "overloadVenting"
    ]),
    ...pickString(body, [
      "cooldownUntilUtc",
      "overloadUntilUtc",
      "currentViewerName",
      "currentViewerImageUrl",
      "eventMessage",
      "eventType"
    ]),
    mode: mode || relayStatus.mode
  };

  relayStatus.lastDischargeAt =
    mode === "discharge" || mode === "overload" || mode === "venting" || mode === "flush"
      ? new Date().toISOString()
      : relayStatus.lastDischargeAt;

  relayStatus = getLiveStatus();

  appendStatusLog(relayStatus);

  res.json({
    ok: true,
    status: relayStatus
  });
});

function getLiveStatus() {
  const status = { ...relayStatus };
  const now = Date.now();

  const cooldownUntilMs = Date.parse(status.cooldownUntilUtc || "");
  if (Number.isFinite(cooldownUntilMs) && cooldownUntilMs > now) {
    status.cooldownRemaining = Math.ceil((cooldownUntilMs - now) / 1000);
  } else if (status.cooldownUntilUtc) {
    status.cooldownRemaining = 0;
    status.cooldownTotal = 0;
    status.cooldownUntilUtc = "";

    if (status.mode === "cooldown") {
      status.mode = "idle";
      status.eventMessage = "Safety lockout cleared. Relay ready.";
    }
  } else if (status.cooldownRemaining > 0) {
    status.cooldownRemaining = 0;
    status.cooldownTotal = 0;

    if (status.mode === "cooldown") {
      status.mode = "idle";
      status.eventMessage = "Safety lockout cleared. Relay ready.";
    }
  }

  const overloadUntilMs = Date.parse(status.overloadUntilUtc || "");
  if (Number.isFinite(overloadUntilMs) && overloadUntilMs > now) {
    status.overloadRemaining = Math.ceil((overloadUntilMs - now) / 1000);
  } else if (status.overloadUntilUtc) {
    status.overloadRemaining = 0;
  }

  return status;
}

function pickNumeric(source, fields) {
  return fields.reduce((picked, field) => {
    if (Number.isFinite(Number(source[field]))) {
      picked[field] = Number(source[field]);
    }

    return picked;
  }, {});
}

function pickBoolean(source, fields) {
  return fields.reduce((picked, field) => {
    if (typeof source[field] === "boolean") {
      picked[field] = source[field];
    }

    return picked;
  }, {});
}

function pickString(source, fields) {
  return fields.reduce((picked, field) => {
    if (typeof source[field] === "string") {
      picked[field] = source[field];
    }

    return picked;
  }, {});
}

function appendStatusLog(status) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      statusLogPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        status
      }) + "\n",
      "utf8"
    );
  } catch (error) {
    console.warn("[PiShock] Failed to write status log:", error.message);
  }
}

module.exports = router;
