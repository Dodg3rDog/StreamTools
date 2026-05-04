# Picarto to Streamer.bot Bridge

## Purpose

Connects Picarto chat to Streamer.bot so Picarto messages can trigger the same central stream actions used by the rest of StreamTools.

The first version is a Node bridge process:

```text
Picarto chat -> pmi.js bridge -> Streamer.bot HTTP DoAction
```

## Requirements

1. A Picarto bot account.
2. A Picarto chat OAuth token generated while logged in as that bot account.
3. Streamer.bot HTTP Server enabled.
4. A Streamer.bot action named `Picarto Chat Message`, or another name configured in `.env`.

Picarto docs:

```text
https://pmi.picarto.tv/
https://oauth.picarto.tv/chat/bot
```

Streamer.bot HTTP DoAction docs:

```text
https://docs.streamer.bot/api/http/requests/do-action
```

## Setup

From the `server` folder, install the Picarto PMI client:

```powershell
npm install pmi.js
```

Create a local bridge env file from the example:

```powershell
Copy-Item bridges/.env.example bridges/.env
```

Fill in:

```text
PICARTO_BOT_USERNAME
PICARTO_OAUTH_TOKEN
STREAMERBOT_HTTP_URL
STREAMERBOT_PICARTO_ACTION_NAME
```

Run the bridge:

```powershell
npm run start:picarto-bridge
```

## Streamer.bot Action Args

The bridge calls Streamer.bot `DoAction` with these args:

```text
picartoUser
picartoMessage
picartoTarget
picartoIsCommand
picartoCommand
picartoRawContext
```

Suggested Streamer.bot action:

```text
Name: Picarto Chat Message
```

That action can inspect `%picartoMessage%`, `%picartoCommand%`, and `%picartoUser%`, then branch into existing actions or redeems.

## Test Command

If `PICARTO_ENABLE_PING_REPLY=true`, typing this in Picarto chat:

```text
!ping
```

Should make the bot reply:

```text
AnthroCorp relay online.
```

Picarto has message limits, so keep bot replies conservative.

