# StreamTools To Do

## How To Maintain This Document

Use this document for lightweight reminders, planning notes, and follow-up tasks across StreamTools projects. Keep entries grouped by project, then by topic when useful. Prefer short actionable bullets that start with a verb. If a task has important context, add one brief indented note after the bullet. When Codex reviews this file later, it should preserve the existing grouping, add new items under the most relevant project/topic, and avoid deleting completed items unless explicitly asked.

Suggested format:

```text
## Project Name

### Topic

- Action item.
  Context or decision notes, if needed.
```

## Commission Portal

### Manual Entry

- Design a staff-only manual commission entry method.
  This should let staff enter a commission form manually for clients who submit details outside Discord.

### Client Messaging

- Review the cancellation notice messages sent to clients for active commissions.

### Logging And Privacy

- Create a more robust logging system so internal comments are not saved to the client-facing commission form.
- Investigate whether internal notes can be redacted or hidden from certain roles.

### Invoices And Cross-Service Tracking

- Consider issuing an invoice number for each commission.
  This could also be used with services such as PayPal or Ko-fi and would make logs and related commission details easier to locate across Discord, Trello, and payment channels.

### Trello Sync

- Wire Discord tag progress to Trello checklist completion.
  Define which checklist items should be marked complete when each commission tag is added or progresses.

### External Intake Options

- Explore Telegram as a pre-payment external intake option.
  Telegram could guide non-Discord clients through intake questions, collect references, and create an internal Discord tracking thread without requiring upfront payment.
- Keep Ko-fi as a possible payment layer after approval rather than the primary intake method.

## Telegram Art Bot

### Setup

- Create the Telegram bot through BotFather and add the token to `.env`.
- Add the bot to the art group and use `/chatid` to capture the group ID.
- Add Telegram admin user IDs to `.env`.
- Decide the public group welcome/help copy.

### Commission Bridge

- Test the private `/commission` Telegram intake flow.
- Add Discord-side import tooling for pending Telegram commission requests.
  Telegram requests are stored locally with status `pending_discord_import` until staff imports them.
- Decide how Telegram media/reference uploads should be stored and carried into Discord.

### Art Channel Features

- Design posting tools for finished art, WIP previews, and announcements.
- Decide how NSFW or private work should be handled on Telegram.
