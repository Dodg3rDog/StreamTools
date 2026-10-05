(() => {
const embedded = Boolean(document.getElementById("widgetEditor"));
const byId = id => document.getElementById(embedded && id !== "tokenInput" ? `we-${id}` : id);
let dirty = false;
let loadSequence = 0;
let saving = false;
function canLeave() { return !saving && (!dirty || window.confirm("Discard unsaved overlay changes?")); }
function stopPreview() { previewReady = false; previewFrame.src = "about:blank"; }
const tokenInput = byId("tokenInput");
const tokenField = byId("tokenField");
const overlaySelect = byId("overlaySelect");
const openOverlayLink = byId("openOverlayLink");
const copyUrlButton = byId("copyUrlButton");
const newOverlayButton = byId("newOverlayButton");
const refreshButton = byId("refreshButton");
const saveButton = byId("saveButton");
const reloadPreviewButton = byId("reloadPreviewButton");
const statusLine = byId("statusLine");
const configForm = byId("configForm");
const previewFrame = byId("previewFrame");
const previewTitle = byId("previewTitle");
const previewViewport = byId("previewViewport");
const previewToolbar = byId("previewToolbar");
const toolbarHandle = byId("toolbarHandle");
const emulateButton = byId("emulateButton");
const zoomOutButton = byId("zoomOutButton");
const zoomInButton = byId("zoomInButton");
const zoomResetButton = byId("zoomResetButton");
const fitButton = byId("fitButton");
const snapButton = byId("snapButton");
const volumeInput = byId("volumeInput");

let activeOverlay = null;
let activeFields = {};
let requiresToken = true;
let previewReady = false;
let previewZoom = 1;
let previewFit = true;

if (!embedded) tokenInput.value = localStorage.getItem("streamtoolsAdminToken") || localStorage.getItem("streamtools.adminToken") || "";

tokenInput.addEventListener("input", () => {
  localStorage.setItem("streamtoolsAdminToken", tokenInput.value);
});

refreshButton.addEventListener("click", () => { if (canLeave()) loadOverlays(); });
copyUrlButton.addEventListener("click", copyOverlayUrl);
newOverlayButton.addEventListener("click", createOverlay);
saveButton.addEventListener("click", saveConfig);
reloadPreviewButton.addEventListener("click", reloadPreview);
emulateButton.addEventListener("click", emulatePreviewEvent);
zoomOutButton.addEventListener("click", () => setPreviewZoom(previewZoom / 1.15));
zoomInButton.addEventListener("click", () => setPreviewZoom(previewZoom * 1.15));
zoomResetButton.addEventListener("click", () => {
  previewFit = false;
  previewZoom = 1;
  resizePreview();
});
fitButton.addEventListener("click", () => {
  previewFit = true;
  previewZoom = 1;
  resizePreview();
});
snapButton.addEventListener("click", toggleSnapToGrid);
volumeInput.addEventListener("input", () => {
  setFieldValue("audioVolume", volumeInput.value);
  updatePreview();
});
toolbarHandle.addEventListener("pointerdown", startToolbarDrag);
overlaySelect.addEventListener("change", () => loadOverlayConfig(overlaySelect.value));
configForm.addEventListener("input", updatePreview);
configForm.addEventListener("change", updatePreview);
previewFrame.addEventListener("load", () => {
  previewReady = true;
  updatePreview();
});
window.addEventListener("resize", resizePreview);

if (embedded) {
  window.streamtoolsOverlayEditor = {
    open: loadOverlayConfig, canLeave, stop: stopPreview,
    clear() { ++loadSequence; activeOverlay = null; dirty = false; stopPreview(); },
    create: createOverlay
  };
  document.getElementById("we-discard").addEventListener("click", () => {
    if (activeOverlay && canLeave()) loadOverlayConfig(activeOverlay.slug);
  });
} else { init(); }
configForm.addEventListener("submit", event => event.preventDefault());
configForm.addEventListener("input", () => { dirty = true; setStatus("Unsaved changes. Save applies to the live overlay."); });
configForm.addEventListener("change", () => { dirty = true; });
volumeInput.addEventListener("input", () => { dirty = true; });
snapButton.addEventListener("click", () => { dirty = true; });
window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });

async function init() {
  restoreToolbarPosition();
  await loadAccessMode();
  await loadOverlays();
}

async function loadAccessMode() {
  try {
    const response = await fetch("/api/overlays/access", { cache: "no-store" });
    const data = await response.json();
    requiresToken = data.requiresToken !== false;
  } catch (error) {
    requiresToken = true;
  }

  tokenField.classList.toggle("hidden", !requiresToken);
}

async function loadOverlays(preferredSlug = "") {
  setStatus("Loading overlays...");

  try {
    const data = await requestJson("/api/overlays/purchased");

    overlaySelect.innerHTML = "";

    if (!data.overlays.length) {
      overlaySelect.append(new Option("No purchased overlays found", ""));
      configForm.innerHTML = "";
      setStatus("No purchased overlays found.");
      return;
    }

    data.overlays.forEach((overlay) => {
      overlaySelect.append(new Option(overlay.name, overlay.slug));
    });

    if (preferredSlug && data.overlays.some(overlay => overlay.slug === preferredSlug)) {
      overlaySelect.value = preferredSlug;
    }

    await loadOverlayConfig(overlaySelect.value);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function createOverlay() {
  if (!canLeave()) return;
  const name = window.prompt("Name for the new overlay:");
  if (!name || !name.trim()) {
    return;
  }

  setStatus("Creating overlay...");

  try {
    const data = await requestJson("/api/overlays/purchased", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() })
    });

    dirty = false;
    if (embedded) document.dispatchEvent(new CustomEvent("overlay-created", { detail: data.overlay.slug }));
    else await loadOverlays(data.overlay.slug);
    setStatus(`Created ${data.overlay.name}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function copyOverlayUrl() {
  if (!activeOverlay) {
    return;
  }

  const url = new URL(activeOverlay.url, window.location.origin).href;

  try {
    await navigator.clipboard.writeText(url);
    setStatus(`Copied OBS URL: ${url}`);
  } catch (error) {
    window.prompt("Copy this OBS URL:", url);
    setStatus("Copy the OBS URL from the prompt.");
  }
}

async function loadOverlayConfig(slug) {
  if (!slug) {
    return;
  }

  const sequence = ++loadSequence;
  activeOverlay = null; dirty = false; stopPreview();
  configForm.replaceChildren();
  saveButton.disabled = true;
  setStatus("Loading config...");

  try {
    const loaded = await requestJson(`/api/overlays/purchased/${encodeURIComponent(slug)}/config`);
    if (sequence !== loadSequence) return;
    activeOverlay = loaded;
    saveButton.disabled = false;
    activeFields = activeOverlay.fields || {};
    openOverlayLink.href = activeOverlay.url;
    renderForm(activeFields, activeOverlay.config || {});
    previewTitle.textContent = titleFromSlug(activeOverlay.slug);
    syncToolbarState(activeOverlay.config || {});
    if (!embedded) loadPreview(activeOverlay.url);
    setStatus("Settings loaded. Start preview to test changes; Save updates the live overlay.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderForm(fields, config) {
  configForm.innerHTML = "";

  const groupedFields = groupFields(fields);

  Object.entries(groupedFields).forEach(([groupName, groupFields]) => {
    const section = document.createElement("section");
    section.className = "field-group";

    const heading = document.createElement("h2");
    heading.textContent = groupName;
    section.append(heading);

    const grid = document.createElement("div");
    grid.className = "field-grid";

    groupFields.forEach(([key, field]) => {
      grid.append(createFieldRow(key, field, config[key] ?? field.value ?? ""));
    });

    section.append(grid);
    configForm.append(section);
  });
}

function createFieldRow(key, field, value) {
  const row = document.createElement("div");
  row.className = "field-row";

  const label = document.createElement("label");
  label.htmlFor = `field-${key}`;
  label.textContent = field.label || key;

  const input = createInput(key, field, value);
  if (field.type === "button") {
    const button = document.createElement("button");
    button.className = "button secondary";
    button.type = "button";
    button.textContent = field.label || key;
    button.addEventListener("click", () => sendPreviewButton(key));
    row.append(button);
  } else {
    label.append(input);
    row.append(label);
  }

  return row;
}

function createInput(key, field, value) {
  if (field.type === "dropdown") {
    const select = document.createElement("select");
    select.id = `field-${key}`;
    select.name = key;

    Object.entries(field.options || {}).forEach(([optionValue, optionLabel]) => {
      select.append(new Option(optionLabel, optionValue));
    });

    select.value = String(value);
    return select;
  }

  if (field.type === "button") {
    return document.createElement("span");
  }

  const input = document.createElement("input");
  input.id = `field-${key}`;
  input.name = key;
  input.value = value;
  input.type = field.type === "num" ? "number" : field.type === "colorpicker" ? "color" : "text";

  if (field.min !== undefined) {
    input.min = field.min;
  }

  if (field.step !== undefined) {
    input.step = field.step;
  }

  return input;
}

async function saveConfig() {
  if (!activeOverlay) {
    return;
  }

  saving = true; saveButton.disabled = true;
  setStatus("Saving...");

  const config = collectConfig();

  try {
    await requestJson(`/api/overlays/purchased/${encodeURIComponent(activeOverlay.slug)}/config`, {
      method: "PUT",
      body: JSON.stringify({ config })
    });
    dirty = false;
    setStatus("Saved. Reload the OBS browser source if changes do not appear.");
  } catch (error) {
    setStatus(error.message, true);
  } finally { saving = false; saveButton.disabled = false; }
}

function groupFields(fields) {
  const groups = {};

  Object.entries(fields).forEach(([key, field]) => {
    const groupName = field.group || "Settings";
    groups[groupName] ||= [];
    groups[groupName].push([key, field]);
  });

  return groups;
}

function collectConfig() {
  const formData = new FormData(configForm);
  const config = {};

  Object.entries(activeFields).forEach(([key, field]) => {
    if (field.type === "button") {
      return;
    }

    const rawValue = formData.get(key);
    config[key] = field.type === "num" ? Number(rawValue) : String(rawValue ?? "");
  });

  if (config.snapToGrid === "On") {
    ["widgetWidth", "widgetHeight", "widgetTop", "widgetLeft"].forEach((key) => {
      if (Number.isFinite(config[key])) {
        config[key] = Math.round(config[key] / 10) * 10;
      }
    });
  }

  return config;
}

function loadPreview(url) {
  previewReady = false;
  previewFrame.src = addPreviewQuery(url);
}

function reloadPreview() {
  if (!activeOverlay) {
    return;
  }

  loadPreview(activeOverlay.url);
}

function updatePreview() {
  syncToolbarState(collectConfig());
  resizePreview();

  if (!previewReady || !previewFrame.contentWindow) {
    return;
  }

  previewFrame.contentWindow.postMessage({
    type: "streamtools:overlay-config",
    config: collectConfig()
  }, window.location.origin);
}

function emulatePreviewEvent() {
  const buttonField = Object.entries(activeFields)
    .find(([, field]) => field.type === "button")?.[0];

  if (buttonField) {
    sendPreviewButton(buttonField);
  }
}

function sendPreviewButton(field) {
  if (!previewReady || !previewFrame.contentWindow) {
    return;
  }

  updatePreview();
  previewFrame.contentWindow.postMessage({
    type: "streamtools:overlay-button",
    field
  }, window.location.origin);
}

function resizePreview() {
  const config = collectConfig();
  const width = Number(config.canvasWidth || 1920);
  const height = Number(config.canvasHeight || 1080);
  const viewportWidth = previewViewport.clientWidth || 1;
  const viewportHeight = previewViewport.clientHeight || 1;
  const fitScale = Math.min(viewportWidth / width, viewportHeight / height);
  const scale = previewFit ? fitScale : previewZoom;

  previewViewport.style.aspectRatio = `${width} / ${height}`;
  previewFrame.style.width = `${width}px`;
  previewFrame.style.height = `${height}px`;
  previewFrame.style.transform = `scale(${scale})`;
  fitButton.classList.toggle("active", previewFit);
}

function setPreviewZoom(value) {
  previewFit = false;
  previewZoom = Math.max(0.1, Math.min(value, 4));
  resizePreview();
}

function toggleSnapToGrid() {
  const current = getFieldValue("snapToGrid") === "On";
  setFieldValue("snapToGrid", current ? "Off" : "On");
  updatePreview();
}

function syncToolbarState(config) {
  const snapEnabled = config.snapToGrid === "On";
  snapButton.classList.toggle("active", snapEnabled);
  volumeInput.value = String(config.audioVolume ?? 100);
}

function getFieldValue(name) {
  return configForm.elements[name]?.value;
}

function setFieldValue(name, value) {
  const field = configForm.elements[name];
  if (field) {
    field.value = String(value);
  }
}

function startToolbarDrag(event) {
  event.preventDefault();
  toolbarHandle.setPointerCapture(event.pointerId);

  const panelRect = previewToolbar.offsetParent.getBoundingClientRect();
  const toolbarRect = previewToolbar.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startLeft = toolbarRect.left - panelRect.left;
  const startTop = toolbarRect.top - panelRect.top;

  previewToolbar.style.right = "auto";
  previewToolbar.style.bottom = "auto";
  previewToolbar.style.transform = "none";

  function moveToolbar(moveEvent) {
    const nextLeft = startLeft + moveEvent.clientX - startX;
    const nextTop = startTop + moveEvent.clientY - startY;
    const maxLeft = previewToolbar.offsetParent.clientWidth - previewToolbar.offsetWidth;
    const maxTop = previewToolbar.offsetParent.clientHeight - previewToolbar.offsetHeight;

    previewToolbar.style.left = `${Math.max(0, Math.min(nextLeft, maxLeft))}px`;
    previewToolbar.style.top = `${Math.max(0, Math.min(nextTop, maxTop))}px`;
  }

  function stopToolbarDrag() {
    localStorage.setItem("streamtools.overlayEditorToolbar", JSON.stringify({
      left: previewToolbar.style.left,
      top: previewToolbar.style.top
    }));
    toolbarHandle.removeEventListener("pointermove", moveToolbar);
    toolbarHandle.removeEventListener("pointerup", stopToolbarDrag);
    toolbarHandle.removeEventListener("pointercancel", stopToolbarDrag);
  }

  toolbarHandle.addEventListener("pointermove", moveToolbar);
  toolbarHandle.addEventListener("pointerup", stopToolbarDrag);
  toolbarHandle.addEventListener("pointercancel", stopToolbarDrag);
}

function restoreToolbarPosition() {
  try {
    const position = JSON.parse(localStorage.getItem("streamtools.overlayEditorToolbar") || "{}");
    if (!position.left || !position.top) {
      return;
    }

    previewToolbar.style.left = position.left;
    previewToolbar.style.top = position.top;
    previewToolbar.style.right = "auto";
    previewToolbar.style.bottom = "auto";
    previewToolbar.style.transform = "none";
  } catch {}
}

function addPreviewQuery(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}preview=1`;
}

function titleFromSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function requestJson(url, options = {}) {
  const token = tokenInput.value.trim();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(requiresToken && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.style.color = isError ? "#ff8c8c" : "";
}

})();
