const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const fs = require("fs");
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
const {
  createCharacterPermissionPdfBuffer,
  createCommissionRequestPdfBuffer,
  createThirdPartyCharacterPermissionPdfBuffer,
  getCommissionRequestPdfFileName,
  getCharacterPermissionPdfFileName,
  getThirdPartyCharacterPermissionPdfFileName,
  getCommissionDocumentOpenCustomId,
  handleCommissionDocumentInteraction,
  publishCommissionDocument,
  publishCommissionDocuments
} = require("./documents");

const ids = {
  request: "commission:request",
  intakeStart: "commission:intake:start",
  intakeTermsSignatureModal: "commission:intake:terms_signature_modal",
  intakeReviewTerms: "commission:intake:review_terms",
  intakeTermsNavPrefix: "commission:intake:terms:",
  intakeTermsSectionSelect: "commission:intake:terms_section",
  preferredNameOpen: "commission:preferred_name_open",
  preferredNameModal: "commission:preferred_name_modal",
  characterCountPrefix: "commission:character_count:",
  characterCountMore: "commission:character_count_more",
  characterCountModal: "commission:character_count_modal",
  ownedCharacterCountPrefix: "commission:owned_character_count:",
  ownedCharacterCountMore: "commission:owned_character_count_more",
  ownedCharacterCountOpen: "commission:owned_character_count_open",
  ownedCharacterCountModal: "commission:owned_character_count_modal",
  ownedCharacterNamesOpen: "commission:owned_character_names_open",
  ownedCharacterNamesModal: "commission:owned_character_names_modal",
  thirdPartyCharactersOpen: "commission:third_party_characters_open",
  thirdPartyCharactersModal: "commission:third_party_characters_modal",
  thirdPartyNameOwnerModal: "commission:third_party_name_owner_modal",
  thirdPartyOwnerReusePrefix: "commission:third_party_owner_reuse:",
  thirdPartyOwnerQuantityPrefix: "commission:third_party_owner_quantity:",
  thirdPartyAdditionalNamesModal: "commission:third_party_additional_names_modal",
  thirdPartyContactPlatformPrefix: "commission:third_party_contact_platform:",
  thirdPartyContactHandleModal: "commission:third_party_contact_handle_modal",
  availabilityTimeModal: "commission:availability_time_modal",
  detailsOpen: "commission:details_open",
  reviewSubmit: "commission:review_submit",
  reviewEdit: "commission:review_edit",
  typePrefix: "commission:type:",
  levelPrefix: "commission:level:",
  ratingPrefix: "commission:rating:",
  characterOwnershipPrefix: "commission:character_ownership:",
  characterPermissionForm: "commission:character_permission_form",
  characterPermissionBlankPdf: "commission:character_permission_blank_pdf",
  characterPermissionContinue: "commission:character_permission_continue",
  characterPermissionModal: "commission:character_permission_modal",
  characterPermissionSign: "commission:character_permission_sign",
  characterPermissionEdit: "commission:character_permission_edit",
  characterPermissionSignatureModal: "commission:character_permission_signature_modal",
  privacyPrefix: "commission:privacy:",
  availabilityDayPrefix: "commission:availability_day:",
  availabilityContinue: "commission:availability_continue",
  otherModalPrefix: "commission:other:",
  detailsModal: "commission:details:modal",
  fieldPreferredHandle: "preferredHandle",
  fieldOtherValue: "otherValue",
  fieldCharacterCount: "characterCount",
  fieldOwnedCharacterCount: "ownedCharacterCount",
  fieldOwnedCharacterNames: "ownedCharacterNames",
  fieldThirdPartyCharacters: "thirdPartyCharacters",
  fieldThirdPartyCharacterName: "thirdPartyCharacterName",
  fieldThirdPartyOwnerName: "thirdPartyOwnerName",
  fieldThirdPartyAdditionalNames: "thirdPartyAdditionalNames",
  fieldThirdPartyContactHandle: "thirdPartyContactHandle",
  fieldCharacterOwnerName: "characterOwnerName",
  fieldCharacterName: "characterName",
  fieldCharacterContentType: "characterContentType",
  fieldCharacterOwnerContact: "characterOwnerContact",
  fieldCharacterSignature: "characterSignature",
  fieldTermsSignature: "termsSignature",
  fieldRequestDetails: "requestDetails",
  fieldAvailabilityStartTime: "availabilityStartTime",
  fieldAvailabilityEndTime: "availabilityEndTime",
  fieldAvailabilityTimezone: "availabilityTimezone",
  doneUploadingPrefix: "commission:done_uploading:",
  approvePrefix: "commission:approve:",
  ownerConfirmationRequiredPrefix: "commission:owner_confirmation_required:",
  ownerConfirmationSkipPrefix: "commission:owner_confirmation_skip:",
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
const approvalPromptSources = new Map();
const finalPaymentPrompted = new Set();
const threadTagSyncTimers = new Map();
const threadTagSyncSnapshots = new Map();
const threadTagSyncInFlight = new Set();
const EPHEMERAL_FLAGS = 64;
const PAPERCLIP_EMOJI_NAME = "📎";
const WORKFLOW_REVIEW_EMOJI_NAMES = ["🔎", "🔍"];
const FEEDBACK_SKIP_EMOJI_NAME = "⏭️";
const DOCUMENT_EPHEMERAL_DELETE_AFTER_MS = 10 * 60 * 1000;

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

const characterOwnershipChoices = [
  { id: "owned", label: "Yes, I own all characters.", buttonLabel: "I own them" },
  { id: "permission", label: "No, but I have permission from the character owner.", buttonLabel: "I have permission" },
  { id: "unsure", label: "No / unsure.", buttonLabel: "No / unsure" }
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
    .setDescription("Publish the commission pricing navigator entry message.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON();
}

function createCommissionPublishTosCommand() {
  return new SlashCommandBuilder()
    .setName("commission-publish-tos")
    .setDescription("Publish the commission Terms of Service navigator entry message.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON();
}

function createCommissionPublishDocumentsCommand() {
  return new SlashCommandBuilder()
    .setName("commission-publish-docs")
    .setDescription("Publish both commission pricing and Terms of Service navigator entry messages.")
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
    await handlePublishDocumentCommand(interaction, config, "pricing");
    return true;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "commission-publish-tos") {
    await handlePublishDocumentCommand(interaction, config, "tos");
    return true;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "commission-publish-docs") {
    await handlePublishDocumentsCommand(interaction, config);
    return true;
  }

  if (await handleCommissionDocumentInteraction(interaction, config)) {
    return true;
  }

  if (interaction.isButton()) {
    if (interaction.customId === ids.request) {
      await handleRequestButton(interaction);
      return true;
    }

    if (interaction.customId === ids.intakeStart) {
      await showTermsSignatureModal(interaction);
      return true;
    }

    if (interaction.customId === ids.intakeReviewTerms) {
      await showIntakeTermsReview(interaction, 0);
      return true;
    }

    if (interaction.customId.startsWith(ids.intakeTermsNavPrefix)) {
      await handleIntakeTermsNav(interaction);
      return true;
    }

    if (interaction.customId === ids.preferredNameOpen) {
      await showPreferredNameModal(interaction);
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

    if (interaction.customId.startsWith(ids.characterCountPrefix)) {
      await handleCharacterCountButton(interaction);
      return true;
    }

    if (interaction.customId === ids.characterCountMore) {
      await showCharacterCountModal(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.characterOwnershipPrefix)) {
      await handleCharacterOwnershipSelection(interaction, config);
      return true;
    }

    if (interaction.customId.startsWith(ids.ownedCharacterCountPrefix)) {
      await handleOwnedCharacterCountButton(interaction);
      return true;
    }

    if (interaction.customId === ids.ownedCharacterCountMore) {
      await showOwnedCharacterCountModal(interaction);
      return true;
    }

    if (interaction.customId === ids.ownedCharacterCountOpen) {
      await showOwnedCharacterCountModal(interaction);
      return true;
    }

    if (interaction.customId === ids.ownedCharacterNamesOpen) {
      await showOwnedCharacterNamesModal(interaction);
      return true;
    }

    if (interaction.customId === ids.thirdPartyCharactersOpen) {
      const session = getIntakeSession(interaction.user.id);
      await showThirdPartyNameOwnerModal(interaction, session.pendingThirdPartyCount || 1);
      return true;
    }

    if (interaction.customId.startsWith(ids.thirdPartyOwnerReusePrefix)) {
      await handleThirdPartyOwnerReuse(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.thirdPartyOwnerQuantityPrefix)) {
      await handleThirdPartyOwnerQuantity(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.thirdPartyContactPlatformPrefix)) {
      await showThirdPartyContactHandleModal(interaction);
      return true;
    }

    if (interaction.customId === ids.characterPermissionForm) {
      await showCharacterPermissionModal(interaction);
      return true;
    }

    if (interaction.customId === ids.characterPermissionBlankPdf) {
      await handleCharacterPermissionBlankPdf(interaction, config);
      return true;
    }

    if (interaction.customId === ids.characterPermissionSign) {
      await showCharacterPermissionSignatureModal(interaction);
      return true;
    }

    if (interaction.customId === ids.characterPermissionEdit) {
      await showCharacterPermissionModal(interaction);
      return true;
    }

    if (interaction.customId === ids.characterPermissionContinue) {
      await showPrivacySelection(interaction);
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

    if (interaction.customId === ids.detailsOpen) {
      await showDetailsModal(interaction);
      return true;
    }

    if (interaction.customId === ids.reviewSubmit) {
      await handleReviewSubmit(interaction, config);
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

    if (interaction.customId.startsWith(ids.ownerConfirmationRequiredPrefix)) {
      await handleOwnerConfirmationDecision(interaction, config, true);
      return true;
    }

    if (interaction.customId.startsWith(ids.ownerConfirmationSkipPrefix)) {
      await handleOwnerConfirmationDecision(interaction, config, false);
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
    if (interaction.customId === ids.intakeTermsSignatureModal) {
      await handleTermsSignatureModal(interaction);
      return true;
    }

    if (interaction.customId === ids.preferredNameModal) {
      await handlePreferredNameModal(interaction);
      return true;
    }

    if (interaction.customId === ids.characterCountModal) {
      await handleCharacterCountModal(interaction);
      return true;
    }

    if (interaction.customId === ids.ownedCharacterCountModal) {
      await handleOwnedCharacterCountModal(interaction);
      return true;
    }

    if (interaction.customId === ids.ownedCharacterNamesModal) {
      await handleOwnedCharacterNamesModal(interaction);
      return true;
    }

    if (interaction.customId === ids.thirdPartyCharactersModal) {
      await handleThirdPartyCharactersModal(interaction);
      return true;
    }

    if (interaction.customId === ids.thirdPartyNameOwnerModal) {
      await handleThirdPartyNameOwnerModal(interaction);
      return true;
    }

    if (interaction.customId === ids.thirdPartyAdditionalNamesModal) {
      await handleThirdPartyAdditionalNamesModal(interaction);
      return true;
    }

    if (interaction.customId === ids.thirdPartyContactHandleModal) {
      await handleThirdPartyContactHandleModal(interaction);
      return true;
    }

    if (interaction.customId === ids.availabilityTimeModal) {
      await handleAvailabilityTimeModal(interaction);
      return true;
    }

    if (interaction.customId.startsWith(ids.otherModalPrefix)) {
      await handleOtherModal(interaction);
      return true;
    }

    if (interaction.customId === ids.detailsModal) {
      await handleDetailsModal(interaction, config);
      return true;
    }

    if (interaction.customId === ids.characterPermissionModal) {
      await handleCharacterPermissionModal(interaction, config);
      return true;
    }

    if (interaction.customId === ids.characterPermissionSignatureModal) {
      await handleCharacterPermissionSignatureModal(interaction, config);
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

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === ids.intakeTermsSectionSelect) {
      await handleIntakeTermsSectionSelect(interaction);
      return true;
    }

    if (interaction.customId === ids.reviewEdit) {
      await handleReviewEditSelection(interaction);
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

  const channel = await interaction.client.channels.fetch(config.portalChannelId);
  if (!channel || typeof channel.send !== "function") {
    await interaction.reply({
      content: "The configured commission portal channel could not be found.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  await channel.send({
    embeds: [createCommissionPortalEmbed(config)],
    components: createCommissionPortalRows()
  });

  await interaction.reply({
    content: "Commission portal posted in <#" + config.portalChannelId + ">.",
    flags: EPHEMERAL_FLAGS
  });
}

async function handlePublishDocumentCommand(interaction, config, documentType) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({
      content: "You do not have permission to publish commission documents.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const result = await publishCommissionDocument(interaction.client, config, documentType, {
    reason: "slash_command",
    staffUserId: interaction.user.id
  });

  await interaction.editReply(
    "Published the " + documentType + " navigator entry message to <#" + result.channelId + ">."
  );
}

async function handlePublishDocumentsCommand(interaction, config) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({
      content: "You do not have permission to publish commission documents.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const results = await publishCommissionDocuments(interaction.client, config, {
    reason: "slash_command",
    staffUserId: interaction.user.id
  });

  await interaction.editReply(
    "Published commission document navigator entries: " +
      results.map((result) => result.documentType + " in <#" + result.channelId + ">").join(", ") +
      "."
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
    content: "Before starting a commission request, please agree to the Terms of Service or review them privately.",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.intakeStart)
          .setLabel("Agree")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(ids.intakeReviewTerms)
          .setLabel("Review Terms")
          .setStyle(ButtonStyle.Secondary)
      )
    ],
    flags: EPHEMERAL_FLAGS
  });
  rememberWizardInteraction(interaction.user.id, interaction);
}

async function acceptTermsAndShowPreferredName(interaction) {
  intakeSessions.set(interaction.user.id, {
    startedAt: new Date().toISOString(),
    termsAcceptedAt: new Date().toISOString(),
    termsAcceptedUserId: interaction.user.id,
    termsAcceptedUserName: formatDiscordUserName(interaction.user),
    termsAcceptedSignature: "AGREE",
    cleanupInteractions: getWizardCleanupInteractions(interaction.user.id)
  });
  rememberWizardInteraction(interaction.user.id, interaction);
  await showPreferredNameModal(interaction);
}

async function showTermsSignatureModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(ids.intakeTermsSignatureModal)
    .setTitle("Terms Agreement")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldTermsSignature)
          .setLabel("Type AGREE to accept the ToS")
          .setPlaceholder("AGREE")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleTermsSignatureModal(interaction) {
  const typedAgreement = readField(interaction, ids.fieldTermsSignature);
  if (typedAgreement.trim().toLowerCase() !== "agree") {
    await interaction.reply({
      content: "Please click Agree again and type AGREE to continue.",
      flags: EPHEMERAL_FLAGS
    });
    scheduleDeleteInteractionReply(interaction);
    return;
  }

  intakeSessions.set(interaction.user.id, {
    startedAt: new Date().toISOString(),
    termsAcceptedAt: new Date().toISOString(),
    termsAcceptedUserId: interaction.user.id,
    termsAcceptedUserName: formatDiscordUserName(interaction.user),
    termsAcceptedSignature: "AGREE",
    cleanupInteractions: getWizardCleanupInteractions(interaction.user.id)
  });

  await interaction.reply({
    content: "Terms accepted. Continue to the commission request form.",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.preferredNameOpen)
          .setLabel("Continue")
          .setStyle(ButtonStyle.Primary)
      )
    ],
    flags: EPHEMERAL_FLAGS
  });
  await deleteStoredWizardMessages(interaction.user.id, interaction);
  rememberWizardInteraction(interaction.user.id, interaction);
}

