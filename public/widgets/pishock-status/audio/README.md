Drop PiShock widget animation audio files in this folder.

The widget ignores missing files, so you can replace these gradually. Each animation owns its cue timing: loops fade in/out with the animation, and one-shots are stopped when the paired animation ends.

Browsers cannot reliably list every file in a folder, so random audio pools are declared explicitly in the widget code. This keeps OBS playback predictable and makes it clear which files are expected.

## Current Audio Cues

| File | Animation | Playback behavior |
|---|---|---|
| `contribution/rift-contribution_01.mp3` through `contribution/rift-contribution_17.mp3` | Viewer contribution/profile alert | Random one-shot, about 3.2 seconds, avoids immediate repeats |
| `rift-contribution.mp3` | Viewer contribution/profile alert fallback | Included in the random pool for single-file compatibility |
| `rift-cooldown-freeze.mp3` | Freeze lockout/cooldown | Loop, fades in/out |
| `rift-overload-active.mp3` | Overload active wave | Loop, fades in/out |
| `rift-overload-discharge.mp3` | Overload impulse indication | One-shot, about 2.8 seconds |
| `rift-overload-reroute-complete.mp3` | Overload reroute complete/recovery | One-shot, about 4.5 seconds |
| `rift-overload-emergency-discharge.mp3` | Overload expiry emergency discharge lead/countdown | One-shot, about 6 seconds |
| `rift-system-vent-countdown.mp3` | System vent countdown | Loop, fades in/out |
| `rift-system-power-down.mp3` | Post-countdown power-down handoff | Loop, fades in/out |
| `rift-shock-warning.mp3` | Impulse imminent warning | One-shot, hard-stopped when warning animation ends |
| `rift-discharge-averted.mp3` | Discharge averted result | One-shot, stopped when result animation ends |
| `rift-venting-loop.mp3` | Vent/drain animation | Loop, fades in when draining starts and fades out when drain ends |
| `rift-system-stabilized.mp3` | System stabilized ending | One-shot during stabilized/return-to-pressure transition |

Several cue files are present in the repo, and missing files are ignored at runtime. Add or replace MP3s with the exact names above when ready.

To add more contribution variants, add another MP3 to `audio/contribution/` and add its URL to the `contribution.urls` list in `public/widgets/pishock-status/index.html`.
