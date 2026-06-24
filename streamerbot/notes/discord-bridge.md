# Discord Bridge

## Purpose

Discord events are forwarded from StreamTools into Streamer.bot as custom triggers.

This makes Discord redeems and commands behave more like native Streamer.bot triggers instead of requiring every real action to be called directly through HTTP `DoAction`.

## Flow

```text
Discord button or command
  -> StreamTools server
  -> Streamer.bot DoAction: Discord Trigger Bridge
  -> C# TriggerCodeEvent
  -> Your Streamer.bot action trigger fires
```

## Required Streamer.bot Action

Create one Streamer.bot action:

```text
Discord Trigger Bridge
```

Add the C# script:

```text
streamerbot/csharp/discord/Discord_Trigger_Bridge.cs
```

Recommended settings:

```text
Precompile on Application start: enabled
```

The `Init()` method fetches trigger definitions from StreamTools and registers them whenever Streamer.bot starts. If StreamTools is not available, it falls back to the generic Discord triggers.

## StreamTools Env

In the root StreamTools `.env`:

```env
STREAMERBOT_HTTP_URL=http://127.0.0.1:7474
STREAMERBOT_DISCORD_REDEEM_ACTION_NAME=Discord Trigger Bridge
STREAMERBOT_DISCORD_MESSAGE_ACTION_NAME=Discord Trigger Bridge
STREAMERBOT_POINTS_ACTION_NAME=StreamTools Points
```

## Streamer.bot Globals

For the dynamic trigger list, the bridge fetches:

```text
http://127.0.0.1:3030/api/discord/triggers.txt
```

Recommended persisted Streamer.bot global:

```text
st_discordTriggersUrl = http://127.0.0.1:3030/api/discord/triggers.txt
```

The bridge also tries `st_apiBaseUrl + /api/discord/triggers.txt`, then common local defaults `3030` and `3055`. StreamTools must be running before the bridge action initializes if you want the full dynamic trigger list.

## Triggers To Use

After the bridge action has initialized, add triggers to your real actions from:

```text
Custom -> StreamTools -> Discord
```

Registered triggers:

```text
Discord Redeem
Discord Chat Message
Discord Command
Discord Redeem: Hydrate
Discord Redeem: Join Queue
Discord Redeem: Trigger Howl
Discord Redeem: Summon HR
Discord Redeem: Make It Sus
Discord Redeem: Change Overlay Color
```

The per-redeem trigger list is generated from:

```text
server/services/discordRedeems.js
```

Streamer.bot refreshes this trigger list when the bridge action initializes, so restart Streamer.bot or recompile/reload the bridge action after changing redeems.

You can also pre-register specific command triggers from `.env`:

```env
DISCORD_COMMAND_TRIGGER_NAMES=test,howl,sus
```

That creates trigger names like:

```text
Discord Command: test
Discord Command: howl
Discord Command: sus
```

Example:

```text
Action: Make It Sus
Trigger: Custom -> StreamTools -> Discord -> Discord Redeem: Make It Sus
```

## Variables

Redeem triggers receive:

```text
%discordEventType%
%discordRedeemId%
%discordRedeemLabel%
%discordRedeemStyle%
%discordRedeemPointCost%
%discordRedeemRequiresInput%
%discordRedeemInput%
%discordRedeemInputLabel%
%pointUserKey%
%discordUserName%
%discordUserId%
%discordGuildId%
%discordChannelId%
%discordMessageId%
%discordTimestamp%
%discordRawPayload%
```

Message and command triggers receive:

```text
%discordEventType%
%discordUserName%
%discordUserId%
%discordGuildId%
%discordChannelId%
%discordMessageId%
%discordMessage%
%discordHasMedia%
%discordAttachmentCount%
%discordStickerCount%
%discordEmbedCount%
%discordMediaTypes%
%discordIsCommand%
%discordCommand%
%discordCommandArgs%
%discordTimestamp%
%discordRawPayload%
```

Media-only Discord posts count as chat messages. The bridge does not forward the file contents or URLs by default; it only forwards metadata such as whether media was present and how many attachments, stickers, or embeds Discord reported.

## Discord Channel Filtering

Command/message relay can be limited to specific Discord channels.

In the root StreamTools `.env`:

```env
DISCORD_RELAY_CHANNEL_IDS=1426736234956329112
```

Use a comma-separated list for multiple channels:

```env
DISCORD_RELAY_CHANNEL_IDS=111111111111111111,222222222222222222
```

When this value is set, Discord text messages outside those channels are ignored by the relay. Redeem button clicks are still handled wherever the redeem board message exists.

### Runtime Channel Control

Trusted Discord roles can enable or disable relay for the current channel with slash commands:

```text
/howlerstream
/howlerstop
```

Configure the allowed roles in the root StreamTools `.env`:

```env
DISCORD_RELAY_CONTROL_ROLE_NAMES=🐺Owner
DISCORD_RELAY_CONTROL_ROLE_IDS=
```

Role IDs are more stable than role names. You can use either or both:

```env
DISCORD_RELAY_CONTROL_ROLE_IDS=123456789012345678
```

Runtime channel changes are saved to:

```text
server/data/discord/relay-channels.json
```

Channels listed in `DISCORD_RELAY_CHANNEL_IDS` are static baseline channels. `/howlerstop` removes runtime-added channels; it does not edit `.env`.

