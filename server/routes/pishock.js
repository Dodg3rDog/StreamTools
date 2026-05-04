const express = require("express");
const { requireBearerToken } = require("../middleware/auth");

const router = express.Router();

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
    status: relayStatus
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
      "eventValueBits"
    ]),
    ...pickBoolean(body, [
      "overloadArmed",
      "overloadActive",
      "overloadVenting"
    ]),
    ...pickString(body, [
      "currentViewerName",
      "currentViewerImageUrl",
      "eventMessage",
      "eventType"
    ]),
    mode: mode || relayStatus.mode
  };

  relayStatus.lastDischargeAt =
    mode === "discharge" || mode === "overload" || mode === "venting"
      ? new Date().toISOString()
      : relayStatus.lastDischargeAt;

  res.json({
    ok: true,
    status: relayStatus
  });
});

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

module.exports = router;
