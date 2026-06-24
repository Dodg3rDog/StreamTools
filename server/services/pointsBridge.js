const { triggerStreamerBot } = require("./streamerbot");

const pendingRequests = new Map();
const snapshots = new Map();
const callbackTimeoutMs = 5000;

async function requestPointAction(args = {}) {
  const requestId = createRequestId();
  const actionName = process.env.STREAMERBOT_POINTS_ACTION_NAME || "StreamTools Points";

  const pending = waitForCallback(requestId);
  const streamerBot = await triggerStreamerBot(
    actionName,
    {
      ...(args || {}),
      streamToolsRequestId: requestId
    },
    "[Points]"
  );

  if (!streamerBot.ok) {
    clearPendingRequest(requestId);
    return {
      ok: false,
      streamerBot,
      error: streamerBot.reason || streamerBot.error || "Streamer.bot point action did not run"
    };
  }

  try {
    const snapshot = await pending;
    return {
      ok: true,
      streamerBot,
      snapshot
    };
  } catch (error) {
    return {
      ok: false,
      streamerBot,
      error: error.message
    };
  }
}

function receivePointCallback(snapshot) {
  const requestId = String(snapshot?.requestId || "").trim();
  if (!requestId) {
    throw new Error("Missing required field: requestId");
  }

  const normalizedSnapshot = normalizeSnapshot(snapshot);
  snapshots.set(requestId, normalizedSnapshot);

  const pending = pendingRequests.get(requestId);
  if (pending) {
    clearTimeout(pending.timeout);
    pending.resolve(normalizedSnapshot);
    pendingRequests.delete(requestId);
  }

  return normalizedSnapshot;
}

function waitForCallback(requestId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Timed out waiting for Streamer.bot point callback"));
    }, callbackTimeoutMs);

    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeout
    });
  });
}

function clearPendingRequest(requestId) {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeout);
  pendingRequests.delete(requestId);
}

function normalizeSnapshot(snapshot) {
  const pointName = String(snapshot?.pointName || "point");
  const pointsBalance = Number(snapshot?.pointsBalance ?? snapshot?.pointsBalanceAfter ?? 0) || 0;
  const pointsBalanceAfter = Number(snapshot?.pointsBalanceAfter ?? snapshot?.pointsBalance ?? 0) || 0;

  return {
    requestId: String(snapshot?.requestId || ""),
    type: String(snapshot?.type || ""),
    pointUserKey: String(snapshot?.pointUserKey || ""),
    pointVarName: sanitizeVarName(snapshot?.pointVarName || "points"),
    pointName,
    pointsApproved: snapshot?.pointsApproved === true,
    pointsBalanceBefore: Number(snapshot?.pointsBalanceBefore) || 0,
    pointsBalance,
    pointsBalanceAfter,
    pointsCost: Number(snapshot?.pointsCost) || 0,
    pointsDelta: Number(snapshot?.pointsDelta) || 0,
    pointsShortfall: Number(snapshot?.pointsShortfall) || 0,
    pointsDeniedReason: String(snapshot?.pointsDeniedReason || ""),
    receivedAt: String(snapshot?.receivedAt || new Date().toISOString())
  };
}

function sanitizeVarName(value) {
  const sanitized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "");

  return sanitized || "points";
}

function createRequestId() {
  return "points-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

module.exports = {
  receivePointCallback,
  requestPointAction,
  sanitizeVarName
};
