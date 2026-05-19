# PiShock Streamer.bot Notes

## Private Local File

`streamerbot/csharp/pishock/PiShock V2.cs` is intentionally local-only and ignored by git.

## Required Shared Globals

These Streamer.bot globals are required by the public relay/status scripts:

| Name | Example | Purpose |
|---|---|---|
| st_apiBaseUrl | http://127.0.0.1:3055 | StreamTools server base URL for workshop or live use |
| st_bearerToken | private value | Bearer token matching the StreamTools server `.env` |

Do not commit real token values.

For live OBS/server use, set `st_apiBaseUrl` to the live StreamTools host instead:

```text
http://<your-lan-ip>:3030
```

## Streamer.bot Setup Checklist

Start the workshop server before testing:

```bash
cd server
npm run start:workshop
```

Set these persisted Streamer.bot globals:

```text
st_apiBaseUrl = http://127.0.0.1:3055
st_bearerToken = same value as BEARER_TOKEN in StreamTools/.env
```

Import each public script in `streamerbot/csharp/pishock/` as a Streamer.bot C# action with the same action name as the file name without `.cs`.

Required public actions:

```text
AnthroCorp_Setup_Reset
AnthroCorp_Process_Pressure_Event
AnthroCorp_Debug_PiShock_Args
AnthroCorp_Announce_Discharge
AnthroCorp_Arm_Overload
AnthroCorp_Prepare_Vent_Step
AnthroCorp_Complete_Venting
AnthroCorp_Hype_Pressure_Update
AnthroCorp_Hype_Pressure_Decay
AnthroCorp_Hype_Train_End
Anthro-Corp_Relay_Status_Update
```

Optional manual/test helpers:

```text
AnthroCorp_Add_Charge
AnthroCorp_Prepare_Discharge
```

`PiShock V2` remains a private local Streamer.bot action and should be the only action that talks directly to PiShock.

Smoke test after importing:

```text
1. Run AnthroCorp_Setup_Reset
2. Open http://127.0.0.1:3055/api/pishock/status
3. Confirm the response is ok and mode is reset
```

## Streamer.bot Action Recipes

Cheer, sub, and gift-sub pressure event:

```text
1. AnthroCorp_Process_Pressure_Event
2. If shouldStartOverloadVent == true:
   - Start the overload vent sequence
3. Else if shouldDischarge == true:
   - AnthroCorp_Debug_PiShock_Args during beta testing
   - PiShock V2
   - AnthroCorp_Announce_Discharge
```

`AnthroCorp_Process_Pressure_Event` posts the fresh status directly to the StreamTools API. Do not run `Anthro-Corp_Relay_Status_Update` after normal cheer/sub/gift-sub pressure events, or stale Streamer.bot globals can make the widget appear one event behind.

Use `Set Argument` sub-actions before `AnthroCorp_Process_Pressure_Event`. Enter the argument name exactly as shown in the left column. The right column is the Streamer.bot value field.

Cheer event arguments:

| Argument name | Value |
|---|---|
| eventType | cheer |
| bits | %bits% |
| displayName | %user% |
| userName | %userName% |
| profileImageUrl | %userProfileImageUrl% |

Single sub event arguments:

| Argument name | Value |
|---|---|
| eventType | sub |
| subCount | 1 |
| displayName | %user% |
| userName | %userName% |
| profileImageUrl | %userProfileImageUrl% |

Gift sub event arguments:

| Argument name | Value |
|---|---|
| eventType | gift-sub |
| giftSubCount | %giftSubCount% |
| displayName | %user% |
| userName | %userName% |
| profileImageUrl | %userProfileImageUrl% |

If Streamer.bot does not expose `%userProfileImageUrl%` for a trigger, omit `profileImageUrl`. The action still works; the widget will just keep or show the fallback viewer image.

Accepted aliases for the profile image argument are:

```text
profileImageUrl
profileImageURL
userProfileImageUrl
```

Overload redeem:

```text
1. AnthroCorp_Arm_Overload
2. Delay 30 seconds during current testing
3. Start the overload vent sequence
```

Overload vent sequence:

