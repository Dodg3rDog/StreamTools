# Widget and Overlay URL Reference

Use the production URLs below for OBS browser sources and other devices on the
local network.

- Production base: `http://192.168.1.131:3030`
- Local workshop base: `http://127.0.0.1:3055`

The workshop address only works on the machine running the workshop server and
only while that server is running. Replace the production base with the
workshop base when testing locally.

## Widgets

| Widget | Production URL |
| --- | --- |
| PiShock Status | `http://192.168.1.131:3030/widgets/pishock-status/` |
| Drawing Slot Machine | `http://192.168.1.131:3030/widgets/drawing-slot-machine/` |
| Code Break Protocol | `http://192.168.1.131:3030/widgets/chat-games/apps/code-break-protocol/` |
| Emote Sync Protocol | `http://192.168.1.131:3030/widgets/chat-games/apps/emote-sync-protocol/` |

The chat-game widgets accept `?controls=false` to hide their on-screen controls.

## PiShock Views

Add one of these query strings to the PiShock Status URL:

| View | Query string |
| --- | --- |
| Compact | `?mode=compact` |
| Mini | `?mode=mini` |
| Visual | `?mode=visual&transparent=true` |
| Console | `?mode=console&transparent=true` |
| Radial | `?mode=radial&transparent=true` |
| Gauge | `?mode=gauge&transparent=true` |
| Signals | `?mode=signals&transparent=true` |
| Viewer | `?mode=viewer&transparent=true` |
| Ticker | `?mode=ticker&transparent=true` |
| Stage | `?mode=stage&transparent=true` |

Other useful PiShock options are `transparent=true`, `boot=false`, and
`demo=true`. Join multiple options with `&` after the first `?`.

## Purchased Overlays

The files behind these URLs are private and excluded from Git.

| Overlay | Production URL |
| --- | --- |
| Nutty Shoutout Overlay | `http://192.168.1.131:3030/overlays/purchased/nutty-shoutout-overlay/` |
| Nutty's Ad Overlay | `http://192.168.1.131:3030/overlays/purchased/nuttys-ad-overlay/` |
| Nutty's Hype Train Widget | `http://192.168.1.131:3030/overlays/purchased/nuttys-hype-train-widget/` |
| Nutty's Twitch Poll Widget | `http://192.168.1.131:3030/overlays/purchased/nuttys-twitch-poll-widget/` |
| Nutty's Twitch Prediction Widget | `http://192.168.1.131:3030/overlays/purchased/nuttys-twitch-prediction-widget/` |
| Nutty's Twitch Status Update Widget | `http://192.168.1.131:3030/overlays/purchased/nuttys-twitch-status-update-widget/` |

## Management and Diagnostics

| Page | URL |
| --- | --- |
| Overlay Editor | `http://192.168.1.131:3030/overlays/editor/` |
| StreamTools Admin | `http://192.168.1.131:3030/admin/` |
| Server Health | `http://192.168.1.131:3030/health` |

Last route check: September 25, 2026. All URLs listed above returned HTTP 200.

## Admin server tools

See [Codex Server Operations](codex-server-operations.md) for the documented
SSH, file deployment, restart, verification, and rollback workflow.

Open `/admin/` and select **Server Tools** for health, version, uptime, and a
manual refresh. Health is polled from `/health` every 10 seconds using the same
host and port as Admin, so the workshop controls its own server.

After installing this change, stop the existing server once and relaunch it with
`npm start` from `server/` (or the existing `node server.js` command).
`npm run start:workshop` also uses the restart-capable launcher. Keep the launcher
running. Subsequent restarts can be requested with **Restart server** using the
existing Admin bearer token. The panel verifies a new instance returns online.

`POST /api/server/restart` requires `Authorization: Bearer <token>`, returns 202,
and drains HTTP requests for up to five seconds before replacing the server
process. Repeated requests during shutdown return 409; an unsupported launcher
returns 503. Widgets and bots briefly disconnect, and in-memory state resets.
Persistent configuration stays on disk. Health reports the HTTP process only,
not the connectivity of individual bot integrations. Unexpected crashes are
reported by the launcher and are not automatically retried.

Validation: `node --test server/tests/server-restart.test.js` from the repo root.

## Widgets and overlays in Admin

Select **Widgets & Overlays** in `/admin/` to search the built-in widgets and
installed overlays. The library includes Open and Copy OBS URL actions. PiShock
view, transparency, and boot options, plus chat-game controls, build the URL for
OBS without changing shared configuration.

Selecting an installed overlay loads the existing customization fields inside
Admin using its bearer token. **Start / reload preview** loads the preview on
demand; Emulate, zoom, Fit, Grid, and volume controls operate on that preview.
**Save changes** writes the overlay configuration; **Discard changes** reloads
saved settings. Switching items or Admin sections checks for unsaved changes.
Reload the OBS browser source if saved settings do not appear automatically.
The standalone `/overlays/editor/` remains available.

## Discord Bot workspace

Admin groups Overview, Redeems, Commission Docs, Commission Forms, and Howler
under **Discord Bot**. Points remains a separate shared integration tool.
Overview and Howler status refresh every 15 seconds while their tabs are open.

Howler displays its command, duration, configured channels and roles, active
confinements, original voice channels, and pending restoration retries.
**Release now** and **Retry restoration** require the Admin bearer token and a
confirmation. They use the existing restoration logic; concurrent releases for
the same member are coalesced. Exempt roles and default duration are editable in Admin; channels and the confinement role remain server-configured.

API: authenticated `GET /api/discord/admin/status` and
`POST /api/discord/admin/howler/release` with `guildId` and `userId`.


Howler **Default settings** supports adding/removing exempt roles by name or ID
and setting a duration from 30 to 86400 seconds. Save applies immediately to new
confinements; existing records retain their release times. Admin saves overrides
in `server/data/discord/voice-confinement-settings.json`. Back up this file with
other runtime data. Until the first save, the existing environment settings are
used. After saving, these two values override their environment counterparts.

Authenticated endpoint: `PUT /api/discord/admin/howler/settings` with
`durationSeconds` (integer) and `exemptRoleIds` (array of Discord role ID strings).

## Custom Chat

Admin → Widgets & Overlays → **Custom Chat** provides the comic speech-bubble
editor and sample preview. OBS URL: `http://192.168.1.131:3030/widgets/custom-chat/`
Suggested size: **600 × 900**. See [Custom Chat setup](custom-chat.md) for the
Streamer.bot connection and configuration storage.

## Public viewer tools

- Commission information: `https://bot.anthro-corp.com/commission-info`
- Chatsona upload: `https://bot.anthro-corp.com/chatsona/upload` (open the private link whispered by the bot)
- Discord OAuth redirect: `https://bot.anthro-corp.com/api/chatsona/oauth/callback`

Cloudflare publication is live and the server's `CHATSONA_PUBLIC_URL` is
`https://bot.anthro-corp.com`. The Discord redirect was saved by the administrator.
Verified: viewer pages return 200, missing upload tokens return 403, and admin,
health, private command APIs, and the root path return 404 publicly.
The existing `chatsona.anthro-corp.com` callback route is retained during migration.
See [Twitch viewer commands](twitch-viewer-intake.md).
