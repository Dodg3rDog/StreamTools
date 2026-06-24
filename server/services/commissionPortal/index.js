const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const { getCommissionConfig } = require("./config");
const {
  appendSyncLog,
  createCommission,
  deleteClientRecords,
  getClient,
  getCommissionById,
  getCommissionByThreadId,
  markCommissionApproved,
  markCommissionCanceled,
  markCommissionCancellationReasonRequested,
  markCommissionRejectionReasonRequested,
  markCommissionRejected,
  setClientForum,
  upsertClient
} = require("./db");
const {
  addLabelToCard,
  addUrlAttachmentToCard,
  archiveCard,
  completeChecklistItemsByName,
  createCommissionCard,
  getCardChecklists,
  moveCardToList,
  reconcileCardLabels
} = require("./trello");
const { publishCommissionPricing } = require("./pricing");

const ids = {
  request: "commission:request",
  intakeStart: "commission:intake:start",
  typePrefix: "commission:type:",
  levelPrefix: "commission:level:",
  ratingPrefix: "commission:rating:",
  privacyPrefix: "commission:privacy:",
  availabilityDayPrefix: "commission:availability_day:",
  availabilityContinue: "commission:availability_continue",
  otherModalPrefix: "commission:other:",
  detailsModal: "commission:details:modal",
  fieldPreferredHandle: "preferredHandle",
  fieldOtherValue: "otherValue",
  fieldRequestDetails: "requestDetails",
  fieldAvailabilityStartTime: "availabilityStartTime",
  fieldAvailabilityEndTime: "availabilityEndTime",
  fieldAvailabilityTimezone: "availabilityTimezone",
  doneUploadingPrefix: "commission:done_uploading:",
  approvePrefix: "commission:approve:",
  rejectPrefix: "commission:reject:",
  rejectModalPrefix: "commission:reject_reason:",
  manualEntryModalPrefix: "commission:manual_entry_modal:",
  manualDmSendPrefix: "commission:manual_dm_send:",
  manualDmSkipPrefix: "commission:manual_dm_skip:",
  workflowStartPrefix: "commission:workflow:start:",
  workflowRequestApprovalPrefix: "commission:workflow:request_approval:",
  workflowAskQuestionPrefix: "commission:workflow:ask_question:",
  workflowClientApprovePrefix: "commission:workflow:client_approve:",
  workflowClientChangesPrefix: "commission:workflow:client_changes:",
  workflowInitialPaymentPrefix: "commission:workflow:initial_payment:",
  workflowFinalPaymentPrefix: "commission:workflow:final_payment:",
  workflowDeliveryStatusPrefix: "commission:workflow:delivery_status:",
  workflowDeliveryDelayModalPrefix: "commission:workflow_delivery_delay_modal:",
  workflowDeliveryCompletePrefix: "commission:workflow:delivery_complete:",
  feedbackOpenPrefix: "commission:feedback:open:",
  feedbackModalPrefix: "commission:feedback_modal:",
  workflowQuestionModalPrefix: "commission:workflow_question_modal:",
  workflowChangesModalPrefix: "commission:workflow_changes_modal:",
  acceptedRejectReasonPrefix: "commission:accepted_reject_reason:",
  acceptedRejectReasonModalPrefix: "commission:accepted_reject_reason_modal:",
  cancelReasonPrefix: "commission:cancel_reason:",
  cancelRefundPrefix: "commission:cancel_refund:",
  cancelDetailsModalPrefix: "commission:cancel_details_modal:",
  fieldManualDiscordContact: "manualDiscordContact",
  fieldManualAvailabilityDays: "manualAvailabilityDays",
  fieldManualAvailabilityTime: "manualAvailabilityTime",
  fieldWorkflowQuestion: "workflowQuestion",
  fieldWorkflowChanges: "workflowChanges",
  fieldDeliveryDelayReason: "deliveryDelayReason",
  fieldFeedbackCommunication: "feedbackCommunication",
  fieldFeedbackTimeliness: "feedbackTimeliness",
  fieldFeedbackQuality: "feedbackQuality",
  fieldFeedbackOverall: "feedbackOverall",
  fieldFeedbackAutomation: "feedbackAutomation",
  fieldCancelDetails: "cancelDetails",
  fieldRejectReason: "rejectReason"
};

const intakeSessions = new Map();
const manualEntrySessions = new Map();
const clientQuestionSessions = new Map();
const feedbackSessions = new Map();
const feedbackMessageSessions = new Map();
const finalPaymentPrompted = new Set();
const threadTagSyncTimers = new Map();
const threadTagSyncSnapshots = new Map();
const threadTagSyncInFlight = new Set();
const EPHEMERAL_FLAGS = 64;
const PAPERCLIP_EMOJI_NAME = "📎";
const WORKFLOW_REVIEW_EMOJI_NAMES = ["🔎", "🔍"];
const FEEDBACK_SKIP_EMOJI_NAME = "⏭️";

const commissionTypeChoices = [
  { id: "headshot_profile", label: "Headshot / Profile photo", buttonLabel: "Headshot" },
  { id: "half_body", label: "Half-body", buttonLabel: "Half-body" },
  { id: "full_body", label: "Full-body", buttonLabel: "Full-body" },
  { id: "emote", label: "Emote", buttonLabel: "Emote" },
  { id: "reference_sheet", label: "Reference Sheet", buttonLabel: "Reference Sheet" },
  { id: "character_creation", label: "Character Creation", buttonLabel: "Character Creation" },
  { id: "ych", label: "YCH", buttonLabel: "YCH" },
  { id: "other", label: "Other", buttonLabel: "Other" }
];

const completionLevelChoices = [
  { id: "line_art", label: "Line Art", buttonLabel: "Line Art" },
  { id: "flats_shading", label: "Flats w/ Shading", buttonLabel: "Flats/Shading" },
  { id: "full_render", label: "Full Render", buttonLabel: "Full Render" },
  { id: "painted_illustration", label: "Painted Illustration", buttonLabel: "Painted" },
  { id: "other", label: "Other", buttonLabel: "Other" }
];

const ratingChoices = [
  { id: "sfw", label: "SFW" },
  { id: "nsfw", label: "NSFW" }
];

const privacyChoices = [
  { id: "public_ok", label: "Public work OK", privateCommission: false },
  { id: "private", label: "Keep private", privateCommission: true }
];

const availabilityDayChoices = [
  { id: "monday", label: "Monday", buttonLabel: "Mon" },
  { id: "tuesday", label: "Tuesday", buttonLabel: "Tue" },
  { id: "wednesday", label: "Wednesday", buttonLabel: "Wed" },
  { id: "thursday", label: "Thursday", buttonLabel: "Thu" },
  { id: "friday", label: "Friday", buttonLabel: "Fri" },
  { id: "saturday", label: "Saturday", buttonLabel: "Sat" },
  { id: "sunday", label: "Sunday", buttonLabel: "Sun" }
];

const workflowStages = [
  {
    id: "sketch",
    label: "Sketch",
    waitingTagKey: "waitingSketchApproval",
    approvedTagKey: "sketchApproved",
    pendingItem: "Sketch pending approval",
    approvedItem: "Sketch approved"
  },
  {
    id: "line_art",
    label: "Line Art",
    waitingTagKey: "waitingLineArtApproval",
    approvedTagKey: "lineArtApproved",
    pendingItem: "Line art pending approval",
    approvedItem: "Line art approved"
  },
  {
    id: "flats_shading",
    label: "Flats & Shading",
    waitingTagKey: "waitingFlatsShadingApproval",
    approvedTagKey: "flatsShadingApproved",
    pendingItem: "Flats & Shading pending approval",
    approvedItem: "Flats & Shading approved"
  },
  {
    id: "full_render",
    label: "Full Render",
    waitingTagKey: "waitingFullRenderApproval",
    approvedTagKey: "fullRenderApproved",
    pendingItem: "Full render pending approval",
    approvedItem: "Full render approved"
  },
  {
    id: "painting",
    label: "Painting",
    waitingTagKey: "waitingPaintingApproval",
    approvedTagKey: "paintingApproved",
    pendingItem: "Painting pending approval",
    approvedItem: "Painting approved"
  }
];

const statusTitleIcons = [
  { icon: "🚫", tagKey: "rejected", priority: 100 },
  { icon: "❌", tagKey: "canceled", priority: 90 },
  { icon: "✅", tagKey: "completed", priority: 80 },
  { icon: "🤝", tagKey: "meetingRequired", priority: 70 },
  { icon: "🛠️", tagKey: "wip", priority: 60 },
  { icon: "⏳", tagKey: "inQueue", priority: 50 }
];

const cancelReasons = {
  client_requested: {
    label: "Client Requested",
    requiresRefundStatus: true,
    requiresDetails: false,
    detailsTitle: "Cancellation Details"
  },
  tos_violation: {
    label: "ToS violation",
    requiresRefundStatus: false,
    requiresDetails: true,
    detailsTitle: "ToS Violation Details"
  },
  artist_needs_to_cancel: {
    label: "Artist needs to cancel",
    requiresRefundStatus: true,
    requiresDetails: false,
    detailsTitle: "Cancellation Details"
  }
};

const cancelRefundStatuses = {
  yes: "Yes",
  no: "No",
  payment_not_received: "Payment not received"
};

function createCommissionSetupCommand() {
  return new SlashCommandBuilder()
    .setName("commission-setup")
    .setDescription("Post the commission request button.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON();
}

function createCommissionCleanupCommand() {
  return new SlashCommandBuilder()
    .setName("commission-cleanup-client")
    .setDescription("Remove local commission portal records for a client.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option
        .setName("client")
        .setDescription("Client whose local commission records should be removed.")
        .setRequired(true)
    )
    .toJSON();
}

function createCommissionManualEntryCommand() {
  return new SlashCommandBuilder()
    .setName("commission-manual-entry")
    .setDescription("Manually enter an accepted commission request.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("commission_type")
        .setDescription("Commission type, such as Headshot, Emote, Reference Sheet, or Other.")
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption((option) =>
      option
        .setName("completion_level")
        .setDescription("Level of completion used to choose the Trello template.")
        .setRequired(true)
        .addChoices(
          { name: "Line Art", value: "Line Art" },
          { name: "Flats w/ Shading", value: "Flats w/ Shading" },
          { name: "Full Render", value: "Full Render" },
          { name: "Painted Illustration", value: "Painted Illustration" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("rating")
        .setDescription("Whether the request is SFW or NSFW.")
        .setRequired(true)
        .addChoices(
          { name: "SFW", value: "SFW" },
          { name: "NSFW", value: "NSFW" }
        )
    )
    .addBooleanOption((option) =>
      option
        .setName("private")
        .setDescription("Whether this commission should be treated as private.")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("client")
        .setDescription("Discord user, if the commissioner is in this server.")
        .setRequired(false)
    )
    .toJSON();
}

function createCommissionPublishPricingCommand() {
  return new SlashCommandBuilder()
    .setName("commission-publish-pricing")
    .setDescription("Publish the editable commission pricing catalog to the pricing channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON();
}

async function handleCommissionPortalInteraction(interaction) {
  const config = getCommissionConfig();
  if (!config.enabled) {
    return false;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "commission-setup") {
    await handleSetupCommand(interaction, config);
    return true;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "commission-cleanup-client") {
    await handleCleanupClientCommand(interaction, config);
    return true;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "commission-manual-entry") {
    await showManualEntryModal(interaction, config);
    return true;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "commission-publish-pricing") {
    await handlePublishPricingCommand(interaction, config);
    return true;
  }

  if (interaction.isButton()) {
    if (interaction.customId === ids.request) {
      await handleRequestButton(interaction);
      return true;
    }

    if (interaction.customId === ids.intakeStart) {
      await showCommissionTypeSelection(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.typePrefix)) {
      await handleCommissionTypeSelection(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.levelPrefix)) {
      await handleCompletionLevelSelection(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.ratingPrefix)) {
      await handleRatingSelection(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.privacyPrefix)) {
      await handlePrivacySelection(interaction);
      return true;
    }

    if (interaction.customId === ids.availabilityContinue) {
      await handleAvailabilityContinue(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.availabilityDayPrefix)) {
      await handleAvailabilityDayToggle(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.doneUploadingPrefix)) {
      await handleDoneUploading(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.approvePrefix)) {
      await handleApprove(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.rejectPrefix)) {
      await showRejectModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.manualDmSendPrefix)) {
      await handleManualDmSend(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.manualDmSkipPrefix)) {
      await handleManualDmSkip(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowStartPrefix)) {
      await handleWorkflowStart(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowRequestApprovalPrefix)) {
      await handleWorkflowRequestApproval(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowAskQuestionPrefix)) {
      await showWorkflowQuestionModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowClientApprovePrefix)) {
      await handleWorkflowClientApprove(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowClientChangesPrefix)) {
      await showWorkflowChangesModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowInitialPaymentPrefix)) {
      await handleWorkflowInitialPayment(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowFinalPaymentPrefix)) {
      await handleWorkflowFinalPayment(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowDeliveryStatusPrefix)) {
      await handleWorkflowDeliveryStatus(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowDeliveryCompletePrefix)) {
      await handleWorkflowDeliveryComplete(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.feedbackOpenPrefix)) {
      await showFeedbackModal(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.acceptedRejectReasonPrefix)) {
      await showAcceptedRejectReasonModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.cancelReasonPrefix)) {
      await handleCancelReasonSelection(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.cancelRefundPrefix)) {
      await handleCancelRefundSelection(interaction, config);
      return true;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith(ids.otherModalPrefix)) {
      await handleOtherModal(interaction);
      return true;
    }

    if (interaction.customId === ids.detailsModal) {
      await handleDetailsModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.rejectModalPrefix)) {
      await handleRejectModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.manualEntryModalPrefix)) {
      await handleManualEntryModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowQuestionModalPrefix)) {
      await handleWorkflowQuestionModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowChangesModalPrefix)) {
      await handleWorkflowChangesModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.workflowDeliveryDelayModalPrefix)) {
      await handleWorkflowDeliveryDelayModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.feedbackModalPrefix)) {
      await handleFeedbackModal(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.acceptedRejectReasonModalPrefix)) {
      await handleAcceptedRejectReasonModal(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.cancelDetailsModalPrefix)) {
      await handleCancelDetailsModal(interaction, config);
      return true;
    }
  }

  return false;
}

async function handleCommissionPortalThreadUpdate(oldThread, newThread) {
  const config = getCommissionConfig();
  if (!config.enabled || !newThread?.id) {
    return false;
  }

  const oldTags = normalizeTagIdList(oldThread?.appliedTags);
  const newTags = normalizeTagIdList(newThread?.appliedTags);
  if (sameStringArray(oldTags, newTags)) {
    return false;
  }

  scheduleThreadTagSync(newThread);
  return true;
}

