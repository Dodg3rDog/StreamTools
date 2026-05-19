# PiShock Status

## Purpose

Shows the Anthro-Corp PiShock containment dashboard for OBS browser sources.

## OBS URL

```text
http://<your-lan-ip>:3030/widgets/pishock-status/
```

## Workshop Testing

Use the workshop server when testing changes locally. It defaults to `127.0.0.1:3055` and does not use the live web server address.

```bash
cd server
npm run start:workshop
```

Open the widget:

```text
http://127.0.0.1:3055/widgets/pishock-status/
```

Useful test URLs:

```text
Full:    http://127.0.0.1:3055/widgets/pishock-status/
Compact: http://127.0.0.1:3055/widgets/pishock-status/?mode=compact
Mini:    http://127.0.0.1:3055/widgets/pishock-status/?mode=mini
Visual:  http://127.0.0.1:3055/widgets/pishock-status/?mode=visual&transparent=true
Console: http://127.0.0.1:3055/widgets/pishock-status/?mode=console&transparent=true
Radial:  http://127.0.0.1:3055/widgets/pishock-status/?mode=radial&transparent=true
Gauge:   http://127.0.0.1:3055/widgets/pishock-status/?mode=gauge&transparent=true
Signals: http://127.0.0.1:3055/widgets/pishock-status/?mode=signals&transparent=true
Viewer:  http://127.0.0.1:3055/widgets/pishock-status/?mode=viewer&transparent=true
Ticker:  http://127.0.0.1:3055/widgets/pishock-status/?mode=ticker&transparent=true
Stage:   http://127.0.0.1:3055/widgets/pishock-status/?mode=stage&transparent=true
```

Add `demo=true` to any URL to run animated local demo telemetry without using the relay API:

```text
Visual demo:  http://127.0.0.1:3055/widgets/pishock-status/?mode=visual&transparent=true&demo=true
Console demo: http://127.0.0.1:3055/widgets/pishock-status/?mode=console&transparent=true&demo=true
Radial demo:  http://127.0.0.1:3055/widgets/pishock-status/?mode=radial&transparent=true&demo=true
Signals demo: http://127.0.0.1:3055/widgets/pishock-status/?mode=signals&transparent=true&demo=true
Viewer demo:  http://127.0.0.1:3055/widgets/pishock-status/?mode=viewer&transparent=true&demo=true
```

Radial mode options:

```text
Solid pressure:      ?mode=radial&pressureStyle=solid
Segmented pressure:  ?mode=radial&pressureStyle=segmented
Dial only:           ?mode=radial&dialFrame=false&dialPill=false
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

## Animation Audio

Animation audio is owned by the widget, not Streamer.bot or OBS. Each animation cue decides when its audio starts, stops, fades, or crossfades. Drop MP3 files into `public/widgets/pishock-status/audio/` using the names listed in that folder's README.

Looping cues are used for persistent states such as overload, cooldown, countdown, power-down, and vent drain. One-shot cues are used for contribution alerts, impulse warnings, discharge averted, overload discharge, overload expiry, and the stabilized ending. Missing files are ignored, so cues can be added gradually.

## Display Modes

The widget supports URL-driven layout modes:

```text
Full dashboard: /widgets/pishock-status/
Compact:        /widgets/pishock-status/?mode=compact
Mini:           /widgets/pishock-status/?mode=mini
Visual:         /widgets/pishock-status/?mode=visual
Console:        /widgets/pishock-status/?mode=console
Radial:         /widgets/pishock-status/?mode=radial
Gauge only:     /widgets/pishock-status/?mode=gauge
Signals only:   /widgets/pishock-status/?mode=signals
Viewer only:    /widgets/pishock-status/?mode=viewer
Ticker only:    /widgets/pishock-status/?mode=ticker
Stage panel:    /widgets/pishock-status/?mode=stage
```

Add `transparent=true` for transparent OBS backgrounds, `boot=false` to skip the boot animation, and `demo=true` to use animated local demo telemetry.

`full` is the operator/mainframe dashboard with readable text. `console` is a computer-terminal register view. `radial` is a simplified neon instrument overlay with a weighted outer intensity ring, a smaller inner pressure ring, reactive spectral bars that match the pressure color, a magenta center pressure percentage, a `current | stored` charge line, rotating radial status text, temporary center alerts such as `OVERLOAD REQUIRED`, and contributor image takeovers for larger activity events. `visual`, `signals`, `gauge`, `viewer`, and `ticker` are intended for OBS scene composition where color, symbols, and section-specific views are easier to read on stream.

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
| display.radialPressureStyle | segmented | Uses `segmented` or `solid` pressure gauge in radial mode |
| display.radialFrameEnabled | true | Shows the rectangular radial dial frame |
| display.radialPillEnabled | true | Shows the AC-PSR radial label pill |
| debug.logStatusPayloads | false | Logs raw status payloads |

## API Routes Used

- GET /api/pishock/status

## Notes

`index.html` is the source of truth for this widget. It is a single-file HTML widget with inline CSS and JavaScript.

`config.js` contains the local widget settings. Use `config.example.js` as the safe template when recreating local config.

The radial startup Anthro-Corp text art is stored as a reusable shared asset:

```text
public/shared/assets/ascii/anthro-corp-banner.txt
```

## Streamer.bot Beta Wiring

Set these persisted Streamer.bot globals before testing:

```text
st_apiBaseUrl = http://127.0.0.1:3055
st_bearerToken = same value as BEARER_TOKEN in StreamTools/.env
```

For cheers, subs, and gift subs, run:

Use `Set Argument` sub-actions before `AnthroCorp_Process_Pressure_Event`.

Cheer:

```text
eventType = cheer
bits = %bits%
displayName = %user%
userName = %userName%
profileImageUrl = %userProfileImageUrl%
```

Single sub:

```text
eventType = sub
subCount = 1
displayName = %user%
userName = %userName%
profileImageUrl = %userProfileImageUrl%
```

Gift sub:

```text
eventType = gift-sub
giftSubCount = %giftSubCount%
displayName = %user%
userName = %userName%
profileImageUrl = %userProfileImageUrl%
```

If the trigger does not expose `%userProfileImageUrl%`, omit `profileImageUrl`.

```text
1. Execute Code (AnthroCorp_Process_Pressure_Event.cs)
2. If %shouldStartOverloadVentFlag% Equals 1:
   - Run the overload vent sequence immediately
