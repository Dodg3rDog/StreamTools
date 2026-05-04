(function () {
  const API_PATH = "/chat-games/code-break-protocol";
  const params = new URLSearchParams(window.location.search);
  const controlsEnabled = params.get("controls") !== "false";
  const pollMs = Number(params.get("pollMs") || 1000);

  const els = {
    phrase: document.getElementById("phrase"),
    statusPill: document.getElementById("statusPill"),
    meterFill: document.getElementById("meterFill"),
    missCount: document.getElementById("missCount"),
    guessCount: document.getElementById("guessCount"),
    letters: document.getElementById("letters"),
    eventLog: document.getElementById("eventLog"),
    controlsForm: document.getElementById("controlsForm"),
    guessInput: document.getElementById("guessInput"),
    newGameButton: document.getElementById("newGameButton")
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

  function render(state) {
    if (!state) return;

    const misses = state.misses || 0;
    const maxMisses = state.maxMisses || 6;
    const percent = Math.min(100, Math.round((misses / maxMisses) * 100));

    els.phrase.textContent = state.maskedPhrase || "- - -";
    els.meterFill.style.width = `${percent}%`;
    els.missCount.textContent = `${misses} / ${maxMisses}`;
    els.guessCount.textContent = String(state.guesses?.length || 0);

    const label = state.status === "won"
      ? "DECODED"
      : state.status === "lost"
        ? "BREACH"
        : "ACTIVE";

    els.statusPill.textContent = label;
    els.statusPill.classList.toggle("warning", state.status === "won");
    els.statusPill.classList.toggle("danger", state.status === "lost");

    els.letters.innerHTML = "";
    for (const guess of state.guesses || []) {
      const tile = document.createElement("div");
      tile.className = `letter${guess.hit ? "" : " miss"}`;
      tile.textContent = guess.value;
      els.letters.appendChild(tile);
    }

    els.eventLog.innerHTML = "";
    for (const event of state.events || []) {
      const line = document.createElement("div");
      line.textContent = event;
      els.eventLog.appendChild(line);
    }
  }

  async function refresh() {
    try {
      const data = await apiRequest("/state");
      render(data.state);
    } catch (error) {
      console.warn("[CodeBreak] state refresh failed:", error);
    }
  }

  async function submitGuess(value) {
    const guess = String(value || "").trim();
    if (!guess) return;

    const data = await apiRequest("/guess", {
      method: "POST",
      body: JSON.stringify({
        guess,
        user: params.get("user") || "workshop"
      })
    });

    render(data.state);
  }

  async function newGame() {
    const data = await apiRequest("/new", { method: "POST" });
    render(data.state);
  }

  if (!controlsEnabled) {
    els.controlsForm.classList.add("is-hidden");
  }

  els.controlsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitGuess(els.guessInput.value);
    els.guessInput.value = "";
    els.guessInput.focus();
  });

  els.newGameButton.addEventListener("click", newGame);

  window.CodeBreakProtocol = {
    refresh,
    submitGuess,
    newGame
  };

  refresh();
  setInterval(refresh, pollMs);
})();
