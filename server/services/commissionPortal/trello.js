const { getCommissionConfig, getTemplateIdForCompletionLevel } = require("./config");

async function createCommissionCard(commission, options = {}) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  const templateId = getTemplateIdForCompletionLevel(commission.completionLevel, config);
  if (!templateId) {
    throw new Error("No Trello template is configured for completion level: " + commission.completionLevel);
  }

  const cardName = "Commission for " + (options.preferredName || commission.discordUserId);

  return trelloRequest("POST", "/1/cards", {
    idList: config.trello.listInQueue,
    idCardSource: templateId,
    keepFromSource: "all",
    name: limitText(cardName, 16384),
    desc: createCardDescription(commission)
  });
}

async function archiveCard(cardId) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  if (!cardId) {
    return null;
  }

  return trelloRequest("PUT", "/1/cards/" + encodeURIComponent(cardId), {
    closed: "true"
  });
}

async function moveCardToList(cardId, listId) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  if (!cardId || !listId) {
    return null;
  }

  return trelloRequest("PUT", "/1/cards/" + encodeURIComponent(cardId), {
    idList: listId
  });
}

async function getCard(cardId) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  if (!cardId) {
    return null;
  }

  return trelloRequest("GET", "/1/cards/" + encodeURIComponent(cardId), {
    fields: "id,idList,closed,idLabels,url,shortUrl"
  });
}

async function getCardChecklists(cardId) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  if (!cardId) {
    return [];
  }

  return trelloRequest("GET", "/1/cards/" + encodeURIComponent(cardId) + "/checklists");
}

async function completeChecklistItemsByName(cardId, itemNames) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  if (!cardId || !Array.isArray(itemNames) || itemNames.length === 0) {
    return [];
  }

  const checklists = await getCardChecklists(cardId);
  const wanted = new Set(itemNames.map(normalizeComparable));
  const completed = [];

  for (const checklist of checklists || []) {
    for (const item of checklist.checkItems || []) {
      if (!wanted.has(normalizeComparable(item.name)) || item.state === "complete") {
        continue;
      }

      await trelloRequest("PUT", "/1/cards/" + encodeURIComponent(cardId) + "/checkItem/" + encodeURIComponent(item.id), {
        state: "complete"
      });

      completed.push(item.name);
    }
  }

  return completed;
}

async function addLabelToCard(cardId, labelId) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  if (!cardId || !labelId) {
    return null;
  }

  return trelloRequest("POST", "/1/cards/" + encodeURIComponent(cardId) + "/idLabels", {
    value: labelId
  });
}

async function addUrlAttachmentToCard(cardId, input) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  if (!cardId || !input?.url) {
    return null;
  }

  return trelloRequest("POST", "/1/cards/" + encodeURIComponent(cardId) + "/attachments", {
    url: input.url,
    name: limitText(input.name || "Discord attachment", 256),
    setCover: input.setCover ? "true" : "false"
  });
}

async function removeLabelFromCard(cardId, labelId) {
  const config = getCommissionConfig();
  assertTrelloConfigured(config);

  if (!cardId || !labelId) {
    return null;
  }

  return trelloRequest("DELETE", "/1/cards/" + encodeURIComponent(cardId) + "/idLabels/" + encodeURIComponent(labelId));
}

async function reconcileCardLabels(cardId, desiredLabelIds, managedLabelIds) {
  const card = await getCard(cardId);
  const currentLabelIds = new Set(card?.idLabels || []);
  const desired = new Set((desiredLabelIds || []).filter(Boolean));
  const managed = new Set((managedLabelIds || []).filter(Boolean));
  const added = [];
  const removed = [];

  for (const labelId of desired) {
    if (!currentLabelIds.has(labelId)) {
      await addLabelToCard(cardId, labelId);
      added.push(labelId);
    }
  }

  for (const labelId of managed) {
    if (currentLabelIds.has(labelId) && !desired.has(labelId)) {
      await removeLabelFromCard(cardId, labelId);
      removed.push(labelId);
    }
  }

  return {
    added,
    removed
  };
}

async function trelloRequest(method, pathname, params = {}) {
  const config = getCommissionConfig();
  const search = new URLSearchParams({
    key: config.trello.apiKey,
    token: config.trello.apiToken,
    ...params
  });
  const url = "https://api.trello.com" + pathname + "?" + search.toString();

  if (typeof fetch !== "function") {
    throw new Error("This Node.js runtime does not provide fetch().");
  }

  const response = await fetch(url, { method });
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const message = body?.message || body?.raw || response.statusText;
    throw new Error("Trello API failed (" + response.status + "): " + message);
  }

  return body;
}

function createCardDescription(commission) {
  const lines = [
    "Commission type: " + commission.commissionType,
    "Completion level: " + commission.completionLevel,
    "Content rating: " + commission.contentRating
  ];

  return lines.join("\n");
}

function assertTrelloConfigured(config) {
  if (!config.trello.apiKey || !config.trello.apiToken) {
    throw new Error("TRELLO_API_KEY and TRELLO_API_TOKEN are required.");
  }
}

function limitText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeComparable(value) {
  return String(value || "").trim().toLowerCase();
}

module.exports = {
  addLabelToCard,
  addUrlAttachmentToCard,
  archiveCard,
  completeChecklistItemsByName,
  createCommissionCard,
  getCard,
  getCardChecklists,
  moveCardToList,
  reconcileCardLabels,
  removeLabelFromCard
};
