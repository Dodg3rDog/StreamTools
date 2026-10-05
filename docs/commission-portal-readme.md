# Commission Portal Bot Planning Notes

This document captures the current Discord/Trello commission portal plan so the setup can be referenced later without re-collecting IDs or workflow decisions.

Editable message copy is tracked separately in `docs/commission-portal-copy.md`.

## Architecture Decision

- Use the existing Discord bot account and token.
- Add the commission portal as a separate module inside the same bot runtime.
- Keep commission portal code isolated from stream tooling features.
- Discord forum tags are the source of truth for workflow state because they are more granular than Trello labels.
- Trello mirrors the Discord state as a broader production dashboard/archive.
- Prefer buttons, modals, tags, and reactions for client-facing workflows.
- Keep slash commands staff/admin-only for setup, repair, or manual override actions.

## Discord Channel Structure

### Commission Request

- Category: `1513219882479653036`
- Terms of Service: `1513273071740653680`
- Pricing: `1513273123670327368`
- Submit request: `1513273302699868161`
- Commission logging channel: `1513316071363444788`
- Feedback log forum channel: `1514032732571963514`
- Feedback log thread: `1514032924637532201`

The Submit request channel will hold a persistent bot message with a Request Commission button. Clicking the button starts the intake flow.

### Workflow Categories

- Commission's Pending: `1513273729348538439`
- Commission's in Progress: `1513273895908671509`
- Commission's Completed 2026: `1513274138066812928`
- Trash Category: `1513277018354221237`

Completed categories should be yearly. If a completed category for the current year does not exist, the bot should create it and grant access to the configured staff/admin roles.

### Templates

- Templates category: `1513244019839205509`
- Client Forum Template: `1513244710389547058`

The bot should copy or clone the Client Forum Template when creating a new client forum. The template should contain the desired base permissions, forum tags, thread defaults, archive settings, and staff/bot access.

## Pricing Catalog

Editable pricing source:

```text
server/config/discord/commission-pricing.json
```

The pricing channel is generated from this structured catalog, not from old commission records. Updating this file while the bot is running will refresh the pricing channel after the configured watch interval.

Staff can also run `/commission-publish-pricing` to publish the current catalog immediately.

Publishing edits the bot-owned pricing messages recorded in SQLite. Existing quoted commission line items should be stored separately and should not be recalculated or changed when the catalog is updated.

Useful env overrides:

```text
COMMISSION_PRICING_CATALOG_PATH=
COMMISSION_TOS_CATALOG_PATH=
COMMISSION_PDF_LOGO_PATH=
COMMISSION_PRICING_WATCH_INTERVAL_MS=
```

## Discord Users And Roles

- Owner/user DM target: `406173537498562560`
- Client role: `1513274565978099792`
- Staff/admin roles:
  - `845157373038297109`
  - `1493074430513909833`
  - `1513217100095815761`

Staff/admin roles can manage commissions and should be allowed to use staff-only actions, such as importing a Discord attachment to Trello with the paperclip reaction.

When a user starts an intake, the bot should check whether they have the Client role. If not, it should assign the Client role before creating or reusing their private client forum.

## Discord Forum Tags

```text
In Queue: 1513246461394157728
WIP: 1513247479972237383
On Hold: 1513247648251908359
Completed: 1513247787427303626
1/2 Payment Received: 1513248464660729876
Paid in Full: 1513248569287512104
Installment Plan: 1513248913379823841
Canceled: 1513249708653412433
Rejected: 1513249821543239781
Meeting Required: 1513250392383946863
Sketch Approved: 1513250706054844516
Line Art Approved: 1513250834144559174
Flats & Shading Approved: 1513250914990035056
Full Render Approved: 1513256454327504936
Painting Approved: 1513251110524162281
Waiting Sketch Approval Pending: 1513252349521559852
Waiting Line Art Approval Pending: 1513252466672664769
Waiting Flats/Shading Approval Pending: 1513252668125221045
Waiting Full Render Approval Pending: 1513256641317834812
Waiting Painting Approval Pending: 1513252756335493190
```

Note: confirm the Discord display name for Painting Approved is spelled correctly.

## Trello Board

- Board name: Commission / Project Queue
- Board ID: `69c9d52f22535449b96ef3aa`
- Board URL: `https://trello.com/b/2YualSS7/commission-project-queue`

Trello API key and token should be stored in `.env` only. Do not commit or share them.

Privacy boundary: Trello cards should not include Discord user IDs, Discord thread URLs, private commission flags, client availability, timezone, or full request details. Trello should only receive the card title and minimal operational summary needed for tracking.

## Trello Lists