async function handleCommissionPortalMessageCreate(message) {
  const config = getCommissionConfig();
  if (!config.enabled || message.author?.bot || message.guildId) {
    return false;
  }

  const session = clientQuestionSessions.get(message.author.id);
  if (!session) {
    return false;
  }

  const commission = getCommissionById(session.commissionId);
  const thread = commission
    ? await message.client.channels.fetch(commission.threadId).catch(() => null)
    : null;
  if (!thread?.send) {
    clientQuestionSessions.delete(message.author.id);
    return false;
  }

  const attachmentUrls = Array.from(message.attachments?.values?.() || [])
    .map((attachment) => attachment.url)
    .filter(Boolean);
  const content = [
    "DM reply from <@" + message.author.id + ">:",
    "",
    String(message.content || "").trim() || "(No text provided)",
    attachmentUrls.length > 0 ? "\nAttachments:\n" + attachmentUrls.join("\n") : ""
  ].join("\n");

  await thread.send(content);
  await message.reply("Thanks, I've relayed that back to your commission thread.").catch(() => null);
  clientQuestionSessions.delete(message.author.id);

  appendSyncLog({
    commissionId: commission.id,
    source: "discord_dm",
    action: "workflow_question_reply_relayed",
    payload: {
      userId: message.author.id,
      attachmentCount: attachmentUrls.length
    }
  });

  return true;
}

async function handleCommissionPortalReactionAdd(reaction, user) {
  const config = getCommissionConfig();
  if (!config.enabled || user?.bot || (!isPaperclipReaction(reaction) && !isWorkflowReviewReaction(reaction) && !isFeedbackSkipReaction(reaction))) {
    return false;
  }

  const resolvedReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
  if (!resolvedReaction) {
    return false;
  }

  const message = resolvedReaction.message?.partial
    ? await resolvedReaction.message.fetch().catch(() => null)
    : resolvedReaction.message;
  if (!message?.id || !message.channelId || message.author?.bot) {
    return false;
  }

  if (isFeedbackSkipReaction(resolvedReaction)) {
    return handleFeedbackSkipReaction(message, user);
  }

  const guild = message.guild || await message.client.guilds.fetch(message.guildId).catch(() => null);
  const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;
  if (!memberCanManageCommissions(member, user.id, config)) {
    return false;
  }

  const commission = getCommissionByThreadId(message.channelId);
  if (!commission || !commission.trelloCardId) {
    return false;
  }

  if (isWorkflowReviewReaction(resolvedReaction)) {
    await promptWorkflowReviewAction(message, commission);
    return true;
  }

  const uploaded = await uploadMessageAttachmentsToTrello(message, commission, {
    action: "paperclip_attachments_added_to_trello",
    skippedPrivateAction: "paperclip_attachment_skipped_private_commission",
    userId: user.id
  });

  return uploaded.length > 0;
}

async function promptWorkflowReviewAction(message, commission) {
  if (!message.channel?.send) {
    return;
  }

  await message.channel.send({
    content: "What should happen with this update?",
    components: createWorkflowReviewActionRows(commission.id, message.id)
  });

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_review_prompted",
    payload: {
      messageId: message.id
    }
  });
}

async function uploadMessageAttachmentsToTrello(message, commission, input = {}) {
  if (!message?.id || !commission?.trelloCardId) {
    return [];
  }

  if (Number(commission.privateCommission) === 1) {
    appendSyncLog({
      commissionId: commission.id,
      source: "discord",
      action: input.skippedPrivateAction || "attachment_upload_skipped_private_commission",
      payload: {
        messageId: message.id,
        userId: input.userId || ""
      }
    });
    return [];
  }

  const attachments = Array.from(message.attachments?.values?.() || [])
    .filter(isTrelloAttachmentCandidate);
  if (attachments.length === 0) {
    return [];
  }

  const uploaded = [];
  for (const attachment of attachments) {
    const trelloAttachment = await addUrlAttachmentToCard(commission.trelloCardId, {
      url: attachment.url,
      name: attachment.name || attachment.filename || "Discord attachment",
      setCover: true
    });

    uploaded.push({
      discordAttachmentId: attachment.id,
      trelloAttachmentId: trelloAttachment?.id || "",
      url: attachment.url
    });
  }

  await message.react("✅").catch(() => null);

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: input.action || "attachments_added_to_trello",
    payload: {
      messageId: message.id,
      userId: input.userId || "",
      uploaded
    }
  });

  return uploaded;
}

async function ensurePaperclipReaction(message) {
  if (!message?.react) {
    return false;
  }

  if (messageHasPaperclipReaction(message)) {
    return false;
  }

  await message.react(PAPERCLIP_EMOJI_NAME).catch((error) => {
    console.warn("[Commission Portal] Failed to add paperclip reaction:", error.message);
  });
  return true;
}

function scheduleThreadTagSync(thread) {
  const existingTimer = threadTagSyncTimers.get(thread.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    threadTagSyncTimers.delete(thread.id);
    processThreadTagSync(thread).catch((error) => {
      console.warn("[Commission Portal] Thread tag sync worker failed:", error.message);
    });
  }, 1200);

  threadTagSyncTimers.set(thread.id, timer);
}

async function processThreadTagSync(threadRef) {
  const config = getCommissionConfig();
  const thread = await threadRef.client.channels.fetch(threadRef.id).catch(() => threadRef);
  if (!thread?.id) {
    return false;
  }

  if (threadTagSyncInFlight.has(thread.id)) {
    scheduleThreadTagSync(thread);
    return false;
  }

  const latestTags = normalizeTagIdList(thread.appliedTags);
  const snapshotKey = latestTags.join(",");
  const commission = getCommissionByThreadId(thread.id);
  if (!commission || !commission.trelloCardId) {
    return false;
  }

  if (threadTagSyncSnapshots.get(thread.id) === snapshotKey) {
    return false;
  }

  const parent = thread.parent || await thread.client.channels.fetch(thread.parentId).catch(() => null);
  const tagNames = getAppliedTagNames(parent, latestTags);
  const syncPlan = buildTrelloSyncPlan(tagNames, config);

  threadTagSyncInFlight.add(thread.id);

  try {
    await updateThreadStatusIcon(thread, tagNames, config);

    if (shouldPromptAcceptedRejectionReason(tagNames, commission, config)) {
      await promptAcceptedRejectionReason(thread, commission, config);
    }

    if (shouldPromptAcceptedCancellationReason(tagNames, commission, config)) {
      await promptAcceptedCancellationReason(thread, commission, config);
    }

    if (syncPlan.listId) {
      await moveCardToList(commission.trelloCardId, syncPlan.listId);
    }

    await reconcileCardLabels(
      commission.trelloCardId,
      syncPlan.labelIds,
      getManagedTrelloLabelIds(config)
    );

    const completedChecklistItems = await completeChecklistItemsForTagNames(commission, tagNames, config);

    if (syncPlan.archive) {
      await archiveCard(commission.trelloCardId);
    }

    await promptFinalPaymentIfNeeded(thread, commission, completedChecklistItems);
    const movedForumToCompleted = hasTagName(tagNames, config.tagNames.completed)
      ? await moveClientForumToCompletedIfIdle(thread.client, commission, config)
      : false;

    appendSyncLog({
      commissionId: commission.id,
      source: "discord",
      action: "tags_synced_to_trello",
      payload: {
        threadId: thread.id,
        tagNames,
        listId: syncPlan.listId,
        labelIds: syncPlan.labelIds,
        completedChecklistItems,
        archive: syncPlan.archive,
        movedForumToCompleted
      }
    });

    threadTagSyncSnapshots.set(thread.id, snapshotKey);
    console.log("[Commission Portal] Synced Discord tags to Trello for commission " + commission.id + ".");
    return true;
  } catch (error) {
    appendSyncLog({
      commissionId: commission.id,
      source: "discord",
      action: "tags_sync_to_trello_failed",
      payload: {
        threadId: thread.id,
        tagNames,
        error: error.message
      }
    });

    console.warn("[Commission Portal] Failed to sync Discord tags to Trello:", error.message);
    return false;
  } finally {
    threadTagSyncInFlight.delete(thread.id);
  }
}

async function handleSetupCommand(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({
      content: "You do not have permission to set up commission requests.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  const channel = await interaction.client.channels.fetch(config.submitRequestChannelId);
  if (!channel || typeof channel.send !== "function") {
    await interaction.reply({
      content: "The configured Submit request channel could not be found.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  await channel.send({
    embeds: [createRequestEmbed(config)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.request)
          .setLabel("Request")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  });

  await interaction.reply({
    content: "Commission request button posted in <#" + config.submitRequestChannelId + ">.",
    flags: EPHEMERAL_FLAGS
  });
}

async function handlePublishPricingCommand(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({
      content: "You do not have permission to publish commission pricing.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const result = await publishCommissionPricing(interaction.client, config, {
    reason: "slash_command",
    staffUserId: interaction.user.id
  });

  await interaction.editReply(
    "Published " + result.embedCount + " pricing embeds to <#" + result.channelId + ">."
  );
}

async function handleCleanupClientCommand(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({
      content: "You do not have permission to clean up commission records.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  const user = interaction.options.getUser("client", true);
  const result = deleteClientRecords(user.id);

  await interaction.reply({
    content: "Removed local records for <@" + user.id + ">. Clients: " + result.deletedClients + ", commissions: " + result.deletedCommissions + ". This does not delete Discord channels or Trello cards.",
    flags: EPHEMERAL_FLAGS
  });
}

async function showManualEntryModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({
      content: "You do not have permission to manually enter commission records.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  const sessionId = interaction.id;
  const selectedClient = interaction.options.getUser("client", false);
  manualEntrySessions.set(sessionId, {
    createdAt: new Date().toISOString(),
    staffUserId: interaction.user.id,
    selectedClientId: selectedClient?.id || "",
    commissionType: interaction.options.getString("commission_type", true),
    completionLevel: interaction.options.getString("completion_level", true),
    contentRating: interaction.options.getString("rating", true),
    privateCommission: interaction.options.getBoolean("private", true)
  });

  const modal = new ModalBuilder()
    .setCustomId(ids.manualEntryModalPrefix + sessionId)
    .setTitle("Manual Commission Entry")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldPreferredHandle)
          .setLabel("Preferred name or handle")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldManualDiscordContact)
          .setLabel("Discord user ID or mention")
          .setPlaceholder("Optional if you selected a server member")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldRequestDetails)
          .setLabel("Request details")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldManualAvailabilityDays)
          .setLabel("Best contact days")
          .setPlaceholder("Monday, Wednesday, Friday")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(120)
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldManualAvailabilityTime)
          .setLabel("Best contact time and timezone")
          .setPlaceholder("6:00 PM to 9:00 PM CST")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(120)
          .setRequired(false)
      )
    );

  await interaction.showModal(modal);
}

async function handleManualEntryModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({
      content: "You do not have permission to manually enter commission records.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const sessionId = interaction.customId.slice(ids.manualEntryModalPrefix.length);
  const session = manualEntrySessions.get(sessionId);
  manualEntrySessions.delete(sessionId);

  if (!session || session.staffUserId !== interaction.user.id) {
    await interaction.editReply("This manual entry session expired. Please run `/commission-manual-entry` again.");
    return;
  }

  const preferredHandle = readField(interaction, ids.fieldPreferredHandle);
  const discordContact = readOptionalField(interaction, ids.fieldManualDiscordContact);
  const requestDetails = readField(interaction, ids.fieldRequestDetails);
  const availabilityDays = parseManualAvailabilityDays(readOptionalField(interaction, ids.fieldManualAvailabilityDays));
  const availabilityTime = readOptionalField(interaction, ids.fieldManualAvailabilityTime);
  const discordUserId = session.selectedClientId || extractDiscordSnowflake(discordContact);
  const clientKey = discordUserId || createManualClientKey(discordContact || preferredHandle);
  const member = discordUserId
    ? await interaction.guild.members.fetch(discordUserId).catch(() => null)
    : null;

  if (member) {
    await ensureClientRole(member, config);
  }

  upsertClient({
    discordUserId: clientKey,
    preferredName: preferredHandle,
    clientRoleId: config.clientRoleId
  });

  const forum = await getOrCreateClientForumForClient(interaction, {
    discordUserId: clientKey,
    member,
    preferredHandle,
    parentCategoryId: config.activeCategoryId
  }, config);

  const thread = await createIntakeThread(forum, {
    clientMention: discordUserId ? "<@" + discordUserId + ">" : preferredHandle,
    commissionType: session.commissionType,
    completionLevel: session.completionLevel,
    contentRating: session.contentRating,
    privateCommission: session.privateCommission === true,
    availabilityDays,
    availabilityStartTime: availabilityTime,
    availabilityEndTime: "",
    availabilityTimezone: "",
    requestDetails: requestDetails + "\n\nManually entered by: <@" + interaction.user.id + ">"
  }, config);

  const commission = createCommission({
    discordUserId: clientKey,
    forumChannelId: forum.id,
    threadId: thread.id,
    commissionType: session.commissionType,
    completionLevel: session.completionLevel,
    contentRating: session.contentRating,
    privateCommission: session.privateCommission === true,
    availabilityDays,
    availabilityStartTime: availabilityTime,
    availabilityEndTime: "",
    availabilityTimezone: "",
    requestDetails,
    status: "approved"
  });

  let trelloCard;
  try {
    trelloCard = await createCommissionCard(commission, {
      preferredName: preferredHandle
    });
  } catch (error) {
    await interaction.editReply(
      "Manual entry created in Discord, but Trello card creation failed: " + error.message + "\nThread: <#" + thread.id + ">"
    );
    return;
  }

  const updatedCommission = markCommissionApproved(commission.id, trelloCard);
  await setThreadTags(interaction.client, updatedCommission.threadId, [config.tagNames.inQueue]);
  await thread.send({
    content: "Manual commission entry accepted.\n\nTrello card: " + (updatedCommission.trelloCardUrl || trelloCard.shortUrl || "created"),
    components: createWorkflowStartRows(updatedCommission.id)
  });

  appendSyncLog({
    commissionId: updatedCommission.id,
    source: "discord",
    action: "manual_entry_created",
    payload: {
      staffUserId: interaction.user.id,
      discordUserId: clientKey,
      forumChannelId: forum.id,
      threadId: thread.id,
      trelloCardId: updatedCommission.trelloCardId
    }
  });

  const links = {
    guildId: interaction.guildId,
    forumId: forum.id,
    threadId: thread.id,
    trelloUrl: updatedCommission.trelloCardUrl || trelloCard.shortUrl || ""
  };
  const content = buildManualEntryCreatedReply(updatedCommission, links, discordUserId);

  if (discordUserId) {
    manualEntrySessions.set(String(updatedCommission.id), {
      discordUserId,
      links
    });
  }

  await interaction.editReply({
    content,
    components: discordUserId ? createManualDmChoiceRows(updatedCommission.id) : []
  });
}

async function handleManualDmSend(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can send manual entry link DMs.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const commissionId = interaction.customId.slice(ids.manualDmSendPrefix.length);
  const session = manualEntrySessions.get(String(commissionId));
  const commission = getCommissionById(commissionId);

  if (!session || !commission) {
    await interaction.update({
      content: "The manual DM session expired. The commission record still exists.",
      components: []
    });
    return;
  }

  const sent = await sendManualCommissionLinksDm(interaction.client, session.discordUserId, session.links);
  manualEntrySessions.delete(String(commissionId));

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: sent ? "manual_entry_links_dm_sent" : "manual_entry_links_dm_failed",
    payload: { discordUserId: session.discordUserId }
  });

  await interaction.update({
    content: sent
      ? "Manual commission entry created and link DM sent."
      : "Manual commission entry created, but the DM could not be sent. The user may not share a server with the bot or may have DMs disabled.",
    components: []
  });
}

