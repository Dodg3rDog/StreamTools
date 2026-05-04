# Emote Sync Protocol

## Purpose

A cooperative chat game where viewers reproduce a displayed Twitch emote sequence in order. Each correct chat submission advances the shared cursor. Incorrect submissions add strikes.

## Workshop URL

```text
http://127.0.0.1:3055/widgets/chat-games/apps/emote-sync-protocol/
```

Hide test controls:

```text
/widgets/chat-games/apps/emote-sync-protocol/?controls=false
```

## Emote Pool

The editable emote list lives in:

```text
emotes.config.js
```

It has two sections:

```js
globalEmotes: []
channelEmotes: []
```

`globalEmotes` contains a starter list of common Twitch global emotes. `channelEmotes` is intentionally empty and can be updated later with channel-specific emote names and local image files.

Other tuning options in `emotes.config.js`:

```js
sequenceLength: 5,
maxStrikes: 3,
roundMs: 45000,
nextRoundDelayMs: 4500
```

Recommended channel emote image path:

```text
public/widgets/chat-games/apps/emote-sync-protocol/assets/channel-emotes/
```

Example:

```js
{ name: "Dodg3rHype", image: "./assets/channel-emotes/Dodg3rHype.png" }
```

## API

```text
GET  /api/chat-games/emote-sync-protocol/state
GET  /api/chat-games/emote-sync-protocol/leaders
POST /api/chat-games/emote-sync-protocol/configure
POST /api/chat-games/emote-sync-protocol/new
POST /api/chat-games/emote-sync-protocol/submit
GET  /api/chat-games/emote-sync-protocol/submit?user=viewerName&message=Kappa
POST /api/chat-games/emote-sync-protocol/reset
```

Streamer.bot can relay raw chat messages to `submit`:

```json
{
  "message": "!sync Kappa",
  "user": "viewerName",
  "profileImageUrl": "https://example.com/viewer.png"
}
```

The endpoint strips `!sync`, `!emote`, `!signal`, and `!pattern` before matching the submitted emote name.

Accepted profile image fields:

```text
profileImage
profileImageUrl
avatar
avatarUrl
userProfileImage
```

Correct submissions replace the completed emote tile with the viewer's profile image. Incorrect submissions fill the strike slots with that viewer's profile image and a red X. If no profile image is supplied, the widget shows initials as a fallback.

## Scoring

- Completing a pattern flashes a success alert and automatically advances to the next pattern.
- A successful pattern adds 1 to the current score.
- Strikes persist across successful patterns, making the streak more dangerous.
- A failed or timed-out pattern resets the current score and strikes to 0 when retraining begins.
- The highest score is persisted on the server.
- Correct and incorrect contributor counts are also persisted on the server as a backup record.

Server record file:

```text
server/data/chat-games/emote-sync-protocol.json
```

This record is useful as a fallback if Streamer.bot persistent variables ever reset. Streamer.bot can still maintain its own variables and use this server record for recovery or chat commands later.
