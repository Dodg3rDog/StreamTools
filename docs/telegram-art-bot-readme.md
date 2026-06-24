# Telegram Art Bot Notes

The Telegram bot is a separate StreamTools service from the Discord bot. It uses the Telegram Bot API through long polling and does not require a new npm package.

## Purpose

- Support an art-focused Telegram group.
- Let people start commission interest from Telegram without posting request details publicly.
- Store Telegram commission requests in a local SQLite bridge table so the Discord commission portal can import them later.

## Environment

```text
ENABLE_TELEGRAM_BOT=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_ART_GROUP_ID=
TELEGRAM_ADMIN_USER_IDS=
TELEGRAM_SQLITE_PATH=
TELEGRAM_POLL_TIMEOUT_SECONDS=30
```

`TELEGRAM_ADMIN_USER_IDS` is a comma-separated list of Telegram numeric user IDs.

Default SQLite path:

```text
server/data/telegram/telegram-bot.sqlite
```

## Current Commands

```text
/ping
/help
/commission
/pendingcommissions
```

`/commission` in a group replies with a private bot-chat link. This keeps commission details out of the public art group.

`/commission` in a private chat starts a button-based intake:

1. Commission type
2. Completion level
3. SFW/NSFW
4. Public/private
5. Freeform request details

Completed requests are saved with status `pending_discord_import`.

`/pendingcommissions` is admin-only and shows the oldest pending Telegram requests.

## Discord Bridge

Telegram requests are saved in the `telegram_commission_requests` table. The Discord commission portal can later import from this table and create normal Discord commission request records.

The bridge intentionally stores quoted/intake data separately from Discord commission records until staff imports it. This keeps Telegram intake from mutating the stable Discord workflow automatically.

## Next Steps

- Add a Discord staff command to import a Telegram request by ID.
- Add media/reference capture from Telegram messages.
- Add art-channel posting tools for finished work and announcements.
- Add a public group welcome/help message.
