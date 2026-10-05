async function triggerStreamerBot(actionName, args, logPrefix = "[Streamer.bot]") {
  const streamerBotHttpUrl = process.env.STREAMERBOT_HTTP_URL || "";
  const timeoutMs = clampTimeout(process.env.STREAMERBOT_HTTP_TIMEOUT_MS || 2500);

  if (!streamerBotHttpUrl) {
    return {
      ok: false,
      skipped: true,
      reason: "STREAMERBOT_HTTP_URL not configured"
    };
  }

  const url = streamerBotHttpUrl.replace(/\/$/, "") + "/DoAction";
  const body = {
    action: {
      name: actionName
    },
    args
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok && response.status !== 204) {
      console.warn(logPrefix + " Streamer.bot returned " + response.status + " for action " + actionName);
      return {
        ok: false,
        status: response.status,
        actionName
      };
    }

    console.log(logPrefix + " Streamer.bot action triggered: " + actionName + " Status=" + response.status);

    return {
      ok: true,
      status: response.status,
      actionName
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn(logPrefix + " Streamer.bot action trigger timed out after " + timeoutMs + "ms: " + actionName);
      return {
        ok: false,
        timeout: true,
        timeoutMs,
        actionName
      };
    }

    console.warn(logPrefix + " Streamer.bot action trigger failed:", error.message);
    return {
      ok: false,
      error: error.message,
      actionName
    };
  } finally {
    clearTimeout(timeout);
  }
}

function clampTimeout(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 2500;
  }

  return Math.min(Math.max(parsed, 500), 30000);
}

module.exports = {
  triggerStreamerBot
};
