// ------------------------------------------------------------
// 00) State
// ------------------------------------------------------------

const state = {
  boardConfig: {
    maxButtonsPerRow: 5
  },
  redeems: [],
  selectedRedeemId: "",
  token: window.localStorage.getItem("streamtoolsAdminToken") || ""
};

// ------------------------------------------------------------
// 01) DOM References
// ------------------------------------------------------------

const tokenInput = document.getElementById("tokenInput");
const statusRow = document.getElementById("statusRow");
const workspaceTitle = document.querySelector(".workspace-header h2");
const sectionButtons = Array.from(document.querySelectorAll(".section-button"));
const adminSections = Array.from(document.querySelectorAll(".admin-section"));
const redeemForm = document.getElementById("redeemForm");
const redeemList = document.getElementById("redeemList");
const redeemIdInput = document.getElementById("redeemId");
const redeemNameInput = document.getElementById("redeemName");
const redeemEmojiInput = document.getElementById("redeemEmoji");
const redeemStyleInput = document.getElementById("redeemStyle");
const redeemPointCostInput = document.getElementById("redeemPointCost");
const redeemVisibleInput = document.getElementById("redeemVisible");
const redeemDisabledInput = document.getElementById("redeemDisabled");
const redeemRequiresInputInput = document.getElementById("redeemRequiresInput");
const redeemInputTitleInput = document.getElementById("redeemInputTitle");
const redeemInputLabelInput = document.getElementById("redeemInputLabel");
const redeemInputPlaceholderInput = document.getElementById("redeemInputPlaceholder");
const redeemInputStyleInput = document.getElementById("redeemInputStyle");
const redeemInputRequiredInput = document.getElementById("redeemInputRequired");
const redeemOrderText = document.getElementById("redeemOrderText");
const moveRedeemEarlierButton = document.getElementById("moveRedeemEarlierButton");
const moveRedeemLaterButton = document.getElementById("moveRedeemLaterButton");
const newRedeemButton = document.getElementById("newRedeemButton");
const deleteRedeemButton = document.getElementById("deleteRedeemButton");
const refreshButton = document.getElementById("refreshButton");
const pointSettingsForm = document.getElementById("pointSettingsForm");
const pointUserForm = document.getElementById("pointUserForm");
const refreshPointSettingsButton = document.getElementById("refreshPointSettingsButton");
const refreshPointUserButton = document.getElementById("refreshPointUserButton");
const addPointUserButton = document.getElementById("addPointUserButton");
const pointVarNameInput = document.getElementById("pointVarName");
const pointNameInput = document.getElementById("pointName");
const pointUserKeyInput = document.getElementById("pointUserKey");
const pointUserBalanceInput = document.getElementById("pointUserBalance");
const pointUserDeltaInput = document.getElementById("pointUserDelta");

// ------------------------------------------------------------
// 02) Init
// ------------------------------------------------------------

tokenInput.value = state.token;

tokenInput.addEventListener("input", () => {
  state.token = tokenInput.value.trim();
  window.localStorage.setItem("streamtoolsAdminToken", state.token);
});

sectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!button.disabled) {
      selectSection(button.dataset.section);
    }
  });
});

redeemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveRedeem();
});

newRedeemButton.addEventListener("click", () => {
  selectRedeem(null);
});

deleteRedeemButton.addEventListener("click", async () => {
  await deleteRedeem();
});

redeemRequiresInputInput.addEventListener("change", () => {
  updateInputControls();
});

moveRedeemEarlierButton.addEventListener("click", async () => {
  await moveSelectedRedeem(-1);
});

moveRedeemLaterButton.addEventListener("click", async () => {
  await moveSelectedRedeem(1);
});

refreshButton.addEventListener("click", () => {
  loadRedeems();
});

pointSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await savePointSettings();
});

pointUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await setPointUserBalance();
});

refreshPointSettingsButton.addEventListener("click", async () => {
  await loadPointSettings();
});

refreshPointUserButton.addEventListener("click", async () => {
  await loadPointUserBalance();
});

addPointUserButton.addEventListener("click", async () => {
  await addPointUserBalance();
});

loadRedeems();

