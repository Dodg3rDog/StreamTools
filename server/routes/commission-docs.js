const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { requireBearerToken } = require("../middleware/auth");
const { getCommissionConfig } = require("../services/commissionPortal/config");
const { buildPricingSections } = require("../services/commissionPortal/pricing");

const router = express.Router();

router.get("/tos", requireBearerToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      document: await readTosDocument()
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/pricing", requireBearerToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      document: await readPricingDocument()
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.get("/forms", requireBearerToken, async (req, res) => {
  try {
    res.json({
      ok: true,
      catalog: await readFormsCatalog()
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message
    });
  }
});

router.put("/tos", requireBearerToken, async (req, res) => {
  try {
    const document = normalizeTosDocument(req.body?.document || req.body || {});
    const filePath = getTosCatalogPath();

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(document, null, 2) + "\n", "utf8");

    res.json({
      ok: true,
      document
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      ok: false,
      error: error.message
    });
  }
});

router.put("/pricing", requireBearerToken, async (req, res) => {
  try {
    const document = normalizePricingDocument(req.body?.document || req.body || {});
    const filePath = getPricingCatalogPath();

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(document, null, 2) + "\n", "utf8");

    res.json({
      ok: true,
      document
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      ok: false,
      error: error.message
    });
  }
});

router.put("/forms", requireBearerToken, async (req, res) => {
  try {
    const catalog = normalizeFormsCatalog(req.body?.catalog || req.body || {});
    const filePath = getFormsCatalogPath();

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

    res.json({
      ok: true,
      catalog
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      ok: false,
      error: error.message
    });
  }
});

async function readTosDocument() {
  const filePath = getTosCatalogPath();
  const raw = await fs.readFile(filePath, "utf8");
  return normalizeTosDocument(JSON.parse(raw));
}

async function readPricingDocument() {
  const filePath = getPricingCatalogPath();
  const raw = await fs.readFile(filePath, "utf8");
  return normalizePricingDocument(JSON.parse(raw));
}

async function readFormsCatalog() {
  const filePath = getFormsCatalogPath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return normalizeFormsCatalog(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizeFormsCatalog(createDefaultFormsCatalog());
    }

    throw error;
  }
}

function getTosCatalogPath() {
  const config = getCommissionConfig();
  return config.tosCatalogPath;
}

function getFormsCatalogPath() {
  const config = getCommissionConfig();
  return config.formsCatalogPath;
}

function getPricingCatalogPath() {
  const config = getCommissionConfig();
  return config.pricingCatalogPath;
}

function normalizeTosDocument(input) {
  const title = String(input.title || "Commission Terms of Service").trim();
  const description = String(input.description || "Review commission terms privately.").trim();
  const updatedAt = String(input.updatedAt || new Date().toISOString().slice(0, 10)).trim();
  const sections = (Array.isArray(input.sections) ? input.sections : []).filter((section) => !isMatureContentPolicySection(section));

  if (!title) {
    throw createHttpError(400, "Document title is required.");
  }

  const normalizedSections = sections.map(normalizeTosSection);
  const ids = new Set();

  for (const section of normalizedSections) {
    if (ids.has(section.id)) {
      throw createHttpError(400, "Duplicate section ID: " + section.id);
    }

    ids.add(section.id);
  }

  for (const section of normalizedSections) {
    section.references = section.references.filter((sectionId) => ids.has(sectionId) && sectionId !== section.id);
  }

  return {
    version: Number.parseInt(input.version, 10) || 1,
    updatedAt,
    title,
    description,
    sections: normalizedSections,
    matureContentPolicy: normalizeMatureContentPolicy(input.matureContentPolicy, input.sections)
  };
}

function normalizeTosSection(input, index) {
  const title = String(input.title || "Section " + (index + 1)).trim();
  const id = normalizeSectionId(input.id || title);
  const body = Array.isArray(input.body)
    ? input.body.map((paragraph) => String(paragraph || "").trim()).filter(Boolean)
    : splitParagraphs(input.body);
  const references = Array.isArray(input.references)
    ? input.references.map(normalizeSectionId).filter(Boolean)
    : splitReferences(input.references);

  if (!id) {
    throw createHttpError(400, "Every section needs an ID.");
  }

  if (!title) {
    throw createHttpError(400, "Every section needs a title.");
  }

  return {
    id,
    title,
    body,
    references: Array.from(new Set(references))
  };
}