async function showPreferredNameModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const modal = new ModalBuilder()
    .setCustomId(ids.preferredNameModal)
    .setTitle("Preferred Name")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldPreferredHandle)
          .setLabel("What name should I use for you?")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(80)
          .setValue(limitText(session.preferredHandle || formatDiscordUserName(interaction.user), 80))
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function showIntakeTermsReview(interaction, pageIndex) {
  const config = getCommissionConfig();
  const document = readIntakeTermsDocument(config);
  const page = clamp(Number(pageIndex) || 0, 0, document.sections.length);
  const embed = page === 0
    ? new EmbedBuilder()
      .setTitle(document.title + " - Index")
      .setDescription(limitText([
        document.description,
        "",
        "Sections:",
        ...document.sections.map((section, index) => (index + 1) + ". " + section.title),
        "",
        "Use Next to review the terms. You can agree on the final page."
      ].join("\n"), 4096))
      .setColor(0x5865f2)
      .setFooter({ text: "Page 0 of " + document.sections.length })
    : new EmbedBuilder()
      .setTitle(document.sections[page - 1]?.title || "Terms")
      .setDescription(limitText(document.sections[page - 1]?.body || "", 4096))
      .setColor(0x5865f2)
      .setFooter({ text: "Page " + page + " of " + document.sections.length });

  await interaction.update({
    content: "",
    embeds: [embed],
    components: createIntakeTermsRows(page, document)
  });
  rememberWizardInteraction(interaction.user.id, interaction);
}

async function handleIntakeTermsNav(interaction) {
  const action = interaction.customId.slice(ids.intakeTermsNavPrefix.length);
  if (action === "agree") {
    await showTermsSignatureModal(interaction);
    return;
  }

  await showIntakeTermsReview(interaction, Number.parseInt(action, 10) || 0);
}

async function handleIntakeTermsSectionSelect(interaction) {
  await showIntakeTermsReview(interaction, Number.parseInt(interaction.values?.[0], 10) || 0);
}

function createIntakeTermsRows(pageIndex, document) {
  return [
    createIntakeTermsNavRow(pageIndex, document.sections.length),
    createIntakeTermsSectionRow(pageIndex, document)
  ];
}

function createIntakeTermsNavRow(pageIndex, pageCount) {
  const previousPage = Math.max(0, pageIndex - 1);
  const nextPage = Math.min(pageCount, pageIndex + 1);
  const buttons = [
    new ButtonBuilder()
      .setCustomId(ids.intakeTermsNavPrefix + previousPage)
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex <= 0),
    new ButtonBuilder()
      .setCustomId(ids.intakeTermsNavPrefix + nextPage)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex >= pageCount)
  ];

  if (pageIndex >= pageCount) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(ids.intakeTermsNavPrefix + "agree")
        .setLabel("Agree")
        .setStyle(ButtonStyle.Success)
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(ids.intakeTermsNavPrefix + pageCount)
        .setLabel("Skip to End")
        .setStyle(ButtonStyle.Primary)
    );
  }

  return new ActionRowBuilder().addComponents(buttons);
}