async function handleManualDmSkip(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can manage manual entry link DMs.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const commissionId = interaction.customId.slice(ids.manualDmSkipPrefix.length);
  manualEntrySessions.delete(String(commissionId));

  await interaction.update({
    content: "Manual commission entry created. DM skipped.",
    components: []
  });
}

async function handleWorkflowStart(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can start commission work.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const commissionId = interaction.customId.slice(ids.workflowStartPrefix.length);
  const commission = getCommissionById(commissionId);
  if (!commission || !commission.trelloCardId) {
    await interaction.editReply("This commission record or Trello card could not be found.");
    return;
  }

  const completedItems = await completeChecklistItemsByName(commission.trelloCardId, [
    "Initial vision meet-up",
    "Sketch in progress"
  ]);

  await updateThreadTags(interaction.client, commission.threadId, {
    addTagNames: [config.tagNames.wip],
    removeTagNames: [config.tagNames.inQueue, config.tagNames.meetingRequired, config.tagNames.onHold]
  });

  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  if (thread?.send) {
    await thread.send("Work has started. Initial planning is marked complete and this commission is now WIP.");
  }

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_started",
    payload: {
      completedItems
    }
  });

  await interaction.editReply("Marked start-work checklist items complete and moved the thread to WIP.");
}

async function handleWorkflowRequestApproval(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can request client approval.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const payload = parseCustomIdParts(interaction.customId, ids.workflowRequestApprovalPrefix);
  const commissionId = payload[0];
  const sourceMessageId = payload[1] || "";
  const commission = getCommissionById(commissionId);
  if (!commission || !commission.trelloCardId) {
    await interaction.editReply("This commission record or Trello card could not be found.");
    return;
  }

  const checklists = await getCardChecklists(commission.trelloCardId);
  const stage = determineNextWorkflowStage(commission, checklists);
  if (!stage) {
    await interaction.editReply("I could not determine a remaining approval stage for this commission.");
    return;
  }

  const completedItems = await completeChecklistItemsByName(commission.trelloCardId, [stage.pendingItem]);
  await updateThreadTags(interaction.client, commission.threadId, {
    addTagNames: [config.tagNames[stage.waitingTagKey]],
    removeTagNames: getWorkflowWaitingTagNames(config).filter((tagName) => tagName !== config.tagNames[stage.waitingTagKey])
  });

  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  const sourceUrl = await getSourceReferenceUrl(interaction.client, interaction.guildId, commission.threadId, sourceMessageId);
  if (thread?.send) {
    await thread.send({
      content: [
        formatDiscordUserMention(commission.discordUserId) + " approval is needed for the current " + stage.label + " stage.",
        sourceMessageId ? "Review link: " + sourceUrl : ""
      ].filter(Boolean).join("\n"),
      components: createClientApprovalRowsWithSource(commission.id, stage.id, sourceMessageId)
    });
  }

  await notifyClientOfApprovalRequest(interaction.client, commission.discordUserId, {
    stageLabel: stage.label,
    threadUrl: createDiscordThreadUrl(interaction.guildId, commission.threadId),
    sourceUrl
  });

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_approval_requested",
    payload: {
      stage: stage.id,
      sourceMessageId,
      completedItems
    }
  });

  await deleteInteractionSourceMessage(interaction);
  await interaction.editReply("Requested " + stage.label + " approval from the client.");
}

async function showWorkflowQuestionModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can ask client questions.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const payload = parseCustomIdParts(interaction.customId, ids.workflowAskQuestionPrefix);
  const commissionId = payload[0];
  const sourceMessageId = payload[1] || "";
  const modal = new ModalBuilder()
    .setCustomId([ids.workflowQuestionModalPrefix + commissionId, sourceMessageId || "none"].join(":"))
    .setTitle("Ask Client")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldWorkflowQuestion)
          .setLabel("Question for the client")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
  await deleteInteractionSourceMessage(interaction);
}

async function handleWorkflowQuestionModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can ask client questions.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const payload = parseCustomIdParts(interaction.customId, ids.workflowQuestionModalPrefix);
  const commissionId = payload[0];
  const sourceMessageId = payload[1] === "none" ? "" : payload[1];
  const question = readField(interaction, ids.fieldWorkflowQuestion);
  const commission = getCommissionById(commissionId);
  if (!commission) {
    await interaction.editReply("This commission record could not be found.");
    return;
  }

  const threadUrl = createDiscordThreadUrl(interaction.guildId, commission.threadId);
  const sourceUrl = await getSourceReferenceUrl(interaction.client, interaction.guildId, commission.threadId, sourceMessageId);
  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  if (thread?.send) {
    await thread.send([
      formatDiscordUserMention(commission.discordUserId) + " I have a question for you:",
      "",
      question,
      sourceMessageId ? "\nReference: " + sourceUrl : ""
    ].join("\n"));
  }

  const sent = await notifyClientOfStaffQuestion(interaction.client, commission.discordUserId, {
    question,
    threadUrl,
    sourceUrl
  });

  clientQuestionSessions.set(commission.discordUserId, {
    commissionId: commission.id,
    threadId: commission.threadId,
    question,
    createdAt: new Date().toISOString()
  });

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: sent ? "workflow_question_sent" : "workflow_question_dm_failed",
    payload: {
      staffUserId: interaction.user.id,
      sourceMessageId
    }
  });

  await interaction.editReply(sent
    ? "Question sent and DM relay is ready for this client."
    : "Question posted in the thread, but the DM could not be sent.");
}

async function handleWorkflowClientApprove(interaction, config) {
  const payload = parseCustomIdParts(interaction.customId, ids.workflowClientApprovePrefix);
  const commissionId = payload[0];
  const stageId = payload[1];
  const sourceMessageId = payload[2] === "none" ? "" : payload[2] || "";
  const commission = getCommissionById(commissionId);
  const stage = getWorkflowStageById(stageId);
  if (!commission || !stage) {
    await interaction.reply({ content: "This approval request could not be found.", flags: EPHEMERAL_FLAGS });
    return;
  }

  if (interaction.user.id !== commission.discordUserId && !memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only the client or staff can approve this stage.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const checklistItems = [
    stage.approvedItem,
    stage.id === "sketch" ? "Initial payment pending" : getNextChecklistItemAfterApproval(commission, stage)
  ].filter(Boolean);
  const completedItems = await completeChecklistItemsByName(commission.trelloCardId, checklistItems);

  await updateThreadTags(interaction.client, commission.threadId, {
    addTagNames: [config.tagNames[stage.approvedTagKey]],
    removeTagNames: [config.tagNames[stage.waitingTagKey], config.tagNames.onHold]
  });

  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  const sourceMessage = sourceMessageId && thread?.messages?.fetch
    ? await thread.messages.fetch(sourceMessageId).catch(() => null)
    : null;
  let uploadedMedia = [];
  if (sourceMessage && Array.from(sourceMessage.attachments?.values?.() || []).some(isTrelloAttachmentCandidate)) {
    const hadPaperclip = messageHasPaperclipReaction(sourceMessage);
    if (!hadPaperclip) {
      await ensurePaperclipReaction(sourceMessage);
      uploadedMedia = await uploadMessageAttachmentsToTrello(sourceMessage, commission, {
        action: "approval_attachments_added_to_trello",
        skippedPrivateAction: "approval_attachment_skipped_private_commission",
        userId: interaction.user.id
      });
    }
  }

  if (thread?.send) {
    await thread.send(stage.label + " approved by <@" + interaction.user.id + ">.");
    if (stage.id === "sketch") {
      await thread.send({
        content: "Initial payment checkpoint: has payment been received, or is no initial payment needed?",
        components: createInitialPaymentRows(commission.id)
      });
    }
  }
  await promptFinalPaymentIfNeeded(thread, commission, completedItems);
  await deleteInteractionSourceMessage(interaction);

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_stage_approved",
    payload: {
      stage: stage.id,
      approvedBy: interaction.user.id,
      completedItems,
      sourceMessageId,
      uploadedMedia
    }
  });

  await interaction.editReply(stage.label + " approval recorded.");
}

async function showWorkflowChangesModal(interaction, config) {
  const payload = parseCustomIdParts(interaction.customId, ids.workflowClientChangesPrefix);
  const commissionId = payload[0];
  const stageId = payload[1];
  const commission = getCommissionById(commissionId);
  if (!commission) {
    await interaction.reply({ content: "This approval request could not be found.", flags: EPHEMERAL_FLAGS });
    return;
  }

  if (interaction.user.id !== commission.discordUserId && !memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only the client or staff can request changes for this stage.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId([ids.workflowChangesModalPrefix + commissionId, stageId].join(":"))
    .setTitle("Request Changes")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldWorkflowChanges)
          .setLabel("What needs to be adjusted?")
          .setPlaceholder("Please describe what should change. You can also upload a marked-up image in the thread.")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleWorkflowChangesModal(interaction, config) {
  const payload = parseCustomIdParts(interaction.customId, ids.workflowChangesModalPrefix);
  const commissionId = payload[0];
  const stageId = payload[1];
  const changes = readField(interaction, ids.fieldWorkflowChanges);
  const commission = getCommissionById(commissionId);
  const stage = getWorkflowStageById(stageId);
  if (!commission || !stage) {
    await interaction.reply({ content: "This approval request could not be found.", flags: EPHEMERAL_FLAGS });
    return;
  }

  if (interaction.user.id !== commission.discordUserId && !memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only the client or staff can request changes for this stage.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  await updateThreadTags(interaction.client, commission.threadId, {
    addTagNames: [config.tagNames.onHold],
    removeTagNames: [config.tagNames[stage.waitingTagKey]]
  });

  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  if (thread?.send) {
    await thread.send([
      "Changes requested for " + stage.label + " by <@" + interaction.user.id + ">.",
      "",
      changes,
      "",
      "If helpful, please upload a marked-up copy of the image in this thread."
    ].join("\n"));
  }

  await notifyOwnerOfRequestedChanges(interaction.client, commission, {
    guildId: interaction.guildId,
    stageLabel: stage.label,
    changes
  }, config);
  await deleteInteractionSourceMessage(interaction);

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_changes_requested",
    payload: {
      stage: stage.id,
      requestedBy: interaction.user.id,
      changes
    }
  });

  await interaction.editReply("Change request recorded and the commission is now On Hold.");
}

async function handleWorkflowInitialPayment(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can confirm the initial payment checkpoint.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const payload = parseCustomIdParts(interaction.customId, ids.workflowInitialPaymentPrefix);
  const commissionId = payload[0];
  const paymentState = payload[1] || "";
  const commission = getCommissionById(commissionId);
  if (!commission || !commission.trelloCardId) {
    await interaction.editReply("This commission record or Trello card could not be found.");
    return;
  }

  const nextItem = getInitialPaymentNextChecklistItem(commission);
  const completedItems = await completeChecklistItemsByName(commission.trelloCardId, [
    "Initial payment received",
    nextItem
  ].filter(Boolean));

  if (paymentState === "received") {
    await updateThreadTags(interaction.client, commission.threadId, {
      addTagNames: [config.tagNames.halfPaymentReceived],
      removeTagNames: []
    });
  }

  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  if (thread?.send) {
    await thread.send(paymentState === "none"
      ? "Initial payment checkpoint cleared. No initial payment is needed, and the next work step is now in progress."
      : "Initial payment confirmed. The next work step is now in progress.");
  }
  await deleteInteractionSourceMessage(interaction);

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_initial_payment_confirmed",
    payload: {
      paymentState,
      completedItems
    }
  });

  await interaction.editReply("Initial payment checkpoint completed.");
}

async function handleWorkflowFinalPayment(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can confirm final payment.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const payload = parseCustomIdParts(interaction.customId, ids.workflowFinalPaymentPrefix);
  const commissionId = payload[0];
  const paymentState = payload[1] || "";
  const commission = getCommissionById(commissionId);
  if (!commission || !commission.trelloCardId) {
    await interaction.editReply("This commission record or Trello card could not be found.");
    return;
  }

  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  if (paymentState === "received") {
    await updateThreadTags(interaction.client, commission.threadId, {
      addTagNames: [config.tagNames.paidInFull],
      removeTagNames: [config.tagNames.onHold]
    });

    if (thread?.send) {
      await thread.send({
        content: "Final payment has been confirmed. Has the completed work been delivered to the client?",
        components: createDeliveryStatusRows(commission.id)
      });
    }

    appendSyncLog({
      commissionId: commission.id,
      source: "discord",
      action: "workflow_final_payment_received",
      payload: { staffUserId: interaction.user.id }
    });

    await deleteInteractionSourceMessage(interaction);
    await interaction.editReply("Final payment confirmed. Delivery confirmation requested.");
    return;
  }

  await updateThreadTags(interaction.client, commission.threadId, {
    addTagNames: [config.tagNames.onHold],
    removeTagNames: []
  });

  if (thread?.send) {
    await thread.send({
      content: "Final payment has not been received yet. The commission remains on hold.",
      components: createFinalPaymentRows(commission.id)
    });
  }

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_final_payment_pending",
    payload: { staffUserId: interaction.user.id }
  });

  await deleteInteractionSourceMessage(interaction);
  await interaction.editReply("Final payment left pending and the commission was marked On Hold.");
}