```text
1. AnthroCorp_Prepare_Vent_Step
2. If shouldVentDischarge == true:
   - AnthroCorp_Debug_PiShock_Args during beta testing
   - PiShock V2
   - Delay 1 second
   - Repeat from step 1 while shouldContinueVenting == true
3. AnthroCorp_Complete_Venting
```

Current status-changing PiShock actions post their widget payloads directly to the StreamTools API. Keep `Anthro-Corp_Relay_Status_Update` as a fallback/manual bridge only; it is no longer needed in normal pressure, overload, vent, flush, reset, hype, or manual charge/discharge wiring.

Status-changing actions should use the shared time-aware `GetNextStatusSequence()` pattern before posting to the API. The API can derive overload-expiry states on its own and advances the sequence for those derived states, so scripts should not rely on an old cached sequence value.

Manual flush uses the same vent sequence. The preferred setup starts with `AnthroCorp_Rift_Stabilizer_Countdown`, which announces the countdown and persists the flush intent:

```text
ps_pendingVentMode = manual-flush
ps_pendingVentTargetPressure = 0
ps_pendingVentUntilUtc = countdown end + 10 minutes
```

`AnthroCorp_Prepare_Vent_Step` and `AnthroCorp_Complete_Venting` still accept explicit `ventMode = flush` or `ventTargetPressure = 0`, but they also read the pending flush globals when Streamer.bot does not carry action arguments through the delayed chain. `AnthroCorp_Complete_Venting` and `AnthroCorp_Setup_Reset` clear the pending globals.

## PiShock State Globals

The PiShock action set uses these persisted globals:

```text
ps_chargePool
ps_currentCharge
ps_storedCharge
ps_normalChargeCap
ps_overloadChargeCap
ps_hypeTrainLevel
ps_hypeTrainActive
ps_overloadArmed
ps_lastPoolBefore
ps_lastPoolAfter
ps_lastBaseIntensity
ps_lastHypeBonus
ps_lastRandomSurge
ps_lastFinalIntensity
ps_lastOverloadUsed
ps_lastChargeSpent
ps_relayMode
ps_debug
```

Pressure-system globals:

```text
ps_pressureGauge
ps_maxPressureGauge
ps_missCount
ps_cooldownUntilUtc
ps_cooldownSeconds
ps_overloadActive
ps_overloadUntilUtc
ps_overloadVenting
ps_pendingVentMode
ps_pendingVentTargetPressure
ps_pendingVentUntilUtc
ps_lastViewerName
ps_lastViewerImageUrl
ps_lastViewerShownAtUtc
ps_lastChancePercent
ps_lastRoll
ps_lastPressureBefore
ps_lastPressureAfter
ps_lastPressureGain
ps_lastPressureVented
ps_lastChargeGain
ps_lastEventType
ps_lastEventValueBits
ps_lastEventMessage
```

## Current Pressure Mechanics

The PiShock system treats cheers, gift subs, and subs as Anthro-Corp pressure events rather than guaranteed impulse events.

Core rules:

```text
pressure determines when the system is allowed to discharge
current charge determines the shock intensity used for a normal discharge
stored charge holds overflow when current charge is already capped
```

Normal pressure caps at 100%. The Overload redeem allows the pressure gauge to enter the red zone up to 150%.

Normal current charge caps at 10. Overload current charge caps at 15. Stored charge can accumulate overflow for later promotion.

Gift subs and subs count as 700 bits for chance and pressure calculations.

Pressure gain is tuned so `1000 bits = 100%` gauge pressure:

```text
1-9 bits      = 0% pressure
10 bits       = 1% pressure
100 bits      = 10% pressure
700 bits/sub  = 70% pressure
1000 bits     = 100% pressure
1500 bits     = 150% pressure during overload
```

Pressure gain uses whole percent points per event, so repeated 1-bit cheers cannot gradually fill the gauge.

## Bit-Weighted Intensity Charge

The amount of bits/subs controls how much current intensity charge is added. This is separate from pressure.

Current charge gain table:

```text
1-99 bits      = +0 current charge
100-299 bits   = +1 current charge
300-499 bits   = +2 current charge
500-699 bits   = +3 current charge
700-999 bits   = +5 current charge
1000-1499 bits = +7 current charge
1500+ bits     = +10 current charge
```