function createIntakeTermsSectionRow(pageIndex, document) {
  const options = [
    new StringSelectMenuOptionBuilder()
      .setLabel("Index")
      .setValue("0")
      .setDefault(pageIndex === 0)
  ];

  document.sections.slice(0, 24).forEach((section, index) => {
    const page = index + 1;
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(limitText((page) + ". " + section.title, 100))
        .setValue(String(page))
        .setDefault(pageIndex === page)
    );
  });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(ids.intakeTermsSectionSelect)
      .setPlaceholder("Jump to a section")
      .addOptions(options)
  );
}

function readIntakeTermsDocument(config) {
  try {
    const raw = fs.readFileSync(config.tosCatalogPath, "utf8");
    const catalog = JSON.parse(raw);
    return {
      title: catalog.title || "Commission Terms of Service",
      description: catalog.description || "Review commission terms privately.",
      sections: (catalog.sections || [])
        .filter((section) => !isMatureContentPolicySection(section))
        .map((section, index) => ({
          title: section.title || "Section " + (index + 1),
          body: Array.isArray(section.body) ? section.body.join("\n\n") : String(section.body || "")
        }))
    };
  } catch {
    return {
      title: "Commission Terms of Service",
      description: "Review commission terms privately.",
      sections: [
        {
          title: "Terms",
          body: "Terms could not be loaded right now. Please ask staff for help before submitting a request."
        }
      ]
    };
  }
}

function isMatureContentPolicySection(section) {
  const id = String(section?.id || "").trim().toLowerCase();
  const title = String(section?.title || "").trim().toLowerCase();
  return id === "mature-content-policy" || title === "mature content policy";
}

async function handlePreferredNameModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  session.preferredHandle = readField(interaction, ids.fieldPreferredHandle);
  intakeSessions.set(interaction.user.id, session);

  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }

  await interaction.reply({
    content: "What type of commission are you interested in?",
    components: createChoiceRows(commissionTypeChoices, ids.typePrefix),
    flags: EPHEMERAL_FLAGS
  });
  await deleteStoredWizardMessages(interaction.user.id, interaction);
  rememberWizardInteraction(interaction.user.id, interaction);
}

async function showCommissionTypeSelection(interaction) {
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
  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }
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
  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }
  await showRatingSelection(interaction);
}

async function showRatingSelection(interaction) {
  rememberWizardInteraction(interaction.user.id, interaction);
  await interaction.update({
    content: "Is your request SFW or NSFW?",
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
  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }
  await showCharacterCountSelection(interaction);
}

async function showCharacterCountSelection(interaction) {
  await sendWizardStep(interaction, {
    content: "How many characters are included in this request?",
    components: createCountRows(ids.characterCountPrefix, ids.characterCountMore, 5, 1)
  });
}

async function handleCharacterCountButton(interaction) {
  const count = Number.parseInt(interaction.customId.slice(ids.characterCountPrefix.length), 10) || 1;
  await processCharacterCount(interaction, count);
}

async function showCharacterCountModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const modal = new ModalBuilder()
    .setCustomId(ids.characterCountModal)
    .setTitle("Characters")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldCharacterCount)
          .setLabel("How many characters are included?")
          .setPlaceholder("1")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2)
          .setValue(String(session.characterCount || 1))
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleCharacterCountModal(interaction) {
  const count = clamp(Number.parseInt(readField(interaction, ids.fieldCharacterCount), 10) || 1, 1, 20);
  await processCharacterCount(interaction, count);
}

async function processCharacterCount(interaction, count) {
  const session = getIntakeSession(interaction.user.id);
  session.characterCount = count;
  session.ownedCharacterCount = count === 1 ? 0 : session.ownedCharacterCount;
  intakeSessions.set(interaction.user.id, session);

  if (count === 1) {
    await sendWizardStep(interaction, {
      content: [
        "Character Ownership",
        "",
        "Do you own the character included in this commission?"
      ].join("\n"),
      components: createChoiceRows(characterOwnershipChoices, ids.characterOwnershipPrefix)
    }, { cleanup: true });
    return;
  }

  await showOwnedCharacterCountSelection(interaction, count, { cleanup: true });
}

async function showOwnedCharacterCountSelection(interaction, characterCount, options = {}) {
  const maxButtonCount = Math.min(5, characterCount);
  await sendWizardStep(interaction, {
    content: "Next, tell me how many of those characters you personally own.",
    components: createCountRows(ids.ownedCharacterCountPrefix, characterCount > 5 ? ids.ownedCharacterCountMore : null, maxButtonCount, 0)
  }, options);
}

async function handleOwnedCharacterCountButton(interaction) {
  const ownedCount = Number.parseInt(interaction.customId.slice(ids.ownedCharacterCountPrefix.length), 10) || 0;
  await processOwnedCharacterCount(interaction, ownedCount);
}

async function showOwnedCharacterCountModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const modal = new ModalBuilder()
    .setCustomId(ids.ownedCharacterCountModal)
    .setTitle("Character Ownership")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldOwnedCharacterCount)
          .setLabel("How many characters do you own?")
          .setPlaceholder("0")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2)
          .setValue(String(session.ownedCharacterCount || 0))
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleOwnedCharacterCountModal(interaction) {
  const ownedCount = Number.parseInt(readField(interaction, ids.fieldOwnedCharacterCount), 10) || 0;
  await processOwnedCharacterCount(interaction, ownedCount);
}

async function processOwnedCharacterCount(interaction, requestedOwnedCount) {
  const session = getIntakeSession(interaction.user.id);
  const characterCount = clamp(Number(session.characterCount) || 1, 1, 20);
  const ownedCount = clamp(requestedOwnedCount, 0, characterCount);
  const thirdPartyCount = Math.max(0, characterCount - ownedCount);
  session.ownedCharacterCount = ownedCount;
  session.characterOwnershipId = thirdPartyCount > 0 ? "permission" : "owned";
  session.characterOwnershipLabel = thirdPartyCount > 0
    ? "Some characters belong to another individual."
    : "Yes, I own all characters.";
  session.characterDetails = {
    characterCount,
    ownedCharacterCount: ownedCount,
    ownedCharacterNames: session.ownedCharacterNames || [],
    thirdPartyCharacters: thirdPartyCount > 0 ? session.thirdPartyCharactersRaw || "" : ""
  };
  intakeSessions.set(interaction.user.id, session);

  if (ownedCount > 0) {
    await promptOwnedCharacterNames(interaction, session, thirdPartyCount);
    return;
  }

  if (thirdPartyCount > 0) {
    await startThirdPartyCharacterCollection(interaction, thirdPartyCount);
    return;
  }

  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }

  await showGeneratedCharacterPermissionPreview(interaction, session);
}

async function promptOwnedCharacterNames(interaction, session, nextThirdPartyCount) {
  session.pendingAfterOwnedThirdPartyCount = nextThirdPartyCount;
  intakeSessions.set(interaction.user.id, session);

  if (interaction.isButton?.() || interaction.isStringSelectMenu?.()) {
    await showOwnedCharacterNamesModal(interaction);
    return;
  }

  await sendWizardStep(interaction, {
    content: "Please provide the name" + (Number(session.ownedCharacterCount) === 1 ? "" : "s") + " of the character" + (Number(session.ownedCharacterCount) === 1 ? "" : "s") + " you own.",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.ownedCharacterNamesOpen)
          .setLabel("Continue")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  }, { cleanup: true });
}

async function showOwnedCharacterNamesModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const ownedCount = clamp(Number(session.ownedCharacterCount) || 1, 1, Number(session.characterCount) || 1);
  const modal = new ModalBuilder()
    .setCustomId(ids.ownedCharacterNamesModal)
    .setTitle("Your Characters")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldOwnedCharacterNames)
          .setLabel(ownedCount === 1 ? "Your character name" : "Your character names")
          .setPlaceholder(ownedCount === 1 ? "Character name" : "One character name per line")
          .setStyle(ownedCount === 1 ? TextInputStyle.Short : TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setValue(limitText((session.ownedCharacterNames || []).join("\n"), 500))
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleOwnedCharacterNamesModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const names = splitCharacterNames(readField(interaction, ids.fieldOwnedCharacterNames))
    .slice(0, clamp(Number(session.ownedCharacterCount) || 1, 1, Number(session.characterCount) || 1));
  session.ownedCharacterNames = names;
  session.characterDetails = {
    ...(session.characterDetails || {}),
    characterCount: session.characterCount || 1,
    ownedCharacterCount: session.ownedCharacterCount || names.length,
    ownedCharacterNames: names
  };
  const thirdPartyCount = Math.max(0, Number(session.pendingAfterOwnedThirdPartyCount) || 0);
  delete session.pendingAfterOwnedThirdPartyCount;
  intakeSessions.set(interaction.user.id, session);

  if (thirdPartyCount > 0) {
    await startThirdPartyCharacterCollection(interaction, thirdPartyCount);
    return;
  }

  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }

  await sendWizardStep(interaction, {
    content: "Should this commission be private?\n(Private commissions will be completed out of public view)",
    components: createChoiceRows(privacyChoices, ids.privacyPrefix)
  }, { cleanup: true });
}