async function handleWorkflowDeliveryStatus(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can confirm delivery.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const payload = parseCustomIdParts(interaction.customId, ids.workflowDeliveryStatusPrefix);
  const commissionId = payload[0];
  const deliveryState = payload[1] || "";
  const commission = getCommissionById(commissionId);
  if (!commission || !commission.trelloCardId) {
    await interaction.reply({ content: "This commission record or Trello card could not be found.", flags: EPHEMERAL_FLAGS });
    return;
  }

  if (deliveryState === "delivered") {
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });
    await finalizeCommissionDelivery(interaction, commission, config, {
      action: "workflow_delivery_confirmed",
      threadMessage: "Delivery confirmed. This commission is now complete."
    });
    await deleteInteractionSourceMessage(interaction);
    await interaction.editReply("Delivery confirmed and commission completed.");
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(ids.workflowDeliveryDelayModalPrefix + commissionId)
    .setTitle("Delivery Pending")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldDeliveryDelayReason)
          .setLabel("Why has delivery not happened yet?")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleWorkflowDeliveryDelayModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can document delivery delays.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const commissionId = interaction.customId.slice(ids.workflowDeliveryDelayModalPrefix.length);
  const reason = readField(interaction, ids.fieldDeliveryDelayReason);
  const commission = getCommissionById(commissionId);
  if (!commission) {
    await interaction.editReply("This commission record could not be found.");
    return;
  }

  await updateThreadTags(interaction.client, commission.threadId, {
    addTagNames: [config.tagNames.onHold],
    removeTagNames: []
  });

  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  if (thread?.send) {
    await thread.send({
      content: [
        "Delivery is not complete yet.",
        "",
        "Reason: " + reason
      ].join("\n"),
      components: createDeliveryCompleteRows(commission.id)
    });
  }
  await deleteInteractionSourceMessage(interaction);

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_delivery_delayed",
    payload: {
      staffUserId: interaction.user.id,
      reason
    }
  });

  await interaction.editReply("Delivery delay documented. A Delivery Complete button was posted.");
}

async function handleWorkflowDeliveryComplete(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can confirm delivery completion.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const commissionId = interaction.customId.slice(ids.workflowDeliveryCompletePrefix.length);
  const commission = getCommissionById(commissionId);
  if (!commission || !commission.trelloCardId) {
    await interaction.editReply("This commission record or Trello card could not be found.");
    return;
  }

  await finalizeCommissionDelivery(interaction, commission, config, {
    action: "workflow_delivery_completed_after_delay",
    threadMessage: "Delivery confirmed after delay. This commission is now complete."
  });
  await deleteInteractionSourceMessage(interaction);
  await interaction.editReply("Delivery confirmed and commission completed.");
}

async function finalizeCommissionDelivery(interaction, commission, config, input) {
  const completedItems = await completeChecklistItemsByName(commission.trelloCardId, [
    "Payment received - Order delivered"
  ]);

  await updateThreadTags(interaction.client, commission.threadId, {
    addTagNames: [config.tagNames.paidInFull, config.tagNames.completed],
    removeTagNames: [
      config.tagNames.wip,
      config.tagNames.onHold,
      config.tagNames.meetingRequired,
      ...getWorkflowWaitingTagNames(config)
    ]
  });

  const thread = await interaction.client.channels.fetch(commission.threadId).catch(() => null);
  const completedTagConfirmed = await waitForThreadTagState(interaction.client, commission.threadId, {
    requiredTagNames: [config.tagNames.completed],
    absentTagNames: [config.tagNames.wip]
  });

  if (!completedTagConfirmed) {
    if (thread?.send) {
      await thread.send("Completion tag update could not be confirmed, so I left this thread unlocked. Please check the Discord tags and lock manually if needed.");
    }

    appendSyncLog({
      commissionId: commission.id,
      source: "discord",
      action: "workflow_delivery_completion_tag_confirm_failed",
      payload: {
        staffUserId: interaction.user.id
      }
    });
    return;
  }

  if (thread?.send) {
    await thread.send(input.threadMessage || "Commission completed.");
  }

  await lockThread(thread);
  const movedForumToCompleted = await moveClientForumToCompletedIfIdle(interaction.client, commission, config);
  await sendClientFeedbackRequest(interaction.client, commission.discordUserId, {
    commissionId: commission.id,
    threadId: commission.threadId
  });

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: input.action || "workflow_delivery_finalized",
    payload: {
      staffUserId: interaction.user.id,
      completedItems,
      movedForumToCompleted
    }
  });
}

async function handleRequestButton(interaction) {
  await interaction.reply({
    content: "By clicking the button below, you affirm that you have read and agree to my Terms of Service and are of legal age in your country or region.",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.intakeStart)
          .setLabel("I Agree")
          .setStyle(ButtonStyle.Success)
      )
    ],
    flags: EPHEMERAL_FLAGS
  });
  rememberWizardInteraction(interaction.user.id, interaction);
}

async function showCommissionTypeSelection(interaction) {
  intakeSessions.set(interaction.user.id, {
    startedAt: new Date().toISOString(),
    cleanupInteractions: getWizardCleanupInteractions(interaction.user.id)
  });
  rememberWizardInteraction(interaction.user.id, interaction);

  await interaction.update({
    content: "What type of commission are you interested in?",
    components: createChoiceRows(commissionTypeChoices, ids.typePrefix)
  });
}

