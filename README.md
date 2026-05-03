# StreamTools

StreamTools is a local stream overlay and automation toolkit built for OBS, Streamer.bot, Twitch integrations, and modular browser-source widgets. The goal of this project is to keep stream widgets organized, reusable, easy to debug, and safe to modify over time.

This repo is designed for a local web server that hosts OBS browser-source widgets, exposes API routes, and provides shared assets/configuration used across multiple overlays.

---

## Project Goals

StreamTools should be:

- **Modular**: each widget lives in its own folder and can be developed independently.
- **Predictable**: every widget follows the same file structure and naming pattern.
- **Beginner-friendly**: code should be clearly labeled, sectioned, and commented.
- **Debuggable**: widgets should include safe debug toggles and visible diagnostic modes where useful.
- **Future-proof**: shared values such as API URLs, theme colors, tokens, refresh intervals, and feature flags should come from central config sources instead of being hardcoded in multiple widgets.
- **OBS-friendly**: widgets should be lightweight, browser-source safe, and avoid unnecessary visual/rendering overhead.
- **Streamer.bot-friendly**: integrations should expose clear API routes, event names, and documented variable expectations.

---

## Recommended Repository Structure

```text
StreamTools/
│
├─ server/
│  ├─ server.js
│  ├─ package.json
│  ├─ package-lock.json
│  ├─ routes/
│  │  ├─ health.js
│  │  ├─ timers.js
│  │  └─ pishock.js
│  ├─ services/
│  │  └─ pishockService.js
│  ├─ config/
│  │  └─ env.js
│  └─ utils/
│     └─ logger.js
│
├─ public/
│  ├─ widgets/
│  │  ├─ pishock-status/
│  │  │  ├─ index.html
│  │  │  ├─ widget.css
│  │  │  ├─ widget.js
│  │  │  ├─ config.js
│  │  │  ├─ config.example.js
│  │  │  ├─ README.md
│  │  │  └─ assets/
│  │  │
│  │  ├─ timer-overlay/
│  │  │  ├─ index.html
│  │  │  ├─ widget.css
│  │  │  ├─ widget.js
│  │  │  ├─ config.js
│  │  │  ├─ config.example.js
│  │  │  ├─ README.md
│  │  │  └─ assets/
│  │  │
│  │  └─ slot-machine/
│  │     ├─ index.html
│  │     ├─ widget.css
│  │     ├─ widget.js
│  │     ├─ config.js
│  │     ├─ config.example.js
│  │     ├─ README.md
│  │     └─ assets/
│  │
│  ├─ shared/
│  │  ├─ config/
│  │  │  ├─ streamtools.config.js
│  │  │  ├─ streamtools.config.example.js
│  │  │  └─ streamtools.config.live.example.js
│  │  ├─ css/
│  │  │  ├─ reset.css
│  │  │  ├─ theme.css
│  │  │  └─ debug.css
│  │  ├─ js/
│  │  │  ├─ apiClient.js
│  │  │  ├─ debugTools.js
│  │  │  ├─ featureFlags.js
│  │  │  └─ widgetUtils.js
│  │  ├─ assets/
│  │  └─ fonts/
│  │
│  └─ index.html
│
├─ streamerbot/
│  ├─ actions/
│  ├─ csharp/
│  │  ├─ pishock/
│  │  ├─ pyramid-engine/
│  │  ├─ obs-control/
│  │  └─ examples/
│  └─ notes/
│
├─ obs/
│  ├─ browser-source-urls.md
│  ├─ scene-notes.md
│  └─ setup-checklists/
│
├─ docs/
│  ├─ setup.md
│  ├─ widget-guide.md
│  ├─ api-routes.md
│  ├─ streamerbot-integration.md
│  ├─ coding-standards.md
│  └─ troubleshooting.md
│
├─ logs/
│  └─ .gitkeep
│
├─ backups/
│  └─ .gitkeep
│
├─ .env.example
├─ .gitignore
├─ README.md
└─ CHANGELOG.md
```

---

## Core Design Philosophy

### One main project, many widgets

Widgets should usually live inside this one StreamTools repo rather than each widget becoming its own GitHub repository.

Use separate widget folders for organization:

```text
public/widgets/pishock-status/
public/widgets/timer-overlay/
public/widgets/slot-machine/
public/widgets/anthro-corp-status/
```

Create a separate repo only if a widget becomes a standalone product, has a separate backend, or needs to be shared publicly on its own.