Examples:

```text
500-bit cheer = +50 pressure, +3 current charge
single sub    = +70 pressure, +5 current charge
two subs      = 100 pressure cap, 10 current charge cap
```

If current charge is full, additional charge is placed into stored charge. When a normal discharge fires, the current charge is consumed as the shock intensity, then stored charge is promoted into current charge up to the current cap.

Example:

```text
current charge 10, stored charge 0, pressure 90
single sub adds +70 pressure and +5 charge
pressure caps at 100 and triggers discharge if not in cooldown
shock intensity = 10
stored charge receives +5 overflow
after discharge, stored +5 promotes into current charge
result: current charge 5, stored charge 0, pressure 90 after the 10% vent
```

## Bit-Weighted Chance

A cheer/sub event rolls for a normal discharge using a bit-weighted chance. Hype Train level adds +5% chance per level while active. Once the Hype Train ends, the bonus resets.

Current chance table:

```text
1-99 bits      = 0% shock chance, pressure only
100-299 bits   = 10%
300-499 bits   = 15%
500-699 bits   = 20%
700-999 bits   = 25%
1000-1499 bits = 35%
1500+ bits     = 50%
```

The chance table and related tuning values live in the `ADJUSTMENTS` section of:

```text
streamerbot/csharp/pishock/AnthroCorp_Process_Pressure_Event.cs
```

Pity rule:

```text
5 misses = next eligible event is guaranteed
```

Pressure threshold rule:

```text
100% pressure = guaranteed normal discharge, unless cooldown, overload, or venting is active
```

On miss:

```text
increase ps_missCount
increase pressure gauge
increase current/stored charge from the bit-weighted charge table
relay mode = charge
```

On shock:

```text
shock intensity = current charge
consume current charge
promote stored charge into current charge
reset ps_missCount
vent pressure by 10%
start random cooldown between 10 and 30 seconds during beta testing
relay mode = discharge
```

During cooldown, cheers/subs still add pressure and can update the current viewer display, but no normal shock should discharge.

Direct status POSTs send `ps_cooldownUntilUtc` to the workbench server. The server recalculates `cooldownRemaining` on every widget poll, so the overlay can clear cooldown even if Streamer.bot does not post again exactly when the timer expires.

## Overload Protocol

The Overload redeem allows pressure to exceed 100%, up to 150%. When overload starts:

```text
ps_overloadActive = true
ps_maxPressureGauge = 150
ps_overloadChargeCap = 15
ps_overloadUntilUtc = now + 30 seconds during current testing
relay mode = overload-armed
```

Streamer.bot action:

```text
AnthroCorp_Arm_Overload
Delay 30 seconds during current testing
Start overload vent sequence
```

Widget behavior:

```text
flash alert
show red-zone gauge state
scroll warning ticker
show that normal discharges are locked out
```

During overload lockout, no normal shock should discharge. Cheers/subs still add pressure up to 150%.

When pressure reaches 150%, begin overload venting. Venting is deterministic, not chance-based: it sends one shock per 10% pressure step until pressure reaches the safe pressure target of 30%.

When the overload timer expires, the API/widget show a reroute-complete sequence and return to the normal pressure cap. During current testing the timer is 30 seconds. If pressure is at or above 100% when overload expires, the system triggers the overload-expired emergency discharge visual/drain path.

Every pressure event action should check `shouldStartOverloadVent` immediately after `AnthroCorp_Process_Pressure_Event`. If it is true, start the overload vent sequence instead of waiting for the 5-minute delayed action.

Example from 150%:

```text
shock intensity 15
wait 1 second
shock intensity 14
wait 1 second
shock intensity 13
...
shock intensity 3
```

After venting completes:

```text
ps_pressureGauge = 30
ps_maxPressureGauge = 100
ps_overloadActive = false
ps_overloadVenting = false
relay mode = recovery
```

Venting is prepared one step at a time so the private PiShock action remains the only action that sends impulses:

```text
AnthroCorp_Prepare_Vent_Step
If shouldVentDischarge == true:
  AnthroCorp_Debug_PiShock_Args during beta testing
  PiShock V2 private action
  wait 1 second
  repeat while shouldContinueVenting == true
AnthroCorp_Complete_Venting
```

