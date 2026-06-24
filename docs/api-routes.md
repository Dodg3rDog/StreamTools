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
GET  /api/discord/triggers
GET  /api/discord/triggers.txt
GET  /api/discord/redeems
POST /api/discord/redeems/upsert
POST /api/discord/redeems/remove
POST /api/discord/redeems/reorder
POST /api/discord/redeems/reset
POST /api/discord/send-message
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

The trigger metadata routes expose the current redeem and configured command trigger list so the Streamer.bot bridge can register trigger options dynamically.

Redeem mutation routes require the bearer token and are used by the admin page. Redeems include an `order` value and optional `pointCost`; Discord renders visible buttons left to right in rows of five, up to Discord's five-row button limit. Redeems can also require a single Discord modal text response, which is forwarded to Streamer.bot as `discordRedeemInput`.

Point balances are managed in Streamer.bot by `streamerbot/csharp/points/StreamerBot_Currency_Core_System.cs`, not by the server. The Discord bridge only forwards the configured cost as `discordRedeemPointCost` and a stable `pointUserKey`.

`POST /api/discord/send-message` requires the bearer token and sends a Discord bot message. Use it from Streamer.bot command/redeem responses with:

```json
{
  "channelId": "%discordChannelId%",
  "replyToMessageId": "%discordMessageId%",
  "message": "Response text"
}
```

## Points

```text
GET  /api/points/settings
POST /api/points/settings
GET  /api/points/user?pointUserKey=<key>
POST /api/points/user
POST /api/points/callback
```

Point admin routes require the bearer token. They trigger the Streamer.bot action configured by `STREAMERBOT_POINTS_ACTION_NAME`, defaulting to `StreamTools Points`, and wait for `streamerbot/csharp/points/StreamerBot_Currency_Core_System.cs` to post a callback snapshot.

Set these persisted Streamer.bot globals so the C# action can call back to StreamTools:

```text
st_apiBaseUrl = http://127.0.0.1:3030
st_bearerToken = <StreamTools bearer token>
```

Discord voice points are awarded by the Discord bot through the same `StreamTools Points` action. They use the existing Discord relay channel allow-list, including channels added at runtime with `/howlerstream channel:#voice-channel`.

## Timers

```text
GET  /api/timers
POST /api/timers/upsert
POST /api/timers/remove
POST /api/timers/expire
```

Timer mutation routes require a bearer token.