---

## Shared Configuration Strategy

Shared values should not be hardcoded inside multiple widgets.

Use central shared config files for values that multiple widgets may need, such as:

- Server base URL
- API route paths
- Brand colors
- Default fonts
- Default animation timings
- Debug mode defaults
- Global refresh intervals
- Shared feature flags
- OBS/browser source safe defaults

Recommended shared config file:

```text
public/shared/config/streamtools.config.js
```

Machine-specific network values, such as the LAN IP address used by OBS browser sources, should live in this file. The active `streamtools.config.js` file is intentionally ignored by git so the live web server can keep its own address and port without repo updates overwriting it.

For repo/workshop use, copy the default example:

```text
public/shared/config/streamtools.config.example.js
public/shared/config/streamtools.config.js
```

The default example follows the host and port that served the widget. If the workshop server is running on `127.0.0.1:3054`, widgets will use `127.0.0.1:3054`; if it is running on `localhost:3030`, widgets will use `localhost:3030`.

For the live web server, copy the live example once and leave the active file alone during normal repo updates:

```text
public/shared/config/streamtools.config.live.example.js
public/shared/config/streamtools.config.js
```

Example:

```js
// public/shared/config/streamtools.config.example.js

(function () {
  const locationIsHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  const serverProtocol = locationIsHttp ? window.location.protocol.replace(":", "") : "http";
  const serverHost = locationIsHttp ? window.location.hostname : "localhost";
  const serverPort = locationIsHttp ? window.location.port : "3030";
  const serverBaseUrl = serverPort
    ? `${serverProtocol}://${serverHost}:${serverPort}`
    : `${serverProtocol}://${serverHost}`;

  window.STREAMTOOLS_CONFIG = {
    server: {
      protocol: serverProtocol,
      host: serverHost,
      port: serverPort,
      baseUrl: serverBaseUrl,
      apiBase: "/api",
      widgetBase: "/widgets",
      sharedBase: "/shared"
    },

    urls: {
      health: `${serverBaseUrl}/health`,
      apiHealth: `${serverBaseUrl}/api/health`,
      widgetRoot: `${serverBaseUrl}/widgets/`,
      sharedRoot: `${serverBaseUrl}/shared/`
    },

    brand: {
      name: "StreamTools",
      primaryColor: "#1e7bff",
      accentColor: "#00d4ff",
      warningColor: "#ffcc00",
      dangerColor: "#ff3b3b"
    },

    defaults: {
      refreshIntervalMs: 1000,
      animationSpeedMs: 300,
      enableSounds: true,
      enableAnimations: true
    },

    debug: {
      enabled: false,
      showDebugBadge: false,
      logApiCalls: false,
      logWidgetState: false,
      showMockDataControls: false
    },

    features: {
      useSharedTheme: true,
      preloadAssets: true,
      allowDemoMode: false
    }
  };
})();
```

Each widget may also have its own local config file for widget-specific settings:

```text
public/widgets/pishock-status/config.js
```

Example:

```js
// public/widgets/pishock-status/config.example.js

window.WIDGET_CONFIG = {
  widgetName: "pishock-status",

  controls: {
    enabled: true,
    demoMode: false,
    showChargeBar: true,
    showCooldown: true,
    showConnectionStatus: true,
    playAlertSounds: false
  },

  api: {
    statusEndpoint: "/api/pishock/status",
    refreshIntervalMs: 1000
  },

  display: {
    compactMode: false,
    showHeader: true,
    showTicker: false,
    showLastUpdated: true
  },

  debug: {
    enabled: false,
    logStatusPayloads: false,
    showLayoutBounds: false,
    showTestButtons: false
  }
};
```

### Config priority order

When a setting exists in multiple places, use this priority:

1. Widget-specific config
2. Shared StreamTools config
3. Safe default inside the widget code

Example logic:

```js
const sharedConfig = window.STREAMTOOLS_CONFIG || {};
const widgetConfig = window.WIDGET_CONFIG || {};

const refreshIntervalMs =
  widgetConfig?.api?.refreshIntervalMs ||
  sharedConfig?.defaults?.refreshIntervalMs ||
  1000;
```

---

## Environment Variables

Secrets and machine-specific values belong in `.env`, not in committed code.

Use `.env.example` as a safe template.

Example:

```env
PORT=3030
HOST=0.0.0.0
NODE_ENV=development

