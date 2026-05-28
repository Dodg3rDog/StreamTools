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

## Discord

When `ENABLE_DISCORD_BOT=true`, the main StreamTools server also starts the Discord client. Run the StreamTools server as the single Discord bridge process.

Customize the consolidated redeem board in:

```text
server/services/discordRedeems.js
```

```text
POST /api/discord/redeem
POST /api/discord/message
```

Accepts Discord redeem button events and optional Discord message/command events from the local Discord redeem bot.

If `STREAMTOOLS_BOT_SECRET` is set in the StreamTools server `.env`, requests must include the matching header:

```text
X-StreamTools-Bot-Secret: <secret>
```

The route logs the received event and responds with:

```json
{
  "ok": true,
  "received": true,
  "streamerBot": {
    "ok": true
  }
}
```

If `STREAMERBOT_HTTP_URL` is set, the Discord routes also call Streamer.bot's HTTP `DoAction` endpoint.

Default Streamer.bot bridge action names:

```text
Discord Trigger Bridge
```

Override them with:

```env
STREAMERBOT_DISCORD_REDEEM_ACTION_NAME=Discord Trigger Bridge
STREAMERBOT_DISCORD_MESSAGE_ACTION_NAME=Discord Trigger Bridge
```

The bridge action raises Streamer.bot custom code triggers registered by `streamerbot/csharp/discord/Discord_Trigger_Bridge.cs`.

## Timers

```text
GET  /api/timers
POST /api/timers/upsert
POST /api/timers/remove
POST /api/timers/expire
```

Timer mutation routes require a bearer token.