```text
In Queue: 69c9d53022535449b96ef3bf
In Progress: 69c9d53022535449b96ef3c0
Completed: 69c9d53022535449b96ef3c1
```

## Trello Card Templates

```text
Template - Line Art Commission: 6a25bd0e00f525cb9a301fe3
Template - Flats / Shading Commission: 6a25c03ea6701941a29aa316
Template - Full Render Commission: 6a25c0e094274ba72e1eb86f
Template - Painted Commission: 6a25c1a681e045210b2f8605
```

Level of completion mapping:

```text
Line Art -> Template - Line Art Commission
Flats w/ Shading -> Template - Flats / Shading Commission
Full Render -> Template - Full Render Commission
Painted Illustration -> Template - Painted Commission
Other -> staff review required before selecting a template
```

## Trello Labels

```text
Completed: 69c9d53022535449b96ef3c6
WIP: 69c9d53022535449b96ef3c7
Canceled: 69c9d53022535449b96ef3c8
Awaiting Client Response: 69c9d53022535449b96ef3c9
Paid: 69c9d53022535449b96ef3cb
Installment Plan: 6a25bf20a3715635e33d63ae
Meeting Required: 6a25bf5063e909352680ea65
1/2 Payment Received: 69c9d53022535449b96ef3ca
On Hold: 69c9d7def059333cd0814609
Rejected: 6a25bf0602f55c254dc327d0
```

## Discord To Trello Label Mapping

```text
Discord Completed -> Trello Completed
Discord WIP -> Trello WIP
Discord On Hold -> Trello On Hold
Discord 1/2 Payment Received -> Trello 1/2 Payment Received
Discord Paid in Full -> Trello Paid
Discord Installment Plan -> Trello Installment Plan
Discord Canceled -> Trello Canceled
Discord Rejected -> Trello Rejected
Discord Meeting Required -> Trello Meeting Required and Awaiting Client Response
Any Discord waiting approval tag -> Trello Awaiting Client Response
```

Discord approval-specific tags are intentionally more granular than Trello. Trello should use Awaiting Client Response as the catch-all label for pending approvals or meeting-required states.

## Source Of Truth Rules

- Discord forum tags are canonical.
- Discord tag changes sync to Trello through Discord thread update events after a short debounce, so quick tag edits settle before Trello is updated.
- Discord thread titles are prefixed with status icons from key tags:
  - `⏳` In Queue
  - `🛠️` WIP
  - `🤝` Meeting Required
  - `✅` Completed
  - `🚫` Rejected
  - `❌` Canceled
- Trello can be polled on a schedule, such as every 4 hours, for manual changes.
- Trello changes should only update Discord when the mapping is safe and explicit.
- If Trello and Discord disagree, Discord wins.

Suggested list mapping:

```text
Discord In Queue -> Trello In Queue
Discord WIP -> Trello In Progress
Discord Completed -> Trello Completed
Discord Canceled -> archive Trello card with Canceled label
Discord Rejected -> archive Trello card with Rejected label
```

## Client Intake Flow

The Submit request channel should contain a persistent bot message with a Request Commission button.

Suggested flow:

1. Client clicks Request Commission.
2. Bot shows required acknowledgements.
3. Client confirms:
   - They are 18+.
   - All depicted characters are 18+.
   - They accept the Terms of Service.
   - Discord is the primary communication method.
   - No response for more than 14 days may trigger the abandonment section of the ToS.
4. Bot collects commission type, level of work, and SFW/NSFW through buttons.
5. If Other is selected for commission type or level of work, bot prompts for a short text explanation.
6. Bot asks the client to select the days they are usually available through buttons.
7. Bot collects preferred handle, request details, contact time range, and timezone through a modal.
8. Bot creates or reuses a private client forum from the Client Forum Template in Commission's Pending.
9. Bot creates an intake post/thread.
10. Bot asks the client to upload references, images, color swatches, links, and other supporting material in the thread.
11. Client clicks Done Uploading when finished.
12. Bot locks the request post/thread and posts an awaiting review message.
13. Staff Approve/Reject buttons appear only after the request is awaiting review.
14. Bot notifies the owner/staff for review.
15. After staff approval, bot deletes the staff review controls, unlocks the thread, posts an accepted confirmation, creates a Trello card from the selected template, and moves the client forum to Commission's in Progress.

Client forum naming:

```text
Preferred name or handle supplied by the client
```

Forum post/thread title format:

```text
Commission Type | Level of work | SFW or NSFW
```

If an active forum post already has the same title, the bot may append a short request suffix to prevent duplicate-title issues.

## Intake Form Fields

Commission type:

