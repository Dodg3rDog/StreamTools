# Drawing Slot Machine

## Purpose

Displays a stream drawing-prompt slot machine. The reels produce:

```text
Species + Theme + Pose
```

## Workshop URL

```text
http://127.0.0.1:3054/widgets/drawing-slot-machine/
```

If another workshop server is already running, start this branch on a different port:

```bash
cd server
set PORT=3055
npm run start:workshop
```

Then open:

```text
http://127.0.0.1:3055/widgets/drawing-slot-machine/
```

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

## Notes

This widget was migrated from the old standalone Forge server into the current StreamTools server. The artwork remains a fixed 1920x1080 board and is uniformly scaled to the browser viewport so the graphic layers keep their alignment.
