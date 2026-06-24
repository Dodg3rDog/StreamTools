const path = require("path");

const DEFAULTS = {
  requestCategoryId: "1513219882479653036",
  tosChannelId: "1513273071740653680",
  pricingChannelId: "1513273123670327368",
  submitRequestChannelId: "1513273302699868161",
  pendingCategoryId: "1513273729348538439",
  activeCategoryId: "1513273895908671509",
  completed2026CategoryId: "1513274138066812928",
  trashCategoryId: "1513277018354221237",
  loggingChannelId: "1513316071363444788",
  feedbackLogForumChannelId: "1514032732571963514",
  feedbackLogThreadId: "1514032924637532201",
  templatesCategoryId: "1513244019839205509",
  clientForumTemplateId: "1513244710389547058",
  ownerUserId: "406173537498562560",
  clientRoleId: "1513274565978099792",
  staffRoleIds: ["845157373038297109", "1493074430513909833", "1513217100095815761"],
  tags: {
    inQueue: "1513246461394157728",
    wip: "1513247479972237383",
    onHold: "1513247648251908359",
    completed: "1513247787427303626",
    halfPaymentReceived: "1513248464660729876",
    paidInFull: "1513248569287512104",
    installmentPlan: "1513248913379823841",
    canceled: "1513249708653412433",
    rejected: "1513249821543239781",
    meetingRequired: "1513250392383946863",
    sketchApproved: "1513250706054844516",
    lineArtApproved: "1513250834144559174",
    flatsShadingApproved: "1513250914990035056",
    fullRenderApproved: "1513256454327504936",
    paintingApproved: "1513251110524162281",
    waitingSketchApproval: "1513252349521559852",
    waitingLineArtApproval: "1513252466672664769",
    waitingFlatsShadingApproval: "1513252668125221045",
    waitingFullRenderApproval: "1513256641317834812",
    waitingPaintingApproval: "1513252756335493190"
  },
  trello: {
    boardId: "69c9d52f22535449b96ef3aa",
    listInQueue: "69c9d53022535449b96ef3bf",
    listInProgress: "69c9d53022535449b96ef3c0",
    listCompleted: "69c9d53022535449b96ef3c1",
    templateLineArt: "6a25bd0e00f525cb9a301fe3",
    templateFlatsShading: "6a25c03ea6701941a29aa316",
    templateFullRender: "6a25c0e094274ba72e1eb86f",
    templatePainted: "6a25c1a681e045210b2f8605",
    labelRejected: "6a25bf0602f55c254dc327d0",
    labelCompleted: "69c9d53022535449b96ef3c6",
    labelWip: "69c9d53022535449b96ef3c7",
    labelCanceled: "69c9d53022535449b96ef3c8",
    labelAwaitingClientResponse: "69c9d53022535449b96ef3c9",
    labelPaid: "69c9d53022535449b96ef3cb",
    labelInstallmentPlan: "6a25bf20a3715635e33d63ae",
    labelMeetingRequired: "6a25bf5063e909352680ea65",
    labelHalfPaymentReceived: "69c9d53022535449b96ef3ca",
    labelOnHold: "69c9d7def059333cd0814609"
  }
};