async function showThirdPartyCharactersModal(interaction, thirdPartyCount) {
  const session = getIntakeSession(interaction.user.id);
  const modal = new ModalBuilder()
    .setCustomId(ids.thirdPartyCharactersModal)
    .setTitle("Third-Party Characters")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldThirdPartyCharacters)
          .setLabel("Third-party character info")
          .setPlaceholder(createThirdPartyCharacterPlaceholder(thirdPartyCount))
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setValue(limitText(session.thirdPartyCharactersRaw || "", 1000))
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function startThirdPartyCharacterCollection(interaction, thirdPartyCount) {
  const session = getIntakeSession(interaction.user.id);
  session.pendingThirdPartyCount = thirdPartyCount;
  session.thirdPartyTotal = thirdPartyCount;
  session.thirdPartyRemaining = thirdPartyCount;
  session.thirdPartyOwnerGroups = [];
  delete session.thirdPartyCharactersRaw;
  delete session.thirdPartyContactOwnerIndex;
  delete session.pendingThirdPartyOwnerName;
  delete session.pendingThirdPartyQuantity;
  delete session.pendingCharacterPermission;
  delete session.characterPermission;
  intakeSessions.set(interaction.user.id, session);

  if (interaction.isButton?.() || interaction.isStringSelectMenu?.()) {
    await showThirdPartyNameOwnerModal(interaction, thirdPartyCount);
    return;
  }

  await sendWizardStep(interaction, {
    content: "Next, provide the character owner details for the " + thirdPartyCount + " third-party character" + (thirdPartyCount === 1 ? "" : "s") + ".",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.thirdPartyCharactersOpen)
          .setLabel("Continue")
          .setStyle(ButtonStyle.Primary)
      )
    ]
  }, { cleanup: true });
}

async function showThirdPartyNameOwnerModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const remaining = Math.max(1, Number(session.thirdPartyRemaining || session.pendingThirdPartyCount || 1));
  const modal = new ModalBuilder()
    .setCustomId(ids.thirdPartyNameOwnerModal)
    .setTitle("Third-Party Character")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldThirdPartyCharacterName)
          .setLabel("Additional character name")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldThirdPartyOwnerName)
          .setLabel("Owner name or screen name")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true)
      )
    );

  if (remaining > 1) {
    modal.setTitle("Third-Party Character " + (Number(session.thirdPartyTotal || remaining) - remaining + 1));
  }

  await interaction.showModal(modal);
}

async function handleThirdPartyNameOwnerModal(interaction) {
  const characterName = readField(interaction, ids.fieldThirdPartyCharacterName);
  const ownerName = readField(interaction, ids.fieldThirdPartyOwnerName);
  const session = getIntakeSession(interaction.user.id);
  addThirdPartyCharacter(session, ownerName, characterName);
  session.thirdPartyRemaining = Math.max(0, Number(session.thirdPartyRemaining || 1) - 1);
  session.pendingThirdPartyOwnerName = ownerName;
  intakeSessions.set(interaction.user.id, session);

  if (session.thirdPartyRemaining > 0) {
    await showThirdPartyOwnerReusePrompt(interaction, ownerName, session.thirdPartyRemaining);
    return;
  }

  await beginThirdPartyContactPrompts(interaction, session);
}

async function showThirdPartyOwnerReusePrompt(interaction, ownerName, remaining) {
  await sendWizardStep(interaction, {
    content: [
      "Are other characters in your request owned by " + ownerName + "?",
      "",
      "Remaining third-party character slots: " + remaining
    ].join("\n"),
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.thirdPartyOwnerReusePrefix + "yes")
          .setLabel("Yes")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(ids.thirdPartyOwnerReusePrefix + "no")
          .setLabel("No")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  }, { cleanup: true });
}

async function handleThirdPartyOwnerReuse(interaction) {
  const answer = interaction.customId.slice(ids.thirdPartyOwnerReusePrefix.length);
  const session = getIntakeSession(interaction.user.id);
  const remaining = Math.max(1, Number(session.thirdPartyRemaining || 1));

  if (answer === "no") {
    await showThirdPartyNameOwnerModal(interaction);
    return;
  }

  if (remaining === 1) {
    session.pendingThirdPartyQuantity = 1;
    intakeSessions.set(interaction.user.id, session);
    await showThirdPartyAdditionalNamesModal(interaction);
    return;
  }

  await sendWizardStep(interaction, {
    content: "How many of the remaining characters are owned by " + (session.pendingThirdPartyOwnerName || "that owner") + "?",
    components: createThirdPartyOwnerQuantityRows(remaining)
  });
}

async function handleThirdPartyOwnerQuantity(interaction) {
  const quantity = Number.parseInt(interaction.customId.slice(ids.thirdPartyOwnerQuantityPrefix.length), 10) || 1;
  const session = getIntakeSession(interaction.user.id);
  session.pendingThirdPartyQuantity = clamp(quantity, 1, Number(session.thirdPartyRemaining || 1));
  intakeSessions.set(interaction.user.id, session);
  await showThirdPartyAdditionalNamesModal(interaction);
}

async function showThirdPartyAdditionalNamesModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const quantity = clamp(Number(session.pendingThirdPartyQuantity) || 1, 1, Number(session.thirdPartyRemaining || 1));
  const modal = new ModalBuilder()
    .setCustomId(ids.thirdPartyAdditionalNamesModal)
    .setTitle("Additional Characters")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldThirdPartyAdditionalNames)
          .setLabel(quantity === 1 ? "Additional character name" : "Additional character names")
          .setPlaceholder(quantity === 1 ? "Character name" : "One character name per line")
          .setStyle(quantity === 1 ? TextInputStyle.Short : TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleThirdPartyAdditionalNamesModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const ownerName = session.pendingThirdPartyOwnerName || "Unknown owner";
  const quantity = clamp(Number(session.pendingThirdPartyQuantity) || 1, 1, Number(session.thirdPartyRemaining || 1));
  const names = splitCharacterNames(readField(interaction, ids.fieldThirdPartyAdditionalNames)).slice(0, quantity);

  names.forEach((name) => addThirdPartyCharacter(session, ownerName, name));
  session.thirdPartyRemaining = Math.max(0, Number(session.thirdPartyRemaining || 0) - names.length);
  delete session.pendingThirdPartyQuantity;
  intakeSessions.set(interaction.user.id, session);

  if (session.thirdPartyRemaining > 0) {
    await showThirdPartyOwnerReusePrompt(interaction, ownerName, session.thirdPartyRemaining);
    return;
  }

  await beginThirdPartyContactPrompts(interaction, session);
}

async function beginThirdPartyContactPrompts(interaction, session) {
  session.thirdPartyContactOwnerIndex = 0;
  intakeSessions.set(interaction.user.id, session);
  await showThirdPartyContactPlatformSelection(interaction, session);
}

async function showThirdPartyContactPlatformSelection(interaction, session) {
  const groups = session.thirdPartyOwnerGroups || [];
  const index = clamp(Number(session.thirdPartyContactOwnerIndex) || 0, 0, Math.max(0, groups.length - 1));
  const group = groups[index];

  if (!group) {
    await finalizeThirdPartyCharacters(interaction, session);
    return;
  }

  await sendWizardStep(interaction, {
    content: [
      "Contact details for " + group.ownerName,
      "",
      "This information is strictly for verification if needed and does not guarantee that the owner will be contacted.",
      "It also helps properly attribute character ownership if the finished piece is posted or shared publicly.",
      "",
      "Select the best platform to contact this owner if needed."
    ].join("\n"),
    components: createThirdPartyContactPlatformRows()
  }, { cleanup: true });
}

