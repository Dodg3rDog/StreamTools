# Picarto Bridge Notes

## Goal

Create a Picarto chat bot that relays Picarto chat messages into Streamer.bot so Streamer.bot remains the central controller for stream actions, overlays, redemptions, and game logic.

## Current Integration Shape

```text
Picarto chat -> Node bridge using pmi.js -> Streamer.bot HTTP DoAction
```

## Why This Shape

- Picarto exposes chat bot access through the Picarto Message Interface.
- Streamer.bot exposes a local HTTP `DoAction` endpoint.
- The bridge can normalize Picarto chat into action args that Streamer.bot can branch on.
- This avoids making StreamTools replace Streamer.bot as the stream controller.

## Future Ideas

- Route Picarto chat into the chat-games widgets.
- Add Picarto-specific command aliases.
- Let Streamer.bot send selected responses back to Picarto through the bridge.
- Track Picarto users in the same AnthroCorp employee/profile system.
- Add reconnect/backoff and health status once the bridge is live-tested.