3. Else if %shouldDischargeFlag% Equals 1:
   - Execute Code (AnthroCorp_Apply_PiShock_Vibrate_Args.cs)
   - Execute Method (PiShock V2, OperatePiShock)
   - Delay 0.5 to 1 second
   - Execute Code (AnthroCorp_Apply_PiShock_Shock_Args.cs)
   - Execute Method (PiShock V2, OperatePiShock)
   - AnthroCorp_Announce_Discharge
```

`AnthroCorp_Process_Pressure_Event` posts fresh status directly to the API, so do not run `Anthro-Corp_Relay_Status_Update` after normal cheer/sub/gift-sub pressure events.

Pressure gain is balanced for beta testing around `1000 bits = 100%` gauge pressure. The current conversion is one whole pressure point per 10 bits, rounded down per event, so 1-bit cheers do not fill the gauge by spam.

At 100% pressure, the next pressure event forces a normal discharge unless cooldown, overload, or venting is active.

Intensity is built from a separate current/stored charge system:

```text
1-99 bits      = +0 current charge
100-699 bits   = +0 current charge
700-3499 bits  = +2 current charge
3500+ bits     = +4 current charge
```

A single sub adds `+20` pressure and `+2` current charge. Normal current charge caps at `20`, overload current charge caps at `30`, and overflow goes into stored charge. When a normal discharge fires, current charge is used as the shock intensity, then stored charge is promoted back into current charge up to the cap.

PiShock V2 also needs its Max Intensity setting at `30` or higher, otherwise overload shocks will be clamped by the PiShock action even though the AnthroCorp current cap is `30`.

Discharge-prep scripts also expose pre-shock vibrate arguments. Use the handoff scripts below instead of relying on manual `%shockIntensity%` argument substitution. The handoff scripts set the standard PiShock arguments for the next operate action, while also keeping pending globals available for AnthroCorp-owned helper scripts.

For any branch where `%shouldDischargeFlag% == 1` or `%shouldVentDischargeFlag% == 1`, run these as inline code/method sub-actions in the same parent action. Do not call the apply scripts through separate non-blocking `Action (...)` sub-actions, because PiShock can run before the argument handoff completes.

```text
1. Execute Code (AnthroCorp_Apply_PiShock_Vibrate_Args.cs)
2. Execute Code (AnthroCorp_Debug_PiShock_Args.cs) during beta testing
3. Execute Method (PiShock V2, OperatePiShock)
4. Delay 0.5 to 1 second
5. Execute Code (AnthroCorp_Apply_PiShock_Shock_Args.cs)
6. Execute Code (AnthroCorp_Debug_PiShock_Args.cs) during beta testing
7. Execute Method (PiShock V2, OperatePiShock)
```

The legacy `intensity`, `duration`, `op`, `mode`, and `shocker` arguments still point at the shock right after the prep script for older wiring. If you run a vibrate first, `AnthroCorp_Apply_PiShock_Shock_Args` restores those standard PiShock args before the shock action.

If Streamer.bot logs show `Discharge=True` and `DischargeFlag=1` but do not show `AnthroCorp_Apply_PiShock_Vibrate_Args`, `AnthroCorp_Apply_PiShock_Shock_Args`, or `PiShock V2` being queued immediately afterward, first confirm the conditional is checking `shouldDischargeFlag == 1`. If Streamer.bot still does not see the action argument, check the persisted global `ps_shouldDischargeFlag == 1` instead.

During beta testing, normal shock cooldown is randomized between 10 and 30 seconds in `AnthroCorp_Process_Pressure_Event.cs`.

Cooldown expiry is server-derived from `cooldownUntilUtc`, so restart the workbench server after route changes. Current Streamer.bot actions post status directly to the API; `Anthro-Corp_Relay_Status_Update.cs` is only a fallback/manual bridge for ad-hoc status publishing.

Cooldown has distinct blue/freeze styling in the widget. Elevated pressure can still mark the pressure gauge/signal as warning, but only active cooldown should trigger the blue freeze ticker/banner.

The ticker idles by default and only makes a pass roughly every 2-3 minutes. During active cooldown, it switches to continuous scrolling.

For the beta Overload redeem, run:

```text
1. AnthroCorp_Arm_Overload
2. Delay 30 seconds during current testing
3. Start the overload vent sequence
```

The overload vent sequence is deterministic, not chance-based. It vents one safe pressure step at a time. Each prep/apply/debug item should be `Execute Code` inline so the next PiShock method sees the arguments that were just set:

```text
1. Execute Code (AnthroCorp_Prepare_Vent_Step.cs)
2. If %shouldVentDischargeFlag% Equals 1:
   - Execute Code (AnthroCorp_Apply_PiShock_Vibrate_Args.cs)
   - Execute Code (AnthroCorp_Debug_PiShock_Args.cs) during beta testing
   - Execute Method (PiShock V2, OperatePiShock)
   - Delay 0.5 to 1 second
   - Execute Code (AnthroCorp_Apply_PiShock_Shock_Args.cs)
   - Execute Code (AnthroCorp_Debug_PiShock_Args.cs) during beta testing
   - Execute Method (PiShock V2, OperatePiShock)
   - Delay 1 second
   - Repeat from step 1 while %shouldContinueVenting% Equals true
