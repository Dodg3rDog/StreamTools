const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const DEFAULT_SEQUENCE_LENGTH = Number(process.env.EMOTE_SYNC_SEQUENCE_LENGTH || 5);
const DEFAULT_MAX_STRIKES = Number(process.env.EMOTE_SYNC_MAX_STRIKES || 3);
const DEFAULT_ROUND_MS = Number(process.env.EMOTE_SYNC_ROUND_MS || 45000);
const DEFAULT_NEXT_ROUND_DELAY_MS = Number(process.env.EMOTE_SYNC_NEXT_ROUND_DELAY_MS || 4500);
const EVENT_MAX = Number(process.env.EMOTE_SYNC_EVENT_MAX || 9);

const DATA_DIR = path.join(__dirname, "../data/chat-games");
const RECORD_FILE = path.join(DATA_DIR, "emote-sync-protocol.json");

const DEFAULT_EMOTES = [
  { name: "Kappa", image: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0" },
  { name: "4Head", image: "https://static-cdn.jtvnw.net/emoticons/v2/354/default/dark/3.0" },
  { name: "LUL", image: "https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/3.0" },
  { name: "SeemsGood", image: "https://static-cdn.jtvnw.net/emoticons/v2/64138/default/dark/3.0" },
  { name: "HeyGuys", image: "https://static-cdn.jtvnw.net/emoticons/v2/30259/default/dark/3.0" },
  { name: "VoHiYo", image: "https://static-cdn.jtvnw.net/emoticons/v2/81274/default/dark/3.0" },
  { name: "BibleThump", image: "https://static-cdn.jtvnw.net/emoticons/v2/86/default/dark/3.0" },
  { name: "WutFace", image: "https://static-cdn.jtvnw.net/emoticons/v2/28087/default/dark/3.0" }
];

let runtimeConfig = {
  sequenceLength: DEFAULT_SEQUENCE_LENGTH,
  maxStrikes: DEFAULT_MAX_STRIKES,
  roundMs: DEFAULT_ROUND_MS,
  nextRoundDelayMs: DEFAULT_NEXT_ROUND_DELAY_MS,
  emotes: DEFAULT_EMOTES
};

let records = loadRecords();
let gameState = null;

function defaultRecords() {
  return {
    highScore: 0,
    contributors: {}
  };
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadRecords() {
  try {
    return { ...defaultRecords(), ...JSON.parse(fs.readFileSync(RECORD_FILE, "utf8")) };
  } catch {
    return defaultRecords();
  }
}

function saveRecords() {
  ensureDataDir();
  fs.writeFileSync(RECORD_FILE, JSON.stringify(records, null, 2));
}

function cleanName(value) {
  return String(value || "").trim();
}

function normalizeEmote(value) {
  return cleanName(value).toLowerCase();
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function sanitizeEmotes(emotes) {
  const seen = new Set();
  const clean = [];

  for (const emote of Array.isArray(emotes) ? emotes : []) {
    const name = cleanName(emote?.name);
    if (!name) continue;

    const key = normalizeEmote(name);
    if (seen.has(key)) continue;
    seen.add(key);

    clean.push({
      name,
      image: cleanName(emote?.image)
    });
  }

  return clean.length >= 2 ? clean : DEFAULT_EMOTES;
}

function configSignature(config) {
  return JSON.stringify({
    sequenceLength: config.sequenceLength,
    maxStrikes: config.maxStrikes,
    roundMs: config.roundMs,
    nextRoundDelayMs: config.nextRoundDelayMs,
    emotes: config.emotes.map((emote) => ({
      name: emote.name,
      image: emote.image
    }))
  });
}

function createSequence() {
  const sequence = [];
  const pool = runtimeConfig.emotes;
  const length = Math.max(2, Number(runtimeConfig.sequenceLength) || DEFAULT_SEQUENCE_LENGTH);

  for (let i = 0; i < length; i++) {
    sequence.push(pick(pool));
  }

  return sequence;
}

function createGame(options = {}) {
  const now = Date.now();
  const score = Number(options.score || 0);
  const strikes = Number(options.strikes || 0);
  const strikeSubmissions = Array.isArray(options.strikeSubmissions) ? options.strikeSubmissions : [];
  const reason = options.reason || "Signal pattern generated";
  const sequence = createSequence();

  return {
    sequence,
    syncedBy: Array(sequence.length).fill(null),
    cursor: 0,
    strikes,
    strikeSubmissions: strikeSubmissions.slice(-runtimeConfig.maxStrikes),
    maxStrikes: runtimeConfig.maxStrikes,
    status: "active",
    round: Number(options.round ?? gameState?.round ?? 0) + 1,
    score,
    highScore: records.highScore || 0,
    roundMs: runtimeConfig.roundMs,
    endsAt: now + runtimeConfig.roundMs,
    nextRoundAt: null,
    lastOutcome: null,
    lastSubmission: null,
    startedAt: now,
    updatedAt: now,
    events: [`${reason}: ${new Date(now).toLocaleTimeString()}`]
  };
}

gameState = createGame({ score: 0, reason: "Signal pattern generated" });

function remainingMs() {
  if (gameState.status !== "active") return 0;
  return Math.max(0, gameState.endsAt - Date.now());
}

function contributorRecord(user) {
  const name = cleanName(user).slice(0, 40) || "employee";
  const key = name.toLowerCase();

  records.contributors[key] = records.contributors[key] || {
    user: name,
    correct: 0,
    incorrect: 0,
    avatar: "",
    lastSeen: null
  };

  records.contributors[key].user = name;
  records.contributors[key].lastSeen = Date.now();
  return records.contributors[key];
}

function recordContribution(user, hit, avatar = "") {
  const record = contributorRecord(user);
  if (hit) record.correct += 1;
  else record.incorrect += 1;
  if (avatar) record.avatar = avatar;
  saveRecords();
}

function topContributors(field, limit = 5) {
  return Object.values(records.contributors || {})
    .sort((a, b) => (b[field] || 0) - (a[field] || 0) || String(a.user).localeCompare(String(b.user)))
    .slice(0, limit)
    .map((entry) => ({
      user: entry.user,
      avatar: entry.avatar || "",
      correct: entry.correct || 0,
      incorrect: entry.incorrect || 0
    }));
}

function pushEvent(message) {
  gameState.events.unshift(message);
  gameState.events = gameState.events.slice(0, EVENT_MAX);
}

function setUpdated() {
  gameState.updatedAt = Date.now();
}

function finishRound(status, message) {
  gameState.status = status;
  gameState.lastOutcome = status;
  gameState.nextRoundAt = Date.now() + runtimeConfig.nextRoundDelayMs;

  if (status === "won") {
    gameState.score += 1;
    if (gameState.score > records.highScore) {
      records.highScore = gameState.score;
      saveRecords();
      pushEvent(`New high score logged: ${records.highScore}.`);
    }
  } else {
    gameState.score = 0;
  }

  pushEvent(message);
  setUpdated();
}

function advanceIfNeeded() {
  const now = Date.now();

  if (gameState.status === "active" && now >= gameState.endsAt) {
    finishRound("lost", "Signal timed out. Sync streak reset.");
  }

  if (gameState.status !== "active" && gameState.nextRoundAt && now >= gameState.nextRoundAt) {
    const carryScore = gameState.status === "won" ? gameState.score : 0;
    const carryStrikes = gameState.status === "won" ? gameState.strikes : 0;
    const carryStrikeSubmissions = gameState.status === "won" ? gameState.strikeSubmissions : [];
    const reason = gameState.status === "won" ? "Next signal pattern generated" : "Retraining pattern generated";
    gameState = createGame({
      score: carryScore,
      strikes: carryStrikes,
      strikeSubmissions: carryStrikeSubmissions,
      reason
    });
  }
}

function publicState() {
  advanceIfNeeded();

  return {
    sequence: gameState.sequence,
    syncedBy: gameState.syncedBy,
    cursor: gameState.cursor,
    strikes: gameState.strikes,
    strikeSubmissions: gameState.strikeSubmissions,
    maxStrikes: gameState.maxStrikes,
    status: gameState.status,
    round: gameState.round,
    score: gameState.score,
    highScore: records.highScore || 0,
    roundMs: gameState.roundMs,
    remainingMs: remainingMs(),
    nextRoundInMs: gameState.nextRoundAt ? Math.max(0, gameState.nextRoundAt - Date.now()) : null,
    lastOutcome: gameState.lastOutcome,
    lastSubmission: gameState.lastSubmission,
    startedAt: gameState.startedAt,
    updatedAt: gameState.updatedAt,
    events: gameState.events.slice(0, EVENT_MAX),
    leaders: {
      correct: topContributors("correct"),
      incorrect: topContributors("incorrect")
    }
  };
}

function extractSubmission(req) {
  const value =
    req.body?.emote ??
    req.body?.message ??
    req.body?.input ??
    req.query?.emote ??
    req.query?.message ??
    req.query?.input ??
    "";

  const user =
    req.body?.user ??
    req.body?.displayName ??
    req.body?.username ??
    req.query?.user ??
    req.query?.displayName ??
    req.query?.username ??
    "employee";

  const avatar =
    req.body?.profileImage ??
    req.body?.profileImageUrl ??
    req.body?.avatar ??
    req.body?.avatarUrl ??
    req.body?.userProfileImage ??
    req.query?.profileImage ??
    req.query?.profileImageUrl ??
    req.query?.avatar ??
    req.query?.avatarUrl ??
    req.query?.userProfileImage ??
    "";

  const emote = cleanName(value)
    .split(/\s+/)
    .filter(Boolean)
    .find((token) => !/^!(sync|emote|signal|pattern)$/i.test(token)) || "";

  return {
    emote,
    user: cleanName(user).slice(0, 40) || "employee",
    avatar: cleanName(avatar)
  };
}

function submissionPayload(user, avatar, value, hit, expected) {
  return {
    user,
    avatar,
    value,
    hit,
    expected: expected?.name || null,
    ts: Date.now()
  };
}

function handleSubmission(rawEmote, user = "employee", avatar = "") {
  advanceIfNeeded();

  if (gameState.status !== "active") {
    return { accepted: false, message: "Protocol is not active." };
  }

  const submitted = cleanName(rawEmote);
  if (!submitted) {
    return { accepted: false, message: "Missing emote." };
  }

  const expected = gameState.sequence[gameState.cursor];
  const hit = normalizeEmote(submitted) === normalizeEmote(expected?.name);
  const submission = submissionPayload(user, avatar, submitted, hit, expected);

  recordContribution(user, hit, avatar);

  gameState.lastSubmission = submission;

  if (hit) {
    gameState.syncedBy[gameState.cursor] = submission;
    gameState.cursor += 1;
    pushEvent(`${user} synchronized ${submitted}.`);

    if (gameState.cursor >= gameState.sequence.length) {
      finishRound("won", "Signal pattern synchronized. Advancing pattern.");
    }
  } else {
    gameState.strikes += 1;
    gameState.strikeSubmissions.push(submission);
    gameState.strikeSubmissions = gameState.strikeSubmissions.slice(-gameState.maxStrikes);
    pushEvent(`${user} desynced with ${submitted}. Expected ${expected?.name}.`);

    if (gameState.strikes >= gameState.maxStrikes) {
      finishRound("lost", "Signal pattern failed. Sync streak reset.");
    }
  }

  setUpdated();
  return { accepted: true, hit, expected: expected?.name || null };
}

function submit(req, res) {
  const submission = extractSubmission(req);
  const result = handleSubmission(submission.emote, submission.user, submission.avatar);

  if (!result.accepted) {
    return res.status(400).json({ ok: false, error: result.message, state: publicState() });
  }

  res.json({ ok: true, result, state: publicState() });
}

router.get("/state", (req, res) => {
  res.json({ ok: true, state: publicState(), config: runtimeConfig });
});

router.get("/leaders", (req, res) => {
  res.json({
    ok: true,
    highScore: records.highScore || 0,
    leaders: {
      correct: topContributors("correct", 10),
      incorrect: topContributors("incorrect", 10)
    }
  });
});

router.post("/configure", (req, res) => {
  const nextConfig = {
    sequenceLength: Math.max(2, Number(req.body?.sequenceLength) || DEFAULT_SEQUENCE_LENGTH),
    maxStrikes: Math.max(1, Number(req.body?.maxStrikes) || DEFAULT_MAX_STRIKES),
    roundMs: Math.max(5000, Number(req.body?.roundMs) || DEFAULT_ROUND_MS),
    nextRoundDelayMs: Math.max(1000, Number(req.body?.nextRoundDelayMs) || DEFAULT_NEXT_ROUND_DELAY_MS),
    emotes: sanitizeEmotes(req.body?.emotes)
  };

  const changed = configSignature(nextConfig) !== configSignature(runtimeConfig);
  runtimeConfig = nextConfig;

  if (changed) {
    gameState = createGame({ score: 0, round: 0, reason: "Signal pattern configured" });
  }

  res.json({ ok: true, state: publicState(), config: runtimeConfig });
});

router.post("/new", (req, res) => {
  const carryStrikes = gameState.status === "lost" ? 0 : gameState.strikes;
  const carryStrikeSubmissions = gameState.status === "lost" ? [] : gameState.strikeSubmissions;
  gameState = createGame({
    score: gameState.score,
    strikes: carryStrikes,
    strikeSubmissions: carryStrikeSubmissions,
    reason: "Manual signal pattern generated"
  });
  res.json({ ok: true, state: publicState() });
});

router.post("/reset", (req, res) => {
  gameState = createGame({ score: 0, round: 0, reason: "Signal protocol reset" });
  res.json({ ok: true, state: publicState() });
});

router.post("/submit", (req, res) => {
  submit(req, res);
});

router.get("/submit", (req, res) => {
  submit(req, res);
});

module.exports = router;