The same channel allow-list is used for Discord voice point accrual. You can add a voice channel from any channel with:

```text
/howlerstream channel:#voice-channel
```

Voice points are disabled by default. Enable them in the root StreamTools `.env`:

```env
ENABLE_DISCORD_VOICE_POINTS=true
DISCORD_VOICE_POINT_INTERVAL_SECONDS=300
DISCORD_VOICE_POINT_AMOUNT=1
DISCORD_VOICE_POINTS_REQUIRE_UNMUTED=false
DISCORD_VOICE_POINTS_REQUIRE_UNDEAFENED=false
```

Every interval, the Discord bot awards points through the `StreamTools Points` action to non-bot users currently sitting in allowed voice channels. If no channels are allowed, no voice points are awarded.

## Notes

The HTTP `DoAction` call now only starts the bridge action. Your real work should be attached to the custom triggers registered by the bridge.

Generic `Discord Redeem` will still fire for every redeem, even if a specific trigger has not been registered yet.

The Discord bridge does not approve, deny, or spend points. It forwards the configured cost as `%discordRedeemPointCost%` and provides `%pointUserKey%` so Streamer.bot can run the same point logic used by Twitch or other platforms.

## Points

Point balances live in Streamer.bot as persistent user variables. Use:

```text
streamerbot/csharp/points/StreamerBot_Currency_Core_System.cs
```

Create or update a Streamer.bot C# action named:

```text
Currency Core
```

Create a normal Streamer.bot action named:

```text
StreamTools Points
```

Add one sub-action:

```text
Execute Method ([Currency Core], Execute)
```

Default point variable:

```text
points
```

To use a different variable name, set this persisted Streamer.bot global:

```text
st_pointVarName = your_variable_name
```

The point display name is also a persisted global:

```text
st_pointDisplayName = point
```

The admin page can read/write these settings and user balances through Streamer.bot. For that callback flow, set:

```text
st_apiBaseUrl = http://127.0.0.1:3030
st_bearerToken = <StreamTools bearer token>
```

Useful methods:

```text
Execute
AddPointsDiscord
SpendPointsDiscord
CheckPointsDiscord
SetPointsDiscord
GetPointsDiscord
SendPlatformMessage
```

Recommended redeem action flow:

```text
1. Trigger: Discord Redeem: <name>
2. Set argument: pointOperation = spend
3. Execute Method ([Currency Core], Execute)
4. If %pointsApproved% is true:
   - run the actual redeem sub-actions
5. Else:
   - set %message% or %discordMessageText% to %pointsResponseMessage%
   - Execute Method ([Currency Core], SendPlatformMessage)
```

The helper accepts the Discord cost automatically from `%discordRedeemPointCost%`. For Twitch or manual actions, pass `pointCost` or `redeemCost`.

Example denial response:

```text
%user% You don't have enough %pointName%'s to redeem %discordRedeemLabel%, you only have %pointsBalance% %pointName%'s.
```

If `st_pointVarName` is `points`, the helper also sets `%points%` to the current balance during the action.

Point helper result arguments:

```text
%pointUserKey%
%pointVarName%
%pointName%
%pointsApproved%
%pointsBalanceBefore%
%pointsBalance%
%pointsBalanceAfter%
%pointsCost%
%pointsDelta%
%pointsShortfall%
%pointsDeniedReason%
%pointsResponseMessage%
```

## Admin Page

The StreamTools admin page is available at:

```text
http://127.0.0.1:3030/admin/
```

The first admin section edits Discord redeems. Saving and reordering require the StreamTools bearer token from the root `.env`.

Redeems are shown in the same left-to-right order Discord uses for the button board, with five buttons per row.

Redeems can optionally request one text response from the user and can carry a point cost. When input is enabled, Discord opens a modal before firing the redeem, and Streamer.bot receives the submitted value as `%discordRedeemInput%`.

Saved redeems are written to:

```text
server/data/discord/redeems.json
```

After editing redeems, restart/reload the Discord Trigger Bridge in Streamer.bot to refresh the trigger options.

## Discord Responses

For no-JSON Streamer.bot wiring, import:

```text
streamerbot/csharp/discord/Discord_Send_Message.cs
```

as an action named:

```text
Discord Send Message
```

Then, inside a Discord-triggered action:

```text
1. Set Argument: discordMessageText = your message text
2. Execute C# Code: Discord Send Message
```

The helper uses `%discordChannelId%` and `%discordMessageId%` from the trigger. It replies to the source Discord message when `%discordMessageId%` is available.

Example `discordMessageText`:

```text
%user% You don't have enough %pointName%'s, you only have %pointsBalance% %pointName%'s.
```

Under the hood, the helper sends command or redeem responses back through:

```text
POST http://127.0.0.1:3030/api/discord/send-message
```

Headers:

```text
Authorization: Bearer <StreamTools bearer token>
Content-Type: application/json
```

Body:

```json
{
  "channelId": "%discordChannelId%",
  "replyToMessageId": "%discordMessageId%",
  "message": "Checked in %user%. Total: %checkins%"
}
```

`replyToMessageId` is optional. If it is present and the source message can be found, the bot replies to that message. Otherwise it posts a normal message in the channel.
