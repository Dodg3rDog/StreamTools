const express = require("express");

const router = express.Router();

const MAX_MISSES = Number(process.env.CODE_BREAK_MAX_MISSES || 6);
const EVENT_MAX = Number(process.env.CODE_BREAK_EVENT_MAX || 9);

const PHRASES = [
  "ANTHRO CORP WELCOMES EVERY PHENOTYPE",
  "AUTHORIZED TAIL MODIFICATION ONLY",
  "CANINE DIVISION REPORTS TO SECURITY",
  "FELINE RESEARCH REQUIRES CLEARANCE",
  "NIGHT HOWLERS DETECTED AFTER HOURS",
  "RIFT SIGNAL STABILIZED",
  "EMPLOYEE SPECIES CODE PENDING",
  "PHENOTYPE DRIFT UNDER REVIEW",
  "PAWPRINT ACCESS LOGGED",
  "MUZZLE FIT TEST REQUIRED",
  "FUR STATIC NEAR RIFT EQUIPMENT",
  "AVIAN STAFF AVOID LOW CEILINGS",
  "REPTILIAN COMPLIANCE AUDIT",
  "AQUATIC LAB HUMIDITY WARNING",
  "BOVINE STRENGTH TEST APPROVED",
  "EQUINE MOBILITY ROUTE UPDATED",
  "HR DENIES UNSCHEDULED TRANSFORMATION",
  "EMPLOYEE BADGE RECOGNIZES EARS",
  "ANOMALOUS HOWL IN BREAK ROOM",
  "TAIL HAZARD FORM INCOMPLETE"
];

let gameState = createGame();

function createGame(phraseValue = null) {
  const phrase = normalizePhrase(phraseValue || pick(PHRASES));
  return {
    phrase,
    guessedLetters: [],
    guesses: [],
    misses: 0,
    maxMisses: MAX_MISSES,
    status: "active",
    startedAt: Date.now(),
    updatedAt: Date.now(),
    events: [`Protocol loaded: ${new Date().toLocaleTimeString()}`]
  };
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function normalizePhrase(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function maskPhrase(state) {
  const letters = new Set(state.guessedLetters);
  return state.phrase
    .split("")
    .map((char) => {
      if (char === " ") return " / ";
      if (/[0-9]/.test(char)) return char;
      return letters.has(char) ? char : "_";
    })
    .join(" ");
}

function publicState() {
  return {
    maskedPhrase: maskPhrase(gameState),
    guesses: gameState.guesses,
    misses: gameState.misses,
    maxMisses: gameState.maxMisses,
    status: gameState.status,
    startedAt: gameState.startedAt,
    updatedAt: gameState.updatedAt,
    events: gameState.events.slice(0, EVENT_MAX),
    answer: gameState.status === "active" ? null : gameState.phrase
  };
}

function pushEvent(message) {
  gameState.events.unshift(message);
  gameState.events = gameState.events.slice(0, EVENT_MAX);
}

function setUpdated() {
  gameState.updatedAt = Date.now();
}

function isSolved(state) {
  return !maskPhrase(state).includes("_");
}

function handleGuess(rawGuess, user = "employee") {
  if (gameState.status !== "active") {
    return { accepted: false, message: "Protocol is not active." };
  }

  const normalized = normalizePhrase(rawGuess);
  if (!normalized) {
    return { accepted: false, message: "Missing guess." };
  }

  const employee = String(user || "employee").trim().slice(0, 40);
  const isPhraseGuess = normalized.length > 1;
  let hit = false;

  if (isPhraseGuess) {
    hit = normalized === gameState.phrase;
    gameState.guesses.push({ value: normalized, hit, user: employee, ts: Date.now() });

    if (hit) {
      gameState.guessedLetters = Array.from(new Set(gameState.phrase.replace(/[^A-Z]/g, "").split("")));
      gameState.status = "won";
      pushEvent(`${employee} decoded the full protocol.`);
    } else {
      gameState.misses += 1;
      pushEvent(`${employee} submitted a failed protocol phrase.`);
    }
  } else {
    const letter = normalized[0];
    if (gameState.guessedLetters.includes(letter)) {
      pushEvent(`${employee} repeated ${letter}.`);
      setUpdated();
      return { accepted: true, repeated: true };
    }

    gameState.guessedLetters.push(letter);
    hit = gameState.phrase.includes(letter);
    gameState.guesses.push({ value: letter, hit, user: employee, ts: Date.now() });

    if (hit) {
      pushEvent(`${employee} recovered glyph ${letter}.`);
    } else {
      gameState.misses += 1;
      pushEvent(`${employee} triggered a false glyph: ${letter}.`);
    }
  }

  if (gameState.status === "active" && isSolved(gameState)) {
    gameState.status = "won";
    pushEvent("Protocol decoded. Compliance restored.");
  }

  if (gameState.status === "active" && gameState.misses >= gameState.maxMisses) {
    gameState.status = "lost";
    pushEvent("Protocol breach. Answer exposed.");
  }

  setUpdated();
  return { accepted: true, hit };
}

function extractSubmission(req) {
  const value =
    req.body?.guess ??
    req.body?.message ??
    req.body?.input ??
    req.query?.guess ??
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

  const guess = String(value)
    .trim()
    .replace(/^!(code|guess|cbp|break)\s+/i, "");

  return { guess, user };
}

function submitGuess(req, res) {
  const submission = extractSubmission(req);
  const result = handleGuess(submission.guess, submission.user);

  if (!result.accepted) {
    return res.status(400).json({ ok: false, error: result.message, state: publicState() });
  }

  res.json({ ok: true, result, state: publicState() });
}

router.get("/state", (req, res) => {
  res.json({ ok: true, state: publicState() });
});

router.post("/new", (req, res) => {
  gameState = createGame(req.body?.phrase);
  res.json({ ok: true, state: publicState() });
});

router.post("/reset", (req, res) => {
  gameState = createGame();
  res.json({ ok: true, state: publicState() });
});

router.post("/guess", (req, res) => {
  submitGuess(req, res);
});

router.post("/submit", (req, res) => {
  submitGuess(req, res);
});

router.get("/submit", (req, res) => {
  submitGuess(req, res);
});

module.exports = router;