// ------------------------------------------------------------
// 03) API
// ------------------------------------------------------------

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (options.auth) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with ${response.status}`);
  }

  return data;
}

async function loadPointSettings() {
  if (!state.token) {
    setStatus("Enter the server bearer token before loading point settings.", "error");
    return;
  }

  setStatus("Loading point settings...");

  try {
    const data = await apiRequest("/api/points/settings", {
      auth: true
    });
    applyPointSnapshot(data.snapshot);
    setStatus("Point settings loaded from Streamer.bot.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function savePointSettings() {
  if (!state.token) {
    setStatus("Enter the server bearer token before saving point settings.", "error");
    return;
  }

  try {
    const data = await apiRequest("/api/points/settings", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        pointVarName: pointVarNameInput.value.trim(),
        pointName: pointNameInput.value.trim()
      })
    });
    applyPointSnapshot(data.snapshot);
    setStatus("Point settings saved in Streamer.bot.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function loadPointUserBalance() {
  if (!state.token) {
    setStatus("Enter the server bearer token before loading a point balance.", "error");
    return;
  }

  const pointUserKey = pointUserKeyInput.value.trim();
  if (!pointUserKey) {
    setStatus("Enter a user key first.", "error");
    return;
  }

  setStatus("Loading point balance...");

  try {
    const data = await apiRequest(`/api/points/user?pointUserKey=${encodeURIComponent(pointUserKey)}`, {
      auth: true
    });
    applyPointSnapshot(data.snapshot);
    setStatus("Point balance loaded from Streamer.bot.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function setPointUserBalance() {
  await mutatePointUserBalance("set", Number.parseInt(pointUserBalanceInput.value, 10) || 0);
}

async function addPointUserBalance() {
  await mutatePointUserBalance("add", Number.parseInt(pointUserDeltaInput.value, 10) || 0);
}

async function mutatePointUserBalance(pointOperation, points) {
  if (!state.token) {
    setStatus("Enter the server bearer token before changing point balances.", "error");
    return;
  }

  const pointUserKey = pointUserKeyInput.value.trim();
  if (!pointUserKey) {
    setStatus("Enter a user key first.", "error");
    return;
  }

  try {
    const data = await apiRequest("/api/points/user", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        pointOperation,
        pointUserKey,
        points
      })
    });
    applyPointSnapshot(data.snapshot);
    setStatus("Point balance updated in Streamer.bot.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function loadRedeems() {
  setStatus("Loading redeems...");

  try {
    const data = await apiRequest("/api/discord/redeems");
    state.boardConfig = data.boardConfig || state.boardConfig;
    state.redeems = data.redeems || [];
    renderRedeems();

    if (state.selectedRedeemId) {
      selectRedeem(state.redeems.find((redeem) => redeem.redeemId === state.selectedRedeemId) || null);
    } else {
      selectRedeem(state.redeems[0] || null);
    }

    setStatus("Redeems loaded.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function saveRedeem() {
  if (!state.token) {
    setStatus("Enter the server bearer token before saving.", "error");
    return;
  }

  const payload = {
    redeemId: redeemIdInput.value,
    label: redeemNameInput.value.trim(),
    emoji: redeemEmojiInput.value.trim(),
    order: getSelectedRedeem()?.order || getNextOrder(),
    pointCost: Math.max(0, Number.parseInt(redeemPointCostInput.value, 10) || 0),
    style: redeemStyleInput.value,
    visible: redeemVisibleInput.checked,
    disabled: redeemDisabledInput.checked,
    requiresInput: redeemRequiresInputInput.checked,
    inputTitle: redeemInputTitleInput.value.trim(),
    inputLabel: redeemInputLabelInput.value.trim(),
    inputPlaceholder: redeemInputPlaceholderInput.value.trim(),
    inputRequired: redeemInputRequiredInput.checked,
    inputStyle: redeemInputStyleInput.value
  };

  try {
    const data = await apiRequest("/api/discord/redeems/upsert", {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload)
    });

    state.redeems = data.redeems || [];
    state.selectedRedeemId = data.redeem?.redeemId || "";
    renderRedeems();
    selectRedeem(state.redeems.find((redeem) => redeem.redeemId === state.selectedRedeemId) || null);
    setStatus("Redeem saved. Restart/reload the Discord Trigger Bridge to refresh Streamer.bot trigger options.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function moveSelectedRedeem(direction) {
  if (!state.selectedRedeemId) {
    return;
  }

  await moveRedeem(state.selectedRedeemId, direction);
}

async function moveRedeem(redeemId, direction) {
  if (!state.token) {
    setStatus("Enter the server bearer token before reordering.", "error");
    return;
  }

  const index = state.redeems.findIndex((redeem) => redeem.redeemId === redeemId);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= state.redeems.length) {
    return;
  }

  const nextRedeems = state.redeems.slice();
  const movedRedeem = nextRedeems[index];
  nextRedeems[index] = nextRedeems[nextIndex];
  nextRedeems[nextIndex] = movedRedeem;

  try {
    const data = await apiRequest("/api/discord/redeems/reorder", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        redeemIds: nextRedeems.map((redeem) => redeem.redeemId)
      })
    });

    state.redeems = data.redeems || [];
    renderRedeems();
    updateOrderControls();
    setStatus("Redeem order saved. Repost /redeems in Discord to show the updated board.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function deleteRedeem() {
  if (!state.selectedRedeemId) {
    selectRedeem(null);
    return;
  }

  if (!state.token) {
    setStatus("Enter the server bearer token before deleting.", "error");
    return;
  }

  try {
    const data = await apiRequest("/api/discord/redeems/remove", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ redeemId: state.selectedRedeemId })
    });

    state.redeems = data.redeems || [];
    renderRedeems();
    selectRedeem(state.redeems[0] || null);
    setStatus("Redeem deleted.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

// ------------------------------------------------------------
// 04) Render
// ------------------------------------------------------------

function renderRedeems() {
  redeemList.innerHTML = "";
  redeemList.style.setProperty("--redeem-columns", String(getBoardColumns()));

  if (state.redeems.length === 0) {
    redeemList.innerHTML = "<p class=\"redeem-meta\">No redeems configured.</p>";
    return;
  }

  state.redeems.forEach((redeem, index) => {
    const item = document.createElement("div");
    item.className = [
      "redeem-item",
      redeem.redeemId === state.selectedRedeemId ? "active" : "",
      redeem.visible ? "" : "hidden-redeem",
      redeem.disabled ? "disabled-redeem" : ""
    ].filter(Boolean).join(" ");
    item.dataset.redeemId = redeem.redeemId;
    const pointText = Number(redeem.pointCost) > 0 ? ` · ${Number(redeem.pointCost)} pts` : "";
    item.innerHTML = `
      <button class="redeem-select style-${escapeHtml(redeem.style)}" type="button">
        <span class="redeem-position">${index + 1}</span>
        <span class="redeem-name">${escapeHtml(redeem.emoji || "")} ${escapeHtml(redeem.label)}</span>
      </button>
      <div class="redeem-item-footer">
        <span class="redeem-meta">${escapeHtml(redeem.redeemId)}${pointText} · ${redeem.visible ? "visible" : "hidden"} · ${redeem.disabled ? "disabled" : "enabled"}${redeem.requiresInput ? " · asks input" : ""}</span>
      </div>
    `;
    item.querySelector(".redeem-select").addEventListener("click", () => {
      selectRedeem(redeem);
    });
    redeemList.appendChild(item);
  });
}

function selectSection(sectionName) {
  sectionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionName);
  });

  adminSections.forEach((section) => {
    section.classList.toggle("active", section.dataset.adminSection === sectionName);
  });

  workspaceTitle.textContent = sectionName === "points" ? "Points" : "Discord Redeems";

  if (sectionName === "points") {
    loadPointSettings();
  }
}

function applyPointSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  pointVarNameInput.value = snapshot.pointVarName || pointVarNameInput.value || "stream_points";
  pointNameInput.value = snapshot.pointName || pointNameInput.value || "point";

  if (snapshot.pointUserKey) {
    pointUserKeyInput.value = snapshot.pointUserKey;
  }

  if (Number.isFinite(Number(snapshot.pointsBalance))) {
    pointUserBalanceInput.value = Number(snapshot.pointsBalance);
  }
}

function selectRedeem(redeem) {
  state.selectedRedeemId = redeem?.redeemId || "";
  redeemIdInput.value = redeem?.redeemId || "";
  redeemNameInput.value = redeem?.label || "";
  redeemEmojiInput.value = redeem?.emoji || "";
  redeemStyleInput.value = redeem?.style || "secondary";
  redeemPointCostInput.value = Number(redeem?.pointCost) || 0;
  redeemVisibleInput.checked = redeem?.visible !== false;
  redeemDisabledInput.checked = redeem?.disabled === true;
  redeemRequiresInputInput.checked = redeem?.requiresInput === true;
  redeemInputTitleInput.value = redeem?.inputTitle || redeem?.label || "";
  redeemInputLabelInput.value = redeem?.inputLabel || "Details";
  redeemInputPlaceholderInput.value = redeem?.inputPlaceholder || "";
  redeemInputStyleInput.value = redeem?.inputStyle || "short";
  redeemInputRequiredInput.checked = redeem?.inputRequired !== false;
  deleteRedeemButton.disabled = !state.selectedRedeemId;
  updateInputControls();
  updateOrderControls();
  renderRedeems();
}

function updateInputControls() {
  const enabled = redeemRequiresInputInput.checked;

  redeemInputTitleInput.disabled = !enabled;
  redeemInputLabelInput.disabled = !enabled;
  redeemInputPlaceholderInput.disabled = !enabled;
  redeemInputStyleInput.disabled = !enabled;
  redeemInputRequiredInput.disabled = !enabled;
}

function updateOrderControls() {
  const selectedIndex = state.redeems.findIndex((redeem) => redeem.redeemId === state.selectedRedeemId);
  const hasSelection = selectedIndex >= 0;

  moveRedeemEarlierButton.disabled = !hasSelection || selectedIndex === 0;
  moveRedeemLaterButton.disabled = !hasSelection || selectedIndex === state.redeems.length - 1;

  redeemOrderText.textContent = hasSelection
    ? `Position ${selectedIndex + 1} of ${state.redeems.length}`
    : "Select a redeem";
}

function getSelectedRedeem() {
  return state.redeems.find((redeem) => redeem.redeemId === state.selectedRedeemId) || null;
}

function getNextOrder() {
  if (state.redeems.length === 0) {
    return 10;
  }

  return Math.max(...state.redeems.map((redeem) => Number(redeem.order) || 0)) + 10;
}

function getBoardColumns() {
  const columns = Number(state.boardConfig?.maxButtonsPerRow) || 5;

  return Math.min(Math.max(columns, 1), 5);
}

function setStatus(message, type = "") {
  statusRow.textContent = message;
  statusRow.className = `status-row ${type}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
