# Custom chat overlay import assessment

Source: `import/BlackyWhoElse streamer.bot-actions main widget/chat`
Reviewed: 2026-09-27. Source inspection only; no live chat connection or deployment.

## Findings

The import is an editable HTML/CSS/JavaScript widget, not a compiled application.
It subscribes directly to Streamer.bot WebSocket events for Twitch and YouTube.
It includes avatar lookup/cache, badge and emote rendering, platform colors,
command/user filtering, word replacement, animations, message deletion events,
and a custom ClearChat event. The checked-in default theme is `imessage`.

The iMessage theme already has bubble tails and left/right layout. It puts
broadcasters and moderators on the right, rather than alternating arrivals.
The existing bubble theme is another styling reference. Neither implements the
requested alternating comic-book conversation as supplied.

## Recommended Admin integration

Add **Custom Chat** to Widgets & Overlays, with a dedicated editor styled using
Admin's existing components. This widget uses nested settings and separate CSS
variables, so it needs an adapter rather than the purchased-overlay field editor
unchanged.

- Appearance: theme, font/size, name/avatar/badge visibility, left/right fill,
  outline color/thickness, shadow, bubble width, spacing, tail size, safe margins.
- Conversation: alternating-message layout by default, first side, optional
  switch-on-speaker-change mode, message count, lifetime, entry/exit animation.
- Sources and filtering: Streamer.bot connection, platforms, command hiding,
  ignored users, literal blocked words, connection status.
- Preview: disconnected sample chat with left/right messages, long text,
  emote-only messages, repeated speakers, bursts, deletion and clear tests.
- OBS setup: Copy URL, dimensions, persistent named settings; explicit Save and
  Discard with a clear distinction between preview changes and live settings.

Do not expose a WebSocket password in a public overlay settings response. Decide
whether the widget connects directly from the OBS computer or uses a server
relay after checking the installed Streamer.bot configuration. `localhost` in a
browser source means the computer running that browser, not the Linux web host.

## Comic conversation behavior

Use a transparent canvas, thick ink outlines, rounded/irregular bubbles,
outward-facing tails, optional offset shadows and optional halftone accents.
Left and right fills should be independently configurable. Text remains upright.

Assign a monotonically increasing display sequence and a fixed side only after
a message passes filters. Render in arrival order even if avatars resolve later.
Store the side with the message; do not use CSS nth-child for alternation, since
moderation deletion or expiration would otherwise flip existing bubbles.

Default: every displayed message alternates left/right. An optional mode can
keep consecutive messages from one speaker together and switch sides when the
speaker changes. Neither mode implies that real viewers are replying to each
other. Keep names visible to preserve who actually said each message.

Bound both history and rendered nodes. Wrap long text, constrain emotes, and
remove expired/overflow messages without moving surviving bubbles to the other
side. Moderation deletion must remove the message immediately.

## Code issues to address

- `js/script.js`, `chatHistory`: `messages.slice(1)` does not mutate the array;
  the intended 15-message history cap is ineffective.
- `js/streamer.bot.js`: event handling dereferences `wsdata.event.source` without
  first checking that `event` exists. Authentication/other packets need defensive
  handling and compatibility verification against the installed Streamer.bot.
- Both moderation deletion events and normal expiration call `removeMessage`,
  which waits the configured hide delay and relies on animation completion.
  Separate immediate moderation removal from timed/animated expiration.
- Rendering substitutes message fields into HTML templates. Audit escaping and
  create text/emote nodes safely before enabling arbitrary live chat input.
- Word filters create regular expressions directly from settings. Prefer literal
  matching by default, or validate regex patterns explicitly.
- Async avatar/emote processing can complete out of order. Queue messages or
  reserve positions before enrichment so the visual conversation stays ordered.
- `js/settings.js` changes in-memory settings and themes; it has no persistent
  save path. Add validated, authenticated server-side settings storage.
- Theme settings can override global values during asynchronous loading. Use one
  deterministic precedence: defaults, theme defaults, saved user settings.
- External jQuery, animation CSS, fonts and avatar services are runtime
  dependencies. Decide which dependencies to host locally and provide fallbacks.
- No license file was found in the supplied widget folder. Preserve attribution
  and confirm upstream reuse terms before redistributing copied code.

## Implementation sequence and validation

1. Preserve the import and build the StreamTools widget in a separate folder.
2. Establish a bounded, safe message renderer and disconnected comic preview.
3. Add the Admin editor and persistent configuration API.
4. Adapt/test the actual Streamer.bot event payloads, reconnect and authentication.
5. Validate filtering, immediate moderation deletion, clear chat, ordered bursts,
   expiration without side flipping, long messages, emotes, OBS dimensions,
   saved settings after restart, and preview isolation from live chat.

No source files, server configuration, or live overlays were changed by this review.
