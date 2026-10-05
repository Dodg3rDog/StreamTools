# Twitch viewer commands

Streamer.bot action **StreamTools Twitch Whisper** handles Twitch > Chat > Bot
Whispers and Twitch > Chat > Chat Message. Replies use the connected bot account
`dodg3r_bot`. Streamer.bot must be running and connected to Twitch.

- `!chatsona`: whispers a private PNG upload link tied to the sender's Twitch ID.
  Uploads expire after 30 minutes, accept one static PNG up to 2 MB and 2048 ×
  2048, and enter the existing Discord staff review channel. The private link
  displays review status for seven days. Repeating the command refreshes the
  link and invalidates the earlier link. Approval replaces that viewer's image;
  a Twitch submission does not require a Discord account.
- `!commission` / `!commissions`: whispers a link to the current commission
  catalog and `https://discord.gg/gQcRdvDMJA`. Available in both public chat and
  whispers. This does not create a commission request or change approvals.

Commands have a 60-second per-viewer cooldown. Twitch may suppress whispers due
to privacy settings or platform limits; queue acceptance is not proof of
delivery. Chatsona decisions remain available on the private status page.

## Installation

The import is `streamerbot/StreamTools-Viewer-Intake.sb`; readable C# is in
`streamerbot/csharp/viewer-intake/StreamTools_Twitch_Whisper.cs`. It uses existing
persisted globals `st_apiBaseUrl` and `st_bearerToken`. Do not place secrets in
the import. The existing HTTP action bridge sends decision notifications back
to Streamer.bot. Its WebSocket configuration is unchanged.

The authenticated LAN endpoint is `POST /api/twitch/command`. Only trusted
Streamer.bot events should supply Twitch ID, username, and message. Do not
publish this endpoint through the tunnel.

## Public routing

The Cloudflare hostname is `bot.anthro-corp.com`, with service
`http://127.0.0.1:3030`. The required anchored path expression is:

```text
^/(api/chatsona/oauth/callback|chatsona/upload|api/chatsona/upload|commission-info)$
```

Keep the final `http_status:404` catch-all. Upload/status API calls require a
random link token; only its hash is stored. The token travels in the initial
URL fragment and subsequent Authorization headers, and is excluded from audit
records. The page removes the fragment from browser history; after a reload,
reopen the original whisper link. Do not share that link.

Verify `/admin/`, `/health`, `/api/twitch/command`, `/api/custom-chat/config`, and
`/` return 404 publicly. A missing upload token should return 403. The public
commission page reads the existing pricing catalog each request.

Local automated tests cover token rotation/expiry, identity validation, body
limits, origin checks, PNG validation, approval, notification routing, and
exclusive viewer ownership. Live Twitch delivery still needs a viewer test.