async function handleCommissionTypeSelection(interaction) {
  const choiceId = interaction.customId.slice(ids.typePrefix.length);
  const choice = commissionTypeChoices.find((item) => item.id === choiceId);
  if (!choice) {
    await interaction.reply({ content: "Unknown commission type.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const session = getIntakeSession(interaction.user.id);
  if (choice.id === "other") {
    session.pendingOtherField = "commissionType";
    intakeSessions.set(interaction.user.id, session);
    await showOtherModal(interaction, "commissionType", "Commission type");
    return;
  }

  session.commissionType = choice.label;
  intakeSessions.set(interaction.user.id, session);
  await showCompletionLevelSelection(interaction);
}

async function showCompletionLevelSelection(interaction) {
  rememberWizardInteraction(interaction.user.id, interaction);
  await interaction.update({
    content: "What level of work would you like?",
    components: createChoiceRows(completionLevelChoices, ids.levelPrefix)
  });
}

async function handleCompletionLevelSelection(interaction) {
  const choiceId = interaction.customId.slice(ids.levelPrefix.length);
  const choice = completionLevelChoices.find((item) => item.id === choiceId);
  if (!choice) {
    await interaction.reply({ content: "Unknown level of work.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const session = getIntakeSession(interaction.user.id);
  if (choice.id === "other") {
    session.pendingOtherField = "completionLevel";
    intakeSessions.set(interaction.user.id, session);
    await showOtherModal(interaction, "completionLevel", "Level of work");
    return;
  }

  session.completionLevel = choice.label;
  intakeSessions.set(interaction.user.id, session);
  await showRatingSelection(interaction);
}

async function showRatingSelection(interaction) {
  rememberWizardInteraction(interaction.user.id, interaction);
  await interaction.update({
    content: "Is you request SFW or NSFW?",
    components: createChoiceRows(ratingChoices, ids.ratingPrefix)
  });
}

async function handleRatingSelection(interaction) {
  const choiceId = interaction.customId.slice(ids.ratingPrefix.length);
  const choice = ratingChoices.find((item) => item.id === choiceId);
  if (!choice) {
    await interaction.reply({ content: "Unknown content rating.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const session = getIntakeSession(interaction.user.id);
  session.contentRating = choice.label;
  intakeSessions.set(interaction.user.id, session);
  await showPrivacySelection(interaction);
}

async function showPrivacySelection(interaction) {
  rememberWizardInteraction(interaction.user.id, interaction);
  await interaction.update({
    content: "Should this commission be private?\n(Private commissions will be completed out of public view)",
    components: createChoiceRows(privacyChoices, ids.privacyPrefix)
  });
}

async function handlePrivacySelection(interaction) {
  const choiceId = interaction.customId.slice(ids.privacyPrefix.length);
  const choice = privacyChoices.find((item) => item.id === choiceId);
  if (!choice) {
    await interaction.reply({ content: "Unknown privacy option.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const session = getIntakeSession(interaction.user.id);
  session.privateCommission = choice.privateCommission;
  session.availabilityDays = session.availabilityDays || [];
  intakeSessions.set(interaction.user.id, session);
  rememberWizardInteraction(interaction.user.id, interaction);
  await showAvailabilityDaySelection(interaction);
}

async function showAvailabilityDaySelection(interaction) {
  const session = getIntakeSession(interaction.user.id);
  rememberWizardInteraction(interaction.user.id, interaction);
  await interaction.update({
    content: "Please select the days that are usually best for me to reach you, then click Continue.",
    components: createAvailabilityDayRows(session.availabilityDays || [])
  });
}

async function handleAvailabilityDayToggle(interaction) {
  const dayId = interaction.customId.slice(ids.availabilityDayPrefix.length);
  const day = availabilityDayChoices.find((item) => item.id === dayId);
  if (!day) {
    await interaction.reply({ content: "Unknown availability day.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const session = getIntakeSession(interaction.user.id);
  const selected = new Set(session.availabilityDays || []);
  if (selected.has(day.label)) {
    selected.delete(day.label);
  } else {
    selected.add(day.label);
  }

  session.availabilityDays = Array.from(selected);
  intakeSessions.set(interaction.user.id, session);
  rememberWizardInteraction(interaction.user.id, interaction);

  await interaction.update({
    content: "Please select the days that are usually best for me to reach you, then click Continue.",
    components: createAvailabilityDayRows(session.availabilityDays)
  });
}

async function handleAvailabilityContinue(interaction) {
  const session = getIntakeSession(interaction.user.id);
  if (!Array.isArray(session.availabilityDays) || session.availabilityDays.length === 0) {
    await interaction.reply({
      content: "Please select at least one day before continuing.",
      flags: EPHEMERAL_FLAGS
    });
    rememberWizardInteraction(interaction.user.id, interaction);
    return;
  }

  rememberWizardInteraction(interaction.user.id, interaction);
  await showDetailsModal(interaction);
}

async function showOtherModal(interaction, field, label) {
  rememberWizardInteraction(interaction.user.id, interaction);
  const modal = new ModalBuilder()
    .setCustomId(ids.otherModalPrefix + field)
    .setTitle("Other")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldOtherValue)
          .setLabel(limitText(label, 45))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
  await deleteInteractionSourceMessage(interaction);
}

async function handleOtherModal(interaction) {
  const field = interaction.customId.slice(ids.otherModalPrefix.length);
  const value = readField(interaction, ids.fieldOtherValue);
  const session = getIntakeSession(interaction.user.id);

  if (field === "commissionType") {
    session.commissionType = value;
    intakeSessions.set(interaction.user.id, session);
    await interaction.reply({
      content: "What level of work would you like?",
      components: createChoiceRows(completionLevelChoices, ids.levelPrefix),
      flags: EPHEMERAL_FLAGS
    });
    rememberWizardInteraction(interaction.user.id, interaction);
    return;
  }

  if (field === "completionLevel") {
    session.completionLevel = value;
    intakeSessions.set(interaction.user.id, session);
    await interaction.reply({
      content: "Is you request SFW or NSFW?",
      components: createChoiceRows(ratingChoices, ids.ratingPrefix),
      flags: EPHEMERAL_FLAGS
    });
    rememberWizardInteraction(interaction.user.id, interaction);
    return;
  }

  await interaction.reply({ content: "Unknown field.", flags: EPHEMERAL_FLAGS });
}

async function showDetailsModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(ids.detailsModal)
    .setTitle("Commission Request")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldPreferredHandle)
          .setLabel("Preferred name or handle")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldRequestDetails)
          .setLabel("Request details")
          .setPlaceholder("Please include as much detail as possible. You can upload image references later.")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldAvailabilityStartTime)
          .setLabel("Best contact start time")
          .setPlaceholder("HH:MM AM/PM")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldAvailabilityEndTime)
          .setLabel("Best contact end time")
          .setPlaceholder("HH:MM AM/PM")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldAvailabilityTimezone)
          .setLabel("Timezone")
          .setPlaceholder("CST, EST, PST, GMT+1...")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(50)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleDetailsModal(interaction, config) {
  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const session = getIntakeSession(interaction.user.id);
  if (!session.commissionType || !session.completionLevel || !session.contentRating || session.privateCommission == null || !Array.isArray(session.availabilityDays) || session.availabilityDays.length === 0) {
    await interaction.editReply("The request session expired. Please click Request again.");
    return;
  }
  await deleteStoredWizardMessages(interaction.user.id, interaction);

  const member = await interaction.guild.members.fetch(interaction.user.id);
  await ensureClientRole(member, config);

  const preferredHandle = readField(interaction, ids.fieldPreferredHandle);
  const commissionType = session.commissionType;
  const completionLevel = session.completionLevel;
  const contentRating = session.contentRating;
  const privateCommission = session.privateCommission === true;
  const requestDetails = readField(interaction, ids.fieldRequestDetails);
  const availabilityStartTime = readField(interaction, ids.fieldAvailabilityStartTime);
  const availabilityEndTime = readField(interaction, ids.fieldAvailabilityEndTime);
  const availabilityTimezone = readField(interaction, ids.fieldAvailabilityTimezone);

  upsertClient({
    discordUserId: interaction.user.id,
    preferredName: preferredHandle,
    clientRoleId: config.clientRoleId
  });

  const forum = await getOrCreateClientForum(interaction, member, preferredHandle, config);
  const thread = await createIntakeThread(forum, {
    clientMention: "<@" + interaction.user.id + ">",
    commissionType,
    completionLevel,
    contentRating,
    privateCommission,
    availabilityDays: session.availabilityDays,
    availabilityStartTime,
    availabilityEndTime,
    availabilityTimezone,
    requestDetails
  }, config);

  const commission = createCommission({
    discordUserId: interaction.user.id,
    forumChannelId: forum.id,
    threadId: thread.id,
    commissionType,
    completionLevel,
    contentRating,
    privateCommission,
    availabilityDays: session.availabilityDays,
    availabilityStartTime,
    availabilityEndTime,
    availabilityTimezone,
    requestDetails
  });

  await thread.send({
    content: "Next, upload any references here, then click Done Uploading when ready.",
    components: createUploadControlRows(commission.id)
  });
  await sendClientIntakeConfirmation(interaction.client, interaction.user.id, {
    guildId: interaction.guildId,
    forumId: forum.id,
    threadId: thread.id
  });

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "intake_created",
    payload: {
      userId: interaction.user.id,
      forumChannelId: forum.id,
      threadId: thread.id
    }
  });

  await interaction.editReply({
    content: "Request created: <#" + thread.id + ">. Please upload references in that thread."
  });
  scheduleDeleteInteractionReply(interaction);

  intakeSessions.delete(interaction.user.id);
}

async function handleDoneUploading(interaction) {
  const commissionId = interaction.customId.slice(ids.doneUploadingPrefix.length);
  const commission = getCommissionById(commissionId);

  if (!commission) {
    await interaction.reply({ content: "This request record could not be found.", flags: EPHEMERAL_FLAGS });
    return;
  }

  if (interaction.user.id !== commission.discordUserId && !memberCanManageCommissions(interaction.member, interaction.user.id)) {
    await interaction.reply({ content: "Only the client or staff can mark uploads done.", flags: EPHEMERAL_FLAGS });
    return;
  }

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "reference_uploads_done",
    payload: { userId: interaction.user.id }
  });

  await interaction.reply({
    content: "Reference uploads marked as done. This request is now awaiting review.",
    flags: EPHEMERAL_FLAGS
  });

  if (interaction.channel?.send) {
    await lockThread(interaction.channel);
    await interaction.channel.send({
      content: "This request is awaiting review. <@" + getCommissionConfig().ownerUserId + "> will review it as soon as possible.",
      components: createReviewControlRows(commission.id)
    });
  }
}

async function handleApprove(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can approve commission requests.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const commissionId = interaction.customId.slice(ids.approvePrefix.length);
  const commission = getCommissionById(commissionId);
  if (!commission) {
    await interaction.editReply("This request record could not be found.");
    return;
  }

  const clientRecord = getClient(commission.discordUserId);
  let trelloCard = {
    id: commission.trelloCardId,
    shortUrl: commission.trelloCardUrl
  };

  if (!commission.trelloCardId) {
    try {
      trelloCard = await createCommissionCard(commission, {
        preferredName: clientRecord?.preferredName
      });
    } catch (error) {
      await interaction.editReply(
        "Approval paused: " + error.message + "\nChoose a supported level of work or update the request before approving."
      );
      return;
    }
  }

  const updatedCommission = markCommissionApproved(commission.id, trelloCard);
  await moveChannelToCategory(interaction.client, updatedCommission.forumChannelId, config.activeCategoryId);
  await setThreadTags(interaction.client, updatedCommission.threadId, [config.tagNames.inQueue]);
  await unlockThreadById(interaction.client, updatedCommission.threadId);
  await deleteInteractionSourceMessage(interaction);
  await sendClientProgressConfirmation(interaction.client, updatedCommission.discordUserId, {
    guildId: interaction.guildId,
    forumId: updatedCommission.forumChannelId,
    threadId: updatedCommission.threadId,
    trelloUrl: updatedCommission.trelloCardUrl || trelloCard.shortUrl || ""
  });

  const thread = await interaction.client.channels.fetch(updatedCommission.threadId).catch(() => null);
  if (thread?.send) {
    await thread.send({
      content: "Commission accepted - Your request has joined the queue.\n\nTrello card: " + (updatedCommission.trelloCardUrl || trelloCard.shortUrl || "created"),
      components: createWorkflowStartRows(updatedCommission.id)
    });
  }

  appendSyncLog({
    commissionId: updatedCommission.id,
    source: "discord",
    action: "approved",
    payload: { trelloCardId: updatedCommission.trelloCardId }
  });

  await interaction.editReply("Request approved and linked to Trello.");
}

async function showRejectModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can reject commission requests.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const commissionId = interaction.customId.slice(ids.rejectPrefix.length);
  const modal = new ModalBuilder()
    .setCustomId(ids.rejectModalPrefix + commissionId)
    .setTitle("Reject Request")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldRejectReason)
          .setLabel("Reason for rejection")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleRejectModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can reject commission requests.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const commissionId = interaction.customId.slice(ids.rejectModalPrefix.length);
  const reason = readField(interaction, ids.fieldRejectReason);
  const commission = getCommissionById(commissionId);
  if (!commission) {
    await interaction.editReply("This request record could not be found.");
    return;
  }

  const updatedCommission = markCommissionRejected(commission.id, reason);
  await setThreadTags(interaction.client, updatedCommission.threadId, [config.tagNames.rejected]);

  const thread = await interaction.client.channels.fetch(updatedCommission.threadId).catch(() => null);
  if (thread?.send) {
    await thread.send("Request Rejected\n\nReason: " + reason);
  }

  await notifyClientOfRejection(interaction.client, updatedCommission.discordUserId, reason);
  await logRejectedRequest(interaction.client, updatedCommission, reason, config);

  if (updatedCommission.trelloCardId) {
    await addLabelToCard(updatedCommission.trelloCardId, config.trello.labelRejected).catch((error) => {
      console.warn("[Commission Portal] Failed to add rejected Trello label:", error.message);
    });
    await archiveCard(updatedCommission.trelloCardId).catch((error) => {
      console.warn("[Commission Portal] Failed to archive rejected Trello card:", error.message);
    });
  }

  if (thread?.delete) {
    await thread.delete("Commission request rejected").catch((error) => {
      console.warn("[Commission Portal] Failed to delete rejected request thread:", error.message);
    });
  }

  await moveChannelToCategory(interaction.client, updatedCommission.forumChannelId, config.completed2026CategoryId);

  appendSyncLog({
    commissionId: updatedCommission.id,
    source: "discord",
    action: "rejected",
    payload: { reason }
  });

  await interaction.editReply("Request rejected, documented, deleted, and moved to Completed.");
}

async function showAcceptedRejectReasonModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can provide commission rejection reasons.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const commissionId = interaction.customId.slice(ids.acceptedRejectReasonPrefix.length);
  const modal = new ModalBuilder()
    .setCustomId(ids.acceptedRejectReasonModalPrefix + commissionId)
    .setTitle("Reject Accepted Commission")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldRejectReason)
          .setLabel("Reason for rejection")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleAcceptedRejectReasonModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can provide commission rejection reasons.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const commissionId = interaction.customId.slice(ids.acceptedRejectReasonModalPrefix.length);
  const reason = readField(interaction, ids.fieldRejectReason);
  const commission = getCommissionById(commissionId);
  if (!commission) {
    await interaction.editReply("This commission record could not be found.");
    return;
  }

  const updatedCommission = markCommissionRejected(commission.id, reason);
  const thread = await interaction.client.channels.fetch(updatedCommission.threadId).catch(() => null);

  await notifyClientOfRejection(interaction.client, updatedCommission.discordUserId, reason);
  await logRejectedRequest(interaction.client, updatedCommission, reason, config);

  if (thread?.send) {
    await thread.send("Request Rejected\n\nReason: " + reason);
  }

  await prefixRejectedThreadTitle(thread);
  await lockThread(thread);
  await deleteInteractionSourceMessage(interaction);

  appendSyncLog({
    commissionId: updatedCommission.id,
    source: "discord",
    action: "accepted_commission_rejected",
    payload: { reason }
  });

  await interaction.editReply("Rejection reason sent to the client. The commission thread has been locked.");
}

async function handleCancelReasonSelection(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can cancel accepted commissions.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const payload = parseCustomIdParts(interaction.customId, ids.cancelReasonPrefix);
  const commissionId = payload[0];
  const reasonId = payload[1];
  const reason = cancelReasons[reasonId];
  if (!commissionId || !reason) {
    await interaction.reply({ content: "Unknown cancellation reason.", flags: EPHEMERAL_FLAGS });
    return;
  }

  if (reason.requiresRefundStatus) {
    await interaction.update({
      content: "Was a refund issued for this client-requested cancellation?",
      components: createCancelRefundRows(commissionId, reasonId)
    });
    return;
  }

  await showCancelDetailsModal(interaction, commissionId, reasonId, "");
}

async function handleCancelRefundSelection(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can cancel accepted commissions.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const payload = parseCustomIdParts(interaction.customId, ids.cancelRefundPrefix);
  const commissionId = payload[0];
  const reasonId = payload[1];
  const refundId = payload[2];

  if (!commissionId || !cancelReasons[reasonId] || !cancelRefundStatuses[refundId]) {
    await interaction.reply({ content: "Unknown refund selection.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await showCancelDetailsModal(interaction, commissionId, reasonId, refundId);
}

async function showCancelDetailsModal(interaction, commissionId, reasonId, refundId) {
  const reason = cancelReasons[reasonId];
  const modal = new ModalBuilder()
    .setCustomId([ids.cancelDetailsModalPrefix + commissionId, reasonId, refundId || "none"].join(":"))
    .setTitle(reason.detailsTitle)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldCancelDetails)
          .setLabel(reason.requiresDetails ? "Required details" : "Additional details")
          .setPlaceholder(reason.requiresDetails ? "Include the ToS section that was violated." : "Optional")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(reason.requiresDetails)
      )
    );

  await interaction.showModal(modal);
  await deleteInteractionSourceMessage(interaction);
}

async function handleCancelDetailsModal(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can cancel accepted commissions.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const payload = parseCustomIdParts(interaction.customId, ids.cancelDetailsModalPrefix);
  const commissionId = payload[0];
  const reasonId = payload[1];
  const refundId = payload[2] === "none" ? "" : payload[2];
  const reason = cancelReasons[reasonId];
  const commission = getCommissionById(commissionId);
  const details = readOptionalField(interaction, ids.fieldCancelDetails);

  if (!commission || !reason) {
    await interaction.editReply("This commission cancellation record could not be found.");
    return;
  }

  if (reason.requiresDetails && !details) {
    await interaction.editReply("Details are required for ToS violation cancellations.");
    return;
  }

  const updatedCommission = markCommissionCanceled(commission.id, buildCancellationStatusReason(reason.label, refundId, details));
  const thread = await interaction.client.channels.fetch(updatedCommission.threadId).catch(() => null);

  await notifyClientOfCancellation(interaction.client, updatedCommission.discordUserId, {
    reasonId,
    reasonLabel: reason.label,
    refundStatus: refundId ? cancelRefundStatuses[refundId] : "",
    details,
    tosUrl: createDiscordThreadUrl(interaction.guildId, config.tosChannelId)
  });

  await logCancellation(interaction.client, updatedCommission, {
    reasonLabel: reason.label,
    refundStatus: refundId ? cancelRefundStatuses[refundId] : "",
    details
  }, config);

  if (thread?.send) {
    await thread.send(createCancellationThreadMessage(reason.label, refundId ? cancelRefundStatuses[refundId] : "", details));
  }

  await updateThreadStatusIcon(thread, [config.tagNames.canceled], config);
  await lockThread(thread);
  await deleteInteractionSourceMessage(interaction);

  appendSyncLog({
    commissionId: updatedCommission.id,
    source: "discord",
    action: "accepted_commission_canceled",
    payload: {
      reason: reason.label,
      refundStatus: refundId ? cancelRefundStatuses[refundId] : "",
      details
    }
  });

  await interaction.editReply("Cancellation notice sent to the client. The commission thread has been locked.");
}

async function getOrCreateClientForum(interaction, member, preferredHandle, config) {
  return getOrCreateClientForumForClient(interaction, {
    discordUserId: interaction.user.id,
    member,
    preferredHandle,
    parentCategoryId: config.pendingCategoryId
  }, config);
}

async function getOrCreateClientForumForClient(interaction, input, config) {
  const existingClient = getClient(input.discordUserId);
  const template = await interaction.client.channels.fetch(config.clientForumTemplateId);
  if (!template || typeof template.clone !== "function") {
    throw new Error("Client forum template could not be found or cloned.");
  }

  if (existingClient?.forumChannelId) {
    let existingForum = await interaction.client.channels.fetch(existingClient.forumChannelId).catch(() => null);
    if (existingForum) {
      await existingForum.setParent(input.parentCategoryId, { lockPermissions: false }).catch(() => null);
      existingForum = await copyForumTemplateSettings(template, existingForum);
      if (input.member) {
        await applyClientForumPermission(existingForum, input.member);
      }
      return existingForum;
    }
  }

  let forum = await template.clone({
    name: toChannelName(input.preferredHandle, input.discordUserId),
    reason: "Commission portal client forum"
  });

  await forum.setParent(input.parentCategoryId, { lockPermissions: false });
  forum = await copyForumTemplateSettings(template, forum);
  if (input.member) {
    await applyClientForumPermission(forum, input.member);
  }
  setClientForum(input.discordUserId, forum.id);

  return forum;
}

async function createIntakeThread(forum, input, config) {
  const baseTitle = limitText([
    input.commissionType,
    input.completionLevel,
    input.contentRating
  ].join(" | "), 100);
  const title = await resolveForumThreadTitle(forum, baseTitle);
  const content = [
    "Commission Details:",
    "",
    "Client: " + input.clientMention,
    "Commission type: " + input.commissionType,
    "Level of work: " + input.completionLevel,
    "Rating: " + input.contentRating,
    "Private commission: " + (input.privateCommission ? "Yes" : "No"),
    "Availability: " + formatAvailability(input.availabilityDays, input.availabilityStartTime, input.availabilityEndTime, input.availabilityTimezone),
    "",
    input.requestDetails
  ].join("\n");
  const inQueueTagId = getForumTagIdByName(forum, config.tagNames.inQueue);

  try {
    return await forum.threads.create({
      name: title,
      appliedTags: [inQueueTagId].filter(Boolean),
      message: { content }
    });
  } catch (error) {
    console.warn("[Commission Portal] Failed to create thread with tags, retrying without tags:", error.message);
    return forum.threads.create({
      name: title,
      message: { content }
    });
  }
}

async function applyClientForumPermission(forum, member) {
  await forum.permissionOverwrites.edit(member.id, {
    ViewChannel: true,
    SendMessages: false,
    CreatePublicThreads: false,
    SendMessagesInThreads: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
    AddReactions: true
  });
}

async function copyForumTemplateSettings(template, forum) {
  if (!shouldSyncForumTags(template, forum)) {
    return forum;
  }

  const availableTags = Array.isArray(template.availableTags)
    ? template.availableTags.map((tag) => ({
      name: tag.name,
      moderated: tag.moderated === true,
      emoji: tag.emoji ? {
        id: tag.emoji.id || null,
        name: tag.emoji.name || null
      } : null
    }))
    : [];

  const editOptions = {
    availableTags,
    reason: "Commission portal template sync"
  };

  if (template.defaultReactionEmoji !== undefined) {
    editOptions.defaultReactionEmoji = template.defaultReactionEmoji;
  }

  if (template.defaultThreadRateLimitPerUser !== undefined) {
    editOptions.defaultThreadRateLimitPerUser = template.defaultThreadRateLimitPerUser;
  }

  if (template.defaultAutoArchiveDuration !== undefined) {
    editOptions.defaultAutoArchiveDuration = template.defaultAutoArchiveDuration;
  }

  if (template.defaultSortOrder !== undefined) {
    editOptions.defaultSortOrder = template.defaultSortOrder;
  }

  if (template.defaultForumLayout !== undefined) {
    editOptions.defaultForumLayout = template.defaultForumLayout;
  }

  if (typeof template.nsfw === "boolean") {
    editOptions.nsfw = template.nsfw;
  }

  if (template.topic !== undefined) {
    editOptions.topic = template.topic;
  }

  return forum.edit(editOptions).catch((error) => {
    console.warn("[Commission Portal] Failed to copy forum template settings:", error.message);
    return forum;
  });
}

async function ensureClientRole(member, config) {
  if (!config.clientRoleId || member.roles.cache.has(config.clientRoleId)) {
    return;
  }

  await member.roles.add(config.clientRoleId, "Commission portal client role");
}

async function moveChannelToCategory(client, channelId, categoryId) {
  if (!channelId || !categoryId) {
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel?.setParent) {
    await channel.setParent(categoryId, { lockPermissions: false });
  }
}

async function moveClientForumToCompletedIfIdle(client, commission, config) {
  if (!commission?.forumChannelId || !config.completed2026CategoryId) {
    return false;
  }

  const forum = await client.channels.fetch(commission.forumChannelId).catch(() => null);
  if (!forum?.setParent || !forum?.threads) {
    return false;
  }

  if (forum.parentId === config.completed2026CategoryId) {
    return false;
  }

  const hasQueueOrWipThread = await forumHasQueueOrWipThreads(forum, config);
  if (hasQueueOrWipThread) {
    return false;
  }

  await forum.setParent(config.completed2026CategoryId, { lockPermissions: false });
  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "client_forum_moved_to_completed",
    payload: {
      forumChannelId: forum.id,
      completedCategoryId: config.completed2026CategoryId
    }
  });
  return true;
}