function getCommissionConfig() {
  return {
    enabled: parseBoolean(process.env.ENABLE_COMMISSION_PORTAL, true),
    dataPath: process.env.COMMISSION_SQLITE_PATH || path.join(__dirname, "../../data/discord/commission-portal.sqlite"),
    pricingCatalogPath: process.env.COMMISSION_PRICING_CATALOG_PATH || path.join(__dirname, "../../config/discord/commission-pricing.json"),
    pricingWatchIntervalMs: parseInteger(process.env.COMMISSION_PRICING_WATCH_INTERVAL_MS, 15000),
    requestCategoryId: env("COMMISSION_REQUEST_CATEGORY_ID", DEFAULTS.requestCategoryId),
    tosChannelId: env("COMMISSION_TOS_CHANNEL_ID", DEFAULTS.tosChannelId),
    pricingChannelId: env("COMMISSION_PRICING_CHANNEL_ID", DEFAULTS.pricingChannelId),
    submitRequestChannelId: env("COMMISSION_SUBMIT_REQUEST_CHANNEL_ID", DEFAULTS.submitRequestChannelId),
    pendingCategoryId: env("COMMISSION_PENDING_CATEGORY_ID", DEFAULTS.pendingCategoryId),
    activeCategoryId: env("COMMISSION_ACTIVE_CATEGORY_ID", DEFAULTS.activeCategoryId),
    completed2026CategoryId: env("COMMISSION_COMPLETED_2026_CATEGORY_ID", DEFAULTS.completed2026CategoryId),
    trashCategoryId: env("COMMISSION_TRASH_CATEGORY_ID", DEFAULTS.trashCategoryId),
    loggingChannelId: env("COMMISSION_LOGGING_CHANNEL_ID", DEFAULTS.loggingChannelId),
    feedbackLogForumChannelId: env("COMMISSION_FEEDBACK_LOG_FORUM_CHANNEL_ID", DEFAULTS.feedbackLogForumChannelId),
    feedbackLogThreadId: env("COMMISSION_FEEDBACK_LOG_THREAD_ID", DEFAULTS.feedbackLogThreadId),
    templatesCategoryId: env("COMMISSION_TEMPLATES_CATEGORY_ID", DEFAULTS.templatesCategoryId),
    clientForumTemplateId: env("COMMISSION_CLIENT_FORUM_TEMPLATE_ID", DEFAULTS.clientForumTemplateId),
    ownerUserId: env("COMMISSION_OWNER_USER_ID", DEFAULTS.ownerUserId),
    clientRoleId: env("COMMISSION_CLIENT_ROLE_ID", DEFAULTS.clientRoleId),
    staffRoleIds: parseCsv(process.env.COMMISSION_STAFF_ROLE_IDS, DEFAULTS.staffRoleIds),
    tags: {
      inQueue: env("COMMISSION_TAG_IN_QUEUE", DEFAULTS.tags.inQueue),
      wip: env("COMMISSION_TAG_WIP", DEFAULTS.tags.wip),
      rejected: env("COMMISSION_TAG_REJECTED", DEFAULTS.tags.rejected)
    },
    tagNames: {
      inQueue: env("COMMISSION_TAG_NAME_IN_QUEUE", "In Queue"),
      wip: env("COMMISSION_TAG_NAME_WIP", "WIP"),
      onHold: env("COMMISSION_TAG_NAME_ON_HOLD", "On Hold"),
      completed: env("COMMISSION_TAG_NAME_COMPLETED", "Completed"),
      halfPaymentReceived: env("COMMISSION_TAG_NAME_HALF_PAYMENT_RECEIVED", "1/2 Payment Received"),
      paidInFull: env("COMMISSION_TAG_NAME_PAID_IN_FULL", "Paid in Full"),
      installmentPlan: env("COMMISSION_TAG_NAME_INSTALLMENT_PLAN", "Installment Plan"),
      canceled: env("COMMISSION_TAG_NAME_CANCELED", "Canceled"),
      rejected: env("COMMISSION_TAG_NAME_REJECTED", "Rejected"),
      meetingRequired: env("COMMISSION_TAG_NAME_MEETING_REQUIRED", "Meeting Required"),
      sketchApproved: env("COMMISSION_TAG_NAME_SKETCH_APPROVED", "Sketch Approved"),
      lineArtApproved: env("COMMISSION_TAG_NAME_LINE_ART_APPROVED", "Line Art Approved"),
      flatsShadingApproved: env("COMMISSION_TAG_NAME_FLATS_SHADING_APPROVED", "Flats & Shading Approved"),
      fullRenderApproved: env("COMMISSION_TAG_NAME_FULL_RENDER_APPROVED", "Full Render Approved"),
      paintingApproved: env("COMMISSION_TAG_NAME_PAINTING_APPROVED", "Painting Approved"),
      waitingSketchApproval: env("COMMISSION_TAG_NAME_WAITING_SKETCH_APPROVAL", "Waiting Sketch Approval Pending"),
      waitingLineArtApproval: env("COMMISSION_TAG_NAME_WAITING_LINE_ART_APPROVAL", "Waiting Line Art Approval Pending"),
      waitingFlatsShadingApproval: env("COMMISSION_TAG_NAME_WAITING_FLATS_SHADING_APPROVAL", "Waiting Flats/Shading Approval Pending"),
      waitingFullRenderApproval: env("COMMISSION_TAG_NAME_WAITING_FULL_RENDER_APPROVAL", "Waiting Full Render Approval Pending"),
      waitingPaintingApproval: env("COMMISSION_TAG_NAME_WAITING_PAINTING_APPROVAL", "Waiting Painting Approval Pending")
    },
    trello: {
      apiKey: process.env.TRELLO_API_KEY || "",
      apiToken: process.env.TRELLO_API_TOKEN || "",
      boardId: env("TRELLO_BOARD_ID", DEFAULTS.trello.boardId),
      listInQueue: env("TRELLO_LIST_IN_QUEUE", DEFAULTS.trello.listInQueue),
      listInProgress: env("TRELLO_LIST_IN_PROGRESS", DEFAULTS.trello.listInProgress),
      listCompleted: env("TRELLO_LIST_COMPLETED", DEFAULTS.trello.listCompleted),
      templateLineArt: env("TRELLO_TEMPLATE_LINE_ART", DEFAULTS.trello.templateLineArt),
      templateFlatsShading: env("TRELLO_TEMPLATE_FLATS_SHADING", DEFAULTS.trello.templateFlatsShading),
      templateFullRender: env("TRELLO_TEMPLATE_FULL_RENDER", DEFAULTS.trello.templateFullRender),
      templatePainted: env("TRELLO_TEMPLATE_PAINTED", DEFAULTS.trello.templatePainted),
      labelRejected: env("TRELLO_LABEL_REJECTED", DEFAULTS.trello.labelRejected),
      labelCompleted: env("TRELLO_LABEL_COMPLETED", DEFAULTS.trello.labelCompleted),
      labelWip: env("TRELLO_LABEL_WIP", DEFAULTS.trello.labelWip),
      labelCanceled: env("TRELLO_LABEL_CANCELED", DEFAULTS.trello.labelCanceled),
      labelAwaitingClientResponse: env("TRELLO_LABEL_AWAITING_CLIENT_RESPONSE", DEFAULTS.trello.labelAwaitingClientResponse),
      labelPaid: env("TRELLO_LABEL_PAID", DEFAULTS.trello.labelPaid),
      labelInstallmentPlan: env("TRELLO_LABEL_INSTALLMENT_PLAN", DEFAULTS.trello.labelInstallmentPlan),
      labelMeetingRequired: env("TRELLO_LABEL_MEETING_REQUIRED", DEFAULTS.trello.labelMeetingRequired),
      labelHalfPaymentReceived: env("TRELLO_LABEL_HALF_PAYMENT_RECEIVED", DEFAULTS.trello.labelHalfPaymentReceived),
      labelOnHold: env("TRELLO_LABEL_ON_HOLD", DEFAULTS.trello.labelOnHold)
    }
  };
}

function getTemplateIdForCompletionLevel(completionLevel, config = getCommissionConfig()) {
  const normalized = normalizeKey(completionLevel);

  if (normalized.includes("line")) {
    return config.trello.templateLineArt;
  }

  if (normalized.includes("flat") || normalized.includes("shading")) {
    return config.trello.templateFlatsShading;
  }

  if (normalized.includes("render")) {
    return config.trello.templateFullRender;
  }

  if (normalized.includes("paint")) {
    return config.trello.templatePainted;
  }

  return "";
}

function env(name, fallback) {
  const value = process.env[name];
  return value == null || value === "" ? fallback : String(value).trim();
}

function parseCsv(value, fallback = []) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

module.exports = {
  getCommissionConfig,
  getTemplateIdForCompletionLevel
};