async function showThirdPartyContactHandleModal(interaction) {
  const platform = interaction.customId.slice(ids.thirdPartyContactPlatformPrefix.length);
  const session = getIntakeSession(interaction.user.id);
  const groups = session.thirdPartyOwnerGroups || [];
  const index = clamp(Number(session.thirdPartyContactOwnerIndex) || 0, 0, Math.max(0, groups.length - 1));
  const ownerName = groups[index]?.ownerName || "Owner";
  session.pendingThirdPartyContactPlatform = platform;
  intakeSessions.set(interaction.user.id, session);

  const modal = new ModalBuilder()
    .setCustomId(ids.thirdPartyContactHandleModal)
    .setTitle(limitText(ownerName + " Contact", 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldThirdPartyContactHandle)
          .setLabel(platform === "Email" ? "Email address" : platform + " handle")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(120)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleThirdPartyContactHandleModal(interaction) {
  const handle = readField(interaction, ids.fieldThirdPartyContactHandle);
  const session = getIntakeSession(interaction.user.id);
  const groups = session.thirdPartyOwnerGroups || [];
  const index = clamp(Number(session.thirdPartyContactOwnerIndex) || 0, 0, Math.max(0, groups.length - 1));

  if (groups[index]) {
    groups[index].contactPlatform = session.pendingThirdPartyContactPlatform || "Discord";
    groups[index].contactHandle = handle;
  }

  session.thirdPartyOwnerGroups = groups;
  session.thirdPartyContactOwnerIndex = index + 1;
  delete session.pendingThirdPartyContactPlatform;
  intakeSessions.set(interaction.user.id, session);

  if (session.thirdPartyContactOwnerIndex < groups.length) {
    await showThirdPartyContactPlatformSelection(interaction, session);
    return;
  }

  await finalizeThirdPartyCharacters(interaction, session);
}

async function finalizeThirdPartyCharacters(interaction, session) {
  session.thirdPartyCharactersRaw = formatThirdPartyOwnerGroups(session.thirdPartyOwnerGroups || []);
  delete session.pendingThirdPartyCount;
  delete session.thirdPartyRemaining;
  delete session.pendingThirdPartyOwnerName;
  delete session.pendingThirdPartyQuantity;
  delete session.thirdPartyContactOwnerIndex;
  session.characterDetails = {
    characterCount: session.characterCount || 1,
    ownedCharacterCount: session.ownedCharacterCount || 0,
    ownedCharacterNames: session.ownedCharacterNames || [],
    thirdPartyCharacters: session.thirdPartyCharactersRaw,
    ownerGroups: session.thirdPartyOwnerGroups || []
  };
  session.characterOwnershipId = "permission";
  session.characterOwnershipLabel = "Some characters belong to another individual.";
  intakeSessions.set(interaction.user.id, session);

  await showGeneratedCharacterPermissionPreview(interaction, session);
}

async function handleThirdPartyCharactersModal(interaction) {
  const value = readField(interaction, ids.fieldThirdPartyCharacters);
  const session = getIntakeSession(interaction.user.id);
  session.thirdPartyCharactersRaw = value;
  delete session.pendingThirdPartyCount;
  session.characterDetails = {
    characterCount: session.characterCount || 1,
    ownedCharacterCount: session.ownedCharacterCount || 0,
    ownedCharacterNames: session.ownedCharacterNames || [],
    thirdPartyCharacters: value
  };
  session.characterOwnershipId = "permission";
  session.characterOwnershipLabel = "Some characters belong to another individual.";
  intakeSessions.set(interaction.user.id, session);

  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }

  await showGeneratedCharacterPermissionPreview(interaction, session);
}

function createThirdPartyCharacterPlaceholder(count) {
  if (Number(count) <= 1) {
    return "Character: Name | Owner: Name | Platform: Discord | Handle: @owner";
  }

  return "For each: Character name, owner name, contact platform, owner handle.";
}

async function showCharacterOwnershipSelection(interaction) {
  rememberWizardInteraction(interaction.user.id, interaction);
  await interaction.update({
    content: [
      "Character Ownership",
      "",
      "Do you own all characters included in this commission?",
      "",
      "If you do not own a character, please provide the character owner's screen name or handle and a short written confirmation that they consent to this commission."
    ].join("\n"),
    components: createChoiceRows(characterOwnershipChoices, ids.characterOwnershipPrefix)
  });
}

async function handleCharacterOwnershipSelection(interaction, config) {
  const choiceId = interaction.customId.slice(ids.characterOwnershipPrefix.length);
  const choice = characterOwnershipChoices.find((item) => item.id === choiceId);
  if (!choice) {
    await interaction.reply({ content: "Unknown character ownership option.", flags: EPHEMERAL_FLAGS });
    return;
  }

  const session = getIntakeSession(interaction.user.id);
  session.characterOwnershipId = choice.id;
  session.characterOwnershipLabel = choice.label;
  intakeSessions.set(interaction.user.id, session);
  rememberWizardInteraction(interaction.user.id, interaction);

  if (choice.id === "permission") {
    session.characterCount = session.characterCount || 1;
    session.ownedCharacterCount = 0;
    intakeSessions.set(interaction.user.id, session);
    await startThirdPartyCharacterCollection(interaction, 1);
    return;
  }

  if (choice.id === "unsure") {
    session.characterCount = session.characterCount || 1;
    session.ownedCharacterCount = 0;
    intakeSessions.set(interaction.user.id, session);
    await startThirdPartyCharacterCollection(interaction, 1);
    return;
  }

  session.characterCount = session.characterCount || 1;
  session.ownedCharacterCount = session.characterCount;
  session.characterDetails = {
    characterCount: session.characterCount,
    ownedCharacterCount: session.ownedCharacterCount,
    ownedCharacterNames: session.ownedCharacterNames || [],
    thirdPartyCharacters: ""
  };
  intakeSessions.set(interaction.user.id, session);

  await promptOwnedCharacterNames(interaction, session, 0);
  return;
}

function createCharacterPermissionRows() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.characterPermissionForm)
      .setLabel("Fill Affirmation")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ids.characterPermissionBlankPdf)
      .setLabel("Blank Affirmation")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ids.characterPermissionContinue)
      .setLabel("Continue")
      .setStyle(ButtonStyle.Success)
  );
}

async function showGeneratedCharacterPermissionPreview(interaction, session) {
  const permission = createGeneratedCharacterPermission(interaction.user, session);
  session.pendingCharacterPermission = permission;
  intakeSessions.set(interaction.user.id, session);

  await sendWizardStep(interaction, createCharacterPermissionPreviewPayload(permission), { cleanup: true });
}

function createGeneratedCharacterPermission(user, session) {
  const ownerGroups = Array.isArray(session.thirdPartyOwnerGroups) && session.thirdPartyOwnerGroups.length > 0
    ? session.thirdPartyOwnerGroups
    : parseOwnerGroupsFromRawThirdPartyDetails(session.thirdPartyCharactersRaw);

  return {
    generatedIntakeAffirmation: true,
    ownerGroups,
    ownerName: ownerGroups.map((group) => group.ownerName).filter(Boolean).join(", "),
    characterName: ownerGroups.flatMap((group) => group.characterNames || []).filter(Boolean).join(", "),
    clientName: session.preferredHandle || formatDiscordUserName(user),
    contentType: session.contentRating || "",
    submittedBy: formatDiscordUserName(user),
    submittedUserId: user.id,
    date: new Date().toISOString().slice(0, 10)
  };
}

function parseOwnerGroupsFromRawThirdPartyDetails(value) {
  const text = String(value || "").trim();
  if (!text) {
    return [];
  }

  return [{
    ownerName: "Provided in request",
    characterNames: [text],
    contactPlatform: "",
    contactHandle: ""
  }];
}

async function showCharacterPermissionModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const modal = new ModalBuilder()
    .setCustomId(ids.characterPermissionModal)
    .setTitle("Character Affirmation")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldCharacterOwnerName)
          .setLabel("Owner name or screen name")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldCharacterName)
          .setLabel("Character name")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldCharacterContentType)
          .setLabel("Requested content type")
          .setPlaceholder("SFW, suggestive, mature, explicit, commercial, other")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true)
          .setValue(limitText(session.contentRating || "", 100))
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldCharacterOwnerContact)
          .setLabel("Client name or screen name")
          .setPlaceholder("Your preferred name or handle")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(120)
          .setValue(limitText(formatDiscordUserName(interaction.user), 100))
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleCharacterPermissionBlankPdf(interaction, config) {
  const attachment = new AttachmentBuilder(await createCharacterPermissionPdfBuffer({}, config), {
    name: getCharacterPermissionPdfFileName()
  });

  await interaction.reply({
    content: "Here is a blank client character permission affirmation PDF.",
    files: [attachment],
    flags: EPHEMERAL_FLAGS
  });
  scheduleDeleteInteractionReply(interaction, DOCUMENT_EPHEMERAL_DELETE_AFTER_MS);
}

async function handleCharacterPermissionModal(interaction, config) {
  const permission = {
    ownerName: readField(interaction, ids.fieldCharacterOwnerName),
    characterName: readField(interaction, ids.fieldCharacterName),
    clientName: readField(interaction, ids.fieldCharacterOwnerContact),
    contentType: readField(interaction, ids.fieldCharacterContentType),
    submittedBy: formatDiscordUserName(interaction.user),
    submittedUserId: interaction.user.id,
    date: new Date().toISOString().slice(0, 10)
  };

  const session = getIntakeSession(interaction.user.id);
  session.pendingCharacterPermission = permission;
  intakeSessions.set(interaction.user.id, session);

  await interaction.reply({
    ...createCharacterPermissionPreviewPayload(permission),
    flags: EPHEMERAL_FLAGS
  });
}

function createCharacterPermissionPreviewPayload(permission) {
  const body = createCharacterPermissionPreviewBody(permission);
  const buttons = [
    new ButtonBuilder()
      .setCustomId(ids.characterPermissionSign)
      .setLabel("Sign")
      .setStyle(ButtonStyle.Success)
  ];

  if (!permission.generatedIntakeAffirmation) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(ids.characterPermissionEdit)
        .setLabel("Edit")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("Review Character Affirmation")
        .setDescription(limitText(body, 4096))
        .setColor(0x5865f2)
    ],
    components: [
      new ActionRowBuilder().addComponents(buttons)
    ]
  };
}

function createCharacterPermissionPreviewBody(permission) {
  const lines = [
    "Please review the compiled character permission affirmation before signing.",
    "",
    "**Client Character Permission Affirmation**",
    "",
    "I affirm that I have permission from the owner of any character, design, or concept included in this commission that I do not personally own.",
    "",
    "For any third-party character included in this request, I confirm that:",
    "",
    "- The character owner has given me permission to include their character in this commission.",
    "- The character owner understands the general nature of the requested artwork.",
    "- I have not misrepresented the character, the owner's consent, or the intended use of the finished artwork.",
    "- I understand that Anthro-Corp Studios / Dodger may request additional confirmation from the character owner if needed.",
    ""
  ];

  if (permission.generatedIntakeAffirmation && Array.isArray(permission.ownerGroups)) {
    lines.push("Third-party characters:");
    permission.ownerGroups.forEach((group, index) => {
      lines.push(
        "",
        "Owner " + (index + 1) + ": " + (group.ownerName || "Not provided"),
        "Characters: " + ((group.characterNames || []).join(", ") || "Not provided"),
        "Contact: " + [group.contactPlatform, group.contactHandle].filter(Boolean).join(" / ")
      );
    });
  } else {
    lines.push(
      "Character owner name or screen name: " + permission.ownerName,
      "Character name: " + permission.characterName
    );
  }

  lines.push(
    "",
    "Requested content type: " + (permission.contentType || "Not provided"),
    "Client name or screen name: " + (permission.clientName || "Not provided"),
    "",
    "Date: " + (permission.date || "Not provided"),
    "",
    "Signing account: " + permission.submittedBy + " / ID " + permission.submittedUserId
  );

  return lines.join("\n");
}

async function showCharacterPermissionSignatureModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  if (!session.pendingCharacterPermission) {
    await interaction.reply({
      content: "Please fill out the character permission affirmation before signing.",
      flags: EPHEMERAL_FLAGS
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(ids.characterPermissionSignatureModal)
    .setTitle("Sign Affirmation")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldCharacterSignature)
          .setLabel("Type AGREE to sign")
          .setPlaceholder("AGREE")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleCharacterPermissionSignatureModal(interaction, config) {
  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const typedAgreement = readField(interaction, ids.fieldCharacterSignature);
  if (typedAgreement.trim().toLowerCase() !== "agree") {
    await interaction.editReply("Please click Sign again and type AGREE to complete the character permission affirmation.");
    scheduleDeleteInteractionReply(interaction);
    return;
  }

  const session = getIntakeSession(interaction.user.id);
  const permission = {
    ...(session.pendingCharacterPermission || {}),
    typedAgreement: "AGREE",
    submittedBy: formatDiscordUserName(interaction.user),
    submittedUserId: interaction.user.id,
    signedAt: new Date().toISOString()
  };

  if (!isCharacterPermissionComplete(permission)) {
    await interaction.editReply("The pending affirmation expired. Please fill it out again before signing.");
    scheduleDeleteInteractionReply(interaction);
    return;
  }

  session.characterPermission = permission;
  delete session.pendingCharacterPermission;
  intakeSessions.set(interaction.user.id, session);

  if (permission.generatedIntakeAffirmation) {
    if (await maybeReturnToRequestReview(interaction, session)) {
      return;
    }

    await interaction.editReply({
      content: "Character permission affirmation signed. Should this commission be private?\n(Private commissions will be completed out of public view)",
      components: createChoiceRows(privacyChoices, ids.privacyPrefix)
    });
    rememberWizardInteraction(interaction.user.id, interaction);
    return;
  }

  const pdfBuffer = await createCharacterPermissionPdfBuffer(permission, config);
  const fileName = getCharacterPermissionPdfFileName(permission);
  const attachment = new AttachmentBuilder(pdfBuffer, { name: fileName });

  let dmMessage = "I also sent you a DM copy.";
  try {
    await interaction.user.send({
      content: "Here is your completed Client Character Permission Affirmation PDF.",
      files: [new AttachmentBuilder(pdfBuffer, { name: fileName })]
    });
  } catch {
    dmMessage = "I could not DM you a copy, but the PDF is attached here.";
  }

  await interaction.editReply({
    content: "Character permission affirmation saved for this request. " + dmMessage + "\n\nClick Continue on the previous prompt when you are ready.",
    files: [attachment]
  });
  scheduleDeleteInteractionReply(interaction, DOCUMENT_EPHEMERAL_DELETE_AFTER_MS);
}

function isCharacterPermissionComplete(permission) {
  if (!permission || typeof permission !== "object") {
    return false;
  }

  if (permission.generatedIntakeAffirmation) {
    return Array.isArray(permission.ownerGroups) && permission.ownerGroups.length > 0 && Boolean(permission.clientName);
  }

  return Boolean(permission.ownerName && permission.characterName && permission.clientName);
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
  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }
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
  await showAvailabilityTimeModal(interaction);
}

async function showAvailabilityTimeModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const modal = new ModalBuilder()
    .setCustomId(ids.availabilityTimeModal)
    .setTitle("Contact Availability")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldAvailabilityStartTime)
          .setLabel("Best contact start time")
          .setPlaceholder("HH:MM AM/PM")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setValue(limitText(session.availabilityStartTime || "", 20))
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldAvailabilityEndTime)
          .setLabel("Best contact end time")
          .setPlaceholder("HH:MM AM/PM")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(20)
          .setValue(limitText(session.availabilityEndTime || "", 20))
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldAvailabilityTimezone)
          .setLabel("Timezone")
          .setPlaceholder("CST, EST, PST, GMT+1...")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(50)
          .setValue(limitText(session.availabilityTimezone || "", 50))
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleAvailabilityTimeModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  session.availabilityStartTime = readField(interaction, ids.fieldAvailabilityStartTime);
  session.availabilityEndTime = readField(interaction, ids.fieldAvailabilityEndTime);
  session.availabilityTimezone = readField(interaction, ids.fieldAvailabilityTimezone);
  intakeSessions.set(interaction.user.id, session);

  if (await maybeReturnToRequestReview(interaction, session)) {
    return;
  }

  await interaction.reply({
    content: "Availability saved. Last step: add the request details.",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ids.detailsOpen)
          .setLabel("Continue to Request Details")
          .setStyle(ButtonStyle.Primary)
      )
    ],
    flags: EPHEMERAL_FLAGS
  });
  await deleteStoredWizardMessages(interaction.user.id, interaction);
  rememberWizardInteraction(interaction.user.id, interaction);
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
    if (await maybeReturnToRequestReview(interaction, session)) {
      return;
    }
    await interaction.reply({
      content: "What level of work would you like?",
      components: createChoiceRows(completionLevelChoices, ids.levelPrefix),
      flags: EPHEMERAL_FLAGS
    });
    await deleteStoredWizardMessages(interaction.user.id, interaction);
    rememberWizardInteraction(interaction.user.id, interaction);
    return;
  }

  if (field === "completionLevel") {
    session.completionLevel = value;
    intakeSessions.set(interaction.user.id, session);
    if (await maybeReturnToRequestReview(interaction, session)) {
      return;
    }
    await interaction.reply({
      content: "Is your request SFW or NSFW?",
      components: createChoiceRows(ratingChoices, ids.ratingPrefix),
      flags: EPHEMERAL_FLAGS
    });
    await deleteStoredWizardMessages(interaction.user.id, interaction);
    rememberWizardInteraction(interaction.user.id, interaction);
    return;
  }

  await interaction.reply({ content: "Unknown field.", flags: EPHEMERAL_FLAGS });
}

async function showDetailsModal(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const modal = new ModalBuilder()
    .setCustomId(ids.detailsModal)
    .setTitle("Commission Request")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(ids.fieldRequestDetails)
          .setLabel("Request details")
          .setPlaceholder("Please include as much detail as possible. You can upload image references later.")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setValue(limitText(session.requestDetails || "", 1000))
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function handleDetailsModal(interaction, config) {
  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const session = getIntakeSession(interaction.user.id);
  if (!session.commissionType || !session.completionLevel || !session.contentRating || !session.characterOwnershipId || session.privateCommission == null || !Array.isArray(session.availabilityDays) || session.availabilityDays.length === 0) {
    await interaction.editReply("The request session expired. Please click Request again.");
    return;
  }

  session.requestDetails = readField(interaction, ids.fieldRequestDetails);
  delete session.returnToReview;
  intakeSessions.set(interaction.user.id, session);
  await deleteStoredWizardMessages(interaction.user.id, interaction);
  await showRequestReview(interaction);
}

async function handleReviewSubmit(interaction, config) {
  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const session = getIntakeSession(interaction.user.id);
  const missing = getMissingReviewFields(session);
  if (missing.length > 0) {
    await interaction.editReply("The request is missing: " + missing.join(", ") + ". Please click Edit and complete those sections.");
    return;
  }

  await deleteStoredWizardMessages(interaction.user.id, interaction);

  const member = await interaction.guild.members.fetch(interaction.user.id);
  await ensureClientRole(member, config);

  const preferredHandle = session.preferredHandle || formatDiscordUserName(interaction.user);
  const commissionType = session.commissionType;
  const completionLevel = session.completionLevel;
  const contentRating = session.contentRating;
  const characterOwnershipId = session.characterOwnershipId;
  const characterOwnershipLabel = session.characterOwnershipLabel;
  const characterPermission = session.characterPermission || null;
  const termsAcceptedAt = session.termsAcceptedAt || new Date().toISOString();
  const termsAcceptedUserId = session.termsAcceptedUserId || interaction.user.id;
  const termsAcceptedUserName = session.termsAcceptedUserName || formatDiscordUserName(interaction.user);
  const privateCommission = session.privateCommission === true;
  const requestDetails = session.requestDetails || "";
  const availabilityStartTime = session.availabilityStartTime || "";
  const availabilityEndTime = session.availabilityEndTime || "";
  const availabilityTimezone = session.availabilityTimezone || "";
  const characterCount = clamp(Number(session.characterCount) || 1, 1, 20);
  const ownedCharacterCount = clamp(Number(session.ownedCharacterCount) || (characterOwnershipId === "owned" ? characterCount : 0), 0, characterCount);
  const characterDetails = session.characterDetails || {
    characterCount,
    ownedCharacterCount,
    ownedCharacterNames: session.ownedCharacterNames || [],
    thirdPartyCharacters: session.thirdPartyCharactersRaw || ""
  };

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
    characterOwnershipLabel,
    characterPermission,
    characterCount,
    ownedCharacterCount,
    characterDetails,
    termsAcceptedAt,
    termsAcceptedUserId,
    termsAcceptedUserName,
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
    characterOwnershipId,
    characterOwnershipLabel,
    characterPermission,
    characterCount,
    ownedCharacterCount,
    characterDetails,
    termsAcceptedAt,
    termsAcceptedUserId,
    termsAcceptedUserName,
    privateCommission,
    availabilityDays: session.availabilityDays,
    availabilityStartTime,
    availabilityEndTime,
    availabilityTimezone,
    requestDetails
  });

  await sendCommissionRequestPdfToThread(thread, commission, {
    preferredHandle,
    availabilityText: formatAvailability(session.availabilityDays, availabilityStartTime, availabilityEndTime, availabilityTimezone)
  }, config);
  await sendCommissionRequestPdfToUser(interaction.user, commission, {
    preferredHandle,
    availabilityText: formatAvailability(session.availabilityDays, availabilityStartTime, availabilityEndTime, availabilityTimezone)
  }, config);

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

