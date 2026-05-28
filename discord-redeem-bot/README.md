# Discord Redeem Bot

Local Discord bot prototype for the Night Howlers redeem board.

The Discord bot is now consolidated into the main StreamTools server. Prefer running it from:

```powershell
cd C:\StreamTools\Repos\StreamTools\server
npm start
```

Set `ENABLE_DISCORD_BOT=true` and the Discord values in the root `StreamTools/.env`.

This folder is kept as a standalone prototype/reference while the consolidated server version settles.

## Setup

```bash
cd discord-redeem-bot
npm install
copy .env.example .env
```

Fill in `.env`, then register the slash command:

```bash
npm run register
```

The bot reads `.env`, not `.env.example`. Keep `.env.example` as a blank template and put real Discord values only in `.env`.

Start the bot:

```bash
npm start
```

## Command

```text
/redeems
```

The command posts a Discord-native button board. Button clicks are logged by the bot and forwarded to:

```text
POST /api/discord/redeem
```

If `STREAMTOOLS_BOT_SECRET` is set in both this bot and the StreamTools server `.env`, the bot sends it as:

```text
X-StreamTools-Bot-Secret: <secret>
```

## Streamer.bot Bridge

StreamTools can forward Discord events into Streamer.bot through Streamer.bot's HTTP server.

In the StreamTools root `.env`, set:

```env
STREAMERBOT_HTTP_URL=http://127.0.0.1:7474
STREAMERBOT_DISCORD_REDEEM_ACTION_NAME=Discord Trigger Bridge
STREAMERBOT_DISCORD_MESSAGE_ACTION_NAME=Discord Trigger Bridge
```

In Streamer.bot, enable the HTTP Server and create the bridge action:

```text
Discord Trigger Bridge
```

Import `streamerbot/csharp/discord/Discord_Trigger_Bridge.cs` into that action and enable precompile on application start. Your real actions can then use triggers under `Custom -> StreamTools -> Discord`.

Redeem action args:

```text
discordEventType
discordRedeemId
discordRedeemLabel
discordRedeemStyle
discordUserName
discordUserId
discordGuildId
discordChannelId
discordMessageId
discordTimestamp
discordRawPayload
```

Message action args:

```text
discordEventType
discordUserName
discordUserId
discordGuildId
discordChannelId
discordMessageId
discordMessage
discordHasMedia
discordAttachmentCount
discordStickerCount
discordEmbedCount
discordMediaTypes
discordIsCommand
discordCommand
discordCommandArgs
discordTimestamp
discordRawPayload
```

Media-only posts, such as image uploads or stickers with no text, count as Discord chat messages. The bridge forwards media metadata only, not file contents.

## Discord Chat Relay

The bot can relay Discord text commands and optionally all Discord messages into StreamTools, then Streamer.bot.

In `discord-redeem-bot/.env`:

```env
DISCORD_COMMAND_PREFIX=!
DISCORD_FORWARD_COMMANDS=true
DISCORD_FORWARD_ALL_MESSAGES=false
DISCORD_RELAY_CHANNEL_IDS=1426736234956329112
```

With the default settings, only messages starting with `!` are forwarded. Set `DISCORD_FORWARD_ALL_MESSAGES=true` only if you want every visible Discord message sent to Streamer.bot.

If `DISCORD_RELAY_CHANNEL_IDS` is set, only messages from those comma-separated Discord channel IDs are forwarded. Leave it blank to allow all visible channels.

Trusted roles can control runtime relay channels:

```text
/howlerstream  enables relay for the current channel
/howlerstop    disables runtime relay for the current channel
```

Configure allowed roles:

```env
DISCORD_RELAY_CONTROL_ROLE_NAMES=🐺Owner
DISCORD_RELAY_CONTROL_ROLE_IDS=
```

Role IDs are safer than names if you later rename roles.

For message relay, enable this in the Discord Developer Portal:

```text
Applications -> your bot -> Bot -> Privileged Gateway Intents -> Message Content Intent
```

## Customizing Redeems

Edit:

```text
src/redeems.js
```

Board-level options live in `BOARD_CONFIG`:

```js
const BOARD_CONFIG = {
  title: "Night Howlers Redeem Board",
  description: "Choose a Discord redeem to trigger a stream interaction.",
  color: 0x8f5cff,
  footerText: "",
  thumbnailUrl: "",
  maxButtonsPerRow: 5
};
```

Each redeem can customize its label, emoji, button style, visibility, and disabled state:

```js
trigger_howl: {
  label: "Trigger Howl",
  emoji: { id: "123456789012345678", name: "howl" },
  style: "danger",
  visible: true,
  disabled: false
}
```

Button style options are Discord's built-in colors:

```text
primary   blue
secondary gray
success   green
danger    red
```

Emoji options:

```js
emoji: ""                                            // no emoji
emoji: "<unicode emoji>"                             // Unicode emoji character
emoji: "<:howl:123456789012345678>"                  // pasted custom emoji markup
emoji: { id: "123456789012345678", name: "howl" }    // custom static emoji
emoji: { id: "123456789012345678", name: "howl", animated: true }
```

Discord allows up to 5 buttons per row and 5 rows per message, so the board can show up to 25 buttons.