function normalizePricingDocument(input) {
  const sourceSections = Array.isArray(input.sections) && input.sections.length > 0
    ? input.sections
    : buildPricingSections(input).map((section) => ({
      id: section.id,
      title: section.title,
      body: splitParagraphs(section.body),
      references: section.references || []
    }));
  const normalized = {
    ...input,
    version: Number.parseInt(input.version, 10) || 1,
    currency: String(input.currency || "USD").trim() || "USD",
    updatedAt: String(input.updatedAt || new Date().toISOString().slice(0, 10)).trim(),
    title: String(input.title || "Commission Pricing").trim(),
    description: String(input.description || "Review current commission pricing, add-ons, process, payment policy, and usage notes privately.").trim(),
    sections: normalizeDocumentSections(sourceSections, "Pricing Section")
  };

  if (!normalized.title) {
    throw createHttpError(400, "Pricing title is required.");
  }

  return normalized;
}

function normalizeDocumentSections(sections, fallbackTitlePrefix) {
  const normalizedSections = (Array.isArray(sections) ? sections : []).map((section, index) =>
    normalizeTosSection({
      ...section,
      title: section.title || fallbackTitlePrefix + " " + (index + 1)
    }, index)
  );
  const ids = new Set();

  for (const section of normalizedSections) {
    if (ids.has(section.id)) {
      throw createHttpError(400, "Duplicate section ID: " + section.id);
    }

    ids.add(section.id);
  }

  for (const section of normalizedSections) {
    section.references = section.references.filter((sectionId) => ids.has(sectionId) && sectionId !== section.id);
  }

  return normalizedSections;
}

function normalizeMatureContentPolicy(input, documentSections = []) {
  const sourceSections = input && typeof input === "object" && Array.isArray(input.sections)
    ? input.sections
    : (Array.isArray(documentSections) ? documentSections.filter(isMatureContentPolicySection) : []);

  if ((!input || typeof input !== "object") && sourceSections.length === 0) {
    return {
      title: "Mature Content Policy",
      description: "",
      sections: []
    };
  }

  return {
    title: String(input?.title || sourceSections[0]?.title || "Mature Content Policy").trim(),
    description: String(input?.description || "").trim(),
    sections: normalizeDocumentSections(sourceSections, "Mature Content Policy")
  };
}

function normalizeFormsCatalog(input) {
  const forms = Array.isArray(input.forms) ? input.forms.map(normalizeFormTemplate) : [];
  const ids = new Set();

  for (const form of forms) {
    if (ids.has(form.id)) {
      throw createHttpError(400, "Duplicate form ID: " + form.id);
    }

    ids.add(form.id);
  }

  return {
    version: Number.parseInt(input.version, 10) || 1,
    updatedAt: String(input.updatedAt || new Date().toISOString().slice(0, 10)).trim(),
    tokens: normalizeFormTokens(input.tokens),
    forms
  };
}

function normalizeFormTemplate(input, index) {
  const title = String(input.title || "Commission Form " + (index + 1)).trim();
  const id = normalizeSectionId(input.id || title);
  const body = Array.isArray(input.body)
    ? input.body.map((paragraph) => String(paragraph || "").trim()).filter(Boolean)
    : splitParagraphs(input.body);

  if (!id) {
    throw createHttpError(400, "Every form needs an ID.");
  }

  if (!title) {
    throw createHttpError(400, "Every form needs a title.");
  }

  return {
    id,
    title,
    description: String(input.description || "").trim(),
    signatureMode: normalizeChoice(input.signatureMode, ["none", "typed_agree", "print_signature"], "typed_agree"),
    pdfMode: normalizeChoice(input.pdfMode, ["blank", "prefilled", "completed"], "completed"),
    workflow: normalizeStringArray(input.workflow),
    body,
    fields: normalizeFormFields(input.fields),
    staffNotes: String(input.staffNotes || "").trim()
  };
}

function normalizeFormFields(fields) {
  return (Array.isArray(fields) ? fields : []).map((field, index) => {
    const label = String(field.label || "Field " + (index + 1)).trim();
    const id = normalizeSectionId(field.id || label);

    if (!id) {
      throw createHttpError(400, "Every form field needs an ID.");
    }

    return {
      id,
      label,
      placeholder: String(field.placeholder || "").trim(),
      required: field.required !== false,
      token: String(field.token || "").trim()
    };
  });
}

