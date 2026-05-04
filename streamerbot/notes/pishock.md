# PiShock Streamer.bot Notes

## Private Local File

`streamerbot/csharp/pishock/PiShock V2.cs` is intentionally local-only and ignored by git.

## Required Shared Globals

These Streamer.bot globals are required by the public relay/status scripts:

| Name | Example | Purpose |
|---|---|---|
| st_apiBaseUrl | http://127.0.0.1:3054 | StreamTools server base URL for workshop or live use |
| st_bearerToken | private value | Bearer token matching the StreamTools server `.env` |

Do not commit real token values.

## PiShock State Globals

The PiShock action set uses these persisted globals:

```text
ps_chargePool
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

Planned pressure-system globals:

```text
ps_pressureGauge
ps_maxPressureGauge
ps_missCount
ps_cooldownUntilUtc
ps_cooldownSeconds
ps_overloadActive
ps_overloadUntilUtc
ps_overloadVenting
ps_lastViewerName
ps_lastViewerImageUrl
ps_lastViewerShownAtUtc
ps_lastChancePercent
ps_lastRoll
```

## Planned Pressure Mechanics

The next PiShock system should treat cheers, gift subs, and subs as Anthro-Corp pressure events rather than guaranteed impulse events.

Core rules:

```text
10% gauge pressure = intensity 1
20% gauge pressure = intensity 2
30% gauge pressure = intensity 3
...
100% gauge pressure = intensity 10
150% overload pressure = intensity 15
```

Normal operation caps at 100%. The Overload redeem allows the gauge to enter the red zone up to 150%.

Gift subs and subs count as 700 bits for chance and pressure calculations.

## Bit-Weighted Chance

A cheer/sub event should roll for an impulse event using a bit-weighted chance. Hype Train level adds +5% chance per level while active. Once the Hype Train ends, the bonus resets.

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

On miss:

```text
increase ps_missCount
increase pressure gauge
relay mode = charge
```

On shock:

```text
reset ps_missCount
vent pressure by 10%
start random cooldown between 30 and 90 seconds
relay mode = discharge
```

During cooldown, cheers/subs still add pressure and can update the current viewer display, but no normal shock should discharge.

## Overload Protocol

The Overload redeem allows pressure to exceed 100%, up to 150%. When overload starts:

```text
ps_overloadActive = true
ps_maxPressureGauge = 150
ps_overloadUntilUtc = now + 5 minutes
relay mode = overload-armed
```

Widget behavior:

```text
flash alert
show red-zone gauge state
scroll warning ticker
show that normal discharges are locked out
```

During overload lockout, no normal shock should discharge. Cheers/subs still add pressure up to 150%.

When pressure reaches 150%, or when the 5-minute timer expires, begin overload venting. Venting sends one shock per 10% pressure step until pressure reaches the safe pressure target of 30%.

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

Suggested recovery ticker copy:

```text
ALL SYSTEMS RETURNED TO NORMAL OPERATING PARAMETERS // CHARGING RESUMED
```

## Manual Flush Protocol

A future channel point redemption should flush the system using the same step-down process as overload venting. Each 10% drop sends one shock at the matching intensity and waits 1 second before the next step.

Flush target:

```text
30% safe pressure
```

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
AnthroCorp_Prepare_Discharge
PiShock V2 private action
AnthroCorp_Announce_Discharge
Anthro-Corp_Relay_Status_Update
```

For the guaranteed cheer shock, call `AnthroCorp_Prepare_Discharge` without a charge-spend argument. That prepares the PiShock args but leaves `ps_chargePool` alone.

For the secondary/capacitor shock, set one of these arguments before `AnthroCorp_Prepare_Discharge`:

```text
spendCharge = true
consumeCharge = true
secondaryShock = true
```

Only the secondary/capacitor shock should spend from `ps_chargePool`. If the secondary shock chance fails, run `AnthroCorp_Add_Charge` instead.

Recommended non-discharge update order:

```text
State update action
Anthro-Corp_Relay_Status_Update
```

## Relay Route

`Anthro-Corp_Relay_Status_Update.cs` posts to:

```text
POST /api/pishock/status
```

The route requires the `Authorization: Bearer <token>` header.
