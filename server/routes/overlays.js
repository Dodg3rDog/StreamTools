const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { requireBearerToken } = require("../middleware/auth");

const router = express.Router();
const purchasedOverlayRoot = path.join(__dirname, "../../public/overlays/purchased");
const overlayEditorRequiresToken = process.env.OVERLAY_EDITOR_REQUIRE_TOKEN !== "false";

router.get("/access", (req, res) => {
  res.json({
    ok: true,
    requiresToken: overlayEditorRequiresToken
  });
});

router.get("/purchased", requireOverlayAccess, async (req, res) => {
  try {
    const entries = await fs.readdir(purchasedOverlayRoot, { withFileTypes: true });
    const overlays = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        slug: entry.name,
        name: titleFromSlug(entry.name),
        url: `/overlays/purchased/${entry.name}/`,
        configUrl: `/api/overlays/purchased/${entry.name}/config`
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      ok: true,
      overlays
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.json({
        ok: true,
        overlays: []
      });
    }

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

router.post("/purchased", requireOverlayAccess, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const slug = slugify(name);

    if (!slug) {
      return res.status(400).json({
        ok: false,
        error: "Overlay name is required"
      });
    }

    const overlayPath = getOverlayPath(slug);

    await fs.mkdir(purchasedOverlayRoot, { recursive: true });
    await fs.mkdir(overlayPath);
    await writeBlankOverlay(overlayPath, name || titleFromSlug(slug));

    res.status(201).json({
      ok: true,
      overlay: {
        slug,
        name: name || titleFromSlug(slug),
        url: `/overlays/purchased/${slug}/`,
        configUrl: `/api/overlays/purchased/${slug}/config`
      }
    });
  } catch (error) {
    if (error.code === "EEXIST") {
      return res.status(409).json({
        ok: false,
        error: "An overlay with that name already exists"
      });
    }

    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/purchased/:slug/config", requireOverlayAccess, async (req, res) => {
  try {
    const overlayPath = getOverlayPath(req.params.slug);
    const [fields, config] = await Promise.all([
      readJson(path.join(overlayPath, "fields.json"), {}),
      readJson(path.join(overlayPath, "config.json"), {})
    ]);

    res.json({
      ok: true,
      slug: req.params.slug,
      fields,
      config,
      url: `/overlays/purchased/${req.params.slug}/`
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.put("/purchased/:slug/config", requireOverlayAccess, async (req, res) => {
  try {
    const overlayPath = getOverlayPath(req.params.slug);
    const config = normalizeConfig(req.body?.config || req.body || {});
    const configPath = path.join(overlayPath, "config.json");

    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    res.json({
      ok: true,
      slug: req.params.slug,
      config
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

function getOverlayPath(slug) {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug || "")) {
    const error = new Error("Invalid overlay slug");
    error.statusCode = 400;
    throw error;
  }

  return path.join(purchasedOverlayRoot, slug);
}

async function writeBlankOverlay(overlayPath, name) {
  const config = {
    canvasWidth: 1920,
    canvasHeight: 1080,
    widgetWidth: 640,
    widgetHeight: 220,
    widgetTop: 120,
    widgetLeft: 120,
    widgetOpacity: 100,
    widgetRotation: 0,
    snapToGrid: "Off",
    audioVolume: 100,
    title: name
  };

  const fields = {
    canvasWidth: {
      group: "Overlay",
      type: "num",
      label: "Canvas Width",
      value: 1920,
      min: 1,
      step: 1
    },
    canvasHeight: {
      group: "Overlay",
      type: "num",
      label: "Canvas Height",
      value: 1080,
      min: 1,
      step: 1
    },
    widgetWidth: {
      group: "Position, size and style",
      type: "num",
      label: "Width",
      value: 640,
      min: 1,
      step: 1
    },
    widgetHeight: {
      group: "Position, size and style",
      type: "num",
      label: "Height",
      value: 220,
      min: 1,
      step: 1
    },
    widgetTop: {
      group: "Position, size and style",
      type: "num",
      label: "Top",
      value: 120,
      step: 1
    },
    widgetLeft: {
      group: "Position, size and style",
      type: "num",
      label: "Left",
      value: 120,
      step: 1
    },
    widgetOpacity: {
      group: "Position, size and style",
      type: "num",
      label: "Opacity",
      value: 100,
      min: 0,
      max: 100,
      step: 1
    },
    widgetRotation: {
      group: "Position, size and style",
      type: "num",
      label: "Rotation",
      value: 0,
      step: 1
    },
    snapToGrid: {
      group: "Position, size and style",
      type: "dropdown",
      label: "Snap to Grid",
      value: "Off",
      options: {
        On: "On",
        Off: "Off"
      }
    },
    audioVolume: {
      group: "Audio",
      type: "num",
      label: "Volume",
      value: 100,
      min: 0,
      max: 100,
      step: 1
    },
    title: {
      group: "Content",
      type: "text",
      label: "Title",
      value: name
    }
  };

  await Promise.all([
    fs.writeFile(path.join(overlayPath, "index.html"), blankIndexHtml(name), "utf8"),
    fs.writeFile(path.join(overlayPath, "style.css"), blankStyleCss(), "utf8"),
    fs.writeFile(path.join(overlayPath, "script.js"), blankScriptJs(), "utf8"),
    fs.writeFile(path.join(overlayPath, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8"),
    fs.writeFile(path.join(overlayPath, "fields.json"), `${JSON.stringify(fields, null, 2)}\n`, "utf8")
  ]);
}

function blankIndexHtml(name) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(name)}</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <main id="mainContainer">
    <section class="overlay-card">
      <p id="titleLabel"></p>
    </section>
  </main>
  <script src="./script.js"></script>
</body>
</html>
`;
}

function blankStyleCss() {
  return `:root {
  --overlay-width: 1920px;
  --overlay-height: 1080px;
  --widget-width: 640px;
  --widget-height: 220px;
  --widget-top: 120px;
  --widget-left: 120px;
  --widget-opacity: 1;
  --widget-rotation: 0deg;
}

html,
body {
  width: var(--overlay-width);
  height: var(--overlay-height);
  margin: 0;
  overflow: hidden;
  font-family: Arial, Helvetica, sans-serif;
}

#mainContainer {
  box-sizing: border-box;
  position: absolute;
  top: var(--widget-top);
  left: var(--widget-left);
  width: var(--widget-width);
  height: var(--widget-height);
  opacity: var(--widget-opacity);
  transform: rotate(var(--widget-rotation));
  transform-origin: top left;
}

.overlay-card {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 2px solid rgb(255 255 255 / 60%);
  background: rgb(12 12 12 / 75%);
  color: white;
}

#titleLabel {
  margin: 0;
  font-size: 48px;
  font-weight: 800;
}
`;
}

function blankScriptJs() {
  return `const isPreviewMode = new URLSearchParams(window.location.search).has("preview");
const state = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  widgetWidth: 640,
  widgetHeight: 220,
  widgetTop: 120,
  widgetLeft: 120,
  widgetOpacity: 100,
  widgetRotation: 0,
  audioVolume: 100,
  title: "New Overlay"
};

loadLocalConfig();

async function loadLocalConfig() {
  try {
    const response = await fetch("./config.json", { cache: "no-store" });
    if (response.ok) {
      applyConfig(await response.json());
    }
  } catch (error) {
    console.warn("Local overlay config could not be loaded.", error);
  }
}

function applyConfig(config) {
  Object.assign(state, config || {});
  document.documentElement.style.setProperty("--overlay-width", Number(state.canvasWidth || 1920) + "px");
  document.documentElement.style.setProperty("--overlay-height", Number(state.canvasHeight || 1080) + "px");
  document.documentElement.style.setProperty("--widget-width", Number(state.widgetWidth || 640) + "px");
  document.documentElement.style.setProperty("--widget-height", Number(state.widgetHeight || 220) + "px");
  document.documentElement.style.setProperty("--widget-top", Number(state.widgetTop || 0) + "px");
  document.documentElement.style.setProperty("--widget-left", Number(state.widgetLeft || 0) + "px");
  document.documentElement.style.setProperty("--widget-opacity", Math.max(0, Math.min(Number(state.widgetOpacity ?? 100), 100)) / 100);
  document.documentElement.style.setProperty("--widget-rotation", Number(state.widgetRotation || 0) + "deg");
  document.getElementById("titleLabel").textContent = state.title || "New Overlay";

  const volume = Math.max(0, Math.min(Number(state.audioVolume ?? 100), 100)) / 100;
  document.querySelectorAll("audio, video").forEach((element) => {
    element.volume = volume;
  });
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin || !event.data) {
    return;
  }

  if (event.data.type === "streamtools:overlay-config") {
    applyConfig(event.data.config);
  }
});
`;
}

function requireOverlayAccess(req, res, next) {
  if (!overlayEditorRequiresToken) {
    return next();
  }

  return requireBearerToken(req, res, next);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

function normalizeConfig(config) {
  return Object.fromEntries(
    Object.entries(config)
      .filter(([key]) => /^[a-zA-Z0-9_]+$/.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
  );
}

function titleFromSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = router;