function normalizeFormTokens(tokens) {
  const defaults = createDefaultFormTokens();
  const custom = Array.isArray(tokens) ? tokens : [];
  const byToken = new Map();

  defaults.concat(custom).forEach((token) => {
    const value = String(token.token || "").trim();
    if (!value) {
      return;
    }

    byToken.set(value, {
      token: value,
      label: String(token.label || value).trim(),
      description: String(token.description || "").trim()
    });
  });

  return Array.from(byToken.values());
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeChoice(value, allowed, fallback) {
  const normalized = String(value || "").trim();
  return allowed.includes(normalized) ? normalized : fallback;
}

function createDefaultFormsCatalog() {
  return {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    tokens: createDefaultFormTokens(),
    forms: [
      {
        id: "client-character-permission-affirmation",
        title: "Client Character Permission Affirmation",
        description: "Client affirmation for third-party characters included in a commission request.",
        signatureMode: "typed_agree",
        pdfMode: "completed",
        workflow: ["commission_intake", "tos_navigator"],
        body: [
          "I affirm that I have permission from the owner of any character, design, or concept included in this commission that I do not personally own.",
          "For any third-party character included in this request, I confirm that:\n\n- The character owner has given me permission to include their character in this commission.\n- The character owner understands the general nature of the requested artwork.\n- I have not misrepresented the character, the owner's consent, or the intended use of the finished artwork.\n- I understand that Anthro-Corp Studios / Dodger may request additional confirmation from the character owner if needed.",
          "Character owner name or screen name: {{form.ownerName}}\n\nCharacter name: {{form.characterName}}\n\nRequested content type: {{form.contentType}}\n\nClient name or screen name: {{client.name}}\n\nDiscord user: {{discord.username}} / {{discord.userId}}\n\nDate: {{current.date}}"
        ],
        fields: [
          { id: "owner-name", label: "Character owner name or screen name", placeholder: "Owner Name / Handle", required: true, token: "{{form.ownerName}}" },
          { id: "character-name", label: "Character name", placeholder: "Character Name", required: true, token: "{{form.characterName}}" },
          { id: "content-type", label: "Requested content type", placeholder: "SFW / suggestive / mature / explicit / commercial / other", required: true, token: "{{form.contentType}}" }
        ]
      },
      {
        id: "third-party-character-permission-confirmation",
        title: "Third-Party Character Permission Confirmation",
        description: "Owner-facing confirmation form staff may request during approval.",
        signatureMode: "print_signature",
        pdfMode: "prefilled",
        workflow: ["staff_approval"],
        body: [
          "I, {{form.ownerName}}, confirm that I own or control the character/design known as {{form.characterName}}.",
          "I give permission for {{client.name}} to commission artwork of this character from Anthro-Corp Studios / Dodger.",
          "I understand that the commissioned artwork may include the following general content type: {{commission.contentType}}.",
          "I understand that this permission applies only to this specific commission unless otherwise agreed in writing.",
          "Character owner contact or handle: {{form.ownerContact}}\n\nDate: {{current.date}}\n\nCharacter owner signature: ________________________________"
        ],
        fields: [
          { id: "owner-name", label: "Character owner name or screen name", placeholder: "Owner Name / Handle", required: true, token: "{{form.ownerName}}" },
          { id: "character-name", label: "Character name", placeholder: "Character Name", required: true, token: "{{form.characterName}}" },
          { id: "owner-contact", label: "Character owner contact or handle", placeholder: "Handle / email / Discord / other", required: false, token: "{{form.ownerContact}}" }
        ]
      }
    ]
  };
}

function createDefaultFormTokens() {
  return [
    { token: "{{discord.username}}", label: "Discord Username", description: "The Discord username or display name from the interaction." },
    { token: "{{discord.userId}}", label: "Discord User ID", description: "The Discord account ID from the interaction." },
    { token: "{{client.name}}", label: "Client Name", description: "Preferred client name or handle when known." },
    { token: "{{current.date}}", label: "Current Date", description: "The date when the form is generated or signed." },
    { token: "{{commission.contentType}}", label: "Commission Content Type", description: "Commission type/rating summary when known." },
    { token: "{{form.ownerName}}", label: "Owner Name Field", description: "Value entered for the character owner." },
    { token: "{{form.characterName}}", label: "Character Name Field", description: "Value entered for the character name." },
    { token: "{{form.contentType}}", label: "Content Type Field", description: "Value entered for requested content type." }
  ];
}

function isMatureContentPolicySection(section) {
  const id = String(section?.id || "").trim().toLowerCase();
  const title = String(section?.title || "").trim().toLowerCase();
  return id === "mature-content-policy" || title === "mature content policy";
}

function splitParagraphs(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitReferences(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map(normalizeSectionId)
    .filter(Boolean);
}

function normalizeSectionId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = router;