async function maybeReturnToRequestReview(interaction, session) {
  if (!session?.returnToReview) {
    return false;
  }

  delete session.returnToReview;
  intakeSessions.set(interaction.user.id, session);
  if (interaction.isModalSubmit?.()) {
    await deleteStoredWizardMessages(interaction.user.id, interaction);
  }
  await showRequestReview(interaction);
  return true;
}

async function showRequestReview(interaction) {
  const session = getIntakeSession(interaction.user.id);
  const payload = createRequestReviewPayload(interaction.user, session);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else if (interaction.isButton?.() || interaction.isStringSelectMenu?.()) {
    await interaction.update(payload);
  } else {
    await interaction.reply({
      ...payload,
      flags: EPHEMERAL_FLAGS
    });
  }

  rememberWizardInteraction(interaction.user.id, interaction);
}

function createRequestReviewPayload(user, session) {
  const missing = getMissingReviewFields(session);
  const characterSummary = formatReviewCharacterSummary(session);
  const embed = new EmbedBuilder()
    .setTitle("Review Commission Request")
    .setDescription(missing.length > 0
      ? "Please review the request. Missing sections must be completed before submitting: " + missing.join(", ")
      : "Please review the request below. Submit when everything looks right, or choose a section to edit.")
    .setColor(missing.length > 0 ? 0xf59e0b : 0x57f287)
    .addFields(
      { name: "Preferred name", value: limitText(session.preferredHandle || formatDiscordUserName(user), 1024), inline: true },
      { name: "Commission type", value: limitText(session.commissionType || "Not provided", 1024), inline: true },
      { name: "Completion level", value: limitText(session.completionLevel || "Not provided", 1024), inline: true },
      { name: "Content rating", value: limitText(session.contentRating || "Not provided", 1024), inline: true },
      { name: "Privacy", value: session.privateCommission == null ? "Not provided" : (session.privateCommission ? "Private" : "Public"), inline: true },
      { name: "Availability", value: limitText(formatAvailability(session.availabilityDays, session.availabilityStartTime, session.availabilityEndTime, session.availabilityTimezone), 1024), inline: false },
      { name: "Characters", value: limitText(characterSummary, 1024), inline: false },
      { name: "Request details", value: limitText(session.requestDetails || "Not provided", 1024), inline: false }
    );

  return {
    content: "",
    embeds: [embed],
    components: createReviewRows(missing.length === 0)
  };
}

function createReviewRows(canSubmit) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(ids.reviewSubmit)
        .setLabel("Submit")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canSubmit)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(ids.reviewEdit)
        .setPlaceholder("Edit a section")
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel("Preferred name").setValue("preferred_name"),
          new StringSelectMenuOptionBuilder().setLabel("Commission type").setValue("commission_type"),
          new StringSelectMenuOptionBuilder().setLabel("Completion level").setValue("completion_level"),
          new StringSelectMenuOptionBuilder().setLabel("Content rating").setValue("content_rating"),
          new StringSelectMenuOptionBuilder().setLabel("Characters").setValue("characters"),
          new StringSelectMenuOptionBuilder().setLabel("Privacy").setValue("privacy"),
          new StringSelectMenuOptionBuilder().setLabel("Availability").setValue("availability"),
          new StringSelectMenuOptionBuilder().setLabel("Request details").setValue("request_details")
        )
    )
  ];
}

async function handleReviewEditSelection(interaction) {
  const selected = interaction.values?.[0] || "";
  const session = getIntakeSession(interaction.user.id);
  session.returnToReview = true;
  intakeSessions.set(interaction.user.id, session);

  if (selected === "preferred_name") {
    await showPreferredNameModal(interaction);
    return;
  }

  if (selected === "commission_type") {
    await interaction.update({
      content: "What type of commission are you interested in?",
      embeds: [],
      components: createChoiceRows(commissionTypeChoices, ids.typePrefix)
    });
    return;
  }

  if (selected === "completion_level") {
    await interaction.update({
      content: "What level of work would you like?",
      embeds: [],
      components: createChoiceRows(completionLevelChoices, ids.levelPrefix)
    });
    return;
  }

  if (selected === "content_rating") {
    await interaction.update({
      content: "Is your request SFW or NSFW?",
      embeds: [],
      components: createChoiceRows(ratingChoices, ids.ratingPrefix)
    });
    return;
  }

  if (selected === "characters") {
    await showCharacterCountSelection(interaction);
    return;
  }

  if (selected === "privacy") {
    await interaction.update({
      content: "Should this commission be private?\n(Private commissions will be completed out of public view)",
      embeds: [],
      components: createChoiceRows(privacyChoices, ids.privacyPrefix)
    });
    return;
  }

  if (selected === "availability") {
    await interaction.update({
      content: "Please select the days that are usually best for me to reach you, then click Continue.",
      embeds: [],
      components: createAvailabilityDayRows(session.availabilityDays || [])
    });
    return;
  }

  if (selected === "request_details") {
    await showDetailsModal(interaction);
    return;
  }

  delete session.returnToReview;
  intakeSessions.set(interaction.user.id, session);
  await interaction.reply({ content: "Unknown review section.", flags: EPHEMERAL_FLAGS });
}

function getMissingReviewFields(session) {
  const missing = [];
  if (!session.preferredHandle) missing.push("preferred name");
  if (!session.commissionType) missing.push("commission type");
  if (!session.completionLevel) missing.push("completion level");
  if (!session.contentRating) missing.push("content rating");
  if (!session.characterOwnershipId) missing.push("character ownership");
  if (session.characterOwnershipId === "permission" && !session.characterPermission) missing.push("character permission affirmation");
  if (session.privateCommission == null) missing.push("privacy");
  if (!Array.isArray(session.availabilityDays) || session.availabilityDays.length === 0) missing.push("availability days");
  if (!session.availabilityStartTime || !session.availabilityEndTime || !session.availabilityTimezone) missing.push("contact time");
  if (!session.requestDetails) missing.push("request details");
  return missing;
}

function formatReviewCharacterSummary(session) {
  const characterCount = clamp(Number(session.characterCount) || 1, 1, 20);
  const ownedCount = clamp(Number(session.ownedCharacterCount) || (session.characterOwnershipId === "owned" ? characterCount : 0), 0, characterCount);
  const thirdPartyCount = Math.max(0, characterCount - ownedCount);
  const lines = [
    "Total characters: " + characterCount,
    "Owned by commissioner: " + ownedCount,
    "Third-party characters: " + thirdPartyCount,
    "Ownership answer: " + (session.characterOwnershipLabel || "Not provided")
  ];

  if (Array.isArray(session.ownedCharacterNames) && session.ownedCharacterNames.length > 0) {
    lines.push("Commissioner-owned characters: " + session.ownedCharacterNames.join(", "));
  }

  if (session.thirdPartyCharactersRaw) {
    lines.push("", session.thirdPartyCharactersRaw);
  }

  return lines.join("\n");
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

  if (commissionRequiresOwnerConfirmationPrompt(commission)) {
    approvalPromptSources.set(String(commission.id), {
      channelId: interaction.channelId,
      messageId: interaction.message?.id || ""
    });
    await interaction.editReply({
      content: [
        "This request is marked as including third-party character material.",
        "",
        "Is a separate Third-Party Character Permission Confirmation from the character owner required before/while accepting this commission?"
      ].join("\n"),
      components: [createOwnerConfirmationDecisionRow(commission.id)]
    });
    return;
  }

  await performCommissionApproval(interaction, config, commission);
}

async function handleOwnerConfirmationDecision(interaction, config, required) {
  if (!memberCanManageCommissions(interaction.member, interaction.user.id, config)) {
    await interaction.reply({ content: "Only staff can approve commission requests.", flags: EPHEMERAL_FLAGS });
    return;
  }

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const prefix = required ? ids.ownerConfirmationRequiredPrefix : ids.ownerConfirmationSkipPrefix;
  const commissionId = interaction.customId.slice(prefix.length);
  const commission = getCommissionById(commissionId);
  if (!commission) {
    await interaction.editReply("This request record could not be found.");
    return;
  }

  if (required) {
    await sendThirdPartyOwnerConfirmationToThread(interaction.client, commission, config);
  }

  await deleteStoredApprovalSourceMessage(interaction.client, commission.id);
  await performCommissionApproval(interaction, config, commission, {
    ownerConfirmationRequired: required,
    skipSourceDelete: true
  });
}

function createOwnerConfirmationDecisionRow(commissionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.ownerConfirmationRequiredPrefix + commissionId)
      .setLabel("Required")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(ids.ownerConfirmationSkipPrefix + commissionId)
      .setLabel("Not Required")
      .setStyle(ButtonStyle.Secondary)
  );
}