```text
Headshot / Profile photo
Half-body
Full-body
Emote
Reference Sheet
Character Creation
YCH
Other
```

YCH should prompt for a YCH post link or a description of which YCH is being referenced.

Other should prompt for details about the requested work or medium and be marked for staff review/quote.

Level of completion:

```text
Line Art
Flats w/ Shading
Full Render
Painted Illustration
Other
```

Other should be reviewed and quoted by staff.

Other requested fields:

```text
Detailed request description
Timezone
Best contact times
Available days
Best contact start/end time
Timezone
Personal or commercial use
Mature content yes/no
Private commission yes/no
Public work permission
Final posting permission
Preferred invoice email
```

Do not include budget range or deadline in the client intake. Estimated completion date should be staff-entered after initial review.

The form should indicate that an initial Discord call is preferred when possible so ideas can be discussed and sketched live with the client.

## Public Work Permission

Suggested options:

```text
Yes, public work is okay
Ask me before sharing WIPs
Only after final approval
No, keep this commission private
```

Final posting permission should be tracked separately:

```text
Yes, with credit
Yes, anonymously
Only after a specific date
No, private commission
```

## Approval Workflow

The commission workflow should be treated as a state machine. Discord tags remain the source of truth, and Trello cards/checklists mirror that state.

Recommended state flow:

```text
Accepted / In Queue
  Staff confirms scheduling or start-work trigger
  -> Initial vision meet-up complete
  -> Sketch in progress complete
  -> remove In Queue
  -> apply WIP

WIP
  Staff reacts to an uploaded image with 🔎 or 🔍
  -> bot asks staff: Request Approval or Ask Client Question

Request Approval
  Bot determines current stage from checklist/tag progress
  -> apply the matching waiting approval tag
  -> check the matching "pending approval" Trello checklist item
  -> ping client in thread
  -> DM client with review request
  -> show client Approve / Request Changes buttons

Client Approves
  -> remove the matching waiting approval tag
  -> apply the matching approved tag
  -> check the matching "approved" Trello checklist item
  -> if Sketch is approved, ask staff to confirm initial payment before advancing
  -> otherwise check the next "in progress" Trello checklist item when applicable

Initial Payment Checkpoint
  Staff chooses Confirm Payment Received or No Payment Needed
  -> check Initial payment received
  -> check the next work item:
     Line Art / Flats / Full Render: Line art in progress
     Painted Illustration: Painting in progress

Client Requests Changes
  -> ask client for details
  -> ask for marked-up reference upload if helpful
  -> replace waiting approval tag with On Hold
  -> DM owner/staff with thread link and requested changes summary
  -> document the requested changes in the thread

Ask Client Question
  Staff provides the question through a modal
  -> ping client in thread
  -> DM client with the question and attachment/message link
  -> relay client DM replies back to the commission thread

Meeting Required
  -> apply Meeting Required
  -> apply or keep On Hold when appropriate
  Staff confirms meeting complete
  -> remove Meeting Required
  -> remove On Hold if no other blocker remains
  -> check Initial vision meet-up if not already complete
  -> apply WIP if work is starting
```

The negative option for stage reviews should be labeled Request Changes, not Reject. Rejected should remain reserved for rejecting or terminating the overall commission.

When one of the waiting approval tags is applied, the bot should ping the client in the relevant forum thread and ask them to review the current progress.

Use buttons rather than text commands:

```text
Approve
Request Changes
Request Call
```

Approval mapping:

```text
Waiting Sketch Approval Pending
  Approve -> Sketch Approved
  Request Changes -> On Hold
  Request Call -> Meeting Required

Waiting Line Art Approval Pending
  Approve -> Line Art Approved
  Request Changes -> On Hold
  Request Call -> Meeting Required

Waiting Flats/Shading Approval Pending
  Approve -> Flats & Shading Approved
  Request Changes -> On Hold
  Request Call -> Meeting Required

Waiting Full Render Approval Pending
  Approve -> Full Render Approved
  Request Changes -> On Hold
  Request Call -> Meeting Required

Waiting Painting Approval Pending
  Approve -> Painting Approved
  Request Changes -> On Hold
  Request Call -> Meeting Required
```

When Request Changes or Request Call is chosen:

- Apply On Hold for requested changes.
- Apply Meeting Required if the client requests a call or the issue needs discussion.
- Keep or apply Trello Awaiting Client Response.
- Prompt the client to describe requested changes.
- Ask the client to upload a marked-up copy of the image if helpful.
- Allow them to indicate that they want an audio call.
- DM the owner with a link to the forum thread and a summary.

When Approve is chosen:

