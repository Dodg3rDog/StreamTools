// ------------------------------------------------------------
// 00) State
// ------------------------------------------------------------

const state = {
  boardConfig: {
    maxButtonsPerRow: 5
  },
  redeems: [],
  selectedRedeemId: "",
  tosDocument: null,
  commissionDocuments: {
    tos: null,
    pricing: null
  },
  formsCatalog: null,
  selectedFormIndex: -1,
  activeCommissionDocumentType: "tos",
  selectedTosSectionIndex: -1,
  guildAssets: null,
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
const tosDocumentForm = document.getElementById("tosDocumentForm");
const tosSectionForm = document.getElementById("tosSectionForm");
const refreshTosButton = document.getElementById("refreshTosButton");
const commissionDocumentTypeInput = document.getElementById("commissionDocumentType");
const newTosSectionButton = document.getElementById("newTosSectionButton");
const applyTosSectionButton = document.getElementById("applyTosSectionButton");
const deleteTosSectionButton = document.getElementById("deleteTosSectionButton");
const moveTosSectionUpButton = document.getElementById("moveTosSectionUpButton");
const moveTosSectionDownButton = document.getElementById("moveTosSectionDownButton");
const tosTitleInput = document.getElementById("tosTitle");
const tosUpdatedAtInput = document.getElementById("tosUpdatedAt");
const tosDescriptionInput = document.getElementById("tosDescription");
const maturePolicyFields = document.getElementById("maturePolicyFields");
const maturePolicyTitleInput = document.getElementById("maturePolicyTitle");
const maturePolicyDescriptionInput = document.getElementById("maturePolicyDescription");
const maturePolicyBodyInput = document.getElementById("maturePolicyBody");
const tosSectionIndexInput = document.getElementById("tosSectionIndex");
const tosSectionIdInput = document.getElementById("tosSectionId");
const tosSectionTitleInput = document.getElementById("tosSectionTitle");
const tosSectionBodyInput = document.getElementById("tosSectionBody");
const tosSectionReferencesInput = document.getElementById("tosSectionReferences");
const tosSectionList = document.getElementById("tosSectionList");
const formattingButtons = Array.from(document.querySelectorAll("[data-format-command]"));
const tosBodyCounter = document.getElementById("tosBodyCounter");
const tosBodyLimitMeter = document.getElementById("tosBodyLimitMeter");
const loadDiscordAssetsButton = document.getElementById("loadDiscordAssetsButton");
const discordEmojiGrid = document.getElementById("discordEmojiGrid");
const commissionFormsForm = document.getElementById("commissionFormsForm");
const refreshFormsButton = document.getElementById("refreshFormsButton");
const formTemplateIndexInput = document.getElementById("formTemplateIndex");
const formTemplateIdInput = document.getElementById("formTemplateId");
const formTemplateTitleInput = document.getElementById("formTemplateTitle");
const formTemplateDescriptionInput = document.getElementById("formTemplateDescription");
const formSignatureModeInput = document.getElementById("formSignatureMode");
const formPdfModeInput = document.getElementById("formPdfMode");
const formWorkflowInput = document.getElementById("formWorkflow");
const formTokenButtons = document.getElementById("formTokenButtons");
const formTemplateBodyInput = document.getElementById("formTemplateBody");
const formFieldsJsonInput = document.getElementById("formFieldsJson");
const formStaffNotesInput = document.getElementById("formStaffNotes");
const newFormButton = document.getElementById("newFormButton");
const deleteFormButton = document.getElementById("deleteFormButton");
const formTemplateList = document.getElementById("formTemplateList");

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

tosDocumentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveTosDocument();
});

tosSectionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applyTosSectionEditor();
});

refreshTosButton.addEventListener("click", async () => {
  await loadTosDocument();
});

commissionDocumentTypeInput.addEventListener("change", async () => {
  applyTosMetadata();
  applyTosSectionEditor({ quiet: true });
  state.activeCommissionDocumentType = commissionDocumentTypeInput.value === "pricing" ? "pricing" : "tos";
  state.selectedTosSectionIndex = -1;

  if (!getActiveCommissionDocument()) {
    await loadTosDocument();
  } else {
    renderTosDocument();
  }
});