async function performCommissionApproval(interaction, config, commission, options = {}) {
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
  if (!options.skipSourceDelete) {
    await deleteInteractionSourceMessage(interaction);
  }
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
    payload: {
      trelloCardId: updatedCommission.trelloCardId,
      ownerConfirmationRequired: options.ownerConfirmationRequired === true
    }
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
    "Discord user ID: " + (input.termsAcceptedUserId || "Not provided"),
    "ToS accepted: " + (input.termsAcceptedAt || "Not provided"),
    "Commission type: " + input.commissionType,
    "Level of work: " + input.completionLevel,
    "Rating: " + input.contentRating,
    "Character ownership: " + (input.characterOwnershipLabel || "Not provided"),
    formatCharacterDetailsForThread(input),
    formatCharacterPermissionSummary(input.characterPermission),
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

async function sendCommissionRequestPdfToThread(thread, commission, input, config) {
  try {
    const pdfBuffer = await createCommissionRequestPdfBuffer({
      commission,
      preferredHandle: input.preferredHandle,
      availabilityText: input.availabilityText
    }, config);
    await thread.send({
      content: "Commission request PDF copy:",
      files: [
        new AttachmentBuilder(pdfBuffer, {
          name: getCommissionRequestPdfFileName({ commission })
        })
      ]
    });
  } catch (error) {
    console.warn("[Commission Portal] Failed to attach commission request PDF:", error.message);
  }
}

async function sendCommissionRequestPdfToUser(user, commission, input, config) {
  try {
    const pdfBuffer = await createCommissionRequestPdfBuffer({
      commission,
      preferredHandle: input.preferredHandle,
      availabilityText: input.availabilityText
    }, config);
    await user.send({
      content: "Here is a PDF copy of your submitted commission request.",
      files: [
        new AttachmentBuilder(pdfBuffer, {
          name: getCommissionRequestPdfFileName({ commission })
        })
      ]
    });
  } catch (error) {
    console.warn("[Commission Portal] Failed to DM commission request PDF:", error.message);
  }
}

async function sendThirdPartyOwnerConfirmationToThread(client, commission, config) {
  const thread = await client.channels.fetch(commission.threadId).catch(() => null);
  if (!thread?.send) {
    return;
  }

  const clientRecord = getClient(commission.discordUserId);
  const affirmation = parseJsonObject(commission.characterPermissionJson);
  const formInput = {
    ownerName: affirmation?.ownerName || "",
    characterName: affirmation?.characterName || "",
    clientName: clientRecord?.preferredName || affirmation?.clientName || commission.termsAcceptedUserName || commission.discordUserId,
    contentType: [commission.commissionType, commission.contentRating].filter(Boolean).join(" / "),
    ownerContact: "",
    date: ""
  };
  const pdfBuffer = await createThirdPartyCharacterPermissionPdfBuffer(formInput, config);

  await thread.send({
    content: [
      "Third-party character owner confirmation requested.",
      "",
      "Please have the character owner either sign and return this form, or reply back to the artist with written confirmation that they consent to this specific commission."
    ].join("\n"),
    files: [
      new AttachmentBuilder(pdfBuffer, {
        name: getThirdPartyCharacterPermissionPdfFileName(formInput)
      })
    ]
  });
}

async function deleteStoredApprovalSourceMessage(client, commissionId) {
  const key = String(commissionId);
  const source = approvalPromptSources.get(key);
  approvalPromptSources.delete(key);

  if (!source?.channelId || !source.messageId) {
    return;
  }

  const channel = await client.channels.fetch(source.channelId).catch(() => null);
  const message = await channel?.messages?.fetch?.(source.messageId).catch(() => null);
  await message?.delete?.().catch(() => null);
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

function createCommissionPortalEmbed(config) {
  return new EmbedBuilder()
    .setTitle("Commissions")
    .setDescription([
      "Thanks so much for your interest!",
      "",
      "Use the buttons below to review pricing, read the Terms of Service, or start a commission request. Pricing and Terms open privately so the channel stays clean."
    ].join("\n"))
    .setColor(0x7c5cff);
}

function createCommissionPortalRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(getCommissionDocumentOpenCustomId("pricing"))
        .setLabel("Pricing")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(getCommissionDocumentOpenCustomId("tos"))
        .setLabel("Terms")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(ids.request)
        .setLabel("Request")
        .setStyle(ButtonStyle.Primary)
    )
  ];
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

function createCountRows(prefix, moreId, maxCount, startAt = 1) {
  const buttons = [];
  for (let value = startAt; value <= maxCount; value++) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(prefix + value)
        .setLabel(String(value))
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (moreId) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(moreId)
        .setLabel("+")
        .setStyle(ButtonStyle.Primary)
    );
  }

  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)));
  }

  return rows;
}

function createThirdPartyOwnerQuantityRows(remaining) {
  return createCountRows(ids.thirdPartyOwnerQuantityPrefix, null, Math.min(remaining, 5), 1);
}

function createThirdPartyContactPlatformRows() {
  const choices = ["Discord", "Telegram", "Bluesky", "FurAffinity", "Twitter", "Email"];
  const buttons = choices.map((choice) =>
    new ButtonBuilder()
      .setCustomId(ids.thirdPartyContactPlatformPrefix + choice)
      .setLabel(choice)
      .setStyle(ButtonStyle.Secondary)
  );

  return [
    new ActionRowBuilder().addComponents(buttons.slice(0, 3)),
    new ActionRowBuilder().addComponents(buttons.slice(3))
  ];
}

async function sendWizardStep(interaction, payload, options = {}) {
  const response = {
    content: payload.content || "",
    embeds: payload.embeds || [],
    components: payload.components || []
  };

  if (interaction.isButton?.() || interaction.isStringSelectMenu?.()) {
    await interaction.update(response);
    rememberWizardInteraction(interaction.user.id, interaction);
    return;
  }

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(response);
  } else {
    await interaction.reply({
      ...response,
      flags: EPHEMERAL_FLAGS
    });
  }

  if (options.cleanup) {
    await deleteStoredWizardMessages(interaction.user.id, interaction);
  }
  rememberWizardInteraction(interaction.user.id, interaction);
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
      { name: "Character ownership", value: limitText(commission.characterOwnershipLabel || "Not provided", 1024), inline: true },
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

function commissionRequiresOwnerConfirmationPrompt(commission) {
  const ownershipId = String(commission?.characterOwnershipId || "").trim().toLowerCase();
  if (ownershipId === "permission" || ownershipId === "unsure") {
    return true;
  }

  const characterCount = Number(commission?.characterCount || 0) || 0;
  const ownedCount = Number(commission?.ownedCharacterCount || 0) || 0;
  if (characterCount > 0 && ownedCount < characterCount) {
    return true;
  }

  const ownershipLabel = String(commission?.characterOwnershipLabel || "").trim().toLowerCase();
  return ownershipLabel.includes("permission") || ownershipLabel.includes("unsure");
}

function formatDiscordUserName(user) {
  return user?.tag || user?.globalName || user?.username || "Unknown Discord user";
}

function parseJsonObject(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function formatCharacterDetailsForThread(input) {
  const details = input?.characterDetails || parseJsonObject(input?.characterDetailsJson) || {};
  const characterCount = Number(input?.characterCount || details.characterCount || 1) || 1;
  const ownedCount = Number(input?.ownedCharacterCount || details.ownedCharacterCount || 0) || 0;
  const thirdPartyCount = Math.max(0, characterCount - ownedCount);
  const lines = [
    "Total characters: " + characterCount,
    "Owned by commissioner: " + ownedCount,
    "Third-party characters: " + thirdPartyCount
  ];

  if (Array.isArray(details.ownedCharacterNames) && details.ownedCharacterNames.length > 0) {
    lines.push("Commissioner-owned characters: " + details.ownedCharacterNames.join(", "));
  }

  if (details.thirdPartyCharacters) {
    lines.push("Third-party details:\n" + details.thirdPartyCharacters);
  }

  return lines.join("\n");
}

function addThirdPartyCharacter(session, ownerName, characterName) {
  const normalizedOwner = normalizeComparable(ownerName);
  const groups = Array.isArray(session.thirdPartyOwnerGroups) ? session.thirdPartyOwnerGroups : [];
  let group = groups.find((item) => normalizeComparable(item.ownerName) === normalizedOwner);

  if (!group) {
    group = {
      ownerName,
      characterNames: [],
      contactPlatform: "",
      contactHandle: ""
    };
    groups.push(group);
  }

  if (characterName && !group.characterNames.some((name) => normalizeComparable(name) === normalizeComparable(characterName))) {
    group.characterNames.push(characterName);
  }

  session.thirdPartyOwnerGroups = groups;
}

function splitCharacterNames(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatThirdPartyOwnerGroups(groups) {
  return (groups || []).map((group, index) => [
    "Owner " + (index + 1) + ": " + (group.ownerName || "Not provided"),
    "Characters: " + ((group.characterNames || []).join(", ") || "Not provided"),
    "Best contact platform: " + (group.contactPlatform || "Not provided"),
    "Owner handle/contact: " + (group.contactHandle || "Not provided")
  ].join("\n")).join("\n\n");
}

function formatCharacterPermissionSummary(permission) {
  if (!permission || typeof permission !== "object") {
    return "Client character permission affirmation: Not provided";
  }

  return [
    "Client character permission affirmation: Completed",
    "Character owner: " + (permission.ownerName || "Not provided"),
    "Character: " + (permission.characterName || "Not provided"),
    "Requested content type: " + (permission.contentType || "Not provided"),
    "Client name: " + (permission.clientName || "Not provided"),
    "Affirmation date: " + (permission.date || "Not provided")
  ].join("\n");
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

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
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
  createCommissionPublishDocumentsCommand,
  createCommissionPublishPricingCommand,
  createCommissionPublishTosCommand,
  createCommissionSetupCommand,
  handleCommissionPortalInteraction,
  handleCommissionPortalMessageCreate,
  handleCommissionPortalReactionAdd,
  handleCommissionPortalThreadUpdate
};

