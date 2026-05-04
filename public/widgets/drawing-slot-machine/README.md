# Drawing Slot Machine

## Purpose

Displays a stream drawing-prompt slot machine. The reels produce:

```text
Species + Theme + Pose
```

## Workshop URL

```text
http://127.0.0.1:3055/widgets/drawing-slot-machine/
```

If another workshop server is already running, start this branch on a different port:

```powershell
cd server
$env:PORT='3055'
npm run start:workshop
```

Then open:

```text
http://127.0.0.1:3055/widgets/drawing-slot-machine/
```

## Controls

The Awoo button supports pointer/touch and keyboard testing:

```text
Click/touch hold: depresses the button until released
Space hold: depresses the button until Space is released
Release: triggers a spin
```

The button is made from two artwork layers. The base layer stays fixed while the top `awoo_button.png` layer scales darker from its center to simulate a physical press.

## Reel Behavior

The three main prompt reels use a 3D cylinder-style animation. Each reel prebuilds multiple tile faces, rotates through them during the spin, then locks the front face as the result.

Duplicate reel results trigger a controlled reroll path. The duplicate warning plays first, then the affected reel releases, spins again, and relocks with its stop audio. The looping spin audio is stopped once all active reels are complete.

## Modifier Flow

Modifiers are queued by the StreamTools API or by URL test mode. A queued modifier is held until the next non-jackpot winning spin.

When the modifier resolves, the popup tile now behaves like a small Forge card printer:

```text
1. Modifier sign flips/reveals.
2. Modifier tile pops into place.
3. Tile scans/prints through entries from modifiers/{type}.json.
4. Final prompt locks.
5. APPLIED stamp appears on the card.
```

The modifier image source still comes from:

```text
public/assets/drawing-slot-machine/images/slot_machine/modifiers/{type}/
```

The visible text label is intentionally kept on top of the tile so the result remains readable while placeholder modifier images are blank.

## API Routes

Public overlay routes:

```text
GET  /api/drawing-slot-machine/state
GET  /api/drawing-slot-machine/history
POST /api/drawing-slot-machine/history
GET  /api/drawing-slot-machine/jackpot
POST /api/drawing-slot-machine/jackpot/reset
GET  /api/drawing-slot-machine/status
POST /api/drawing-slot-machine/status
```

Streamer.bot/server-trigger routes require the configured bearer token:

```text
GET  /api/drawing-slot-machine/trigger-spin
POST /api/drawing-slot-machine/trigger-spin
GET  /api/drawing-slot-machine/jackpot/increment?delta=100
POST /api/drawing-slot-machine/jackpot/increment
GET  /api/drawing-slot-machine/modifier/set?type=sussy
POST /api/drawing-slot-machine/modifier/set
GET  /api/drawing-slot-machine/modifier/clear
POST /api/drawing-slot-machine/modifier/clear
```

## URL Test Modes

For local workshop testing, the widget can queue a modifier directly from the browser URL:

```text
/widgets/drawing-slot-machine/?mode=modify-sus
/widgets/drawing-slot-machine/?mode=modify-sussy
```

Those modes queue the `sussy` modifier and start a test spin automatically. To queue a modifier without auto-spinning:

```text
/widgets/drawing-slot-machine/?modifier=sussy&autospin=0
```

## Notes

This widget was migrated from the old standalone Forge server into the current StreamTools server. The artwork remains a fixed 1920x1080 board and is uniformly scaled to the browser viewport so the graphic layers keep their alignment.
