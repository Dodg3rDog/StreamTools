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
Visual:  http://127.0.0.1:3054/widgets/pishock-status/?mode=visual&transparent=true
Console: http://127.0.0.1:3054/widgets/pishock-status/?mode=console&transparent=true
Gauge:   http://127.0.0.1:3054/widgets/pishock-status/?mode=gauge&transparent=true
Signals: http://127.0.0.1:3054/widgets/pishock-status/?mode=signals&transparent=true
Viewer:  http://127.0.0.1:3054/widgets/pishock-status/?mode=viewer&transparent=true
Ticker:  http://127.0.0.1:3054/widgets/pishock-status/?mode=ticker&transparent=true
Stage:   http://127.0.0.1:3054/widgets/pishock-status/?mode=stage&transparent=true
```

Add `demo=true` to any URL to run animated local demo telemetry without using the relay API:

```text
Visual demo:  http://127.0.0.1:3054/widgets/pishock-status/?mode=visual&transparent=true&demo=true
Console demo: http://127.0.0.1:3054/widgets/pishock-status/?mode=console&transparent=true&demo=true
Signals demo: http://127.0.0.1:3054/widgets/pishock-status/?mode=signals&transparent=true&demo=true
Viewer demo:  http://127.0.0.1:3054/widgets/pishock-status/?mode=viewer&transparent=true&demo=true
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
Visual:         /widgets/pishock-status/?mode=visual
Console:        /widgets/pishock-status/?mode=console
Gauge only:     /widgets/pishock-status/?mode=gauge
Signals only:   /widgets/pishock-status/?mode=signals
Viewer only:    /widgets/pishock-status/?mode=viewer
Ticker only:    /widgets/pishock-status/?mode=ticker
Stage panel:    /widgets/pishock-status/?mode=stage
```

Add `transparent=true` for transparent OBS backgrounds, `boot=false` to skip the boot animation, and `demo=true` to use animated local demo telemetry.

`full` is the operator/mainframe dashboard with readable text. `console` is a computer-terminal register view. `visual`, `signals`, `gauge`, `viewer`, and `ticker` are intended for OBS scene composition where color, symbols, and section-specific views are easier to read on stream.

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

## Streamer.bot Beta Wiring

Set these persisted Streamer.bot globals before testing:

```text
st_apiBaseUrl = http://127.0.0.1:3054
st_bearerToken = same value as BEARER_TOKEN in StreamTools/.env
```

For cheers, subs, and gift subs, run:

```text
1. AnthroCorp_Process_Pressure_Event
2. If shouldStartOverloadVent == true:
   - Run the overload vent sequence immediately
3. Else if shouldDischarge == true:
   - AnthroCorp_Debug_PiShock_Args during beta testing
   - PiShock V2
   - AnthroCorp_Announce_Discharge
   - Anthro-Corp_Relay_Status_Update
4. Else:
   - Anthro-Corp_Relay_Status_Update
```

Pressure gain is balanced for beta testing around `1000 bits = 100%` gauge pressure. The current conversion is one whole pressure point per 10 bits, rounded down per event, so 1-bit cheers do not fill the gauge by spam.

During beta testing, normal shock cooldown is capped at 30 seconds in `AnthroCorp_Process_Pressure_Event.cs`.

Cooldown expiry is server-derived from `cooldownUntilUtc`, so restart the workbench server after route changes and re-import `Anthro-Corp_Relay_Status_Update.cs` whenever the cooldown payload changes.

Cooldown has distinct blue/freeze styling in the widget. Elevated pressure can still mark the pressure gauge/signal as warning, but only active cooldown should trigger the blue freeze ticker/banner.

The ticker idles by default and only makes a pass roughly every 2-3 minutes. During active cooldown, it switches to continuous scrolling.

For the beta Overload redeem, run:

```text
1. AnthroCorp_Arm_Overload
2. Anthro-Corp_Relay_Status_Update
3. Delay 5 minutes
4. Start the overload vent sequence
```

The overload vent sequence is one safe pressure step at a time:

```text
1. AnthroCorp_Prepare_Vent_Step
2. If shouldVentDischarge == true:
   - AnthroCorp_Debug_PiShock_Args during beta testing
   - PiShock V2
   - Anthro-Corp_Relay_Status_Update
   - Delay 1 second
   - Repeat from step 1 while shouldContinueVenting == true
3. AnthroCorp_Complete_Venting
4. Anthro-Corp_Relay_Status_Update
```

If Streamer.bot cannot loop the step cleanly, duplicate the vent step block up to 12 times for beta testing. Each step stops preparing shocks once pressure reaches the 30% safe target.

PiShock status POSTs are written to:

```text
server/data/pishock/status-events.ndjson
```

`server/data/` is ignored by git, so the workbench server can keep runtime logs without committing stream data.

Manual flush uses the same step action, but passes a zero-pressure target:

```text
1. Set Argument: ventMode = flush
2. Set Argument: ventTargetPressure = 0
3. AnthroCorp_Prepare_Vent_Step
4. If shouldVentDischarge == true:
   - AnthroCorp_Debug_PiShock_Args during beta testing
   - PiShock V2
   - Anthro-Corp_Relay_Status_Update
   - Delay 1 second
   - Repeat from step 1 while shouldContinueVenting == true
5. Set Argument: ventMode = flush
6. Set Argument: ventTargetPressure = 0
7. AnthroCorp_Complete_Venting
8. Anthro-Corp_Relay_Status_Update
```

Overload venting should omit those flush arguments, so it defaults to the 30% safe-pressure recovery target. If the widget first shows 140% when overload venting begins, that usually means the 150% trigger was reached and the first vent step has already reduced pressure by 10% before the relay update posted.
