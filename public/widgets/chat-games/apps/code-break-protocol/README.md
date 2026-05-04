# Code Break Protocol

## Purpose

An AnthroCorp-themed hangman-style chat game. Chat attempts to decode a redacted protocol phrase before the incident meter reaches failure.

## Workshop URL

```text
http://127.0.0.1:3055/widgets/chat-games/apps/code-break-protocol/
```

## Test Controls

The widget includes local test controls by default. Hide them with:

```text
/widgets/chat-games/apps/code-break-protocol/?controls=false
```

## API

```text
GET  /api/chat-games/code-break-protocol/state
POST /api/chat-games/code-break-protocol/new
POST /api/chat-games/code-break-protocol/guess
POST /api/chat-games/code-break-protocol/submit
GET  /api/chat-games/code-break-protocol/submit?user=viewerName&message=A
POST /api/chat-games/code-break-protocol/reset
```

Example guess:

```json
{
  "guess": "E",
  "user": "Dodg3rDog"
}
```

## Streamer.bot Chat Relay

Streamer.bot C# can relay chat messages to `submit`. The endpoint accepts any of these input fields:

```json
{
  "message": "!code E",
  "user": "viewerName"
}
```

Accepted aliases:

```text
guess, message, input
user, displayName, username
```

If the relayed message starts with `!code`, `!guess`, `!cbp`, or `!break`, the command prefix is stripped before the guess is processed.

The first version is intentionally simple: server-backed state, local browser polling, and manual controls for testing. Streamer.bot can call `submit` when chat sends commands or redeems trigger the game.
