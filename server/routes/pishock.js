const express = require("express");
const { requireBearerToken } = require("../middleware/auth");

const router = express.Router();

let relayStatus = {
  online: true,
  chargePool: 0,
  hypeLevel: 0,
  overloadArmed: false,
  lastIntensity: 0,
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
  const {
    chargePool,
    hypeLevel,
    overloadArmed,
    lastIntensity,
    mode
  } = req.body || {};

  relayStatus = {
    ...relayStatus,
    chargePool: Number.isFinite(Number(chargePool))
      ? Number(chargePool)
      : relayStatus.chargePool,

    hypeLevel: Number.isFinite(Number(hypeLevel))
      ? Number(hypeLevel)
      : relayStatus.hypeLevel,

    overloadArmed:
      typeof overloadArmed === "boolean"
        ? overloadArmed
        : relayStatus.overloadArmed,

    lastIntensity: Number.isFinite(Number(lastIntensity))
      ? Number(lastIntensity)
      : relayStatus.lastIntensity,

    mode: mode || relayStatus.mode,

    lastDischargeAt:
      mode === "discharge" || mode === "overload"
        ? new Date().toISOString()
        : relayStatus.lastDischargeAt
  };

  res.json({
    ok: true,
    status: relayStatus
  });
});

module.exports = router;