FORGE_TOKEN=replace_me
BEARER_TOKEN=replace_me
STREAMERBOT_WS_URL=ws://127.0.0.1:8080
PISHOCK_API_URL=http://replace-me

ENABLE_DEBUG_LOGS=false
ENABLE_DEMO_ROUTES=false
```

Never commit real tokens, API keys, private URLs, or passwords.

---

## Git Ignore Rules

Recommended `.gitignore`:

```gitignore
# dependencies
node_modules/

# environment secrets
.env
.env.local
*.env
!.env.example

# logs
logs/
*.log

# backups
backups/
*.zip
*.7z
*.rar

# local runtime/cache files
.cache/
*.pid

# operating system files
.DS_Store
Thumbs.db

# editor files
.vscode/
.idea/
```

---

## Server Overview

The local StreamTools server is responsible for:

- Serving static widget files to OBS browser sources
- Providing health check routes
- Providing API routes used by widgets
- Acting as a bridge between widgets, Streamer.bot, OBS, Twitch, and other local tools

Recommended local URL:

```text
http://localhost:3030
```

For OBS browser sources on another machine, use the live server's active `public/shared/config/streamtools.config.js` with the stream PC's LAN IP address.

Recommended static widget route:

```text
/widgets/<widget-folder>/
```

Example OBS browser source URL:

```text
http://<your-lan-ip>:3030/widgets/pishock-status/
```

Recommended Express static serving pattern:

```js
app.use("/widgets", express.static("public/widgets"));
app.use("/shared", express.static("public/shared"));
```

---

## API Route Pattern

API routes should live under:

```text
server/routes/
```

Use clear route names:

```text
GET  /api/health
GET  /api/timers
POST /api/timers/upsert   (Bearer token required)
POST /api/timers/remove   (Bearer token required)
POST /api/timers/expire   (Bearer token required)
GET  /api/pishock/status
POST /api/pishock/status  (Bearer token required)
```

Each route file should be small and focused.

Example route structure:

```js
// server/routes/pishock.js

// ------------------------------------------------------------
// Imports
// ------------------------------------------------------------
const express = require("express");
const router = express.Router();

