(function () {
  const API_PATH = "/chat-games/emote-sync-protocol";
  const params = new URLSearchParams(window.location.search);
  const controlsEnabled = params.get("controls") !== "false";
  const pollMs = Number(params.get("pollMs") || 1000);
  let lastRound = null;
  let lastStatus = null;

  const els = {
    sequence: document.getElementById("sequence"),
    status: document.getElementById("status"),
    syncAlert: document.getElementById("syncAlert"),
    progressFill: document.getElementById("progressFill"),
    stepCount: document.getElementById("stepCount"),
    timerCount: document.getElementById("timerCount"),
    roundCount: document.getElementById("roundCount"),
    scoreCount: document.getElementById("scoreCount"),
    highScoreCount: document.getElementById("highScoreCount"),
    lastSubmission: document.getElementById("lastSubmission"),
    strikeSlots: document.getElementById("strikeSlots"),
    eventLog: document.getElementById("eventLog"),
    correctLeaders: document.getElementById("correctLeaders"),
    incorrectLeaders: document.getElementById("incorrectLeaders"),
    controlsForm: document.getElementById("controlsForm"),
    submitInput: document.getElementById("submitInput"),
    newRoundButton: document.getElementById("newRoundButton")
  };

  function apiRequest(path, options = {}) {
    if (window.StreamToolsApi) {
      return window.StreamToolsApi.request(`${API_PATH}${path}`, options);
    }

    return fetch(`/api${API_PATH}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    }).then((response) => response.json());
  }

  function configuredEmotes() {
    const config = window.EMOTE_SYNC_CONFIG || {};
    return {
      sequenceLength: config.sequenceLength || 5,
      maxStrikes: config.maxStrikes || 3,
      roundMs: config.roundMs || 45000,
      nextRoundDelayMs: config.nextRoundDelayMs || 4500,
      emotes: [
        ...(config.globalEmotes || []),
        ...(config.channelEmotes || [])
      ].filter((emote) => emote?.name)
    };
  }

  async function ensureServerConfig() {
    const config = configuredEmotes();
    if (!config.emotes.length) return;

    try {
      await apiRequest("/configure", {
        method: "POST",
        body: JSON.stringify(config)
      });
    } catch (error) {
      console.warn("[EmoteSync] configure failed:", error);
    }
  }

  function initials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function renderAvatar(user, avatar) {
    if (avatar) {
      const img = document.createElement("img");
      img.className = "avatar-img";
      img.src = avatar;
      img.alt = user || "viewer";
      return img;
    }

    const fallback = document.createElement("div");
    fallback.className = "avatar-fallback";
    fallback.textContent = initials(user) || "🐺";
    return fallback;
  }

  function renderEmoteTile(emote, index, cursor, syncedBy = []) {
    const contributor = syncedBy[index];
    const tile = document.createElement("div");
    tile.className = "emote-tile";
    if (contributor || index < cursor) tile.classList.add("complete");
    if (index === cursor) tile.classList.add("current");

    if (contributor) {
      tile.appendChild(renderAvatar(contributor.user, contributor.avatar));

      const contributorName = document.createElement("div");
      contributorName.className = "contributor-name";
      contributorName.textContent = contributor.user;
      tile.appendChild(contributorName);

      const expectedName = document.createElement("div");
      expectedName.className = "expected-name";
      expectedName.textContent = emote.name;
      tile.appendChild(expectedName);
      return tile;
    }

    if (emote.image) {
      const img = document.createElement("img");
      img.src = emote.image;
      img.alt = emote.name;
      tile.appendChild(img);
    }

    const name = document.createElement("div");
    name.className = "emote-name";
    name.textContent = emote.name;
    tile.appendChild(name);

    return tile;
  }

  function formatSeconds(ms) {
    return String(Math.max(0, Math.ceil(Number(ms || 0) / 1000))).padStart(2, "0");
  }

  function flashSyncAlert(text) {
    if (!els.syncAlert) return;

    els.syncAlert.textContent = text;
    els.syncAlert.classList.remove("is-visible");
    void els.syncAlert.offsetWidth;
    els.syncAlert.classList.add("is-visible");
  }

  function renderLeaders(target, leaders, field) {
    target.innerHTML = "";
    const rows = Array.isArray(leaders) ? leaders.slice(0, 3) : [];

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "leader-row";
      empty.textContent = "No records yet";
      target.appendChild(empty);
      return;
    }

    for (const row of rows) {
      const item = document.createElement("div");
      item.className = "leader-row";

      const name = document.createElement("span");
      name.textContent = row.user;

      const count = document.createElement("strong");
      count.textContent = row[field] || 0;

      item.append(name, count);
      target.appendChild(item);
    }
  }

  function renderLastSubmission(submission) {
    els.lastSubmission.className = "incoming-card";
    els.lastSubmission.innerHTML = "";

    if (!submission) {
      els.lastSubmission.textContent = "Awaiting chat input...";
      return;
    }

    els.lastSubmission.classList.add(submission.hit ? "hit" : "miss");
    els.lastSubmission.appendChild(renderAvatar(submission.user, submission.avatar));

    const text = document.createElement("div");
    text.className = "incoming-text";

    const name = document.createElement("strong");
    name.textContent = submission.user;

    const details = document.createElement("span");
    details.textContent = `${submission.value} ${submission.hit ? "matched" : `missed ${submission.expected || ""}`}`;

    text.append(name, details);
    els.lastSubmission.appendChild(text);
  }

  function renderStrikeSlots(strikes = [], maxStrikes = 3) {
    els.strikeSlots.innerHTML = "";
    const slots = Number(maxStrikes) || 3;

    for (let index = 0; index < slots; index++) {
      const submission = strikes[index];
      const slot = document.createElement("div");
      slot.className = "strike-slot";

      if (submission) {
        slot.classList.add("filled");
        slot.appendChild(renderAvatar(submission.user, submission.avatar));

        const name = document.createElement("div");
        name.className = "strike-name";
        name.textContent = submission.user;
        slot.appendChild(name);
      } else {
        slot.textContent = "Clear";
      }

      els.strikeSlots.appendChild(slot);
    }
  }

  function render(state) {
    if (!state) return;
    const routeIsCurrent = state.remainingMs != null && state.round != null && state.leaders != null;

    const total = state.sequence?.length || 0;
    const cursor = state.cursor || 0;
    const progress = total ? Math.round((cursor / total) * 100) : 0;

    els.sequence.innerHTML = "";
    for (const [index, emote] of (state.sequence || []).entries()) {
      els.sequence.appendChild(renderEmoteTile(emote, index, cursor, state.syncedBy || []));
    }

    els.status.textContent = !routeIsCurrent
      ? "RESTART"
      : state.status === "won"
      ? "SYNCED"
      : state.status === "lost"
        ? "DESYNC"
        : "ACTIVE";
    els.status.classList.toggle("success", routeIsCurrent && state.status === "won");
    els.status.classList.toggle("danger", !routeIsCurrent || state.status === "lost");

    if (lastRound === state.round && lastStatus !== state.status && state.status === "won") {
      flashSyncAlert("Signal Synchronized");
    }

    if (lastRound === state.round && lastStatus !== state.status && state.status === "lost") {
      flashSyncAlert("Pattern Desynced");
    }

    lastRound = state.round;
    lastStatus = state.status;

    els.progressFill.style.width = `${progress}%`;
    els.stepCount.textContent = state.status === "active"
      ? `${Math.min(cursor + 1, total)} / ${total}`
      : `${cursor} / ${total}`;
    els.timerCount.textContent = !routeIsCurrent
      ? "--"
      : state.status === "active"
      ? formatSeconds(state.remainingMs)
      : `+${formatSeconds(state.nextRoundInMs)}`;
    els.roundCount.textContent = routeIsCurrent ? String(state.round || 0) : "--";
    els.scoreCount.textContent = routeIsCurrent ? String(state.score || 0) : "--";
    els.highScoreCount.textContent = routeIsCurrent ? String(state.highScore || 0) : "--";

    renderLastSubmission(state.lastSubmission);
    renderStrikeSlots(state.strikeSubmissions || [], state.maxStrikes || 3);

    els.eventLog.innerHTML = "";
    if (!routeIsCurrent) {
      const warning = document.createElement("div");
      warning.textContent = "Workshop server restart required for timer, score, records, and auto-advance.";
      els.eventLog.appendChild(warning);
    }

    for (const event of state.events || []) {
      const line = document.createElement("div");
      line.textContent = event;
      els.eventLog.appendChild(line);
    }

    renderLeaders(els.correctLeaders, state.leaders?.correct, "correct");
    renderLeaders(els.incorrectLeaders, state.leaders?.incorrect, "incorrect");
  }

  async function refresh() {
    try {
      const data = await apiRequest("/state");
      render(data.state);
    } catch (error) {
      console.warn("[EmoteSync] state refresh failed:", error);
    }
  }

  async function submit(value) {
    const message = String(value || "").trim();
    if (!message) return;

    const data = await apiRequest("/submit", {
      method: "POST",
      body: JSON.stringify({
        message,
        user: params.get("user") || "workshop",
        avatar: params.get("avatar") || params.get("profileImage") || ""
      })
    });

    render(data.state);
  }

  async function newRound() {
    const data = await apiRequest("/new", { method: "POST" });
    render(data.state);
  }

  if (!controlsEnabled) {
    els.controlsForm.classList.add("is-hidden");
  }

  els.controlsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submit(els.submitInput.value);
    els.submitInput.value = "";
    els.submitInput.focus();
  });

  els.newRoundButton.addEventListener("click", newRound);

  window.EmoteSyncProtocol = {
    refresh,
    submit,
    newRound
  };

  ensureServerConfig().then(refresh);
  setInterval(refresh, pollMs);
})();
