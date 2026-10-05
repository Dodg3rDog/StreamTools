# Custom Chat

Admin: `/admin/` → Widgets & Overlays → Custom Chat.
OBS browser source: `/widgets/custom-chat/` (suggested 600 × 900).
The background is transparent. This is a new StreamTools implementation; the
imported BlackyWhoElse widget is preserved unchanged and is not served/copied.

## Appearance and behavior

Comic book and soft bubble styles; message-by-message alternation or switching
when the speaker changes; left/right starting side; colors, outline, tail,
shadow, typography, spacing, message count, and lifetime. Message sides are
assigned after filtering and never flip when earlier messages are deleted.
Names and platform labels are optional. Avatars and emotes are displayed when
provided by the source; image failures fall back gracefully. Standalone emote
names are replaced with supplied images; no third-party emote catalog is fetched.

Chat is rendered with text nodes and validated HTTPS image URLs. Blocked words
are literal case-insensitive filters. History is bounded; moderation deletions
are immediate. Oversized individual messages are clipped to the available
canvas. Oldest messages are removed when the configured canvas fills.

## Admin workflow

Select Custom Chat, adjust fields, then Save chat settings. Drafts update only
the isolated sample preview. Sample conversation, Message burst, Delete oldest,
and Clear preview do not send messages to any real chat service. Discard restores
the last saved configuration. Save writes `server/data/custom-chat.json` and
pushes appearance changes to connected overlays without restart. Preserve that
runtime file during deployments and backups.

## Streamer.bot connection

The OBS browser source connects directly to `ws://127.0.0.1:8080/` on the
computer running OBS. Keep Streamer.bot on its existing localhost binding.
Use this overlay on the same PC as Streamer.bot. No Linux-to-PC connection or
firewall change is required. The Admin preview is sample-only on any device.

The live overlay polls saved appearance settings from StreamTools every five
seconds. Chat reconnects automatically if Streamer.bot restarts. The page title
reports connection status. This direct client was verified against the installed
Streamer.bot instance, with a successful browser subscription on 2026-09-28.
Authentication-enabled WebSocket instances require additional client setup;
no passwords are published in the overlay or its URL.

The older server relay endpoints remain for compatibility but are not used by
the overlay. Admin saves appearance settings without enabling that relay.

## Validation

`node --test server/tests/custom-chat.test.js`
Covers stable alternation after deletion/expiration, bounded history, speaker
mode, filtered-message ordering, validation, and old/current event normalization.
Live Admin loading, sample rendering, initial settings save, and unauthorized
save rejection were verified. The direct browser connection and subscription were verified; actual on-stream
message appearance remains for the user to test in OBS.

Protocol references:
- https://docs.streamer.bot/api/websocket/guide/authentication
- https://docs.streamer.bot/api/websocket/events/twitch/chat-message
- https://docs.streamer.bot/api/websocket/events/twitch/chat-message-deleted
- https://docs.streamer.bot/api/websocket/events/youtube/message

Profile pictures now use the image supplied in the chat event, or a cached
DecAPI Twitch avatar lookup by public login name. Lookups expire after 15 minutes;
failures cache for one minute. Initials appear while loading or if lookup fails.
The sample preview uses initials and does not make avatar lookups.
**Use Twitch name colors** applies the exact valid Twitch color from the event;
missing colors fall back to the configured text color. Both profile pictures
and Twitch name colors can be switched off in Admin.

Exit animation controls: Fade out (default), Fade and slide, Fade and shrink,
or None. Exit duration is in milliseconds, defaults to 600, and accepts 0–5000.
Expiration, message-count overflow, and canvas overflow animate out. Moderation
deletions and clear commands remove messages immediately, including any that are
already exiting. Reduced-motion preferences suppress exits. Exit nodes keep their
previous positions and are bounded to 40 during bursts.

## Audience silhouettes theme

Select **Theme → Audience silhouettes** in the Custom Chat editor and use
Sample conversation to preview it before saving. Original wolf, cat, rabbit,
and dragon silhouettes form a crowd along the bottom. Choose a mixed crowd
or one species, silhouette color, character height, maximum crowd size,
decorative starting crowd, and idle timeout (0 keeps characters indefinitely).

A chatter receives a character on their first accepted message. Bubble placement
can follow the speaker's character or choose a random character. Consecutive messages from the same chatter append on separate lines in the same
bubble and refresh its lifetime. After another chatter speaks, their next message
starts a new bubble that replaces that chatter's previous bubble, using the selected exit animation. Other chatters' bubbles remain. Groups are bounded to 3 messages / 4000 characters. Characters remain after bubbles expire. At the crowd
limit, the least recently active character is reassigned. This represents chat
activity, not a count of viewers or detection of silent viewers joining.

Bubbles move upward to avoid overlap and stay within the canvas. If there is no
room, older bubbles are removed immediately. The crowd resets when the browser
source reloads. Existing Comic book and Soft bubbles settings remain available.

Audience validation: `node --test server/tests/custom-chat-audience.test.js
server/tests/custom-chat-exit.test.js server/tests/custom-chat.test.js`.

### Managing silhouettes

The Audience theme includes a **Silhouette library** below silhouette color.
Upload transparent PNGs (2 MB maximum, up to 2048 × 2048), rename them, and
use Enabled / Update silhouette to include or exclude them. Library changes
apply immediately and reach previews/live overlays within five seconds.
Choose Mixed furry crowd to include custom uploads. Image alpha defines the
shape, tinted with the configured silhouette color; crop transparent margins
for best results. Disable built-ins to use only uploaded characters.

The library and original uploaded PNGs persist under
`server/data/chat-silhouettes/`; preserve this directory in backups/deployments.
Disabling retains the asset. Each overlay session randomizes crowd positions
across the bottom of its canvas, with slight offsets allowing modest overlap.
Positions stay stable as messages arrive and scale with the canvas.

Audience silhouettes uses one Bubble color for every message. Left/right bubble colors remain available for Comic book and Soft bubbles.

Single recognized emotes render at 112px in a dedicated bubble. After a single emote, messages containing only repeats of that same emote from that chatter are suppressed. Different emotes or normal text reset the sequence; other chatters are unaffected. Emotes must be supplied by the chat source.

### Ignored accounts (all themes)

At the top of Custom Chat settings, use **Ignored users — all chat themes**.
Enter one account username per line, optionally prefixed with `@`, then save.
Matching ignores capitalization and checks both login and display name. The
same list applies to Comic book, Soft bubbles, and Audience silhouettes.
Saving removes matching current bubbles and audience characters. Removing a
name allows future messages again. Existing OBS browser sources need one
refresh after installing this code update; later list changes apply live.

Audience bubbles stay anchored above their characters when they overlap. Newer
bubbles layer over older bubbles instead of pushing them upward. Expiring
bubbles fade behind active bubbles.
