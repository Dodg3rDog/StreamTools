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

## Timers

```text
GET  /api/timers
POST /api/timers/upsert
POST /api/timers/remove
POST /api/timers/expire
```

Timer mutation routes require a bearer token.
