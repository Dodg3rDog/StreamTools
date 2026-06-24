# Commission Portal Copy Deck

Use this file to draft and revise user-facing copy for the commission portal bot. The current bot still uses placeholder strings in code; this document is the editable source for the next copy pass.

## Setup Embed

Title:

```text
Commission Requests
```

Body:

```text
Thanks so much for your interest! Please make sure you've taken a moment to look over my Pricing and Terms. Once you're ready, click the button below!

Pricing: #pricing
Terms: #terms-of-service
```

Button:

```text
Request
```

## Acknowledgement

Body:

```text
By clicking the button below, you affirm that you have read and agree to my Terms of Service and are of legal age in your country or region.
```

Button:

```text
I Agree
```

## Wizard Steps

Commission type prompt:

```text
What type of commission are you interested in?
```

Level of work prompt:

```text
What level of work would you like?
```

Rating prompt:

```text
Is you request SFW or NSFW?
```

Privacy prompt:

```text
Should this commission be private?
(Private commissions will be completed out of public view)
```

Availability days prompt:

```text
Please select the days that are usually best for me to reach you, then click Continue.
```

Availability continue validation:

```text
Please select at least one day before continuing.
```

## Details Modal

Title:

```text
Commission Request
```

Preferred name field:

```text
Preferred name or handle
```

Request details field:

```text
Request details - Please include as much detail as possible. You will be able to upload image references later on.
```

Best contact start time field:

```text
Best contact start time
```

Best contact start time placeholder:

```text
HH:MM AM/PM
```

Best contact end time field:

```text
Best contact end time
```

Best contact end time placeholder:

```text
HH:MM AM/PM
```

Timezone field:

```text
Timezone
```

Timezone placeholder:

```text
CST, EST, PST, GMT+1...
```

## Initial Thread

Body:

```text
Commission Details:

Client: @client
Commission type: ...
Level of work: ...
Rating: ...
Private commission: ...
Availability: ...

{request details}
```

## Reference Upload Prompt

Body:

```text
Next, upload any references here, then click Done Uploading when ready.
```

Button:

```text
Done Uploading
```

## Done Uploading Confirmation

Ephemeral reply:

```text
Reference uploads marked as done. This request is now awaiting review.
```

Thread body:

```text
This request is awaiting review. @owner will review it as soon as possible.
```

Staff buttons:

```text
Approve
Reject
```

## Client Intake DM

Body:

```text
**Commission request received**

Thanks so much for your interest! I can't wait to take a look. Below is a handy shortcut to your Client Folder, and a link to your current commission. Once I've had a chance to look it over, you'll get a new message with further info.

**Client Folder**
[Open client folder]({client_folder_url})

**Current Commission Request**
[Open request thread]({request_thread_url})

**Next Step**
Upload reference images and details in the commission request thread, then click **Done Uploading**.
```

## Approval Thread Message

Body:

```text
Commission accepted - Your request has joined the queue.

 Trello card: {trello link}
```

## Approval DM

Body:

```text

**Commission accepted**

Thanks for your patience. I'd be happy to work on this with you! Here is a link were you can keep an eye on the progress of your piece. I'll post any upates to your discord channel and ping you when needed.

**Commission Progress**
[View Trello card]({trello_url})

```

## Rejection Modal

Title:

```text
Reject Request
```

Reason field:

```text
Reason for rejection
```

## Rejection Thread Message

Body:

```text
Request Rejected

Reason: {reason}
```

## Rejection DM

Body:

```text
Hello, 

My sincerest appologies. I was not able to accept your commission request. I've provided more details below:

Reason: {reason}

If you have any other requests, or would like to submit an alteration to your previous request I'd be happy to consider it.

```

## Cancellation Prompt

Thread body:

```text
The Canceled tag was applied to this accepted commission. Please select a cancellation reason before the client is notified.
```

Buttons:

```text
Client Requested
ToS violation
Artist needs to cancel
```

Refund prompt:

```text
Was a refund issued for this client-requested cancellation?
```

Refund buttons:

```text
Yes
No
Payment not received
```

Optional details field:

```text
Additional details
```

ToS violation details field:

```text
Required details
```

ToS violation details placeholder:

```text
Include the ToS section that was violated.
```

## Cancellation DM

Client requested:

```text
**Commission canceled**

Your commission has been canceled as requested.

Refund status: {refund_status}

Additional details:
{additional_details}
```

ToS violation:

```text
**Commission canceled**

Your commission has been canceled due to a Terms of Service violation.

Terms of Service: {tos_url}

Additional details:
{additional_details}
```

Artist needs to cancel:

```text
**Commission canceled**

I’m sorry, but I need to cancel this commission on my end.

Additional details:
{additional_details}
```

Thread message:

```text
Commission Canceled

Reason: {reason}
Refund status: {refund_status}

Additional details:
{additional_details}
```
