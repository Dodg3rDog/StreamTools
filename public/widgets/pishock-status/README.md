# PiShock Status

## Purpose

Shows the Anthro-Corp PiShock containment dashboard for OBS browser sources.

## OBS URL

```text
http://<your-lan-ip>:3030/widgets/pishock-status/
```

## Workshop Testing

Use the workshop server when testing changes locally. It defaults to `127.0.0.1:3054` and does not use the live web server address.

```bash
cd server
npm run start:workshop
```

Open the widget:

```text
http://127.0.0.1:3054/widgets/pishock-status/
```

Useful test URLs:

```text
Full:    http://127.0.0.1:3054/widgets/pishock-status/
Compact: http://127.0.0.1:3054/widgets/pishock-status/?mode=compact
Mini:    http://127.0.0.1:3054/widgets/pishock-status/?mode=mini
Gauge:   http://127.0.0.1:3054/widgets/pishock-status/?mode=gauge&transparent=true
Ticker:  http://127.0.0.1:3054/widgets/pishock-status/?mode=ticker&transparent=true
Stage:   http://127.0.0.1:3054/widgets/pishock-status/?mode=stage&transparent=true
```

To use a different workshop port:

```bash
set PORT=3055
npm run start:workshop
```

## Recommended OBS Settings

- Width: 1920
- Height: 1080
- Transparency: optional
- Custom CSS: none
- Shutdown source when not visible: optional
- Refresh browser when scene becomes active: recommended during testing only
- Control audio via OBS: no

## Display Modes

The widget supports URL-driven layout modes:

```text
Full dashboard: /widgets/pishock-status/
Compact:        /widgets/pishock-status/?mode=compact
Mini:           /widgets/pishock-status/?mode=mini
Gauge only:     /widgets/pishock-status/?mode=gauge
Ticker only:    /widgets/pishock-status/?mode=ticker
Stage panel:    /widgets/pishock-status/?mode=stage
```

Add `transparent=true` for transparent OBS backgrounds and `boot=false` to skip the boot animation.

## Config Options

| Option | Default | Description |
|---|---:|---|
| controls.enabled | true | Enables the widget |
| controls.demoMode | false | Uses local mock status data |
| api.statusEndpoint | /api/pishock/status | Status API route |
| api.refreshIntervalMs | 1000 | API polling interval |
| display.defaultMode | full | Default layout mode |
| display.transparentBackground | false | Uses a transparent background by default |
| display.bootEnabled | true | Plays the boot animation in full mode |
| debug.logStatusPayloads | false | Logs raw status payloads |

## API Routes Used

- GET /api/pishock/status

## Notes

`index.html` is the source of truth for this widget. It is a single-file HTML widget with inline CSS and JavaScript.

`config.js` contains the local widget settings. Use `config.example.js` as the safe template when recreating local config.
