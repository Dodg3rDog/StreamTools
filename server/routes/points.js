const express = require("express");
const { requireBearerToken } = require("../middleware/auth");
const {
  receivePointCallback,
  requestPointAction,
  sanitizeVarName
} = require("../services/pointsBridge");

const router = express.Router();

router.get("/settings", requireBearerToken, async (req, res) => {
  const result = await requestPointAction({
    pointOperation: "settings",
    pointSettingsMode: "get"
  });

  sendPointResult(res, result);
});

router.post("/settings", requireBearerToken, async (req, res) => {
  const result = await requestPointAction({
    pointOperation: "settings",
    pointSettingsMode: "set",
    pointVarName: sanitizeVarName(req.body?.pointVarName || "points"),
    pointName: String(req.body?.pointName || req.body?.pointDisplayName || "point").trim()
  });

  sendPointResult(res, result);
});

router.get("/user", requireBearerToken, async (req, res) => {
  const pointUserKey = String(req.query?.pointUserKey || req.query?.userKey || "").trim();

  if (!pointUserKey) {
    return res.status(400).json({
      ok: false,
      error: "Missing required query parameter: pointUserKey"
    });
  }

  const result = await requestPointAction({
    pointOperation: "get",
    pointUserKey
  });

  sendPointResult(res, result);
});

router.post("/user", requireBearerToken, async (req, res) => {
  const pointUserKey = String(req.body?.pointUserKey || req.body?.userKey || "").trim();
  const pointOperation = String(req.body?.pointOperation || req.body?.operation || "set").trim().toLowerCase();
  const points = Number.parseInt(req.body?.points ?? req.body?.amount ?? 0, 10) || 0;

  if (!pointUserKey) {
    return res.status(400).json({
      ok: false,
      error: "Missing required field: pointUserKey"
    });
  }

  if (!["set", "add", "award", "spend", "deduct"].includes(pointOperation)) {
    return res.status(400).json({
      ok: false,
      error: "Unsupported pointOperation"
    });
  }

  const result = await requestPointAction({
    pointOperation,
    pointUserKey,
    points,
    amount: points,
    pointCost: points
  });

  sendPointResult(res, result);
});

router.post("/callback", requireBearerToken, (req, res) => {
  try {
    const snapshot = receivePointCallback(req.body || {});

    res.json({
      ok: true,
      snapshot
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

function sendPointResult(res, result) {
  if (result.ok) {
    return res.json({
      ok: true,
      streamerBot: result.streamerBot,
      snapshot: result.snapshot
    });
  }

  return res.status(502).json({
    ok: false,
    streamerBot: result.streamerBot,
    error: result.error
  });
}

module.exports = router;