- Replace the pending approval tag with the matching approved tag.
- Document the approval in the thread.
- Check the matching Trello approval checklist item.
- Check the next in-progress Trello checklist item when applicable.
- Remove Trello Awaiting Client Response if no other pending approval or meeting-required state remains.
- If the approval stage requires payment before work proceeds, start the payment/invoice workflow.

Approval checklist progression should be additive. Once a Trello checklist item is checked by workflow progress, removing a Discord tag should not automatically uncheck the Trello item unless a future repair/override tool explicitly supports that.

## Trello Checklist Workflow

Template checklist items currently in use:

```text
Line Art:
Initial vision meet-up
Sketch in progress
Sketch pending approval
Sketch approved
Initial payment pending
Initial payment received
Line art in progress
Line art pending approval
Line art approved
Pending final payment
Payment received - Order delivered

Flats w/ Shading:
Line Art items plus:
Flats & Shading in progress
Flats & Shading pending approval
Flats & Shading approved

Full Render:
Flats w/ Shading items plus:
Full render in progress
Full render pending approval
Full render approved

Painted Illustration:
Initial vision meet-up
Sketch in progress
Sketch pending approval
Sketch approved
Color scheme approved
Initial payment pending
Initial payment received
Painting in progress
Painting pending approval
Painting approved
Pending final payment
Payment received - Order delivered
```

Suggested checklist mapping:

```text
Start work / meeting complete trigger
  -> Initial vision meet-up
  -> Sketch in progress
  -> Discord: remove In Queue, apply WIP

Waiting Sketch Approval Pending
  -> Sketch pending approval

Sketch Approved
  -> Sketch approved
  -> Initial payment pending

Initial payment confirmed / no payment needed
  -> Initial payment received
  -> next item:
     Line Art / Flats / Full Render: Line art in progress
     Painted Illustration: Painting in progress

Waiting Line Art Approval Pending
  -> Line art pending approval

Line Art Approved
  -> Line art approved
  -> next item:
     Flats w/ Shading: Flats & Shading in progress
     Full Render: Flats & Shading in progress
     Line Art: Pending final payment

Waiting Flats/Shading Approval Pending
  -> Flats & Shading pending approval

Flats & Shading Approved
  -> Flats & Shading approved
  -> next item:
     Full Render: Full render in progress
     Flats w/ Shading: Pending final payment

Waiting Full Render Approval Pending
  -> Full render pending approval

Full Render Approved
  -> Full render approved
  -> Pending final payment

Waiting Painting Approval Pending
  -> Painting pending approval

Painting Approved
  -> Painting approved
  -> Pending final payment

Pending final payment
  -> ask staff whether final payment was received
  -> if received, ask whether completed work was delivered
  -> if not delivered, ask staff why and leave a Delivery Complete button
  -> when delivered, check Payment received - Order delivered
  -> apply Paid in Full and Completed
  -> lock the post
  -> check the client forum for any remaining In Queue or WIP posts
  -> if none exist, move the client forum to the completed category
  -> send client thank-you and feedback request

Feedback request:
  Communication: 1-5
  Timeliness: 1-5
  Quality of Work: 1-5
  Overall Satisfaction: 1-5
  Experience with the automated process: 1-5 plus optional comments
  Submitted feedback is recorded in the central feedback log thread.
  Client can react with ⏭️ to skip, which deletes the feedback DM.
  Skipped feedback is also recorded in the central feedback log thread.

1/2 Payment Received
  -> Initial payment received

Paid in Full
  -> Payment received - Order delivered

Completed
  -> Payment received - Order delivered
```

## Rejected Pending Requests

When staff rejects a pending request:

1. Bot prompts the staff member to provide a rejection reason.
2. Bot documents the rejection and reason in the forum post/thread.
3. Bot sends the submitting user a direct message informing them that the request was rejected and includes the reason.
4. Bot documents the request and rejection reason in the commission logging channel: `1513316071363444788`.
5. Bot applies the Rejected Discord tag where appropriate.
6. Bot mirrors Rejected to Trello if a Trello card exists.
7. Bot archives the Trello card if one exists.
8. Bot deletes the rejected request forum post/thread.
9. Bot moves the client forum/channel to the completed category instead of Trash.

## Accepted Commission Rejection

If a commission was already accepted and the Discord Rejected tag is applied while In Queue, WIP, and Completed are all removed:

1. Bot posts a staff confirmation request in the commission thread asking for the rejection reason.
2. Staff provides the reason through a modal.
3. Bot DMs the client with the rejection reason.
4. Bot documents the rejection in the thread and logging channel.
5. Bot locks the thread.
6. Bot prefixes the thread title with `🚫`.