newTosSectionButton.addEventListener("click", () => {
  createTosSection();
});

applyTosSectionButton.addEventListener("click", () => {
  applyTosSectionEditor();
});

deleteTosSectionButton.addEventListener("click", () => {
  deleteSelectedTosSection();
});

moveTosSectionUpButton.addEventListener("click", () => {
  moveSelectedTosSection(-1);
});

moveTosSectionDownButton.addEventListener("click", () => {
  moveSelectedTosSection(1);
});

formattingButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTextFormat(button.dataset.formatCommand);
  });
});

tosSectionBodyInput.addEventListener("input", updateTosBodyCounter);

loadDiscordAssetsButton.addEventListener("click", async () => {
  await loadDiscordAssets();
});

commissionFormsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveFormsCatalog();
});

refreshFormsButton.addEventListener("click", async () => {
  await loadFormsCatalog();
});

newFormButton.addEventListener("click", () => {
  createFormTemplate();
});

deleteFormButton.addEventListener("click", () => {
  deleteSelectedFormTemplate();
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

async function loadTosDocument() {
  if (!state.token) {
    setStatus("Enter the server bearer token before loading commission docs.", "error");
    return;
  }

  const documentType = getActiveCommissionDocumentType();
  setStatus("Loading " + getCommissionDocumentLabel(documentType) + "...");

  try {
    const data = await apiRequest("/api/commission-docs/" + documentType, {
      auth: true
    });
    setCommissionDocument(documentType, normalizeTosDocumentForEditor(data.document));
    const document = getActiveCommissionDocument();
    state.selectedTosSectionIndex = document.sections.length > 0 ? 0 : -1;
    renderTosDocument();
    setStatus(getCommissionDocumentLabel(documentType) + " loaded.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function saveTosDocument() {
  if (!state.token) {
    setStatus("Enter the server bearer token before saving commission docs.", "error");
    return;
  }

  const documentType = getActiveCommissionDocumentType();
  if (!getActiveCommissionDocument()) {
    setCommissionDocument(documentType, createBlankTosDocument(documentType));
  }

  applyTosMetadata();
  applyTosSectionEditor({ quiet: true });

  try {
    const data = await apiRequest("/api/commission-docs/" + documentType, {
      method: "PUT",
      auth: true,
      body: JSON.stringify({
        document: getActiveCommissionDocument()
      })
    });
    setCommissionDocument(documentType, normalizeTosDocumentForEditor(data.document));
    const document = getActiveCommissionDocument();
    state.selectedTosSectionIndex = Math.min(
      Math.max(state.selectedTosSectionIndex, -1),
      document.sections.length - 1
    );
    renderTosDocument();
    const publishCommand = documentType === "pricing" ? "/commission-publish-pricing" : "/commission-publish-tos";
    setStatus(getCommissionDocumentLabel(documentType) + " saved. Run " + publishCommand + " or /commission-publish-docs in Discord to refresh the public entry.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function loadDiscordAssets() {
  if (!state.token) {
    setStatus("Enter the server bearer token before loading Discord assets.", "error");
    return;
  }

  setStatus("Loading Discord server assets...");

  try {
    const data = await apiRequest("/api/discord/guild-assets", {
      auth: true
    });
    state.guildAssets = data.assets || { emojis: [] };
    renderDiscordAssets();
    setStatus("Discord assets loaded.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function loadFormsCatalog() {
  if (!state.token) {
    setStatus("Enter the server bearer token before loading commission forms.", "error");
    return;
  }

  setStatus("Loading commission forms...");

  try {
    const data = await apiRequest("/api/commission-docs/forms", {
      auth: true
    });
    state.formsCatalog = normalizeFormsCatalogForEditor(data.catalog);
    state.selectedFormIndex = state.formsCatalog.forms.length > 0 ? 0 : -1;
    renderFormsCatalog();
    setStatus("Commission forms loaded.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function saveFormsCatalog() {
  if (!state.token) {
    setStatus("Enter the server bearer token before saving commission forms.", "error");
    return;
  }

  if (!state.formsCatalog) {
    state.formsCatalog = createBlankFormsCatalog();
  }

  if (!applyFormTemplateEditor()) {
    return;
  }

  try {
    const data = await apiRequest("/api/commission-docs/forms", {
      method: "PUT",
      auth: true,
      body: JSON.stringify({
        catalog: state.formsCatalog
      })
    });
    state.formsCatalog = normalizeFormsCatalogForEditor(data.catalog);
    state.selectedFormIndex = Math.min(
      Math.max(state.selectedFormIndex, -1),
      state.formsCatalog.forms.length - 1
    );
    renderFormsCatalog();
    setStatus("Commission forms saved.", "success");
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
  if (document.querySelector('[data-admin-section="widgets"].active') && sectionName !== "widgets") {
    if (!window.streamtoolsOverlayEditor?.canLeave() || !window.customChatEditor?.canLeave()) return;
    window.customChatEditor.close();
    window.streamtoolsOverlayEditor.clear();
    document.dispatchEvent(new Event("widgets-left"));
  }
  const discordSections = ["discord-home", "discord", "commission-docs", "commission-forms", "howler"];
  document.getElementById("discordNavigation").hidden = !discordSections.includes(sectionName);
  statusRow.hidden = ["widgets", "discord-home", "howler"].includes(sectionName);
  if (["discord-home", "howler"].includes(sectionName)) document.dispatchEvent(new Event("discord-tools-open"));
  if (sectionName === "widgets") document.dispatchEvent(new Event("widgets-open"));
  sectionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.section === sectionName || (button.closest(".admin-nav") && button.dataset.section === "discord-home" && discordSections.includes(sectionName)));
  });

  adminSections.forEach((section) => {
    section.classList.toggle("active", section.dataset.adminSection === sectionName);
  });

  workspaceTitle.textContent = sectionName === "discord-home" ? "Discord Bot" : sectionName === "howler" ? "Discord Bot · Howler" : sectionName === "widgets" ? "Widgets & Overlays" : sectionName === "server" ? "Server Tools" : sectionName === "points"
    ? "Points"
    : sectionName === "commission-docs"
      ? "Commission Docs"
      : sectionName === "commission-forms"
        ? "Commission Forms"
        : "Discord Redeems";

  if (sectionName === "points") {
    loadPointSettings();
  }

  if (sectionName === "commission-docs" && !getActiveCommissionDocument()) {
    loadTosDocument();
  }

  if (sectionName === "commission-forms" && !state.formsCatalog) {
    loadFormsCatalog();
  }
}

function renderFormsCatalog() {
  const catalog = state.formsCatalog || createBlankFormsCatalog();
  renderFormTokenButtons(catalog.tokens || []);
  renderFormTemplateList();
  selectFormTemplate(state.selectedFormIndex);
}

function renderFormTokenButtons(tokens) {
  formTokenButtons.innerHTML = "";

  tokens.forEach((token) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = token.token;
    button.title = token.description || token.label || token.token;
    button.addEventListener("click", () => {
      insertTextAtCursor(formTemplateBodyInput, token.token);
    });
    formTokenButtons.appendChild(button);
  });
}

function renderFormTemplateList() {
  const forms = state.formsCatalog?.forms || [];
  formTemplateList.innerHTML = "";

  if (forms.length === 0) {
    formTemplateList.innerHTML = "<p class=\"redeem-meta\">No forms configured.</p>";
    return;
  }

  forms.forEach((form, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-card" + (index === state.selectedFormIndex ? " active" : "");
    button.innerHTML = `
      <span class="section-card-title">${escapeHtml(form.title)}</span>
      <span class="section-card-id">${escapeHtml(form.id)} · ${escapeHtml(form.signatureMode)} · ${escapeHtml((form.workflow || []).join(", "))}</span>
    `;
    button.addEventListener("click", () => {
      applyFormTemplateEditor({ quiet: true });
      selectFormTemplate(index);
    });
    formTemplateList.appendChild(button);
  });
}

function selectFormTemplate(index) {
  const forms = state.formsCatalog?.forms || [];
  state.selectedFormIndex = index >= 0 && index < forms.length ? index : -1;
  const form = forms[state.selectedFormIndex] || null;

  formTemplateIndexInput.value = state.selectedFormIndex;
  formTemplateIdInput.value = form?.id || "";
  formTemplateTitleInput.value = form?.title || "";
  formTemplateDescriptionInput.value = form?.description || "";
  formSignatureModeInput.value = form?.signatureMode || "typed_agree";
  formPdfModeInput.value = form?.pdfMode || "completed";
  formWorkflowInput.value = Array.isArray(form?.workflow) ? form.workflow.join(", ") : "";
  formTemplateBodyInput.value = Array.isArray(form?.body) ? form.body.join("\n\n") : "";
  formFieldsJsonInput.value = JSON.stringify(form?.fields || [], null, 2);
  formStaffNotesInput.value = form?.staffNotes || "";
  deleteFormButton.disabled = !form;
  renderFormTemplateList();
}

function createFormTemplate() {
  if (!state.formsCatalog) {
    state.formsCatalog = createBlankFormsCatalog();
  }

  applyFormTemplateEditor({ quiet: true });
  const nextNumber = state.formsCatalog.forms.length + 1;
  state.formsCatalog.forms.push({
    id: `new-form-${nextNumber}`,
    title: `New Form ${nextNumber}`,
    description: "",
    signatureMode: "typed_agree",
    pdfMode: "completed",
    workflow: [],
    body: ["Add form text here. Use tokens like {{discord.username}}, {{discord.userId}}, {{client.name}}, and {{current.date}}."],
    fields: [],
    staffNotes: ""
  });
  selectFormTemplate(state.formsCatalog.forms.length - 1);
  setStatus("New form added. Edit it, then save forms.", "success");
}

function deleteSelectedFormTemplate() {
  if (!state.formsCatalog || state.selectedFormIndex < 0) {
    return;
  }

  state.formsCatalog.forms.splice(state.selectedFormIndex, 1);
  selectFormTemplate(Math.min(state.selectedFormIndex, state.formsCatalog.forms.length - 1));
  setStatus("Form removed locally. Save forms to write it to disk.", "success");
}

function applyFormTemplateEditor(options = {}) {
  if (!state.formsCatalog || state.selectedFormIndex < 0) {
    return true;
  }

  const form = state.formsCatalog.forms[state.selectedFormIndex];
  if (!form) {
    return true;
  }

  let fields;
  try {
    fields = JSON.parse(formFieldsJsonInput.value || "[]");
  } catch (error) {
    setStatus("Fields JSON is invalid: " + error.message, "error");
    return false;
  }

  form.id = slugify(formTemplateIdInput.value || formTemplateTitleInput.value || form.id);
  form.title = formTemplateTitleInput.value.trim() || form.title || "Untitled Form";
  form.description = formTemplateDescriptionInput.value.trim();
  form.signatureMode = formSignatureModeInput.value;
  form.pdfMode = formPdfModeInput.value;
  form.workflow = splitCsvValues(formWorkflowInput.value);
  form.body = splitParagraphs(formTemplateBodyInput.value);
  form.fields = Array.isArray(fields) ? fields : [];
  form.staffNotes = formStaffNotesInput.value.trim();
  renderFormTemplateList();

  if (!options.quiet) {
    setStatus("Form applied locally. Save forms to write it to disk.", "success");
  }

  return true;
}

function renderTosDocument() {
  const documentType = getActiveCommissionDocumentType();
  const document = getActiveCommissionDocument() || createBlankTosDocument(documentType);
  commissionDocumentTypeInput.value = documentType;
  tosTitleInput.value = document.title || "";
  tosUpdatedAtInput.value = document.updatedAt || "";
  tosDescriptionInput.value = document.description || "";
  renderMaturePolicyFields(documentType, document);
  renderTosSectionList();
  selectTosSection(state.selectedTosSectionIndex);
}

function renderMaturePolicyFields(documentType, document) {
  const isTos = documentType === "tos";
  maturePolicyFields.hidden = !isTos;

  if (!isTos) {
    maturePolicyTitleInput.value = "";
    maturePolicyDescriptionInput.value = "";
    maturePolicyBodyInput.value = "";
    return;
  }

  const policy = document.matureContentPolicy || {};
  const section = Array.isArray(policy.sections) ? policy.sections[0] : null;
  maturePolicyTitleInput.value = policy.title || section?.title || "Mature Content Policy";
  maturePolicyDescriptionInput.value = policy.description || "";
  maturePolicyBodyInput.value = Array.isArray(section?.body) ? section.body.join("\n\n") : String(section?.body || "");
}

function renderTosSectionList() {
  const sections = getActiveCommissionDocument()?.sections || [];
  tosSectionList.innerHTML = "";

  if (sections.length === 0) {
    tosSectionList.innerHTML = "<p class=\"redeem-meta\">No sections configured.</p>";
    return;
  }

  sections.forEach((section, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-card" + (index === state.selectedTosSectionIndex ? " active" : "");
    button.innerHTML = `
      <span class="section-card-title">${index + 1}. ${escapeHtml(section.title)}</span>
      <span class="section-card-id">${escapeHtml(section.id)}</span>
    `;
    button.addEventListener("click", () => {
      applyTosSectionEditor({ quiet: true });
      selectTosSection(index);
    });
    tosSectionList.appendChild(button);
  });
}

function selectTosSection(index) {
  const sections = getActiveCommissionDocument()?.sections || [];
  state.selectedTosSectionIndex = index >= 0 && index < sections.length ? index : -1;
  const section = sections[state.selectedTosSectionIndex] || null;

  tosSectionIndexInput.value = state.selectedTosSectionIndex;
  tosSectionIdInput.value = section?.id || "";
  tosSectionTitleInput.value = section?.title || "";
  tosSectionBodyInput.value = Array.isArray(section?.body) ? section.body.join("\n\n") : "";
  tosSectionReferencesInput.value = Array.isArray(section?.references) ? section.references.join(", ") : "";

  deleteTosSectionButton.disabled = !section;
  moveTosSectionUpButton.disabled = !section || state.selectedTosSectionIndex === 0;
  moveTosSectionDownButton.disabled = !section || state.selectedTosSectionIndex === sections.length - 1;
  updateTosBodyCounter();
  renderTosSectionList();
}

function createTosSection() {
  const documentType = getActiveCommissionDocumentType();
  if (!getActiveCommissionDocument()) {
    setCommissionDocument(documentType, createBlankTosDocument(documentType));
  }

  applyTosSectionEditor({ quiet: true });
  const document = getActiveCommissionDocument();
  const nextNumber = document.sections.length + 1;
  document.sections.push({
    id: `new-section-${nextNumber}`,
    title: `New Section ${nextNumber}`,
    body: ["Add section text here."],
    references: []
  });
  selectTosSection(document.sections.length - 1);
  setStatus("New section added. Edit it, then save the document.", "success");
}

function applyTosMetadata() {
  const documentType = getActiveCommissionDocumentType();
  if (!getActiveCommissionDocument()) {
    setCommissionDocument(documentType, createBlankTosDocument(documentType));
  }

  const document = getActiveCommissionDocument();
  document.title = tosTitleInput.value.trim() || getDefaultCommissionDocumentTitle(documentType);
  document.updatedAt = tosUpdatedAtInput.value || new Date().toISOString().slice(0, 10);
  document.description = tosDescriptionInput.value.trim();

  if (documentType === "tos") {
    document.matureContentPolicy = {
      title: maturePolicyTitleInput.value.trim() || "Mature Content Policy",
      description: maturePolicyDescriptionInput.value.trim(),
      sections: [
        {
          id: "mature-content-policy",
          title: maturePolicyTitleInput.value.trim() || "Mature Content Policy",
          body: splitParagraphs(maturePolicyBodyInput.value),
          references: []
        }
      ]
    };
  }
}

function applyTosSectionEditor(options = {}) {
  const document = getActiveCommissionDocument();
  if (!document || state.selectedTosSectionIndex < 0) {
    return;
  }

  const sections = document.sections;
  const section = sections[state.selectedTosSectionIndex];
  if (!section) {
    return;
  }

  section.id = slugify(tosSectionIdInput.value || tosSectionTitleInput.value || section.title);
  section.title = tosSectionTitleInput.value.trim() || section.title || "Untitled Section";
  section.body = splitParagraphs(tosSectionBodyInput.value);
  section.references = splitReferenceIds(tosSectionReferencesInput.value);
  renderTosSectionList();

  if (!options.quiet) {
    setStatus("Section applied locally. Save the document to write it to disk.", "success");
  }
}

function deleteSelectedTosSection() {
  const document = getActiveCommissionDocument();
  if (!document || state.selectedTosSectionIndex < 0) {
    return;
  }

  const removed = document.sections.splice(state.selectedTosSectionIndex, 1)[0];
  document.sections.forEach((section) => {
    section.references = (section.references || []).filter((id) => id !== removed.id);
  });
  const nextIndex = Math.min(state.selectedTosSectionIndex, document.sections.length - 1);
  selectTosSection(nextIndex);
  setStatus("Section removed locally. Save the document to write it to disk.", "success");
}

function moveSelectedTosSection(direction) {
  const document = getActiveCommissionDocument();
  if (!document || state.selectedTosSectionIndex < 0) {
    return;
  }

  applyTosSectionEditor({ quiet: true });
  const sections = document.sections;
  const nextIndex = state.selectedTosSectionIndex + direction;
  if (nextIndex < 0 || nextIndex >= sections.length) {
    return;
  }

  const current = sections[state.selectedTosSectionIndex];
  sections[state.selectedTosSectionIndex] = sections[nextIndex];
  sections[nextIndex] = current;
  selectTosSection(nextIndex);
  setStatus("Section order changed locally. Save the document to write it to disk.", "success");
}

function applyTextFormat(command) {
  const formatters = {
    bold: (text) => wrapSelection(text, "**", "bold text"),
    italic: (text) => wrapSelection(text, "*", "italic text"),
    underline: (text) => wrapSelection(text, "__", "underlined text"),
    strike: (text) => wrapSelection(text, "~~", "struck text"),
    spoiler: (text) => wrapSelection(text, "||", "spoiler text"),
    "inline-code": (text) => wrapSelection(text, "`", "inline code"),
    "code-block": (text) => wrapCodeBlock(text || "code block"),
    heading1: (text) => prefixLines(text || "Heading", "# "),
    heading2: (text) => prefixLines(text || "Heading", "## "),
    heading3: (text) => prefixLines(text || "Heading", "### "),
    bullet: (text) => prefixLines(text || "List item", "- "),
    numbered: (text) => prefixNumberedLines(text || "List item"),
    quote: (text) => prefixLines(text || "Quoted text", "> "),
    "multiline-quote": (text) => ">>> " + (text || "Quoted text"),
    subtext: (text) => prefixLines(text || "Subtext", "-# "),
    link: (text) => `[${text || "link text"}](https://example.com)`
  };

  const formatter = formatters[command];
  if (!formatter) {
    return;
  }

  replaceTextareaSelection(tosSectionBodyInput, formatter);
  updateTosBodyCounter();
}

function replaceTextareaSelection(textarea, formatter) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selectedText = value.slice(start, end);
  const replacement = formatter(selectedText);

  textarea.value = value.slice(0, start) + replacement + value.slice(end);
  textarea.focus();
  textarea.setSelectionRange(start, start + replacement.length);
}

function updateTosBodyCounter() {
  const limit = 4096;
  const count = tosSectionBodyInput.value.length;
  tosBodyCounter.textContent = `${count} / ${limit}`;
  tosBodyLimitMeter.classList.toggle("warning", count >= 3600 && count <= limit);
  tosBodyLimitMeter.classList.toggle("error", count > limit);
}

function renderDiscordAssets() {
  const assets = state.guildAssets || { emojis: [] };

  discordEmojiGrid.innerHTML = "";

  if (!assets.emojis?.length) {
    discordEmojiGrid.innerHTML = "<p class=\"redeem-meta\">No custom emoji found.</p>";
  } else {
    assets.emojis.forEach((emoji) => {
      const button = createAssetButton(emoji.name, emoji.url, emoji.markdown);
      button.title = "Insert " + emoji.markdown;
      button.addEventListener("click", () => {
        insertTextAtCursor(tosSectionBodyInput, emoji.markdown);
        updateTosBodyCounter();
      });
      discordEmojiGrid.appendChild(button);
    });
  }
}

function createAssetButton(label, imageUrl, fallbackText) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "asset-button";

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    button.appendChild(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.textContent = "•";
    button.appendChild(placeholder);
  }

  const text = document.createElement("span");
  text.textContent = label || fallbackText || "asset";
  button.appendChild(text);
  return button;
}

function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = value.slice(0, start) + text + value.slice(end);
  textarea.focus();
  textarea.setSelectionRange(start + text.length, start + text.length);
}

function wrapSelection(text, marker, placeholder) {
  const content = text || placeholder;
  return marker + content + marker;
}

function prefixLines(text, prefix) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line ? prefix + line.replace(new RegExp("^" + escapeRegExp(prefix)), "") : prefix.trimEnd())
    .join("\n");
}

function prefixNumberedLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}`)
    .join("\n");
}

function wrapCodeBlock(text) {
  return "```\n" + String(text || "code block").replace(/^```|```$/g, "").trim() + "\n```";
}

function normalizeFormsCatalogForEditor(catalog) {
  const normalized = catalog || createBlankFormsCatalog();
  normalized.tokens = Array.isArray(normalized.tokens) && normalized.tokens.length > 0
    ? normalized.tokens
    : createDefaultFormTokens();
  normalized.forms = Array.isArray(normalized.forms) ? normalized.forms : [];
  normalized.forms = normalized.forms.map((form, index) => ({
    id: slugify(form.id || form.title || `form-${index + 1}`),
    title: form.title || `Form ${index + 1}`,
    description: form.description || "",
    signatureMode: ["none", "typed_agree", "print_signature"].includes(form.signatureMode) ? form.signatureMode : "typed_agree",
    pdfMode: ["blank", "prefilled", "completed"].includes(form.pdfMode) ? form.pdfMode : "completed",
    workflow: Array.isArray(form.workflow) ? form.workflow : splitCsvValues(form.workflow),
    body: Array.isArray(form.body) ? form.body : splitParagraphs(form.body),
    fields: Array.isArray(form.fields) ? form.fields : [],
    staffNotes: form.staffNotes || ""
  }));
  return normalized;
}

function createBlankFormsCatalog() {
  return {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    tokens: createDefaultFormTokens(),
    forms: []
  };
}

function createDefaultFormTokens() {
  return [
    { token: "{{discord.username}}", label: "Discord Username", description: "Discord username or display name." },
    { token: "{{discord.userId}}", label: "Discord User ID", description: "Discord account ID." },
    { token: "{{client.name}}", label: "Client Name", description: "Preferred client name or handle." },
    { token: "{{current.date}}", label: "Current Date", description: "Date when generated or signed." },
    { token: "{{commission.contentType}}", label: "Commission Content Type", description: "Commission type/rating summary." },
    { token: "{{form.ownerName}}", label: "Owner Name Field", description: "Character owner field value." },
    { token: "{{form.characterName}}", label: "Character Name Field", description: "Character name field value." },
    { token: "{{form.contentType}}", label: "Content Type Field", description: "Requested content type field value." }
  ];
}

function normalizeTosDocumentForEditor(document) {
  const normalized = document || createBlankTosDocument();
  normalized.sections = Array.isArray(normalized.sections) ? normalized.sections : [];
  normalized.sections = normalized.sections.map((section, index) => ({
    id: slugify(section.id || section.title || `section-${index + 1}`),
    title: section.title || `Section ${index + 1}`,
    body: Array.isArray(section.body) ? section.body : splitParagraphs(section.body),
    references: Array.isArray(section.references) ? section.references.map(slugify).filter(Boolean) : splitReferenceIds(section.references)
  }));
  return normalized;
}

function createBlankTosDocument(documentType = getActiveCommissionDocumentType()) {
  return {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    title: getDefaultCommissionDocumentTitle(documentType),
    description: getDefaultCommissionDocumentDescription(documentType),
    sections: []
  };
}

function getActiveCommissionDocumentType() {
  return state.activeCommissionDocumentType === "pricing" ? "pricing" : "tos";
}

function getActiveCommissionDocument() {
  return state.commissionDocuments[getActiveCommissionDocumentType()] || null;
}

function setCommissionDocument(documentType, document) {
  const normalizedType = documentType === "pricing" ? "pricing" : "tos";
  state.commissionDocuments[normalizedType] = document;

  if (normalizedType === "tos") {
    state.tosDocument = document;
  }
}

function getCommissionDocumentLabel(documentType) {
  return documentType === "pricing" ? "Pricing Guide" : "Terms of Service";
}

function getDefaultCommissionDocumentTitle(documentType) {
  return documentType === "pricing" ? "Commission Pricing" : "Commission Terms of Service";
}

function getDefaultCommissionDocumentDescription(documentType) {
  return documentType === "pricing"
    ? "Review current commission pricing, add-ons, process, payment policy, and usage notes privately."
    : "Review commission terms privately.";
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

function splitParagraphs(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitReferenceIds(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map(slugify)
    .filter(Boolean);
}

function splitCsvValues(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Server tools use this Admin page's origin, including the workshop port.
const healthStatus = document.getElementById("serverHealthStatus");
const restartStatus = document.getElementById("serverRestartStatus");
const restartButton = document.getElementById("restartServerButton");
let healthBusy = false;
let restartBusy = false;
let latestHealth = null;
let expectedOldInstance = null;
let restartDeadline = 0;

function updateRestartButton() {
  restartButton.disabled = restartBusy || !state.token || !latestHealth?.restartSupported || !latestHealth?.ok;
}
tokenInput.addEventListener("input", updateRestartButton);

async function refreshServerHealth() {
  if (healthBusy) return;
  healthBusy = true;
  try {
    const response = await fetch("/health", { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const health = await response.json();
    if (health.service !== "streamtools-server" || !Number.isFinite(health.uptimeSec)) throw new Error("Unexpected health response");
    latestHealth = health;
    healthStatus.textContent = health.ok ? "Online" : "Restarting...";
    document.getElementById("serverService").textContent = health.service;
    document.getElementById("serverVersion").textContent = health.version;
    const seconds = health.uptimeSec;
    document.getElementById("serverUptime").textContent = `${Math.floor(seconds / 86400)}d ${Math.floor(seconds / 3600) % 24}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
    if (expectedOldInstance && health.ok && health.instanceId && health.instanceId !== expectedOldInstance) {
      expectedOldInstance = null;
      restartBusy = false;
      restartStatus.textContent = "Server restarted successfully.";
    } else if (!restartBusy && !health.restartSupported) {
      restartStatus.textContent = "Restart requires a one-time relaunch with the updated server launcher (npm start).";
    }
  } catch (error) {
    latestHealth = null;
    healthStatus.textContent = restartBusy ? "Waiting for server to return..." : `Server unreachable: ${error.message}`;
    for (const id of ["serverService", "serverVersion", "serverUptime"]) document.getElementById(id).textContent = "-";
  } finally {
    document.getElementById("serverChecked").textContent = new Date().toLocaleTimeString();
    if (expectedOldInstance && Date.now() > restartDeadline) {
      expectedOldInstance = null;
      restartBusy = false;
      restartStatus.textContent = "Restart could not be verified within 60 seconds. Check the server console before trying again.";
    }
    healthBusy = false;
    updateRestartButton();
  }
}

document.getElementById("refreshHealthButton").addEventListener("click", refreshServerHealth);
restartButton.addEventListener("click", async () => {
  if (restartBusy || !state.token || !latestHealth?.restartSupported) return;
  if (!window.confirm("Restart StreamTools now? Widgets and bots will briefly disconnect, and in-memory state will reset.")) return;
  restartBusy = true;
  expectedOldInstance = latestHealth.instanceId;
  restartDeadline = Date.now() + 60000;
  updateRestartButton();
  restartStatus.textContent = "Requesting restart...";
  try {
    const result = await apiRequest("/api/server/restart", { method: "POST", auth: true, signal: AbortSignal.timeout(6000) });
    expectedOldInstance = result.instanceId;
    restartStatus.textContent = "Restart accepted. Waiting for a new server instance...";
  } catch (error) {
    // A dropped connection may mean the restart was accepted; keep checking.
    restartStatus.textContent = `${error.message}. Checking whether the server restarted...`;
  }
  refreshServerHealth();
});
refreshServerHealth();
window.setInterval(refreshServerHealth, 10000);
