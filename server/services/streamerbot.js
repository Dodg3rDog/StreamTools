async function triggerStreamerBot(actionName, args, logPrefix = "[Streamer.bot]") {
  const streamerBotHttpUrl = process.env.STREAMERBOT_HTTP_URL || "";

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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
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
    console.warn(logPrefix + " Streamer.bot action trigger failed:", error.message);
    return {
      ok: false,
      error: error.message,
      actionName
    };
  }
}

module.exports = {
  triggerStreamerBot
};