3. Execute Code (AnthroCorp_Complete_Venting.cs)
```

If Streamer.bot cannot loop the step cleanly, duplicate the vent step block up to 12 times for beta testing. Each step stops preparing shocks once pressure reaches the 30% safe target.

PiShock status POSTs are written to:

```text
server/data/pishock/status-events.ndjson
```

`server/data/` is ignored by git, so the workbench server can keep runtime logs without committing stream data.

Manual flush uses the same step action, but passes a zero-pressure target:

```text
1. AnthroCorp_Rift_Stabilizer_Countdown
   - Announces the vent countdown
   - Persists ps_pendingVentMode = manual-flush
   - Persists ps_pendingVentTargetPressure = 0
2. Execute Code (AnthroCorp_Prepare_Vent_Step.cs)
3. If %shouldVentDischargeFlag% Equals 1:
   - Execute Code (AnthroCorp_Apply_PiShock_Vibrate_Args.cs)
   - Execute Code (AnthroCorp_Debug_PiShock_Args.cs) during beta testing
   - Execute Method (PiShock V2, OperatePiShock)
   - Delay 0.5 to 1 second
   - Execute Code (AnthroCorp_Apply_PiShock_Shock_Args.cs)
   - Execute Code (AnthroCorp_Debug_PiShock_Args.cs) during beta testing
   - Execute Method (PiShock V2, OperatePiShock)
   - Delay 1 second
   - Repeat from step 2 while %shouldContinueVenting% Equals true
4. Execute Code (AnthroCorp_Complete_Venting.cs)
```

The prepare and complete scripts still accept explicit `ventMode = flush` or `ventTargetPressure = 0`, but the countdown now writes an expiring pending flush marker so the sequence still completes as a manual flush if Streamer.bot does not carry those arguments through every action. `AnthroCorp_Complete_Venting` and `AnthroCorp_Setup_Reset` clear the pending marker.

All status-changing Streamer.bot scripts now use a time-aware `statusSequence` value before posting directly to the API. This prevents manual flushes, pressure events, and charge updates from being ignored as stale after the API derives an overload-expiry recovery/discharge state.

The API-derived overload-expiry state advances the current sequence by one rather than jumping to a wall-clock value, so remaining fallback relay calls have a smaller stale-update window while imported Streamer.bot actions are being updated.

The widget preserves full `statusSequence` values and also uses `statusRevision`/`updatedAt` in vent visual keys. This prevents repeated manual flush or vent-discharge events from being treated as an already-played animation.

Manual flush and vent-discharge visuals include a 1.5 second transition buffer after the power-down beat before the shock/safe outcome appears, and another 1.5 second buffer after the outcome before the drain animation starts. During those buffers, the widget holds the pre-vent telemetry so the display does not briefly flash back to live pressure.

Overload venting should omit those flush arguments, so it defaults to the 30% safe-pressure recovery target. If the widget first shows 140% when overload venting begins, that usually means the 150% trigger was reached and the first vent step has already reduced pressure by 10% before the direct status update posted.

When the overload timer expires, the API/widget show the reroute-complete recovery sequence and return to the normal 100% pressure cap. If pressure is still at or above 100% when overload expires, the overload-expired emergency discharge visual/drain path is used instead.
