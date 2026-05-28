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

The `Init()` method registers the custom triggers whenever Streamer.bot starts.

## StreamTools Env

In the root StreamTools `.env`:

```env
STREAMERBOT_HTTP_URL=http://127.0.0.1:7474
STREAMERBOT_DISCORD_REDEEM_ACTION_NAME=Discord Trigger Bridge
STREAMERBOT_DISCORD_MESSAGE_ACTION_NAME=Discord Trigger Bridge
```

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
Discord Redeem: Ask Question
Discord Redeem: Join Queue
Discord Redeem: Trigger Howl
Discord Redeem: Summon HR
Discord Redeem: Make It Sus
Discord Redeem: Change Overlay Color
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

## Notes

The HTTP `DoAction` call now only starts the bridge action. Your real work should be attached to the custom triggers registered by the bridge.

If you add new redeem IDs in:

```text
server/services/discordRedeems.js
```

also add a matching `RegisterDiscordTrigger` line in:

```text
streamerbot/csharp/discord/Discord_Trigger_Bridge.cs
```

Generic `Discord Redeem` will still fire for every redeem, even if a specific trigger has not been registered yet.