// ------------------------------------------------------------
// Route: GET /api/pishock/status
// Purpose: Returns current PiShock widget status data.
// ------------------------------------------------------------
router.get("/status", async (req, res) => {
  try {
    res.json({
      ok: true,
      chargePool: 0,
      cooldownActive: false,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[PiShock] Failed to get status", error);
    res.status(500).json({
      ok: false,
      error: "Failed to get PiShock status"
    });
  }
});

module.exports = router;
```

---

## Widget Folder Standard

Every widget should follow this structure:

```text
public/widgets/widget-name/
├─ index.html
├─ widget.css
├─ widget.js
├─ config.js
├─ config.example.js
├─ README.md
└─ assets/
```

### Required widget files

#### `index.html`

The OBS browser source entry point.

Should include:

- Clear title
- Shared config script
- Widget config script
- Shared CSS if used
- Widget CSS
- Widget JS
- Debug panel container if useful

Example:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StreamTools - Widget Name</title>

  <link rel="stylesheet" href="/shared/css/reset.css" />
  <link rel="stylesheet" href="/shared/css/theme.css" />
  <link rel="stylesheet" href="./widget.css" />
</head>
<body>
  <main id="widget-root" class="widget-root">
    <!-- Widget content goes here -->
  </main>

  <script src="/shared/config/streamtools.config.js"></script>
  <script src="./config.js"></script>
  <script src="/shared/js/apiClient.js"></script>
  <script src="/shared/js/debugTools.js"></script>
  <script src="./widget.js"></script>
</body>
</html>
```

#### `widget.css`

Widget-specific styles.

Should include clearly labeled sections:

```css
/* ------------------------------------------------------------
   00) Root Variables
------------------------------------------------------------ */

/* ------------------------------------------------------------
   01) Base Layout
------------------------------------------------------------ */

/* ------------------------------------------------------------
   02) Widget Panels
------------------------------------------------------------ */

/* ------------------------------------------------------------
   03) Animations
------------------------------------------------------------ */

/* ------------------------------------------------------------
   04) Debug Styles
------------------------------------------------------------ */
```

#### `widget.js`

Widget-specific behavior.

Should include clearly labeled sections:

```js
// ------------------------------------------------------------
// 00) Config + Safe Defaults
// ------------------------------------------------------------

// ------------------------------------------------------------
// 01) DOM References
// ------------------------------------------------------------

// ------------------------------------------------------------
// 02) State
// ------------------------------------------------------------

// ------------------------------------------------------------
// 03) Init
// ------------------------------------------------------------

// ------------------------------------------------------------
// 04) API Calls
// ------------------------------------------------------------

// ------------------------------------------------------------
// 05) Render Functions
// ------------------------------------------------------------

// ------------------------------------------------------------
// 06) Event Listeners
// ------------------------------------------------------------

// ------------------------------------------------------------
// 07) Debug Helpers
// ------------------------------------------------------------
```

---

## Coding Standards

### General rules

- Prefer simple, readable code over clever code.
- Use clear variable names.
- Avoid mystery numbers. Put adjustable values in config.
- Add comments for purpose, not every single line.
- Keep functions small and focused.
- Use consistent section headers.
- Avoid hardcoded API URLs inside widgets.
- Avoid duplicated logic across widgets when it can live in `public/shared/js/`.
- Keep OBS performance in mind.
- Preload assets when practical.
- Make demo/test modes easy to disable.

### Naming rules

Use predictable names:

```text
widget.js
widget.css
config.js
config.example.js
README.md
```

Use kebab-case for folders:

```text
pishock-status
timer-overlay
slot-machine
anthro-corp-status
```

Use camelCase for JavaScript variables:

```js
const chargePool = 0;
const cooldownActive = false;
const refreshIntervalMs = 1000;
```

Use uppercase snake case only for environment variables:

```env
FORGE_TOKEN=replace_me
ENABLE_DEBUG_LOGS=false
```

---

## Required Section Header Format

Use this style for major sections in JavaScript, CSS, and C# files:

```js
// ------------------------------------------------------------
// 00) Section Name
// ------------------------------------------------------------
```

For subsections:

```js
// ----- Small subsection -----
```

For warnings:

```js
// NOTE: Explain important behavior here.
// WARNING: Explain anything risky here.
// TODO: Explain future work here.
```

---

## Control Sections

Every widget should have a clearly labeled control section in its config file.

Example:

```js
window.WIDGET_CONFIG = {
  controls: {
    enabled: true,
    demoMode: false,
    enableAnimations: true,
    enableSounds: false,
    showDebugPanel: false,
    showTestButtons: false
  }
};
```

If a feature makes sense as a standalone preference, it should usually be controlled from config.

Examples:

- Enable/disable demo mode
- Enable/disable animations
- Enable/disable sounds
- Show/hide debug panel
- Show/hide ticker
- Use compact mode
- Use transparent background
- Use mock data
- Enable/disable API polling
- Enable/disable local storage

---

## Addition Templates

When a file has sections where future additions are expected, include an example template above the editable section.

Example:

```js
// ------------------------------------------------------------
// 04) Widget Modes
// ------------------------------------------------------------

// Template:
// modeName: {
//   label: "Human readable label",
//   width: 600,
//   height: 400,
//   showTicker: false,
//   compact: true
// }

const WIDGET_MODES = {
  full: {
    label: "Full",
    width: 1920,
    height: 1080,
    showTicker: true,
    compact: false
  },

  compact: {
    label: "Compact",
    width: 600,
    height: 400,
    showTicker: false,
    compact: true
  }
};
```

This keeps future edits easier for novice programmers and Codex-assisted changes.

---

## Debugging Standards

Debugging should be intentional, controlled, and easy to turn off.

### Recommended debug toggles

```js
window.WIDGET_CONFIG = {
  debug: {
    enabled: false,
    showDebugBadge: false,
    showLayoutBounds: false,
    logApiCalls: false,
    logStateChanges: false,
    showMockDataControls: false
  }
};
```

### Console logging pattern

Use a helper so logs can be turned on/off cleanly:

```js
function debugLog(...args) {
  const debugEnabled = window.WIDGET_CONFIG?.debug?.enabled === true;

  if (!debugEnabled) return;

  console.log("[WidgetName]", ...args);
}
```

### Debug badge pattern

Widgets may show a small debug badge when debug mode is active:

```text
DEBUG MODE
DEMO DATA
API OFFLINE
```

This helps avoid accidentally running OBS with test data without noticing.

---

## Demo Mode Standards

Demo mode is useful for designing widgets without live API data.

Demo mode should:

- Be disabled by default.
- Be controlled from widget config.
- Be visibly marked when active.
- Never be confused with real live data.
- Use predictable mock payloads.

Example:

```js
const demoMode = window.WIDGET_CONFIG?.controls?.demoMode === true;

if (demoMode) {
  renderStatus(getMockStatus());
} else {
  fetchLiveStatus();
}
```

---

## Asset Standards

Each widget should keep widget-specific assets inside its own `assets/` folder.

Shared assets should live in:

```text
public/shared/assets/
```

Use widget-specific assets for:

- Unique icons
- Widget-only sounds
- Widget-only images
- Special animation elements

Use shared assets for:

- Brand logos
- Common sound effects
- Common backgrounds
- Common UI elements
- Shared fonts

Assets should be named clearly:

```text
charge-bar-frame.png
status-online.svg
alert-warning.wav
spin-start.mp3
```

Avoid vague names:

```text
thing.png
newnewfinal.png
sound2.mp3
```

---

## OBS Browser Source Standards

Widgets should be designed for OBS browser sources.

Each widget README should list:

- Recommended browser source URL
- Recommended width
- Recommended height
- Whether transparency is expected
- Whether custom CSS is needed in OBS
- Whether the widget needs audio control
- Whether the widget should refresh when scene becomes active

Example:

```text
URL: http://<your-lan-ip>:3030/widgets/pishock-status/
Width: 600
Height: 400
Custom CSS: none
Shutdown source when not visible: optional
Refresh browser when scene becomes active: recommended during testing only
Control audio via OBS: no
```

---

## Streamer.bot Integration Standards

Streamer.bot scripts and notes should live under:

```text
streamerbot/
```

Recommended structure:

```text
streamerbot/
├─ csharp/
│  ├─ pishock/
│  ├─ pyramid-engine/
│  ├─ obs-control/
│  └─ examples/
├─ actions/
└─ notes/
```

Each Streamer.bot integration should document:

- Action name
- Trigger type
- Required global variables
- Required arguments
- Expected output arguments
- Related API route
- Related OBS source, if any

Example:

```text
Action Name: PiShock - Add Charge
Trigger: Twitch Channel Point Redemption
Global Variables Used:
- ps_chargePool
- ps_cooldownActive

Expected API Route:
- GET /api/pishock/status

Related Widget:
- /widgets/pishock-status/
```

---

## C# Script Standards for Streamer.bot

Streamer.bot C# scripts should be structured with labeled sections.

Example:

```csharp
using System;

public class CPHInline
{
    public bool Execute()
    {
        // ------------------------------------------------------------
        // 00) Control Values
        // ------------------------------------------------------------
        int addCharge = 5;

        // ------------------------------------------------------------
        // 01) Read Current State
        // ------------------------------------------------------------
        int pool = GetInt("ps_chargePool", 0);
        int oldPool = pool;

        // ------------------------------------------------------------
        // 02) Apply Logic
        // ------------------------------------------------------------
        pool = Math.Min(100, pool + addCharge);

        // ------------------------------------------------------------
        // 03) Save State
        // ------------------------------------------------------------
        CPH.SetGlobalVar("ps_chargePool", pool, true);

        // ------------------------------------------------------------
        // 04) Debug Logging
        // ------------------------------------------------------------
        CPH.LogInfo("[PiShock Debug] Add Charge | OldPool=" + oldPool + " | Add=" + addCharge + " | NewPool=" + pool);

        return true;
    }

    private int GetInt(string name, int fallback)
    {
        try { return CPH.GetGlobalVar<int>(name, true); }
        catch { return fallback; }
    }
}
```

### C# rules

- Prefer strings and simple values where possible.
- Avoid unnecessary hashing unless there is a clear reason.
- Use helper functions for repeated variable reads.
- Log important state changes.
- Keep output arguments clearly named.
- Use consistent prefixes for related variables.

Example prefixes:

```text
ps_     PiShock
pyr_    Pyramid Engine
timer_  Timers
obs_    OBS control
st_     Shared StreamTools
```

---

## Documentation Standards

Every major feature should include enough documentation that future-you can understand it quickly.

Use documentation files for:

```text
docs/setup.md
docs/widget-guide.md
docs/api-routes.md
docs/streamerbot-integration.md
docs/troubleshooting.md
```

Each widget should also have its own README:

```text
public/widgets/pishock-status/README.md
```

Widget README template:

```md
# Widget Name

## Purpose

Explain what this widget does.

## OBS URL

```text
http://<your-lan-ip>:3030/widgets/widget-name/
```

## Recommended OBS Settings

- Width:
- Height:
- Transparency:
- Audio:

## Config Options

| Option | Default | Description |
|---|---:|---|
| controls.enabled | true | Enables the widget |
| controls.demoMode | false | Uses mock data |

## API Routes Used

- GET /api/example/status

## Debug Options

Explain debug toggles.

## Notes

Anything special about this widget.
```

---

## Git Workflow

Recommended branch workflow:

```text
main
feature/pishock-status-widget
feature/timer-overlay
fix/static-widget-serving
fix/pishock-api-status
```

Basic workflow:

```bash
git checkout main
git pull
git checkout -b feature/widget-name

# make changes

git add .
git commit -m "Add widget-name widget"
git push -u origin feature/widget-name
```

Keep `main` stable. Work on features in branches.

Do not let experimental code live directly on `main` unless it has been tested.

---

## Codex / AI Assistant Guidelines

When using Codex or another AI coding assistant, start with inspection before edits.

Recommended first prompt:

```text
Inspect this project and explain the folder structure, server routes, widget folders, and shared config system. Do not edit anything yet.
```

Recommended edit prompt:

```text
Make the smallest safe change needed to solve the issue. Preserve the existing structure, section headers, config pattern, and debug toggles. Explain which files you changed and why.
```

Recommended review prompt:

```text
Review this change for broken routes, hardcoded values, missing config options, missing debug controls, OBS compatibility issues, and beginner-readability problems.
```

AI assistants should follow these project rules:

- Do not remove section headers.
- Do not hardcode shared values if a config source exists.
- Do not silently remove debug tools.
- Do not collapse files into unreadable dense code.
- Do not rename routes, variables, or folders unless asked.
- Prefer small targeted changes.
- Update related documentation when behavior changes.
- Preserve OBS-safe behavior.
- Preserve Streamer.bot compatibility.

---

## Feature Flag Standards

Feature flags should be used when a feature may need to be enabled/disabled without rewriting code.

Example:

```js
window.STREAMTOOLS_CONFIG = {
  features: {
    preloadAssets: true,
    enableWidgetSounds: true,
    enableStreamerBotBridge: true,
    enableExperimentalModes: false
  }
};
```

Do not use feature flags as a substitute for cleaning up old code. Remove abandoned experiments once they are no longer needed.

---

## Logging Standards

Server logs should be clear and searchable.

Recommended format:

```text
[Area] Action | Key=value | Key=value
```

Examples:

```text
[Server] Started | Host=0.0.0.0 | Port=3030
[PiShock] Status Updated | ChargePool=45 | Cooldown=false
[Timer] Created | Label=Break Time | Duration=300
[OBS] Request Sent | Action=SetInputSettings | Source=TimerOverlay
```

Avoid vague logs:

```text
Done
Worked
Error happened
```

---

## Error Handling Standards

API errors should return safe JSON.

Example:

```js
res.status(500).json({
  ok: false,
  error: "Failed to load PiShock status"
});
```

Do not expose private tokens, full stack traces, or sensitive internal data to browser widgets.

Widgets should fail gracefully:

- Show offline state
- Show fallback display
- Log debug info only when debug mode is enabled
- Retry API calls at a reasonable interval
- Avoid infinite rapid retry loops

---

## Performance Guidelines

Because widgets run inside OBS browser sources, avoid unnecessary rendering cost.

Recommended:

- Use simple CSS animations when possible.
- Avoid large full-screen blur effects.
- Avoid excessive drop shadows on many moving elements.
- Preload important assets.
- Keep polling intervals reasonable.
- Hide or remove unused DOM elements.
- Use static baked images for expensive effects when possible.

Avoid:

- Constant layout recalculations
- Massive animated backgrounds when unnecessary
- Multiple large transparent videos unless needed
- Uncontrolled timers or intervals
- Debug panels left visible during live streams

---

## Adding a New Widget

1. Create a new folder:

```text
public/widgets/new-widget-name/
```

2. Add required files:

```text
index.html
widget.css
widget.js
config.js
config.example.js
README.md
assets/
```

3. Use shared config:

```html
<script src="/shared/config/streamtools.config.js"></script>
<script src="./config.js"></script>
```

4. Add the OBS URL to:

```text
obs/browser-source-urls.md
```

5. Add any API route documentation to:

```text
docs/api-routes.md
```

6. Add Streamer.bot notes if needed:

```text
streamerbot/notes/
```

7. Test in a browser before adding to OBS.

8. Test in OBS before using live.

---

## Current/Planned Widget Ideas

Current or planned StreamTools widgets may include:

- PiShock status widget
- Timer overlay
- Slot machine overlay
- Anthro-Corp status panel
- Stream progress / EXP widget
- Stream halfway and end alerts
- Twitch chat game widgets
- OBS control panels
- Night Howlers themed interaction widgets

Each widget should follow the same project rules unless there is a documented reason not to.

---

## Useful Local URLs

Update `public/shared/config/streamtools.config.js` only for the environment where it lives. Repo/workshop copies can use the default same-origin config; the live web server should keep its own active config with the configured LAN IP and port.

```text
Server Health:
http://localhost:3030/health

Widget Root:
http://localhost:3030/widgets/

PiShock Status Widget:
http://<your-lan-ip>:3030/widgets/pishock-status/

Timer Overlay:
http://<your-lan-ip>:3030/widgets/timer-overlay/

Slot Machine:
http://<your-lan-ip>:3030/widgets/slot-machine/
```

---

## Quick Start

Run these commands from the repo root unless a command says otherwise.

Install server dependencies:

```bash
cd server
npm install
```

Create local config files:

```bash
cd ..
copy .env.example .env
copy public\shared\config\streamtools.config.example.js public\shared\config\streamtools.config.js
```

Start the local server:

```bash
cd server
npm start
```

Check the server in a browser:

```text
http://localhost:3030/health
http://localhost:3030/api/health
http://localhost:3030/widgets/
```

For OBS browser sources on another machine, use the live server's `public/shared/config/streamtools.config.js`. Do not overwrite that live active config during repo updates.

---

## Setup Checklist

### First-time setup

- [ ] Clone repo
- [ ] Install Node dependencies with `cd server` then `npm install`
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in local `.env` values
- [ ] Copy shared config example to active config
- [ ] Copy widget config examples to active config files
- [ ] Start server with `cd server` then `npm start`
- [ ] Confirm `/health` works
- [ ] Confirm `/api/health` works
- [ ] Confirm `/widgets/...` loads
- [ ] Add widget URL to OBS browser source
- [ ] Test with debug mode enabled
- [ ] Disable debug mode before live use

### Before going live

- [ ] Confirm server is running
- [ ] Confirm OBS browser sources load
- [ ] Confirm demo mode is off
- [ ] Confirm debug panels are hidden
- [ ] Confirm API routes respond
- [ ] Confirm Streamer.bot actions are connected
- [ ] Confirm sounds are routed correctly
- [ ] Confirm no secrets are visible in browser console

---

## Troubleshooting Checklist

### Widget does not load

- Check the OBS browser source URL.
- Open the URL in a normal browser.
- Confirm the server is running.
- Confirm static routes are configured.
- Check browser console errors.
- Check server logs.

### Widget loads but has no data

- Confirm API route works directly in browser.
- Confirm demo mode is not accidentally enabled.
- Check widget config endpoint path.
- Check CORS settings if calling another host.
- Check server logs.

### Widget looks wrong in OBS

- Confirm OBS browser source width/height.
- Confirm transparency settings.
- Confirm CSS uses fixed or responsive sizing correctly.
- Check whether compact mode is enabled.
- Check whether ticker/header elements are hidden for small layouts.

### Streamer.bot data is wrong

- Confirm global variable names.
- Confirm persisted vs non-persisted variable setting.
- Confirm action trigger order.
- Confirm relay/status actions are not overwriting values.
- Add temporary debug logs.

---

## Changelog Standards

Use `CHANGELOG.md` to track notable changes.

Example:

```md
# Changelog

## 2026-05-02

### Added
- Initial StreamTools repo structure.
- Added shared config pattern.
- Added widget folder standard.

### Changed
- Moved widgets under `public/widgets/`.

### Fixed
- Fixed static widget serving path.
```

---

## Final Rule

Build everything so future-you can open the project tired, distracted, or rusty and still understand what is happening.

Readable beats clever.
Controlled beats chaotic.
Config beats hardcoding.
Debuggable beats mysterious.
Small safe changes beat giant risky rewrites.