This path is separate from rejecting a pending intake request.

## Accepted Commission Cancellation

If a commission was already accepted and the Discord Canceled tag is applied while In Queue, WIP, and Completed are all removed:

1. Bot posts a staff confirmation request in the commission thread asking for the cancellation reason.
2. Staff chooses one reason: Client Requested, ToS violation, or Artist needs to cancel.
3. Client Requested asks whether a refund was issued: Yes, No, or Payment not received.
4. ToS violation requires additional details and includes a ToS link in the client DM.
5. Other cancellation reasons allow optional additional details.
6. Bot DMs the client with the relevant cancellation copy and details.
7. Bot documents the cancellation in the thread and logging channel.
8. Bot locks the thread.
9. Bot prefixes the thread title with `❌`.

## Media And Trello Attachments

The bot should watch for the paperclip reaction on messages in commission threads.

Suggested behavior:

1. A staff member reacts to a message with the paperclip emoji.
2. Bot verifies the reactor is the owner or has a staff/admin role.
3. Bot verifies the message belongs to a linked commission thread.
4. Bot checks whether the commission is marked private.
5. If the commission is private, bot ignores the attachment reaction for that thread.
6. Bot checks the message for image/media attachments.
7. Bot adds the Discord attachment URL to the linked Trello card as an attachment.
8. Bot sets the new Trello attachment as the card cover.

Unauthorized paperclip reactions from clients should be ignored quietly.

## Payment / PayPal Notes

PayPal invoice automation is possible later, but should start as a guarded workflow:

1. Bot detects that a payment milestone is due.
2. Bot drafts or prepares invoice details from the approved commission quote.
3. Bot sends owner/staff a preview.
4. Owner/staff confirms.
5. Bot sends the invoice and posts the invoice link in the client thread.

Payment processor rules should be reviewed before automating invoices for mature/adult content.

## Data To Store Locally

The bot should keep a local database table or collection for commission records:

```text
discord_client_user_id
discord_client_role_id
discord_client_forum_channel_id
discord_commission_thread_id
trello_card_id
commission_type
completion_level
private_commission
availability_days
availability_start_time
availability_end_time
availability_timezone
current_discord_tag_ids
current_trello_label_ids
status
tos_version
age_confirmed_at
created_at
updated_at
completed_at
archived_at
```

Avoid relying on parsed names, forum descriptions, or message text as the only source of relationships between Discord and Trello.

The bot should use a local SQLite database as its source of relationship data. The SQLite file should live under `server/data/discord`, so commission portal state stays grouped with the Discord bot tooling and other Discord data. Forum descriptions should be reserved for important client-facing information, such as ToS reminders or other static portal guidance.

## Open Items

- Finalize the exact intake modal sequence.
- Decide whether to add a general Discord tag for Awaiting Client Response or keep it Trello-only.
- Confirm the spelling of Painting Approved in Discord.
- Decide how abandoned/rejected pending requests should be moved to Trash and deleted.
- Add PayPal credentials and invoice rules only after the base Discord/Trello workflow is stable.
- Decide whether Trello webhooks will be supported with a public HTTPS callback URL, or whether polling is enough for the first version.

## Prototype V1

Implemented prototype scope:

```text
/commission-setup staff command
/commission-cleanup-client staff command
Persistent Request Commission button
Placeholder acknowledgement step
Button-based commission type, level of work, rating, and privacy selection
Placeholder details modal
Ephemeral intake wizard cleanup after form submission, preserving the persistent Request Commission setup message
Client intake DM confirmation with Client Folder, Current Commission Request, and reference upload next step. Approval follow-up DM includes Commission Progress with the Trello link.
Client role assignment
Client forum create/reuse from template
Intake thread creation
SQLite relationship records
Done Uploading button
Request thread lock while awaiting staff review
Staff Approve button
Staff Reject button with rejection reason modal
Trello card creation from template on approval
Immediate Discord tag-to-Trello label/list sync
Rejected request DM + thread note + Trash move
```

Prototype database path:

```text
server/data/discord/commission-portal.sqlite
```

First test path:

```text
1. Start StreamTools with ENABLE_DISCORD_BOT=true.
2. Confirm Discord slash commands register.
3. Run /commission-setup as staff.
4. Click Request Commission in Submit request.
5. Submit a test request.
6. Confirm Client role assignment.
7. Confirm private client forum appears in Commission's Pending.
8. Confirm thread title uses Commission Type | Level of work | SFW or NSFW.
9. Click Approve as staff and confirm Trello card creation.
10. Submit a second test request, click Reject, provide a reason, and confirm DM/thread note/Trash move.
```
