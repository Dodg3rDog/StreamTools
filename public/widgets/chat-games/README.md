# Chat Games

## Purpose

Hosts AnthroCorp chat-playable game widgets. These games are designed to run as normal StreamTools web widgets now, and later they can be opened inside a shared phone/device overlay.

## Apps

```text
Code Break Protocol: /widgets/chat-games/apps/code-break-protocol/
Emote Sync Protocol: /widgets/chat-games/apps/emote-sync-protocol/
```

## Future Phone Overlay

The phone shell should eventually become a launcher/container that opens these app routes, instead of each game owning its own phone frame.

Suggested future structure:

```text
public/widgets/chat-games/
  phone-shell/
  apps/
    code-break-protocol/
    employee-evaluation/
    exploration-assignment/
  shared/
```

## API Routes

Code Break Protocol uses:

```text
GET  /api/chat-games/code-break-protocol/state
POST /api/chat-games/code-break-protocol/new
POST /api/chat-games/code-break-protocol/guess
POST /api/chat-games/code-break-protocol/submit
GET  /api/chat-games/code-break-protocol/submit?user=viewerName&message=A
POST /api/chat-games/code-break-protocol/reset
```

`guess` and `submit` accept either a single letter or a full phrase guess:

```json
{ "guess": "A", "user": "viewerName" }
```

`submit` is intended for Streamer.bot/chat relay code. It accepts `guess`, `message`, or `input`, plus `user`, `displayName`, or `username`.

Emote Sync Protocol uses:

```text
GET  /api/chat-games/emote-sync-protocol/state
GET  /api/chat-games/emote-sync-protocol/leaders
POST /api/chat-games/emote-sync-protocol/configure
POST /api/chat-games/emote-sync-protocol/new
POST /api/chat-games/emote-sync-protocol/submit
GET  /api/chat-games/emote-sync-protocol/submit?user=viewerName&message=Kappa
POST /api/chat-games/emote-sync-protocol/reset
```

`submit` is intended for Streamer.bot/chat relay code. It accepts `emote`, `message`, or `input`, plus `user`, `displayName`, or `username`.

It also accepts viewer profile image fields:

```text
profileImage
profileImageUrl
avatar
avatarUrl
userProfileImage
```

Correct submissions can replace completed emote tiles with the viewer's profile image. Incorrect submissions can fill the desync strike slots with the viewer's profile image and a red X.

Emote Sync keeps a server-side backup record for highest score and contributor counts:

```text
server/data/chat-games/emote-sync-protocol.json
```
