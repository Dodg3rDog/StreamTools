# API Routes

## Health

```text
GET /health
GET /api/health
```

Returns server status, service name, version, and uptime.

## PiShock

```text
GET /api/pishock/status
POST /api/pishock/status
```

`POST /api/pishock/status` requires a bearer token and updates the in-memory relay status used by the PiShock status widget.

The status route also derives live timer state for cooldowns, event countdowns, and overload expiry. When `overloadUntilUtc` expires, the route clears overload flags, returns the max pressure cap to `100`, and emits either `overload-expired-recovery` or `overload-expired-discharge` depending on whether pressure is still at standard max capacity.

Incoming status updates older than the current `statusSequence` are ignored as stale. Streamer.bot scripts should post with a monotonic, time-aware sequence. When this route derives an overload-expiry state, it advances the current sequence by one so later Streamer.bot updates do not have to catch up to a wall-clock timestamp jump.

## Timers

```text
GET  /api/timers
POST /api/timers/upsert
POST /api/timers/remove
POST /api/timers/expire
```

Timer mutation routes require a bearer token.