async function forumHasQueueOrWipThreads(forum, config) {
  const activeTagIds = [
    getForumTagIdByName(forum, config.tagNames.inQueue),
    getForumTagIdByName(forum, config.tagNames.wip)
  ].filter(Boolean);

  if (activeTagIds.length === 0) {
    console.warn("[Commission Portal] Could not resolve In Queue/WIP tags for forum idle check:", forum.id);
    return true;
  }

  const threads = await fetchForumThreadsForIdleCheck(forum);
  return threads.some((thread) => {
    const appliedTagIds = new Set(thread.appliedTags || []);
    return activeTagIds.some((tagId) => appliedTagIds.has(tagId));
  });
}

async function fetchForumThreadsForIdleCheck(forum) {
  const threads = new Map();
  const addThreads = (collection) => {
    for (const thread of collection?.values?.() || []) {
      threads.set(thread.id, thread);
    }
  };

  const activeThreads = await forum.threads.fetchActive().catch((error) => {
    console.warn("[Commission Portal] Failed to fetch active forum threads for idle check:", error.message);
    return null;
  });
  addThreads(activeThreads?.threads || activeThreads);

  for (const type of ["public", "private"]) {
    const archivedThreads = await forum.threads.fetchArchived({ type, limit: 100 }).catch(() => null);
    addThreads(archivedThreads?.threads || archivedThreads);
  }

  return Array.from(threads.values());
}

async function setThreadTags(client, threadId, tagNames) {
  const thread = await client.channels.fetch(threadId).catch(() => null);
  if (!thread?.setAppliedTags) {
    return;
  }

  const parent = thread.parent || await client.channels.fetch(thread.parentId).catch(() => null);
  const tagIds = tagNames
    .map((tagName) => getForumTagIdByName(parent, tagName))
    .filter(Boolean);

  if (tagIds.length > 0) {
    await thread.setAppliedTags(tagIds);
  }
}

async function updateThreadTags(client, threadId, input) {
  const thread = await client.channels.fetch(threadId).catch(() => null);
  if (!thread?.setAppliedTags) {
    return [];
  }

  const parent = thread.parent || await client.channels.fetch(thread.parentId).catch(() => null);
  const currentTagIds = new Set(thread.appliedTags || []);
  const removeIds = new Set((input.removeTagNames || [])
    .map((tagName) => getForumTagIdByName(parent, tagName))
    .filter(Boolean));
  const addIds = (input.addTagNames || [])
    .map((tagName) => getForumTagIdByName(parent, tagName))
    .filter(Boolean);

  for (const tagId of removeIds) {
    currentTagIds.delete(tagId);
  }

  for (const tagId of addIds) {
    currentTagIds.add(tagId);
  }

  const nextTagIds = Array.from(currentTagIds);
  await thread.setAppliedTags(nextTagIds);
  return nextTagIds;
}

async function waitForThreadTagState(client, threadId, input, attempts = 5, delayMs = 500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const thread = await client.channels.fetch(threadId).catch(() => null);
    const freshThread = typeof thread?.fetch === "function"
      ? await thread.fetch().catch(() => thread)
      : thread;

    if (!freshThread?.id) {
      return false;
    }

    const parent = freshThread.parent || await client.channels.fetch(freshThread.parentId).catch(() => null);
    const appliedTagIds = new Set(freshThread.appliedTags || []);
    const requiredTagIds = (input.requiredTagNames || [])
      .map((tagName) => getForumTagIdByName(parent, tagName))
      .filter(Boolean);
    const absentTagIds = (input.absentTagNames || [])
      .map((tagName) => getForumTagIdByName(parent, tagName))
      .filter(Boolean);

    const hasRequiredTags = requiredTagIds.every((tagId) => appliedTagIds.has(tagId));
    const lacksAbsentTags = absentTagIds.every((tagId) => !appliedTagIds.has(tagId));

    if (hasRequiredTags && lacksAbsentTags) {
      return true;
    }

    await wait(delayMs);
  }

  return false;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lockThread(channel) {
  if (!channel) {
    return;
  }

  if (typeof channel.setLocked === "function") {
    await channel.setLocked(true, "Commission request awaiting staff review").catch((error) => {
      console.warn("[Commission Portal] Failed to lock request thread:", error.message);
    });
  }

  if (typeof channel.setArchived === "function" && channel.archived) {
    await channel.setArchived(false, "Commission request awaiting staff review").catch(() => null);
  }
}

async function unlockThreadById(client, threadId) {
  const thread = await client.channels.fetch(threadId).catch(() => null);
  if (typeof thread?.setLocked === "function") {
    await thread.setLocked(false, "Commission request approved").catch((error) => {
      console.warn("[Commission Portal] Failed to unlock approved request thread:", error.message);
    });
  }
}

function shouldPromptAcceptedRejectionReason(tagNames, commission, config) {
  const names = new Set((tagNames || []).map(normalizeComparable));
  const has = (tagName) => names.has(normalizeComparable(tagName));
  const hasRejected = has(config.tagNames.rejected);
  const lacksQueueProgressTags = !has(config.tagNames.inQueue) &&
    !has(config.tagNames.wip) &&
    !has(config.tagNames.completed);

  return hasRejected &&
    lacksQueueProgressTags &&
    commission.trelloCardId &&
    commission.status !== "rejected" &&
    commission.status !== "rejection_reason_requested";
}

function hasTagName(tagNames, tagName) {
  const names = new Set((tagNames || []).map(normalizeComparable));
  return names.has(normalizeComparable(tagName));
}

function shouldPromptAcceptedCancellationReason(tagNames, commission, config) {
  const names = new Set((tagNames || []).map(normalizeComparable));
  const has = (tagName) => names.has(normalizeComparable(tagName));
  const hasCanceled = has(config.tagNames.canceled);
  const lacksQueueProgressTags = !has(config.tagNames.inQueue) &&
    !has(config.tagNames.wip) &&
    !has(config.tagNames.completed);

  return hasCanceled &&
    lacksQueueProgressTags &&
    commission.trelloCardId &&
    commission.status !== "rejected" &&
    commission.status !== "cancellation_reason_requested";
}

async function promptAcceptedRejectionReason(thread, commission, config) {
  markCommissionRejectionReasonRequested(commission.id);

  if (!thread?.send) {
    return;
  }

  await thread.send({
    content: "The Rejected tag was applied to this accepted commission. Please provide a reason before the client is notified.",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.acceptedRejectReasonPrefix + commission.id)
          .setLabel("Provide Rejection Reason")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  });
}

async function promptAcceptedCancellationReason(thread, commission) {
  markCommissionCancellationReasonRequested(commission.id);

  if (!thread?.send) {
    return;
  }

  await thread.send({
    content: "The Canceled tag was applied to this accepted commission. Please select a cancellation reason before the client is notified.",
    components: createCancelReasonRows(commission.id)
  });
}

async function prefixRejectedThreadTitle(thread) {
  if (!thread?.setName || !thread.name || thread.name.startsWith("🚫")) {
    return;
  }

  await thread.setName(limitText("🚫 " + thread.name, 100), "Commission rejected").catch((error) => {
    console.warn("[Commission Portal] Failed to prefix rejected thread title:", error.message);
  });
}

async function updateThreadStatusIcon(thread, tagNames, config) {
  if (!thread?.setName || !thread.name) {
    return;
  }

  const icon = getStatusIconForTags(tagNames, config);
  const titleWithoutIcon = stripStatusTitleIcon(thread.name);
  const nextTitle = limitText(icon ? icon + " " + titleWithoutIcon : titleWithoutIcon, 100);

  if (nextTitle && nextTitle !== thread.name) {
    await thread.setName(nextTitle, "Commission status tag updated").catch((error) => {
      console.warn("[Commission Portal] Failed to update thread status icon:", error.message);
    });
  }
}

function getStatusIconForTags(tagNames, config) {
  const names = new Set((tagNames || []).map(normalizeComparable));
  const matching = statusTitleIcons
    .filter((entry) => names.has(normalizeComparable(config.tagNames[entry.tagKey])))
    .sort((left, right) => right.priority - left.priority);

  return matching[0]?.icon || "";
}

function stripStatusTitleIcon(title) {
  let result = String(title || "").trim();

  for (const entry of statusTitleIcons) {
    if (result.startsWith(entry.icon)) {
      result = result.slice(entry.icon.length).trim();
    }
  }

  return result;
}

async function notifyClientOfRejection(client, discordUserId, reason) {
  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user) {
    return;
  }

  await user.send([
    "Hello,",
    "",
    "My sincerest appologies. I was not able to accept your commission request. I've provided more details below:",
    "",
    "Reason: " + reason,
    "",
    "If you have any other requests, or would like to submit an alteration to your previous request I'd be happy to consider it."
  ].join("\n")).catch((error) => {
    console.warn("[Commission Portal] Failed to DM rejection reason:", error.message);
  });
}

async function notifyClientOfCancellation(client, discordUserId, input) {
  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user) {
    return;
  }

  await user.send(createCancellationClientMessage(input)).catch((error) => {
    console.warn("[Commission Portal] Failed to DM cancellation notice:", error.message);
  });
}

function createCancellationClientMessage(input) {
  const lines = [];

  if (input.reasonId === "client_requested") {
    lines.push(
      "**Commission canceled**",
      "",
      "Your commission has been canceled as requested.",
      "",
      "Refund status: " + (input.refundStatus || "Not provided")
    );
  } else if (input.reasonId === "tos_violation") {
    lines.push(
      "**Commission canceled**",
      "",
      "Your commission has been canceled due to a Terms of Service violation.",
      "",
      "Terms of Service: " + input.tosUrl
    );
  } else {
    lines.push(
      "**Commission canceled**",
      "",
      "I’m sorry, but I need to cancel this commission on my end."
    );
  }

  if (input.details) {
    lines.push("", "Additional details:", input.details);
  }

  return lines.join("\n");
}

function createCancellationThreadMessage(reasonLabel, refundStatus, details) {
  const lines = [
    "Commission Canceled",
    "",
    "Reason: " + reasonLabel
  ];

  if (refundStatus) {
    lines.push("Refund status: " + refundStatus);
  }

  if (details) {
    lines.push("", "Additional details:", details);
  }

  return lines.join("\n");
}

function buildCancellationStatusReason(reasonLabel, refundId, details) {
  return [
    "Cancellation: " + reasonLabel,
    refundId ? "Refund: " + cancelRefundStatuses[refundId] : "",
    details ? "Details: " + details : ""
  ].filter(Boolean).join("\n");
}

async function sendClientIntakeConfirmation(client, discordUserId, input) {
  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user) {
    return;
  }

  const forumUrl = createDiscordThreadUrl(input.guildId, input.forumId);
  const threadUrl = createDiscordThreadUrl(input.guildId, input.threadId);
  const content = [
    "**Commission request received**",
    "",
    "Thanks so much for your interest! I can't wait to take a look. Below is a handy shortcut to your Client Folder, and a link to your current commission. Once I've had a chance to look it over, you'll get a new message with further info.",
    "",
    "**Client Folder**",
    "[Open client folder](" + forumUrl + ")",
    "",
    "**Current Commission Request**",
    "[Open request thread](" + threadUrl + ")",
    "",
    "**Next Step**",
    "Upload reference images and details in the commission request thread, then click **Done Uploading**."
  ].join("\n");

  await user.send(content).catch((error) => {
    console.warn("[Commission Portal] Failed to DM intake confirmation:", error.message);
  });
}

async function sendClientProgressConfirmation(client, discordUserId, input) {
  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user || !input.trelloUrl) {
    return;
  }

  const forumUrl = createDiscordThreadUrl(input.guildId, input.forumId);
  const threadUrl = createDiscordThreadUrl(input.guildId, input.threadId);
  const content = [
    "**Commission accepted**",
    "",
    "Thanks for your patience. I'd be happy to work on this with you! Here is a link were you can keep an eye on the progress of your piece. I'll post any upates to your discord channel and ping you when needed.",
    "",
    "**Commission Progress**",
    "[View Trello card](" + input.trelloUrl + ")"
  ].join("\n");

  await user.send(content).catch((error) => {
    console.warn("[Commission Portal] Failed to DM progress confirmation:", error.message);
  });
}

async function sendManualCommissionLinksDm(client, discordUserId, input) {
  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user) {
    return false;
  }

  const forumUrl = createDiscordThreadUrl(input.guildId, input.forumId);
  const threadUrl = createDiscordThreadUrl(input.guildId, input.threadId);
  const content = [
    "**Commission accepted**",
    "",
    "Here are the links for your commission record.",
    "",
    "**Client Folder**",
    "[Open client folder](" + forumUrl + ")",
    "",
    "**Current Commission Request**",
    "[Open request thread](" + threadUrl + ")",
    "",
    "**Commission Progress**",
    input.trelloUrl ? "[View Trello card](" + input.trelloUrl + ")" : "Trello card link unavailable"
  ].join("\n");

  return user.send(content)
    .then(() => true)
    .catch((error) => {
      console.warn("[Commission Portal] Failed to DM manual commission links:", error.message);
      return false;
    });
}

async function notifyClientOfApprovalRequest(client, discordUserId, input) {
  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user) {
    return false;
  }

  const content = [
    "**Approval needed**",
    "",
    "I have an update ready for your review: " + input.stageLabel + ".",
    "",
    input.sourceUrl ? "Review link: " + input.sourceUrl : "Thread: " + input.threadUrl,
    "",
    "Please open the thread and choose **Approve** or **Request Changes**."
  ].join("\n");

  return user.send(content)
    .then(() => true)
    .catch((error) => {
      console.warn("[Commission Portal] Failed to DM approval request:", error.message);
      return false;
    });
}