If Streamer.bot looping is awkward during beta testing, duplicate the vent step block up to 12 times. The step action stops preparing shocks once the pressure reaches 30%.

If the widget first shows 140% when overload venting begins, that usually means the 150% trigger was reached and the first 10% vent step already posted its direct status update.

Suggested recovery ticker copy:

```text
ALL SYSTEMS RETURNED TO NORMAL OPERATING PARAMETERS // CHARGING RESUMED
```

## Manual Flush Protocol

The manual flush channel point redemption flushes the system through the countdown/result/drain sequence and clears pressure/current to 0.

Flush target:

```text
0% full pressure purge
```

Manual flush uses the same step action as overload venting. The countdown action marks the pending flush globally:

```text
AnthroCorp_Rift_Stabilizer_Countdown
  sets ps_pendingVentMode = manual-flush
  sets ps_pendingVentTargetPressure = 0
  sets ps_pendingVentUntilUtc = countdown end + 10 minutes
```

`AnthroCorp_Prepare_Vent_Step` and `AnthroCorp_Complete_Venting` use those pending globals if `ventMode`/`ventTargetPressure` args are missing. Explicit args still work:

```text
ventMode = flush
ventTargetPressure = 0
```

`AnthroCorp_Complete_Venting` clears the pending globals after it posts the final 0% state.

## Viewer Attribution

The widget should display the current pressure contributor:

```text
viewer display name
viewer profile image URL
event type
event value as bits
```

After a viewer appears on the gauge, that same viewer has a 10-second display cooldown before they can replace the displayed contributor again.

This is a display cooldown only. The viewer's cheers/subs should still affect pressure and chance during that window.

## Planned Widget Telemetry Fields

The relay status route should eventually expose these additional fields:

```text
pressureGauge
maxPressureGauge
currentVoltage
storedVoltage
normalVoltageCap
overloadVoltageCap
chancePercent
missCount
cooldownRemaining
cooldownTotal
overloadActive
overloadVenting
overloadRemaining
currentViewerName
currentViewerImageUrl
tickerMessage
alertMessage
eventType
eventValueBits
```

## Relay Mode Contract

Use `relayMode` for overlay/display state. Do not use PiShock's `mode` argument for overlay state because `mode` is also used by the PiShock action to choose shocker behavior.

Common relay modes:

```text
idle
reset
charge
hype
hype-ended
cooling
overload-armed
overload-denied
discharge
overload
cooldown
recovery
flush
venting
```

Recommended discharge action order:

```text
AnthroCorp_Process_Pressure_Event
If shouldDischarge == true:
AnthroCorp_Debug_PiShock_Args during beta testing
PiShock V2 private action
AnthroCorp_Announce_Discharge
```

`AnthroCorp_Process_Pressure_Event` prepares the PiShock arguments directly when `shouldDischarge == true`, posts the current widget status directly, and consumes/promotes current/stored charge. The normal cheer/sub workflow does not need `AnthroCorp_Prepare_Discharge` or a follow-up `Anthro-Corp_Relay_Status_Update`.

`AnthroCorp_Prepare_Discharge` remains available as an optional manual/test helper. It uses current charge for intensity by default, can consume/promote charge with `consumeCharge = true`, and can vent 10% pressure if called with `ventPressure = true` or `spendPressure = true`.

`AnthroCorp_Add_Charge` remains available as an optional manual/test helper. Use `addCharge` to add current/stored intensity charge, or `addPressure`/`pressure` to adjust pressure directly.

Recommended non-discharge update order:

```text
State update action
```

## Relay Route Fallback

`Anthro-Corp_Relay_Status_Update.cs` posts to:

```text
POST /api/pishock/status
```

The route requires the `Authorization: Bearer <token>` header.

Current Anthro-Corp status actions post to this route directly. Use the relay status action only as a fallback/manual bridge when testing a custom state update that does not have its own direct POST yet.

The workbench server writes each status POST to:

```text
server/data/pishock/status-events.ndjson
```

`server/data/` is ignored by git and can be reviewed after stream tests.
