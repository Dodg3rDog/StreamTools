# Chatsona viewer submissions

Chatsona is an isolated module in the existing Howler bot. Manual viewer images
are available in Admin > Widgets & Overlays > Custom Chat > Audience silhouettes >
Silhouette library. Enter a Twitch login before uploading, or assign an existing
upload using its Twitch owner field and Update silhouette. Blank ownership means
a general crowd image. Assigning an image disables earlier images for that viewer
without deleting the originals. Viewer-owned images retain their original colors;
they are excluded from decorative crowds and other viewers' random bubble targets.
Verified submissions match Twitch numeric user IDs; manual entries match login.

## Discord flow

1. In channel `1554196413758443540`, a viewer types `!chatsona`.
2. The bot opens a private, non-invitable thread and adds that viewer. Server staff
   with Manage Threads can still see private threads, as Discord permits.
3. Verify Discord connection opens Discord OAuth with `identify connections`.
   Successful verification redirects the browser back to the request's Discord thread.
   The authorizing Discord account must match the request owner. Exactly one
   verified, non-revoked Twitch connection is required. Tokens are revoked after
   lookup and are not saved. Links expire after 15 minutes and are single-use.
4. The viewer uploads one static PNG, maximum 2 MB and 2048 x 2048 pixels. The
   server checks dimensions, CRC, and full decoding; APNG and corrupt files fail.
5. The bot posts the image with Approve / Deny buttons in `1554195970009464922`.
   Anyone with View Channel access there can approve or deny; control access with Discord channel roles.
6. Approval updates the viewer's library assignment. Approval and denial both
   notify the private thread and attempt a DM. Closed DMs do not undo approval.
7. Threads are kept unarchived and deleted seven days after creation (not seven
   days after approval). Cleanup resumes after downtime. Originals and audit
   records are retained. Completed requests can be replaced with a new !chatsona.

## Required public verification setup

The bot token cannot read other users' Discord Connections. Configure:

- `CHATSONA_PUBLIC_URL=https://bot.anthro-corp.com`
- `DISCORD_CLIENT_SECRET` from the existing bot application's OAuth2 settings.
- Existing `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, and `DISCORD_TOKEN`.

Register exactly `https://bot.anthro-corp.com/api/chatsona/oauth/callback` in the
Discord application's OAuth2 redirect URLs. Route that path over HTTPS to this
server; exposing Admin or the other server endpoints is not necessary. Configure
proxy access logs to omit callback query strings. The app itself skips callback
access logging. Restart streamtools-app after changing environment settings.
Never put the client secret in the Admin browser or a public URL.

Until public URL and secret are configured, verification reports that setup is
pending and no viewer uploads are accepted. Manual assignment works independently.

## Persistence and recovery

Back up `server/data/discord/chatsona/` and `server/data/chat-silhouettes/`.
Requests and pending PNGs persist on disk with atomic record-file replacement.
Approval uses the request ID as an idempotency key. On restart, approvals in
progress finish, missing review posts retry, and undelivered notifications retry.

Channel `682419465560129550` receives bot-authored audit snapshots and image
attachments. OAuth secrets/state hashes are excluded. If requests.json is missing,
startup scans that log for the newest snapshot per request and reconstructs state,
including approved viewer images missing from the library. Recovery accepts only
this bot's messages in that configured guild/channel. A recovery marker ensures
an interrupted scan is retried. Keep Discord logs and image attachments intact;
if those have also been removed, recovery requires a filesystem backup. A corrupt
(nonmissing) JSON file stops Chatsona startup so staff can restore a backup rather
than silently discard records. Other bot features remain available.

Tests: `node --test server/tests/chatsona*.test.js server/tests/chat-silhouettes.test.js`.
The automated workflow uses mocked Discord/OAuth services, including review,
notifications, ownership, retention, and audit restoration. A real viewer OAuth
round-trip remains a deployment acceptance check once public setup is complete.

## Selected Cloudflare hostname

DNS is managed by Cloudflare for anthro-corp.com. Use the dedicated hostname
`chatsona.anthro-corp.com`; do not alter the root domain or existing website.
The planned tunnel runs on StreamTools and forwards only the exact path
`/api/chatsona/oauth/callback` to `http://127.0.0.1:3030`. Every other path
must return 404. No router port forwarding is needed.

A locally managed configuration template is in
`deploy/chatsona/cloudflared.yml.example`. Replace its tunnel UUID/credentials
placeholders before use. If managing the tunnel in Cloudflare's dashboard instead,
set this exact hostname and anchored path regex in the published route and retain
a final HTTP 404 fallback. Never publish a catch-all route to port 3030.

Before declaring setup complete, validate callback reachability and verify that
`/admin/`, `/health`, `/api/custom-chat/config`, and `/` return 404 from the public
hostname. Register the exact HTTPS callback URL with the Discord application,
configure the client secret privately on the server, then test a real OAuth flow.

Deployment progress: the remotely managed Cloudflare tunnel is
`streamtools-chatsona` (`7fc3e57f-252b-413f-a0e4-8d07180ba112`). Its only published
route is the exact callback path; the catch-all returns 404. Verified externally:
callback reaches StreamTools (400 for missing/expired OAuth state), while /admin/, /health,
/api/custom-chat/config, and / return 404.

The connector is installed at `/home/dodger/.local/bin/cloudflared`, with its token
in `/home/dodger/.config/cloudflared/chatsona.token` (0600). It uses the systemd user
unit `chatsona-tunnel.service`. Verified `Linger=yes` and service active after
enabling linger so the user service can survive logout/reboot.

The OAuth client secret is configured; Discord accepted the credentials and
StreamTools reports OAuth configured. The exact Discord callback URL is saved
and was verified to persist after a developer portal page reload.
A real viewer verification/upload/review remains to be tested. To
store the secret without echoing it, run on StreamTools:
`python3 /opt/streamtools/server/scripts/configure-chatsona-oauth.py`.
The helper makes a protected .env backup, writes the secret and public URL,
then requests the existing authenticated application restart endpoint.

## General bot hostname migration

The live public base is `https://bot.anthro-corp.com`. The administrator saved
`https://bot.anthro-corp.com/api/chatsona/oauth/callback` in Discord's OAuth
redirects. Cloudflare publishes only the four routes in
`deploy/chatsona/cloudflared.yml.example`, and the server has been restarted
with the new `CHATSONA_PUBLIC_URL`. The older hostname above describes the
original callback-only deployment; its callback route remains available.
Viewer pages return 200, a missing upload token returns 403, and a missing
OAuth state returns 400. Admin, health, private command APIs, and `/` return
404 publicly. See `twitch-viewer-intake.md`.

### Deleting library images

In Manage silhouette library, uploaded images have a **Delete image** button
in both tile and list views. Confirmation is required. Deletion removes the
library image and assignment; it does not reactivate an older viewer image.
Built-in silhouettes can be disabled instead. Connected overlays refresh the
collection within five seconds. Submission images/audit records are retained.
The library stores deletion markers to prevent normal startup recovery and
approval retries from restoring deleted entries. Back up library.json with
other runtime data; losing deletion markers can allow audit recovery to restore
previous approvals. The API is authenticated `DELETE /api/custom-chat/silhouettes/:id`.