async function notifyClientOfStaffQuestion(client, discordUserId, input) {
  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user) {
    return false;
  }

  const content = [
    "**Question about your commission**",
    "",
    input.question,
    "",
    input.sourceUrl ? "Reference: " + input.sourceUrl : "Thread: " + input.threadUrl,
    "",
    "You can reply here and I'll relay it back to your commission thread."
  ].join("\n");

  return user.send(content)
    .then(() => true)
    .catch((error) => {
      console.warn("[Commission Portal] Failed to DM staff question:", error.message);
      return false;
    });
}

async function notifyOwnerOfRequestedChanges(client, commission, input, config) {
  const owner = await client.users.fetch(config.ownerUserId).catch(() => null);
  if (!owner) {
    return false;
  }

  const threadUrl = createDiscordThreadUrl(input.guildId, commission.threadId);
  const content = [
    "**Commission changes requested**",
    "",
    "Stage: " + input.stageLabel,
    "Thread: " + threadUrl,
    "",
    input.changes
  ].join("\n");

  return owner.send(content)
    .then(() => true)
    .catch((error) => {
      console.warn("[Commission Portal] Failed to DM requested changes to owner:", error.message);
      return false;
    });
}

async function sendClientFeedbackRequest(client, discordUserId, input) {
  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user) {
    return false;
  }

  const message = await user.send({
    content: [
      "**Thank you for commissioning me!**",
      "",
      "If you have a moment, I would appreciate feedback on your experience. Click the button below to open the feedback form, or react with " + FEEDBACK_SKIP_EMOJI_NAME + " to skip and remove this message."
    ].join("\n"),
    components: createFeedbackRows(input.commissionId)
  }).catch((error) => {
    console.warn("[Commission Portal] Failed to DM feedback request:", error.message);
    return null;
  });

  if (!message) {
    return false;
  }

  feedbackMessageSessions.set(message.id, {
    commissionId: input.commissionId,
    discordUserId
  });
  await message.react(FEEDBACK_SKIP_EMOJI_NAME).catch(() => null);
  return true;
}

async function showFeedbackModal(interaction) {
  const commissionId = interaction.customId.slice(ids.feedbackOpenPrefix.length);
  const session = feedbackMessageSessions.get(interaction.message?.id);

  feedbackSessions.set(interaction.user.id, {
    commissionId,
    messageId: interaction.message?.id || "",
    channelId: interaction.channelId,
    createdAt: new Date().toISOString()
  });

  const modal = new ModalBuilder()
    .setCustomId(ids.feedbackModalPrefix + commissionId)
    .setTitle("Commission Feedback")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldFeedbackCommunication)
          .setLabel("Communication rating, 1-5")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldFeedbackTimeliness)
          .setLabel("Timeliness rating, 1-5")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldFeedbackQuality)
          .setLabel("Quality of work rating, 1-5")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldFeedbackOverall)
          .setLabel("Overall satisfaction rating, 1-5")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldFeedbackAutomation)
          .setLabel("Automation rating + comments")
          .setPlaceholder("Automation 1-5, plus any general feedback.")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(false)
      )
    );

  if (session) {
    feedbackMessageSessions.set(interaction.message.id, session);
  }

  await interaction.showModal(modal);
}

async function handleFeedbackModal(interaction) {
  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const config = getCommissionConfig();
  const commissionId = interaction.customId.slice(ids.feedbackModalPrefix.length);
  const session = feedbackSessions.get(interaction.user.id);
  const feedback = {
    communication: readField(interaction, ids.fieldFeedbackCommunication),
    timeliness: readField(interaction, ids.fieldFeedbackTimeliness),
    quality: readField(interaction, ids.fieldFeedbackQuality),
    overall: readField(interaction, ids.fieldFeedbackOverall),
    automationAndComments: readOptionalField(interaction, ids.fieldFeedbackAutomation)
  };
  const commission = getCommissionById(commissionId);

  if (commission) {
    const commissionThreadUrl = await getCommissionThreadUrl(interaction.client, commission);
    await sendFeedbackLogMessage(interaction.client, config, [
      "**Client feedback received**",
      "",
      "Commission ID: " + commission.id,
      "Client: <@" + interaction.user.id + ">",
      "Commission Post: " + (commissionThreadUrl || "<#" + commission.threadId + ">"),
      commission.trelloCardUrl ? "Trello Card: " + commission.trelloCardUrl : "",
      "",
      "Communication: " + feedback.communication,
      "Timeliness: " + feedback.timeliness,
      "Quality of Work: " + feedback.quality,
      "Overall Satisfaction: " + feedback.overall,
      "Automated Process / General Feedback: " + (feedback.automationAndComments || "Not provided")
    ].filter(Boolean).join("\n"));

    appendSyncLog({
      commissionId: commission.id,
      source: "discord_dm",
      action: "client_feedback_received",
      payload: {
        userId: interaction.user.id,
        feedback
      }
    });
  }

  if (session?.messageId && interaction.channel?.messages?.fetch) {
    const feedbackMessage = await interaction.channel.messages.fetch(session.messageId).catch(() => null);
    await feedbackMessage?.delete?.().catch(() => null);
    feedbackMessageSessions.delete(session.messageId);
  }
  feedbackSessions.delete(interaction.user.id);

  await interaction.editReply("Thank you for the feedback.");
}

async function handleFeedbackSkipReaction(message, user) {
  const session = feedbackMessageSessions.get(message.id);
  if (!session || session.discordUserId !== user.id) {
    return false;
  }

  const config = getCommissionConfig();
  const commission = getCommissionById(session.commissionId);
  appendSyncLog({
    commissionId: session.commissionId,
    source: "discord_dm",
    action: "client_feedback_skipped",
    payload: {
      userId: user.id
    }
  });

  feedbackMessageSessions.delete(message.id);
  await message.delete().catch(() => null);

  if (commission) {
    const commissionThreadUrl = await getCommissionThreadUrl(message.client, commission);
    await sendFeedbackLogMessage(message.client, config, [
      "**Client skipped feedback form**",
      "",
      "Commission ID: " + commission.id,
      "Client: <@" + user.id + ">",
      "Commission Post: " + (commissionThreadUrl || "<#" + commission.threadId + ">"),
      commission.trelloCardUrl ? "Trello Card: " + commission.trelloCardUrl : ""
    ].filter(Boolean).join("\n"));
  }

  return true;
}

async function sendFeedbackLogMessage(client, config, content) {
  const feedbackThread = await client.channels.fetch(config.feedbackLogThreadId).catch((error) => {
    console.warn("[Commission Portal] Failed to fetch feedback log thread:", error.message);
    return null;
  });

  if (!feedbackThread?.send) {
    console.warn("[Commission Portal] Feedback log thread is unavailable:", config.feedbackLogThreadId);
    return false;
  }

  await feedbackThread.send(content).catch((error) => {
    console.warn("[Commission Portal] Failed to write feedback log:", error.message);
  });
  return true;
}

async function getCommissionThreadUrl(client, commission) {
  const thread = await client.channels.fetch(commission.threadId).catch(() => null);
  return createDiscordThreadUrl(thread?.guildId, commission.threadId);
}

function createRequestEmbed(config) {
  return new EmbedBuilder()
    .setTitle("Commission Requests")
    .setDescription("Thanks so much for your interest! Please make sure you've taken a moment to look over my Pricing and Terms. Once you're ready, click the button below!\n\nPricing: <#" + config.pricingChannelId + ">\nTerms: <#" + config.tosChannelId + ">")
    .setColor(0x7c5cff);
}

function createUploadControlRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.doneUploadingPrefix + commissionId)
        .setLabel("Done Uploading")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

function createReviewControlRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.approvePrefix + commissionId)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(ids.rejectPrefix + commissionId)
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function createManualDmChoiceRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.manualDmSendPrefix + commissionId)
        .setLabel("Send Links DM")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(ids.manualDmSkipPrefix + commissionId)
        .setLabel("Skip DM")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createWorkflowStartRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.workflowStartPrefix + commissionId)
        .setLabel("Start Work / Meeting Complete")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

function createWorkflowReviewActionRows(commissionId, messageId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.workflowRequestApprovalPrefix + commissionId + ":" + messageId)
        .setLabel("Request Approval")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(ids.workflowAskQuestionPrefix + commissionId + ":" + messageId)
        .setLabel("Ask Client Question")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createClientApprovalRows(commissionId, stageId) {
  return createClientApprovalRowsWithSource(commissionId, stageId, "");
}

function createClientApprovalRowsWithSource(commissionId, stageId, sourceMessageId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.workflowClientApprovePrefix + commissionId + ":" + stageId + ":" + (sourceMessageId || "none"))
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(ids.workflowClientChangesPrefix + commissionId + ":" + stageId)
        .setLabel("Request Changes")
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function createInitialPaymentRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.workflowInitialPaymentPrefix + commissionId + ":received")
        .setLabel("Confirm Payment Received")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(ids.workflowInitialPaymentPrefix + commissionId + ":none")
        .setLabel("No Payment Needed")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createFinalPaymentRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.workflowFinalPaymentPrefix + commissionId + ":received")
        .setLabel("Confirm Final Payment")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(ids.workflowFinalPaymentPrefix + commissionId + ":pending")
        .setLabel("Still Pending")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createDeliveryStatusRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.workflowDeliveryStatusPrefix + commissionId + ":delivered")
        .setLabel("Delivered")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(ids.workflowDeliveryStatusPrefix + commissionId + ":not_delivered")
        .setLabel("Not Delivered Yet")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createDeliveryCompleteRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.workflowDeliveryCompletePrefix + commissionId)
        .setLabel("Delivery Complete")
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function createFeedbackRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.feedbackOpenPrefix + commissionId)
        .setLabel("Leave Feedback")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

function createCancelReasonRows(commissionId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.cancelReasonPrefix + commissionId + ":client_requested")
        .setLabel("Client Requested")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(ids.cancelReasonPrefix + commissionId + ":tos_violation")
        .setLabel("ToS violation")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(ids.cancelReasonPrefix + commissionId + ":artist_needs_to_cancel")
        .setLabel("Artist needs to cancel")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createCancelRefundRows(commissionId, reasonId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.cancelRefundPrefix + commissionId + ":" + reasonId + ":yes")
        .setLabel("Yes")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(ids.cancelRefundPrefix + commissionId + ":" + reasonId + ":no")
        .setLabel("No")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(ids.cancelRefundPrefix + commissionId + ":" + reasonId + ":payment_not_received")
        .setLabel("Payment not received")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createChoiceRows(choices, prefix) {
  const buttons = choices.map((choice) =>
    new ButtonBuilder()
      .setCustomId(prefix + choice.id)
      .setLabel(choice.buttonLabel || choice.label)
      .setStyle(ButtonStyle.Secondary)
  );
  const rows = [];

  for (let i = 0; i < buttons.length; i += 4) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 4)));
  }

  return rows;
}

function createAvailabilityDayRows(selectedDays) {
  const selected = new Set(selectedDays || []);
  const rows = [];
  const dayButtons = availabilityDayChoices.map((choice) =>
    new ButtonBuilder()
      .setCustomId(ids.availabilityDayPrefix + choice.id)
      .setLabel(choice.buttonLabel)
      .setStyle(selected.has(choice.label) ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  for (let i = 0; i < dayButtons.length; i += 4) {
    rows.push(new ActionRowBuilder().addComponents(dayButtons.slice(i, i + 4)));
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.availabilityContinue)
        .setLabel("Continue")
        .setStyle(ButtonStyle.Primary)
    )
  );

  return rows;
}

function getForumTagIdByName(forum, tagName) {
  const normalizedName = normalizeComparable(tagName);
  const tag = (forum?.availableTags || []).find((availableTag) =>
    normalizeComparable(availableTag.name) === normalizedName
  );

  return tag?.id || "";
}

function getAppliedTagNames(forum, tagIds) {
  const tags = forum?.availableTags || [];
  const tagIdSet = new Set(tagIds || []);

  return tags
    .filter((tag) => tagIdSet.has(tag.id))
    .map((tag) => tag.name);
}

function buildTrelloSyncPlan(tagNames, config) {
  const names = new Set((tagNames || []).map(normalizeComparable));
  const labels = [];
  let listId = "";
  let archive = false;

  const has = (tagName) => names.has(normalizeComparable(tagName));

  if (has(config.tagNames.inQueue)) {
    listId = config.trello.listInQueue;
  }

  if (has(config.tagNames.wip)) {
    listId = config.trello.listInProgress;
    labels.push(config.trello.labelWip);
  }

  if (has(config.tagNames.completed)) {
    listId = config.trello.listCompleted;
    labels.push(config.trello.labelCompleted);
  }

  if (has(config.tagNames.onHold)) {
    labels.push(config.trello.labelOnHold);
  }

  if (has(config.tagNames.halfPaymentReceived)) {
    labels.push(config.trello.labelHalfPaymentReceived);
  }

  if (has(config.tagNames.paidInFull)) {
    labels.push(config.trello.labelPaid);
  }

  if (has(config.tagNames.installmentPlan)) {
    labels.push(config.trello.labelInstallmentPlan);
  }

  if (has(config.tagNames.meetingRequired)) {
    labels.push(config.trello.labelMeetingRequired);
  }

  if (has(config.tagNames.canceled)) {
    listId = config.trello.listCompleted;
    labels.push(config.trello.labelCanceled);
    archive = true;
  }

  if (has(config.tagNames.rejected)) {
    listId = config.trello.listCompleted;
    labels.push(config.trello.labelRejected);
    archive = true;
  }

  if (hasAnyAwaitingClientResponseTag(names, config)) {
    labels.push(config.trello.labelAwaitingClientResponse);
  }

  return {
    archive,
    labelIds: uniqueStrings(labels),
    listId
  };
}

function hasAnyAwaitingClientResponseTag(normalizedTagNames, config) {
  return [
    config.tagNames.meetingRequired,
    config.tagNames.waitingSketchApproval,
    config.tagNames.waitingLineArtApproval,
    config.tagNames.waitingFlatsShadingApproval,
    config.tagNames.waitingFullRenderApproval,
    config.tagNames.waitingPaintingApproval
  ].some((tagName) => normalizedTagNames.has(normalizeComparable(tagName)));
}

