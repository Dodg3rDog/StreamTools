# PiShock Behavior Notes

This document describes the intended behavior for the Anthro-Corp PiShock system and widget. It is a behavior reference only. It does not describe the current Streamer.bot wiring or whether the current code fully implements every behavior.

## Core Concept

The system has two separate but related resources:

| Resource | Meaning | Widget Display |
|---|---|---|
| Pressure | The fill level of the discharge gauge | Radial pressure gauge and center percentage |
| Current | The active shock intensity charge | Center `C` value and outer current ring |
| Stored | Backlogged intensity charge waiting for overload capacity | Center `S` value |

Pressure determines when a discharge occurs. Current determines the intensity of that discharge. Stored charge preserves intensity contributions that cannot currently fit into the active current cap.

## Normal Caps

| State | Pressure Cap | Current Cap |
|---|---:|---:|
| Normal operation | 100% | 10 |
| Overload active | 100% pressure trigger, extended current capacity | 15 |

Pressure should discharge when it reaches 100%. Current can only rise above 10 while overload is active. If current is capped and more current would be gained, that current should move into Stored instead.

## Contribution Events

Viewer contribution events should add pressure and may add current.

| Event | Pressure Gain | Current Gain |
|---|---:|---:|
| 100 bits | +10% | +0 |
| 500 bits | +50% | +1 |
| 1000 bits | +100% | +2 |
| Sub | +70% | +1 |
| Gift sub | +70% each | +1 each |

Small cheers should still help fill pressure, but should not make it too easy to farm current. The working balance target is roughly 1000 bits to fill the pressure gauge from empty.

## Pressure Discharge

When pressure reaches 100%, the system performs a guaranteed discharge.

Expected outcome:

1. Discharge at the full current value.
2. Reset pressure to 0%.
3. Reduce current after the discharge.
4. Refill current from Stored if capacity is available.
5. Keep excess Stored charge if current reaches its cap.
6. Display a clear discharge/relay event on the widget.

The discharge intensity should be based on Current, not the pressure percentage.

## Stored Current Behavior

Stored current exists because the normal current cap is 10.

Expected behavior:

1. If current is below cap, incoming current fills Current first.
2. If current is at cap, incoming current moves into Stored.
3. If current drops below cap after a discharge or vent, Stored should refill Current.
4. In normal mode, Stored can refill Current up to 10.
5. In overload mode, Stored can refill Current up to 15.
6. Excess current that cannot fit should remain in Stored.

This means Stored charge survives normal current reductions and can become active later when capacity opens.

## Overload Required State

If current is capped at 10 and an event would normally increase current, the system should show an overload warning.

Expected widget behavior:

1. Show `OVERLOAD REQUIRED` in the center briefly.
2. Show a matching radial ticker message.
3. Keep the normal pressure/current readout after the alert expires.
4. Add the blocked current gain to Stored.
5. Keep a visible indicator that Stored charge exists.

This prevents viewers from missing that their contribution was capped, while still preserving the contribution for later overload use.

## Overload Redeem

The Overload redeem temporarily raises the current cap from 10 to 15.

Expected outcome:

1. Activate overload mode for a timed duration.
2. Allow Current to refill from Stored up to 15.
3. Allow new current gains to apply up to 15.
4. Keep excess current gains in Stored after Current reaches 15.
5. Trigger a clear overload visual state on the widget.
6. Use the overload wave/pulse animation while overload is active.

Overload does not immediately force a discharge by itself. It makes higher current possible while chat continues filling pressure.

## Manual Flush / Regular Vent Redeem

The manual flush is a gambling-style redeem. It always flushes pressure and fully drains current, then either shows a safe vent result or an impulse warning based on the pressure risk roll.

Expected outcome:

1. Pressure drops to 0%.
2. Current drops to 0.
3. Stored charge remains stored; it is not automatically refilled into Current by the flush.
4. The vent may randomly trigger a discharge, based on the current pressure/fill risk before the vent.
5. If a discharge occurs from the vent, show the impulse warning before the vent/drain animation.
6. If no discharge occurs, show the discharge-averted result before the vent/drain animation.

The intended viewer gamble is choosing between forcing a vent now and risking loss of built-up current, or continuing toward a guaranteed full-pressure discharge.

The `AnthroCorp_Rift_Stabilizer_Countdown` action persists `ps_pendingVentMode = manual-flush` and `ps_pendingVentTargetPressure = 0`, so the final prepare/complete actions still finish as a manual flush even if Streamer.bot drops action arguments during the delayed countdown.

## Cooldown / Lockout

After a discharge, the system may enter a cooldown/lockout state.

Expected behavior:

1. New pressure contributions can still be accepted during cooldown.
2. New current contributions can still be stored or applied based on cap rules.
3. Additional discharges should not occur until cooldown ends, unless explicitly allowed by a special sequence.
4. The widget should show cooldown as visually distinct from elevated pressure.
5. Cooldown should use a blue/freeze/prohibited style, not the same warning language as high pressure.

The ticker can scroll continuously during cooldown. Outside of cooldown or major alerts, ticker motion/messages should be calmer.

## Hype Train Effects

Hype trains should increase event pressure and current activity in a way that feels special without breaking the core rules.

Expected behavior:

1. Hype train levels can increase event weight or activity.
2. Hype effects should be visible on the widget.
3. Hype bonuses should reset when the hype train ends.
4. Hype should not bypass current caps unless overload is active.
5. Any blocked current gain should still move into Stored.

## Viewer Display Behavior

The widget should make viewer contributions visible without overcrowding the display.

Expected behavior:

1. Larger contribution events can briefly show the viewer profile image in the center.
2. The center should default back to pressure percentage and `current | stored`.
3. The viewer name and contribution amount can appear in the radial ticker or event log, not inside the center image view.
4. A viewer display cooldown should prevent the same viewer from repeatedly taking over the center display too quickly.
5. If no profile image is available, the widget should remain on the normal center readout.

## Radial Widget Readout

The radial widget should prioritize quick stream readability.

Expected default readout:

1. Center pressure percentage.
2. `Current | Stored` line, such as `8c | 2s`.
3. Pressure label.
4. Outer current ring.
5. Inner pressure gauge.
6. Radial ticker with default status text.

Expected temporary readouts:

| Trigger | Center Behavior | Ticker Behavior |
|---|---|---|
| Large contribution | Viewer profile image if available | Contribution message |
| Overload required | `OVERLOAD REQUIRED` | Matching warning message |
| Cooldown | Freeze/lockout language | Matching cooldown message |
| Overload active | Overload active message or visual pulse | Matching overload message |
| Discharge | Discharge/relay event styling | Matching discharge message |

## Safety / Beta Testing Notes

During beta testing, the system should favor logging and clear widget feedback.

Expected behavior:

1. Log every pressure event.
2. Log every current/storage change.
3. Log every discharge request.
4. Log every vent and overload event.
5. Keep enough event data to review after stream.
6. Make it obvious whether the widget is showing pressure, cooldown, overload, or discharge state.

The behavior goal is to make live stream results easy to understand and easy to debug after the fact.
