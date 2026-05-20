const express = require("express");
const fs = require("fs");
const path = require("path");
const { requireBearerToken } = require("../middleware/auth");

const router = express.Router();
const logDir = path.join(__dirname, "../data/pishock");
const statusLogPath = path.join(logDir, "status-events.ndjson");

let relayStatus = createDefaultRelayStatus();
let relayRevision = 0;

router.get("/status", (req, res) => {
  res.json({
    ok: true,
    status: getLiveStatus()
  });
});

router.post("/status", requireBearerToken, (req, res) => {
  const body = req.body || {};
  const { mode } = body;
  const incomingSequence = Number(body.statusSequence);
  const currentSequence = Number(relayStatus.statusSequence) || 0;
  const isResetUpdate =
    String(body.eventType || "").toLowerCase() === "reset" ||
    String(mode || "").toLowerCase() === "reset";

  if (!isResetUpdate && Number.isFinite(incomingSequence) && incomingSequence < currentSequence) {
    const status = getLiveStatus();

    appendStatusLog({
      ...status,
      ignoredStaleUpdate: true,
      ignoredStatusSequence: incomingSequence
    });

    return res.json({
      ok: true,
      ignored: true,
      reason: "stale-status-sequence",
      status
    });
  }

  const baseStatus = isResetUpdate ? createDefaultRelayStatus() : relayStatus;

  relayStatus = {
    ...baseStatus,
    ...pickNumeric(body, [
      "chargePool",
      "pressureGauge",
      "maxPressureGauge",
      "hypeLevel",
      "currentVoltage",
      "storedVoltage",
      "normalVoltageCap",
      "overloadVoltageCap",
      "lastIntensity",
      "chancePercent",
      "missCount",
      "cooldownRemaining",
      "cooldownTotal",
      "overloadRemaining",
      "eventCountdownRemaining",
      "eventCountdownTotal",
      "eventValueBits",
      "statusSequence"
    ]),
    ...pickBoolean(body, [
      "overloadArmed",
      "overloadActive",
      "overloadVenting"
    ]),
    ...pickString(body, [
      "cooldownUntilUtc",
      "overloadUntilUtc",
      "eventCountdownUntilUtc",
      "currentViewerName",
      "currentViewerImageUrl",
      "eventMessage",
      "tickerMessage",
      "eventType"
    ]),
    mode: isResetUpdate ? "reset" : (mode || baseStatus.mode)
  };

  if (isResetUpdate) {
    relayStatus = {
      ...createDefaultRelayStatus(),
      eventType: "reset",
      eventMessage: typeof body.eventMessage === "string" && body.eventMessage
        ? body.eventMessage
        : "Containment status reset.",
      statusSequence: Number.isFinite(incomingSequence)
        ? incomingSequence
        : currentSequence,
      mode: "reset"
    };
  }

  const updatedAt = new Date().toISOString();

  relayStatus.lastDischargeAt =
    mode === "discharge" || mode === "overload" || mode === "venting" || mode === "flush"
      ? updatedAt
      : baseStatus.lastDischargeAt;
  relayStatus.updatedAt = updatedAt;
  relayRevision += 1;
  relayStatus.statusRevision = relayRevision;

  relayStatus = getLiveStatus();

  appendStatusLog(relayStatus);

  res.json({
    ok: true,
    status: relayStatus
  });
});

function createDefaultRelayStatus() {
  return {
    online: true,
    chargePool: 0,
    pressureGauge: 0,
    maxPressureGauge: 100,
    hypeLevel: 0,
    overloadArmed: false,
    overloadActive: false,
    overloadVenting: false,
    currentVoltage: 0,
    storedVoltage: 0,
    normalVoltageCap: 20,
    overloadVoltageCap: 30,
    lastIntensity: 0,
    chancePercent: 0,
    missCount: 0,
    cooldownRemaining: 0,
    cooldownTotal: 0,
    cooldownUntilUtc: "",
    overloadRemaining: 0,
    overloadUntilUtc: "",
    eventCountdownRemaining: 0,
    eventCountdownTotal: 0,
    eventCountdownUntilUtc: "",
    currentViewerName: "",
    currentViewerImageUrl: "",
    eventMessage: "",
    tickerMessage: "",
    eventType: "",
    eventValueBits: 0,
    lastDischargeAt: null,
    updatedAt: null,
    statusRevision: 0,
    statusSequence: 0,
    mode: "idle"
  };
}

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
    const pressureAtExpiry = Number(status.pressureGauge) || 0;
    const currentBefore = Number(status.currentVoltage) || Number(status.chargePool) || 0;
    const storedBefore = Number(status.storedVoltage) || 0;
    const normalCap = Number(status.normalVoltageCap) || 20;
    const overloadCap = Number(status.overloadVoltageCap) || 30;
    const shouldEmergencyDischarge = pressureAtExpiry >= 100;
    const updatedAt = new Date(now).toISOString();

    status.overloadRemaining = 0;
    status.overloadUntilUtc = "";
    status.overloadActive = false;
    status.overloadArmed = false;
    status.overloadVenting = false;
    status.maxPressureGauge = 100;
    status.currentViewerName = "";
    status.currentViewerImageUrl = "";
    status.eventValueBits = 0;

    if (shouldEmergencyDischarge) {
      const spentCurrent = Math.min(Math.max(0, currentBefore), overloadCap);
      const refilledCurrent = Math.min(Math.max(0, storedBefore), normalCap);
      status.pressureGauge = 0;
      status.chargePool = refilledCurrent;
      status.currentVoltage = refilledCurrent;
      status.storedVoltage = Math.max(0, storedBefore - refilledCurrent);
      status.lastIntensity = spentCurrent;
      status.eventType = "overload-expired-discharge";
      status.eventMessage = "Overload expired at maximum standard pressure. Emergency discharge initiated.";
      status.tickerMessage = "ERROR // SYSTEM PRESSURE AT MAX CAPACITY // EMERGENCY DISCHARGE INITIATED";
      status.mode = "overload-expired-discharge";
      status.lastDischargeAt = updatedAt;
    } else {
      const overflowCurrent = Math.max(0, currentBefore - normalCap);
      const currentAfterRecovery = Math.min(Math.max(0, currentBefore), normalCap);
      const storedAfterRecovery = Math.min(99, Math.max(0, storedBefore) + overflowCurrent);
      status.pressureGauge = Math.min(pressureAtExpiry, 100);
      status.chargePool = currentAfterRecovery;
      status.currentVoltage = currentAfterRecovery;
      status.storedVoltage = storedAfterRecovery;
      status.eventType = "overload-expired-recovery";
      status.eventMessage = "Overload protocol expired. Storage capacitors back online.";
      status.tickerMessage = "PRESSURE REROUTING COMPLETE // STANDARD OPERATING LEVELS RESTORED";
      status.mode = "overload-expired-recovery";
    }

    relayRevision += 1;
    status.updatedAt = updatedAt;
    status.statusRevision = relayRevision;
    status.statusSequence = (Number(status.statusSequence) || 0) + 1;
    relayStatus = status;
    appendStatusLog(relayStatus);
  }

  const eventCountdownUntilMs = Date.parse(status.eventCountdownUntilUtc || "");
  if (Number.isFinite(eventCountdownUntilMs) && eventCountdownUntilMs > now) {
    status.eventCountdownRemaining = Math.ceil((eventCountdownUntilMs - now) / 1000);
  } else if (status.eventCountdownUntilUtc) {
    status.eventCountdownRemaining = 0;
    status.eventCountdownTotal = 0;
    status.eventCountdownUntilUtc = "";
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