async function completeChecklistItemsForTagNames(commission, tagNames, config) {
  if (!commission?.trelloCardId) {
    return [];
  }

  const names = new Set((tagNames || []).map(normalizeComparable));
  const items = [];
  const has = (tagName) => names.has(normalizeComparable(tagName));

  for (const stage of workflowStages) {
    if (has(config.tagNames[stage.waitingTagKey])) {
      items.push(stage.pendingItem);
    }

    if (has(config.tagNames[stage.approvedTagKey])) {
      items.push(stage.approvedItem);
      if (stage.id === "sketch") {
        items.push("Initial payment pending");
      }

      const nextItem = stage.id === "sketch" ? "" : getNextChecklistItemAfterApproval(commission, stage);
      if (nextItem) {
        items.push(nextItem);
      }
    }
  }

  if (has(config.tagNames.halfPaymentReceived)) {
    items.push("Initial payment received");
    const initialPaymentNextItem = getInitialPaymentNextChecklistItem(commission);
    if (initialPaymentNextItem) {
      items.push(initialPaymentNextItem);
    }
  }

  if (has(config.tagNames.paidInFull) || has(config.tagNames.completed)) {
    items.push("Payment received - Order delivered");
  }

  return completeChecklistItemsByName(commission.trelloCardId, uniqueStrings(items));
}

async function promptFinalPaymentIfNeeded(thread, commission, completedChecklistItems) {
  if (!thread?.send || !commission?.id || finalPaymentPrompted.has(String(commission.id))) {
    return;
  }

  const completed = new Set((completedChecklistItems || []).map(normalizeComparable));
  if (!completed.has(normalizeComparable("Pending final payment"))) {
    return;
  }

  finalPaymentPrompted.add(String(commission.id));
  await thread.send({
    content: "Pending final payment is now checked. Has the final payment been received?",
    components: createFinalPaymentRows(commission.id)
  });

  appendSyncLog({
    commissionId: commission.id,
    source: "discord",
    action: "workflow_final_payment_prompted",
    payload: {
      completedChecklistItems
    }
  });
}

function determineNextWorkflowStage(commission, checklists) {
  const completed = getCompletedChecklistItemNameSet(checklists);
  return getWorkflowStageSequence(commission).find((stage) => !completed.has(normalizeComparable(stage.approvedItem))) || null;
}

function getWorkflowStageById(stageId) {
  return workflowStages.find((stage) => stage.id === stageId) || null;
}

function getWorkflowStageSequence(commission) {
  const level = normalizeComparable(commission?.completionLevel);
  const byId = (stageId) => getWorkflowStageById(stageId);

  if (level.includes("paint")) {
    return [byId("sketch"), byId("painting")].filter(Boolean);
  }

  if (level.includes("render")) {
    return [byId("sketch"), byId("line_art"), byId("flats_shading"), byId("full_render")].filter(Boolean);
  }

  if (level.includes("flat") || level.includes("shading")) {
    return [byId("sketch"), byId("line_art"), byId("flats_shading")].filter(Boolean);
  }

  return [byId("sketch"), byId("line_art")].filter(Boolean);
}

function getNextChecklistItemAfterApproval(commission, stage) {
  const level = normalizeComparable(commission?.completionLevel);

  if (stage.id === "sketch") {
    return "";
  }

  if (stage.id === "line_art") {
    if (level.includes("flat") || level.includes("shading") || level.includes("render")) {
      return "Flats & Shading in progress";
    }

    return "Pending final payment";
  }

  if (stage.id === "flats_shading") {
    return level.includes("render") ? "Full render in progress" : "Pending final payment";
  }

  if (stage.id === "full_render" || stage.id === "painting") {
    return "Pending final payment";
  }

  return "";
}

function getInitialPaymentNextChecklistItem(commission) {
  const level = normalizeComparable(commission?.completionLevel);
  return level.includes("paint") ? "Painting in progress" : "Line art in progress";
}

function getCompletedChecklistItemNameSet(checklists) {
  const completed = new Set();

  for (const checklist of checklists || []) {
    for (const item of checklist.checkItems || []) {
      if (item.state === "complete") {
        completed.add(normalizeComparable(item.name));
      }
    }
  }

  return completed;
}

function getWorkflowWaitingTagNames(config) {
  return workflowStages
    .map((stage) => config.tagNames[stage.waitingTagKey])
    .filter(Boolean);
}

function getManagedTrelloLabelIds(config) {
  return uniqueStrings([
    config.trello.labelCompleted,
    config.trello.labelWip,
    config.trello.labelCanceled,
    config.trello.labelAwaitingClientResponse,
    config.trello.labelPaid,
    config.trello.labelInstallmentPlan,
    config.trello.labelMeetingRequired,
    config.trello.labelHalfPaymentReceived,
    config.trello.labelOnHold,
    config.trello.labelRejected
  ]);
}

function shouldSyncForumTags(template, forum) {
  const templateTagNames = new Set((template?.availableTags || []).map((tag) => normalizeComparable(tag.name)));
  const forumTagNames = new Set((forum?.availableTags || []).map((tag) => normalizeComparable(tag.name)));

  if (templateTagNames.size === 0) {
    return false;
  }

  for (const tagName of templateTagNames) {
    if (!forumTagNames.has(tagName)) {
      return true;
    }
  }

  return false;
}

function getIntakeSession(userId) {
  return intakeSessions.get(userId) || {
    startedAt: new Date().toISOString(),
    cleanupInteractions: []
  };
}

function getWizardCleanupInteractions(userId) {
  return getIntakeSession(userId).cleanupInteractions || [];
}

function rememberWizardInteraction(userId, interaction) {
  const session = getIntakeSession(userId);
  const cleanupInteractions = session.cleanupInteractions || [];

  if (!cleanupInteractions.some((item) => item.id === interaction.id)) {
    cleanupInteractions.push(interaction);
  }

  session.cleanupInteractions = cleanupInteractions.slice(-12);
  intakeSessions.set(userId, session);
}

async function deleteStoredWizardMessages(userId, currentInteraction) {
  const cleanupInteractions = getWizardCleanupInteractions(userId);
  await Promise.all(cleanupInteractions.map(async (interaction) => {
    if (!interaction || interaction.id === currentInteraction.id) {
      return;
    }

    await interaction.deleteReply().catch(() => null);
  }));

  const session = getIntakeSession(userId);
  session.cleanupInteractions = [];
  intakeSessions.set(userId, session);
}

function scheduleDeleteInteractionReply(interaction, delayMs = 8000) {
  setTimeout(() => {
    interaction.deleteReply().catch(() => null);
  }, delayMs);
}

async function deleteInteractionSourceMessage(interaction) {
  if (interaction.message?.delete) {
    await interaction.message.delete().catch((error) => {
      console.warn("[Commission Portal] Failed to delete staff control message:", error.message);
    });
  }
}

async function resolveForumThreadTitle(forum, baseTitle) {
  const normalizedBase = String(baseTitle || "").trim();
  const activeThreads = await forum.threads.fetchActive().catch(() => null);
  const duplicate = activeThreads?.threads?.some((thread) => thread.name === normalizedBase);

  if (!duplicate) {
    return normalizedBase;
  }

  return limitText(normalizedBase + " | " + createShortRequestSuffix(), 100);
}

function createShortRequestSuffix() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");

  return month + day + "-" + hour + minute;
}

async function logRejectedRequest(client, commission, reason, config) {
  const channel = await client.channels.fetch(config.loggingChannelId).catch(() => null);
  if (!channel?.send) {
    return;
  }

  const clientRecord = getClient(commission.discordUserId);
  const embed = new EmbedBuilder()
    .setTitle("Commission Request Rejected")
    .setColor(0xcc3333)
    .addFields(
      { name: "Client", value: "<@" + commission.discordUserId + ">", inline: true },
      { name: "Preferred name", value: limitText(clientRecord?.preferredName || "Unknown", 1024), inline: true },
      { name: "Commission type", value: limitText(commission.commissionType, 1024), inline: true },
      { name: "Level of work", value: limitText(commission.completionLevel, 1024), inline: true },
      { name: "Rating", value: limitText(commission.contentRating, 1024), inline: true },
      { name: "Private", value: commission.privateCommission ? "Yes" : "No", inline: true },
      { name: "Availability", value: limitText(formatAvailabilityFromCommission(commission), 1024) },
      { name: "Reason", value: limitText(reason, 1024) },
      { name: "Request details", value: limitText(commission.requestDetails, 1024) }
    )
    .setTimestamp(new Date());

  await channel.send({ embeds: [embed] }).catch((error) => {
    console.warn("[Commission Portal] Failed to log rejected request:", error.message);
  });
}

async function logCancellation(client, commission, input, config) {
  const channel = await client.channels.fetch(config.loggingChannelId).catch(() => null);
  if (!channel?.send) {
    return;
  }

  const clientRecord = getClient(commission.discordUserId);
  const fields = [
    { name: "Client", value: "<@" + commission.discordUserId + ">", inline: true },
    { name: "Preferred name", value: limitText(clientRecord?.preferredName || "Unknown", 1024), inline: true },
    { name: "Commission type", value: limitText(commission.commissionType, 1024), inline: true },
    { name: "Level of work", value: limitText(commission.completionLevel, 1024), inline: true },
    { name: "Cancellation reason", value: limitText(input.reasonLabel, 1024), inline: true }
  ];

  if (input.refundStatus) {
    fields.push({ name: "Refund status", value: limitText(input.refundStatus, 1024), inline: true });
  }

  if (input.details) {
    fields.push({ name: "Additional details", value: limitText(input.details, 1024) });
  }

  const embed = new EmbedBuilder()
    .setTitle("Commission Canceled")
    .setColor(0xcc6633)
    .addFields(fields)
    .setTimestamp(new Date());

  await channel.send({ embeds: [embed] }).catch((error) => {
    console.warn("[Commission Portal] Failed to log cancellation:", error.message);
  });
}

function memberCanManageCommissions(member, userId, config = getCommissionConfig()) {
  if (userId && config.ownerUserId && userId === config.ownerUserId) {
    return true;
  }

  const roles = member?.roles;
  if (!roles) {
    return false;
  }

  if (roles.cache) {
    return config.staffRoleIds.some((roleId) => roles.cache.has(roleId));
  }

  if (Array.isArray(roles)) {
    return config.staffRoleIds.some((roleId) => roles.includes(roleId));
  }

  return false;
}

function readField(interaction, fieldId) {
  return String(interaction.fields.getTextInputValue(fieldId) || "").trim();
}

function readOptionalField(interaction, fieldId) {
  try {
    return String(interaction.fields.getTextInputValue(fieldId) || "").trim();
  } catch {
    return "";
  }
}

function buildManualEntryCreatedReply(commission, links, discordUserId) {
  const lines = [
    "Manual commission entry created.",
    "",
    "Client Folder: <#" + links.forumId + ">",
    "Current Commission Request: <#" + links.threadId + ">",
    "Commission Progress: " + (links.trelloUrl || "Trello card created"),
    "",
    discordUserId
      ? "Do you want to DM these links to <@" + discordUserId + ">?"
      : "No Discord user ID was provided, so the bot cannot send a links DM."
  ];

  if (!commission.trelloCardUrl && links.trelloUrl) {
    lines.push("Stored Trello URL is pending, but the card link is available above.");
  }

  return lines.join("\n");
}

function parseManualAvailabilityDays(value) {
  return String(value || "")
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractDiscordSnowflake(value) {
  const match = String(value || "").match(/\d{17,20}/);
  return match ? match[0] : "";
}

function formatDiscordUserMention(value) {
  const snowflake = extractDiscordSnowflake(value);
  return snowflake ? "<@" + snowflake + ">" : "Client";
}

function createManualClientKey(preferredHandle) {
  const normalized = toChannelName(preferredHandle, "external");
  return "manual:" + normalized;
}

function toChannelName(preferredHandle, userId) {
  const normalized = String(preferredHandle || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || "client-" + userId;
}

function createDiscordThreadUrl(guildId, threadId) {
  if (!guildId || !threadId) {
    return "";
  }

  return "https://discord.com/channels/" + guildId + "/" + threadId;
}

async function getSourceReferenceUrl(client, guildId, threadId, messageId) {
  if (!messageId) {
    return createDiscordThreadUrl(guildId, threadId);
  }

  const thread = await client.channels.fetch(threadId).catch(() => null);
  const message = thread?.messages?.fetch
    ? await thread.messages.fetch(messageId).catch(() => null)
    : null;
  const attachmentUrl = Array.from(message?.attachments?.values?.() || [])
    .map((attachment) => attachment.url)
    .find(Boolean);

  return attachmentUrl || createDiscordThreadUrl(guildId, threadId + "/" + messageId);
}

function formatAvailability(days, startTime, endTime, timezone) {
  const dayText = Array.isArray(days) && days.length > 0 ? days.join(", ") : "Not provided";
  const timeText = startTime && endTime ? startTime + " to " + endTime : startTime || "Not provided";
  const timezoneText = timezone || "";

  return [dayText, timeText, timezoneText].filter(Boolean).join(" | ");
}

function formatAvailabilityFromCommission(commission) {
  const days = String(commission.availabilityDays || "")
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean);

  return formatAvailability(
    days,
    commission.availabilityStartTime,
    commission.availabilityEndTime,
    commission.availabilityTimezone
  );
}

function normalizeComparable(value) {
  return String(value || "").trim().toLowerCase();
}

function parseCustomIdParts(customId, prefix) {
  return String(customId || "").slice(prefix.length).split(":");
}

function normalizeTagIdList(value) {
  return Array.from(value || [])
    .map((item) => String(item))
    .sort();
}

function sameStringArray(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function isPaperclipReaction(reaction) {
  return reaction?.emoji?.name === PAPERCLIP_EMOJI_NAME || reaction?.emoji?.identifier === "%F0%9F%93%8E";
}

function messageHasPaperclipReaction(message) {
  return Array.from(message?.reactions?.cache?.values?.() || [])
    .some((reaction) => isPaperclipReaction(reaction));
}

function isWorkflowReviewReaction(reaction) {
  return WORKFLOW_REVIEW_EMOJI_NAMES.includes(reaction?.emoji?.name);
}

function isFeedbackSkipReaction(reaction) {
  return reaction?.emoji?.name === FEEDBACK_SKIP_EMOJI_NAME;
}

function isTrelloAttachmentCandidate(attachment) {
  if (!attachment?.url) {
    return false;
  }

  const contentType = String(attachment.contentType || "").toLowerCase();
  if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
    return true;
  }

  const name = String(attachment.name || attachment.filename || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|tiff?|mp4|mov|webm)$/i.test(name);
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function limitText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = {
  createCommissionCleanupCommand,
  createCommissionManualEntryCommand,
  createCommissionPublishPricingCommand,
  createCommissionSetupCommand,
  handleCommissionPortalInteraction,
  handleCommissionPortalMessageCreate,
  handleCommissionPortalReactionAdd,
  handleCommissionPortalThreadUpdate
};

