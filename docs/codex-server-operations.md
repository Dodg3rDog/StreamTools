# Codex Server Operations

This document explains how a Codex coding agent working in this repository can
inspect, update, and operate the live StreamTools server. It records the current
LAN deployment workflow without storing credentials or other secrets in Git.

## Current environment

| Item | Value |
| --- | --- |
| Local repository | `C:\StreamTools\Repos\StreamTools` |
| Server SSH host | `192.168.1.131` |
| Server SSH user | `dodger` |
| Live application root | `/opt/streamtools` |
| Production HTTP base | `http://192.168.1.131:3030` |
| Health endpoint | `http://192.168.1.131:3030/health` |
| Systemd service | `streamtools-app.service` |

These are private LAN addresses and paths. If the server address, account, or
installation directory changes, update this document and
[`widget-urls.md`](widget-urls.md) together.

## How Codex access works

Codex does not have an independent server account or a hidden management
connection. It operates through commands run from the user's Windows workstation:

1. The terminal tool starts PowerShell commands in the local workspace.
2. The installed OpenSSH client provides `ssh` and `scp`.
3. `ssh` runs a command on the Linux server as `dodger`.
4. `scp` transfers a local file to or from the server.
5. Authentication is supplied by the workstation's normal SSH configuration,
   key agent, or interactive password prompt. Credentials are not stored in this
   repository and should not be pasted into source files or documentation.

The Codex execution sandbox may require user approval before a network command
such as `ssh` or `scp` is allowed. Approval grants the requested command access;
it does not disclose the SSH password or private key to the repository.

Codex can run ordinary commands that the `dodger` account is authorized to run.
Commands requiring elevated Linux privileges still require the server's normal
`sudo` authorization. Codex does not bypass SSH, filesystem, or `sudo` security.

## Basic server access

Open an interactive server shell from PowerShell:

```powershell
ssh dodger@192.168.1.131
```

Run one non-interactive command without opening a persistent shell:

```powershell
ssh dodger@192.168.1.131 "cd /opt/streamtools && pwd && ls"
```

Inspect the application service:

```powershell
ssh dodger@192.168.1.131 "systemctl status streamtools-app.service --no-pager"
```

Follow live server activity:

```powershell
ssh dodger@192.168.1.131 "journalctl -u streamtools-app.service -f"
```

Add `sudo` only when the server requires it. An interactive password prompt may
appear according to the server's configured sudo timeout.

## File mapping

Local source files normally map directly beneath `/opt/streamtools`:

| Local path | Live path |
| --- | --- |
| `server/...` | `/opt/streamtools/server/...` |
| `public/...` | `/opt/streamtools/public/...` |
| `.env` | `/opt/streamtools/.env` |

The preferred editing workflow is:

1. Read and edit the local repository copy.
2. Run the relevant local tests and syntax checks.
3. Back up each live file that will be replaced.
4. Upload only the tested files with `scp`.
5. Restart the application if the changed code requires it.
6. Verify health and the affected integration.

Avoid editing live source files in place because that makes the server diverge
silently from the local working copy. Do not upload `.env`, `server/data/`, or
private purchased-overlay files as part of a general source deployment. Those
contain machine-specific, persistent, secret, or licensed content.

## Safe deployment example

The following example deploys a changed service file. Replace the paths and the
backup label with values appropriate to the change.

Run validation from the repository first:

```powershell
cd C:\StreamTools\Repos\StreamTools\server
node --check services/voiceConfinement.js
node --test
```

Back up the live file before replacing it:

```powershell
ssh dodger@192.168.1.131 "cp /opt/streamtools/server/services/voiceConfinement.js /opt/streamtools/server/services/voiceConfinement.js.bak-pre-change-YYYYMMDD"
```

Upload the tested local file:

```powershell
cd C:\StreamTools\Repos\StreamTools
scp server/services/voiceConfinement.js dodger@192.168.1.131:/opt/streamtools/server/services/voiceConfinement.js
```

Multiple files going to the same directory can be sent in one command:

```powershell
scp public/admin/index.html public/admin/admin.js dodger@192.168.1.131:/opt/streamtools/public/admin/
```

Use separate `scp` commands when destination directories differ. Do not deploy
the entire repository merely to update one or two files.

## Restarting StreamTools

### Preferred authenticated restart

When StreamTools is healthy, use its supervised restart endpoint. The bearer
token remains in the ignored local `.env` file and must not be printed:

```powershell
cd C:\StreamTools\Repos\StreamTools
$line = Get-Content .env | Where-Object { $_ -match '^BEARER_TOKEN=' } | Select-Object -First 1
$token = $line.Substring($line.IndexOf('=') + 1).Trim().Trim('"').Trim("'")
Invoke-RestMethod `
  -Uri 'http://192.168.1.131:3030/api/server/restart' `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" }
```

This endpoint returns HTTP 202 when the supervised launcher accepts the
restart. Widgets and bot integrations disconnect briefly while the child
process is replaced.

### Manual service restart

Use systemd when the HTTP server is unavailable or its launcher cannot restart:

```powershell
ssh dodger@192.168.1.131 "sudo systemctl restart streamtools-app.service"
```

This may request the Linux account password. Do not place that password in a
command, script, `.env`, chat message, or committed file.

## Verification

Check basic HTTP health after every restart:

```powershell
Invoke-RestMethod -Uri 'http://192.168.1.131:3030/health'
```

A healthy response has `ok: true`. When checking a restart, capture the
`instanceId` before and after; a changed value confirms that a new application
process started.

For authenticated Discord and Howler status, reuse the bearer token loaded in
the restart example:

```powershell
Invoke-RestMethod `
  -Uri 'http://192.168.1.131:3030/api/discord/admin/status' `
  -Headers @{ Authorization = "Bearer $token" }
```

Verify the feature itself as well as `/health`. HTTP health only proves that the
web process is running; it does not prove Discord, Streamer.bot, Twitch, or an
overlay connection is ready. Review service activity when startup is unclear:

```powershell
ssh dodger@192.168.1.131 "journalctl -u streamtools-app.service -n 100 --no-pager"
```

## Rollback

If a deployment fails, restore the specific backup rather than overwriting
unrelated server files:

```powershell
ssh dodger@192.168.1.131 "cp /opt/streamtools/server/services/voiceConfinement.js.bak-pre-change-YYYYMMDD /opt/streamtools/server/services/voiceConfinement.js"
```

Then restart StreamTools and repeat the health and integration checks. Keep the
local failed change available for diagnosis; do not erase unrelated local or
server changes.

## Operational safety rules

- Never commit or display real bearer tokens, Discord tokens, OAuth secrets,
  passwords, private keys, or purchased overlay source.
- Inspect the current local Git status before editing or deploying. The working
  tree may contain unrelated user changes that must be preserved.
- Back up live files before overwriting them and use descriptive backup names.
- Prefer targeted uploads and targeted rollbacks over recursive copies.
- Do not replace live `.env` or persistent `server/data/` content unless the
  task explicitly requires and validates that change.
- Avoid destructive commands such as recursive deletion, `git reset --hard`,
  and blind directory replacement.
- Use the authenticated application endpoint for routine restarts and systemd
  only when necessary.
- Confirm both process health and feature readiness before declaring a server
  change complete.
