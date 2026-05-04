/*****************************************************
 *  StreamTools Slot Machine Overlay
 *  Author: Dad/Drakar 🐲 | For: Lucky Pup 🦊
 *  Version: 1.0 | Date: 2025-07-12 (patched 2025-09-13)
 *
 *  This script powers a fully modular,
 *  streamer-integrated slot machine overlay with
 *  per-reel history checking, jackpot odds, and
 *  easy hooks for Forge (Socket.IO), Streamer.bot, OBS, visuals, and audio.
 *****************************************************/

/* =================== FORGE BRIDGE ===================
   Forge (Dad's server) is the realtime hub now.
   We removed the direct Streamer.bot WebSocket triggers here to prevent
   double-fires. If you need SB direct again, re-enable in a separate module.
====================================================== */

const API_BASE = "/api/drawing-slot-machine";
const SLOT_NATIVE_WIDTH = 1920;
const SLOT_NATIVE_HEIGHT = 1080;

function updateSlotScale() {
  const scale = Math.min(
    window.innerWidth / SLOT_NATIVE_WIDTH,
    window.innerHeight / SLOT_NATIVE_HEIGHT
  );
  document.documentElement.style.setProperty("--slot-scale", String(scale || 1));
}

window.addEventListener("resize", updateSlotScale);
updateSlotScale();

// ---- StreamTools spin-status helper ----
function setForgeSpinStatus(spinning, by = 'slot') {
  try {
    fetch(`${API_BASE}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spinning, by, ts: Date.now() })
    }).catch(() => {});
  } catch (_) {}
}

/* 
    ============= SECTION 1: CONSTANTS & GLOBALS ============= 
    (All main settings, jackpots, and DOM references)
*/

// ---- General Reel/Category Setup ---- //
const REEL_COUNT = 3;
const REEL_IDS = ["slotReel1", "slotReel2", "slotReel3"]; // (HTML IDs of reel containers)
const REEL_CATEGORIES = ["Species", "Themes", "Poses"];   // Used for pathing and history
const CYLINDER_FACE_COUNT = 12;
const CYLINDER_FACE_ANGLE = 360 / CYLINDER_FACE_COUNT;
const CYLINDER_RADIUS = [430, 520, 430];
const CYLINDER_FACE_SCALE = [0.76, 0.78, 0.76];
const GRAPHICS_PATHS = [
    "/assets/drawing-slot-machine/images/slot_machine/species/",
    "/assets/drawing-slot-machine/images/slot_machine/themes/",
    "/assets/drawing-slot-machine/images/slot_machine/poses/"
];
const JSON_PATHS = [
    "/assets/drawing-slot-machine/images/slot_machine/species/species.json",
    "/assets/drawing-slot-machine/images/slot_machine/themes/themes.json",
    "/assets/drawing-slot-machine/images/slot_machine/poses/poses.json"
];
const HISTORY_KEYS = ["species", "theme", "pose"];

// ---- Jackpot Setup ---- //
const JACKPOT_IMAGES = [
    //"jackpot1.png",
    "jackpot2.png",
    "jackpot3.png"
];
const JACKPOT_PATH = "/assets/drawing-slot-machine/images/slot_machine/jackpot/";

// ---- Modifier Setup ---- //
let modifierType = null;        // Stores the type (e.g., "sussy", "artsy")
let modifierPending = false;    // Has a modifier been received & waiting for win?
let modifierRevealInProgress = false; // Prevents double-reveals
let localModifierTestMode = false; // Keeps URL test modifiers from being cleared by polling
// Map modifier types to images and audio (expand as needed)
const MODIFIER_CONFIG = {
    "sussy": {
        image: "/assets/drawing-slot-machine/images/slot_machine/signs/sussy.png",
        audio: document.getElementById("modifierSussyAudio")
    },
    "artsy": {
        image: "",
        audio: document.getElementById("modifierArtsyAudio")
    },
    "respin": {
        image: "",
        audio: null
    },
    "style": {
        image: "",
        audio: null
    }
};

const MODIFIER_ALIASES = {
    sus: "sussy",
    sussy: "sussy",
    artsy: "artsy",
    art: "artsy",
    respin: "respin",
    reroll: "respin",
    style: "style"
};

function getUrlFlag(params, key, defaultValue = false) {
    const value = params.get(key);
    if (value == null) return defaultValue;
    return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function normalizeModifierType(value) {
    if (!value) return null;
    const cleanValue = String(value)
        .toLowerCase()
        .trim()
        .replace(/^(modify|modifier|mod)[-_:\s]*/, "");
    const alias = MODIFIER_ALIASES[cleanValue] || cleanValue;
    return MODIFIER_CONFIG[alias] ? alias : null;
}

function getUrlModifierTest() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode") || "";
    const modeModifierMatch = mode.match(/^(?:modify|modifier|mod)[-_:\s]*(.+)$/i);
    const explicitModifier = params.get("modifier") || params.get("mod");
    const type = normalizeModifierType(explicitModifier || modeModifierMatch?.[1]);

    if (!type) return null;

    return {
        type,
        autoSpin: getUrlFlag(params, "autospin", Boolean(modeModifierMatch))
    };
}

function applyUrlModifierTestMode() {
    const test = getUrlModifierTest();
    if (!test) return;

    localModifierTestMode = true;
    modifierType = test.type;
    modifierPending = true;
    console.log(`[URL Test] modifier queued: ${modifierType}`);

    if (test.autoSpin) {
        setTimeout(() => {
            if (!isSpinning) safeSpinRequest();
        }, 600);
    }
}

// ---- Jackpot Odds Settings ---- //
let jackpotChance = 8;   // Default % chance, adjustable via setJackpotChance()
let forcedJackpotMin = 0; // Tracks forced jackpots per spin (see guarantee logic)
let forcedJackpotTarget = 0; // How many jackpots *must* appear on this spin
let forceJackpotOnStop = [false, false, false];

// ---- Reel State ---- //
let allTileImages = [[], [], []];   // Stores loaded image filename arrays by reel/category
let spinningReels = [false, false, false]; // Tracks which reels are spinning (booleans)
let currentResults = [null, null, null];   // Tracks current center tile for each reel
let jackpotLanded = [false, false, false]; // Tracks if a reel has hit jackpot this spin
let reelSpinTokens = [0, 0, 0];             // Cancels stale reel loops when a respin restarts the same reel
let reelRotationSteps = [0, 0, 0];          // Current cylinder index/rotation per reel
// Modifier reel state
let currentModifierReelType = null;
let modifierReelImages = [];
let modifierReelResult = null;
let modifierReelSpinning = false;
let modifierReelSpinToken = 0;

// ---- History & Control ---- //
let last10History = [];    // Last 10 results (from Forge)
let isSpinning = false;    // Global spin lock
let pendingRespins = [];   // Queue of reels needing re-spin
let spinDirection = [1, 1, 1]; // 1=down (default), -1=up (reverse on respin)
let holdTimer = null;
let isPausedFromHold = false;
let isButtonActive = false;
let spinSpeeds = [1,1,1]; // default multiplier for each reel
let respinSequenceActive = false;

// ---- Timings ---- //
const SPIN_MIN_MS = 3000;
const SPIN_MAX_MS = 6000;
const RESPIN_DELAY_MS = 2200;   // Delay before re-spins, for effect
const SLIP_ANIMATION_MS = 180;  // For "catch" animation
const JERK_ANIMATION_MS = 80;   // For "jerk back" animation
const MODIFIER_SPIN_MIN_TICKS = 20;
const MODIFIER_SPIN_EXTRA_TICKS = 10;
const MODIFIER_SPIN_BASE_DELAY_MS = 45;
const MODIFIER_SPIN_DECEL_MS = 7;
const spinAudio = document.getElementById('spinAudio');
const reelStopAudio = [
  document.getElementById('reel1StopAudio'),
  document.getElementById('reel2StopAudio'),
  document.getElementById('reel3StopAudio')
];
const matchErrorAudio = document.getElementById('matchErrorAudio');
const reelReleaseAudio = document.getElementById('reelReleaseAudio');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stopAudio(el) {
  if (!el) return;
  try {
    el.pause();
    el.currentTime = 0;
  } catch (_) {}
}

function playAudioCue(el, fallbackMs = 1200) {
  return new Promise((resolve) => {
    if (!el) return resolve();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      el.removeEventListener("ended", finish);
      resolve();
    };
    const timeout = setTimeout(finish, fallbackMs);

    try {
      el.pause();
      el.currentTime = 0;
      el.addEventListener("ended", finish, { once: true });
      const playPromise = el.play();
      if (playPromise?.catch) playPromise.catch(finish);
    } catch (_) {
      finish();
    }
  });
}

// ---- DOM References ---- //
let reelElements = []; // filled after DOM is ready
const awooButton = document.getElementById('awooPushButton');
const buttonSound = document.getElementById("buttonsound");
const holdDelay = 200;
const loadingIndicator = document.getElementById('slotLoadingIndicator');


// === Modifier Queue (Dad’s stash drawer 💌) ==========================
const ModQueue = {
  _q: [],
  push(mods) {
    if (!mods?.length) return;
    const cap = 5; // cap optional
    this._q.push(...mods);
    if (this._q.length > cap) this._q.splice(0, this._q.length - cap);
    console.debug("[MOD][QUEUE] Pushed:", mods, "Now:", this._q);
  },
  has() { return this._q.length > 0; },
  consumeAll() {
    const mods = this._q.slice();
    this._q.length = 0;
    console.debug("[MOD][QUEUE] Consumed:", mods);
    return mods;
  }
};

// === Modifier Detection =================================================
function basenameLower(p) {
  if (!p) return "";
  const name = p.split(/[\\/]/).pop();
  return name.toLowerCase();
}

const MODIFIER_KEYWORDS = [
  "modifier", "mod_", "sussy", "x2", "double", "reroll", "wild", "jackpotmod"
];

function detectModifiers(norm) {
  const hits = [];
  for (const [reel, name] of Object.entries(norm)) {
    if (hasModifierSignature(name)) {
      hits.push({ reel, name, type: classifyModifier(name) });
    }
  }
  return hits;
}

function hasModifierSignature(name) {
  if (!name) return false;
  return MODIFIER_KEYWORDS.some(k => name.includes(k));
}

function classifyModifier(name) {
  if (name.includes("sussy")) return "sussy";
  if (name.includes("double") || name.includes("x2")) return "double";
  if (name.includes("wild")) return "wild";
  if (name.includes("reroll")) return "reroll";
  return "generic";
}


/* ============= SECTION 2: IMAGE & DATA UTILS ============= */
// Utility: Returns a random element from an array
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Animate out the modifier reel, then hide overlay and run callback (e.g. startSpin)
function hideModifierReelWithAnimation(callback) {
    const overlay = document.getElementById("modifierReelOverlay");
    const reelContent = overlay && overlay.querySelector(".modifier-reel-content");
    let didHide = false;
    if (overlay && reelContent && overlay.style.display !== "none") {
        // If visible, animate out
        reelContent.classList.remove("out"); // reset if needed
        void reelContent.offsetWidth; // force reflow
        reelContent.classList.add("out");
        function handleAnimationEnd() {
            overlay.style.display = "none";
            reelContent.classList.remove("out");
            reelContent.removeEventListener("animationend", handleAnimationEnd);
            if (typeof callback === "function") callback();
        }
        reelContent.addEventListener("animationend", handleAnimationEnd);
        didHide = true;
    }
    if (!didHide && typeof callback === "function") {
        callback();
    }
}
function flipOutModifierSign() {
    const modifierSign = document.getElementById("modifierSign");
    if (!modifierSign) return;
    modifierSign.classList.remove("flipped"); // Triggers flip out
    const img = document.getElementById("modifierSignImage");
    if (img) img.style.display = "none";
}

/* 
    ============= SECTION 3: JACKPOT ODDS & GUARANTEE =============
*/

async function initJackpotFromServer() {
  try {
    const r = await fetch(`${API_BASE}/jackpot`);
    const { state } = await r.json();
    if (state?.chance != null) setJackpotChance(state.chance);
  } catch (_) {}
}


function setJackpotChance(newPercent) {
    jackpotChance = Math.max(0, Math.min(100, newPercent));
    document.dispatchEvent(new CustomEvent('jackpotChanceChanged', { detail: { jackpotChance } }));
}
window.setJackpotChance = setJackpotChance;

function determineJackpotDraw(reelIndex, jackpotSoFar) {
    // Figure out forced minimum based on chance
    forcedJackpotTarget = 0;
    if (jackpotChance >= 100) forcedJackpotTarget = 3;
    else if (jackpotChance >= 80) forcedJackpotTarget = 2;
    else if (jackpotChance >= 50) forcedJackpotTarget = 1;

    // If forced minimum not yet met, guarantee jackpot on this reel
    if (jackpotSoFar < forcedJackpotTarget) {
        return true;
    }
    // Otherwise, roll for chance as normal
    return (Math.random() * 100) < jackpotChance;
}

function getRandomJackpotImage() {
    return JACKPOT_PATH + pickRandom(JACKPOT_IMAGES);
}

function setupCylinderReels() {
    reelElements.forEach((reel, reelIndex) => {
        if (!reel || reel.dataset.cylinderReady === "true") return;

        const existingWrappers = Array.from(reel.getElementsByClassName("slot-tile-wrapper"));
        const defaultSrc = existingWrappers[0]?.querySelector("img")?.src || "";
        const isCenter = reelIndex === 1;

        while (existingWrappers.length < CYLINDER_FACE_COUNT) {
            const wrapper = document.createElement("div");
            wrapper.className = `slot-tile-wrapper${isCenter ? " center-tile" : ""}`;
            const img = document.createElement("img");
            img.className = "slot-tile-image";
            img.src = defaultSrc;
            wrapper.appendChild(img);
            reel.appendChild(wrapper);
            existingWrappers.push(wrapper);
        }

        existingWrappers.forEach((wrapper, faceIndex) => {
            wrapper.style.setProperty("--face-index", faceIndex);
            wrapper.style.setProperty("--face-angle", `${CYLINDER_FACE_ANGLE}deg`);
            wrapper.style.setProperty("--reel-radius", `${CYLINDER_RADIUS[reelIndex]}px`);
            wrapper.style.setProperty("--face-scale", CYLINDER_FACE_SCALE[reelIndex]);
            wrapper.dataset.faceIndex = String(faceIndex);
        });

        reel.classList.add("is-cylinder");
        reel.style.setProperty("--reel-rotation", "0deg");
        reel.dataset.cylinderReady = "true";
    });
}

function getFrontFaceIndex(reelIndex) {
    return ((reelRotationSteps[reelIndex] % CYLINDER_FACE_COUNT) + CYLINDER_FACE_COUNT) % CYLINDER_FACE_COUNT;
}

function getReelFace(reelIndex, faceIndex) {
    const reel = reelElements[reelIndex];
    return reel?.querySelector(`.slot-tile-wrapper[data-face-index="${faceIndex}"]`);
}

function setReelRotation(reelIndex, stepDelta = 0, direction = 1) {
    const reel = reelElements[reelIndex];
    if (!reel) return;

    reelRotationSteps[reelIndex] += stepDelta * direction;
    reel.style.setProperty("--reel-rotation", `${-reelRotationSteps[reelIndex] * CYLINDER_FACE_ANGLE}deg`);
}

function getCurrentReelResult(reelIndex) {
    const face = getReelFace(reelIndex, getFrontFaceIndex(reelIndex));
    const img = face?.querySelector("img");
    return img?.src?.split("/").pop() || "";
}

/*
    ============= SECTION 4: REEL SPIN & ANIMATION LOGIC =============
*/
function doReelReleaseAnimation(reelIndex, mainDirection, callback) {
    let reel = reelElements[reelIndex];
    reel.classList.remove("slip-up", "slip-down", "jerk");

    let slipClass = mainDirection === 1 ? "slip-down" : "slip-up";
    reel.classList.add(slipClass);

    if (reelReleaseAudio) {
        reelReleaseAudio.currentTime = 0;
        reelReleaseAudio.play();
    }

    setTimeout(() => {
        reel.classList.remove(slipClass);
        reel.classList.add("jerk");

        setTimeout(() => {
            reel.classList.remove("jerk");
            callback(); // NOW begin the spin!
        }, JERK_ANIMATION_MS);
    }, 500);
}

function shiftReelTiles(reelIndex, newImageSrc, isJackpot = false) {
    const direction = spinDirection[reelIndex] || 1;
    const nextStep = reelRotationSteps[reelIndex] + direction;
    const nextFaceIndex = ((nextStep % CYLINDER_FACE_COUNT) + CYLINDER_FACE_COUNT) % CYLINDER_FACE_COUNT;
    const face = getReelFace(reelIndex, nextFaceIndex);
    const img = face?.querySelector("img");

    if (!img) return;

    img.src = newImageSrc;
    img.classList.toggle("jackpot-glow", Boolean(isJackpot));
    setReelRotation(reelIndex, 1, direction);
}

function spinReel(reelIndex, duration, direction = 1, speed = 1) {
    const spinToken = ++reelSpinTokens[reelIndex];
    spinDirection[reelIndex] = direction;
    spinningReels[reelIndex] = true;           // ✅ boolean, not direction
    jackpotLanded[reelIndex] = false;          // Reset jackpot flag

    doReelReleaseAnimation(reelIndex, direction, () => {
        if (spinToken !== reelSpinTokens[reelIndex]) return;
        let spinStart = Date.now();

        function doSpinStep() {
            if (!spinningReels[reelIndex] || spinToken !== reelSpinTokens[reelIndex]) return;

            let now = Date.now();
            let timeElapsed = now - spinStart;
            let thisStepSpeed = Math.floor(90 + Math.random() * 70) / speed;

            // Determine if we should draw a jackpot image or not for this shift
            let drawJackpot = determineJackpotDraw(
              reelIndex,
              jackpotLanded.filter(x => x).length
            );
            let newImageSrc;
            if (drawJackpot) {
                newImageSrc = getRandomJackpotImage();
                jackpotLanded[reelIndex] = true;
                document.dispatchEvent(new CustomEvent("jackpotHit", {
                    detail: { reelIndex, filename: newImageSrc.split("/").pop() }
                }));
                } else {
                let filename = pickRandom(allTileImages[reelIndex]);
                newImageSrc = GRAPHICS_PATHS[reelIndex] + filename;
                }

            shiftReelTiles(reelIndex, newImageSrc, drawJackpot);

            if (spinAudio?.paused) {
                spinAudio.currentTime = 0;
                spinAudio.play().catch(() => {});
            }

            if (timeElapsed < duration) {
                setTimeout(doSpinStep, thisStepSpeed);
            } else {
                doReelCatchAnimation(
                reelIndex,
                spinDirection[reelIndex],
                forceJackpotOnStop[reelIndex],
                spinToken
                );
            }
        }

        doSpinStep();
    });
}


function doReelCatchAnimation(reelIndex, direction = 1, forceOnStop = false, spinToken = reelSpinTokens[reelIndex]) {
  if (spinToken !== reelSpinTokens[reelIndex]) return;
  let reel = reelElements[reelIndex];
  reel.classList.remove("slip-up", "slip-down", "jerk");
  let slipClass = direction === 1 ? "slip-down" : "slip-up";
  reel.classList.add(slipClass);

  setTimeout(() => {
    if (spinToken !== reelSpinTokens[reelIndex]) return;
    reel.classList.remove(slipClass);
    reel.classList.add("jerk");
    if (reelStopAudio[reelIndex]) {
      reelStopAudio[reelIndex].currentTime = 0;
      reelStopAudio[reelIndex].play();
    }
    setTimeout(() => {
      if (spinToken !== reelSpinTokens[reelIndex]) return;
      reel.classList.remove("jerk");

      // ✅ force the final visible tile if required
      if (forceOnStop) {
        const face = getReelFace(reelIndex, getFrontFaceIndex(reelIndex));
        const img = face?.querySelector("img");
        const finalJackpot = getRandomJackpotImage();
        if (img) {
          img.src = finalJackpot;
          img.classList.add("jackpot-glow");
        }
        jackpotLanded[reelIndex] = true;
      }

      reel.classList.remove("fast-spin");
      spinningReels[reelIndex] = false;
      handleReelStop(reelIndex);
    }, JERK_ANIMATION_MS);
  }, SLIP_ANIMATION_MS);
}


/*
    ============= SECTION 5: RESULT & HISTORY LOGIC =============
*/
function handleReelStop(reelIndex) {
    let resultFilename = getCurrentReelResult(reelIndex);
    currentResults[reelIndex] = resultFilename;

    spinningReels[reelIndex] = false;

    if (spinningReels.every(state => state === false)) {
        if (spinAudio && !spinAudio.paused) {
            spinAudio.pause();
            spinAudio.currentTime = 0;
        }
        checkResultsAndHandleRespins();
    }
}

function checkResultsAndHandleRespins() {
    let respinIndices = [];
    for (let i = 0; i < REEL_COUNT; i++) {
        const resultFilename = currentResults[i];
        if (JACKPOT_IMAGES.includes(resultFilename)) {
            jackpotLanded[i] = true;
            continue;
        }
        const key = HISTORY_KEYS[i];
        if (last10History.some(entry => entry[key] === resultFilename)) {

            respinIndices.push(i);
        document.dispatchEvent(new CustomEvent("reelRespin", {
    detail: { reelIndex: i, filename: resultFilename }
  }));
}
    }

    if (respinIndices.length > 0) {
      queueRespins(respinIndices);
    } else {
      handleSpinComplete();
    }

}

async function queueRespins(indices) {
    const respinIndices = Array.from(new Set(indices));
    if (respinSequenceActive || respinIndices.length === 0) return;

    respinSequenceActive = true;
    pendingRespins = respinIndices.slice();
    document.dispatchEvent(new CustomEvent("allRespinsNeeded", { detail: { respinIndices } }));

    try {
        await sleep(1000);
        await playAudioCue(matchErrorAudio, 2600);
        await sleep(700);
    } finally {
        respinSequenceActive = false;
        triggerRespins(respinIndices);
    }
}

function triggerRespins(indices) {
    const respinIndices = Array.from(new Set(indices));
    pendingRespins = [];

    for (let i of respinIndices) {
        spinDirection[i] = Math.random() < 0.5 ? 1 : -1;
        reelElements[i]?.classList.add("fast-spin");
        let respinDuration = SPIN_MIN_MS + Math.random() * (SPIN_MAX_MS - SPIN_MIN_MS);
        spinReel(i, respinDuration, spinDirection[i]);
    }
}
/* === POST-SPIN FUNNEL (centralized outcome handling) ================== */
// One gate: decide jackpot vs normal, defer/flush modifiers, emit clean events.

function isAllJackpot(r) {
  return JACKPOT_IMAGES.includes(r.species)
      && JACKPOT_IMAGES.includes(r.theme)
      && JACKPOT_IMAGES.includes(r.pose);
}

/**
 * Central dispatcher run after reels resolve.
 * - NEVER reveal modifiers on jackpot spins; ask Forge to reset jackpot state.
 * - Reveal pending modifier on the next normal spin.
 * - Emits stable events for external consumers:
 *    • "winningSpin" (back-compat)
 *    • "spin:complete" (structured payload)
 */
function handleSpinOutcome(saveObj) {
  const r = saveObj || {};
  const allJackpot = isAllJackpot(r);

  console.log("%c[SPIN] Outcome", "color:#72FF2B;font-weight:bold;", r, {
    allJackpot,
    modifierPending,
    modifierType
  });

  if (allJackpot) {
    // Jackpot: DO NOT reveal modifiers; keep it pending for next normal win.
    fetch(`${API_BASE}/jackpot/reset`, { method: "POST" }).catch(() => {});
    // External notifications
    document.dispatchEvent(new CustomEvent("winningSpin", {
      detail: { results: r, allJackpot }
    }));
    document.dispatchEvent(new CustomEvent("spin:complete", {
      detail: { results: r, allJackpot, modifiersRan: false }
    }));
    return;
  }

  // Normal outcome: reveal a pending modifier (if any)
let modifiersRan = false;

  // External notifications
  document.dispatchEvent(new CustomEvent("winningSpin", {
    detail: { results: r, allJackpot }
  }));
  document.dispatchEvent(new CustomEvent("spin:complete", {
    detail: { results: r, allJackpot, modifiersRan }
  }));
}

function handleSpinComplete() {
    if (spinAudio) {
        spinAudio.pause();
        spinAudio.currentTime = 0;
    }

    let saveObj = {
        species: currentResults[0],
        theme: currentResults[1],
        pose: currentResults[2]
    };

   handleSpinOutcome(saveObj);


    setTimeout(() => {
        const winAudio = document.getElementById('winAudio');
        if (winAudio) {
            winAudio.currentTime = 0;
            winAudio.volume = 0.3;
            winAudio.play();
            // If you want a fade, you can call fadeOutAudio(winAudio, 2000) *here* after a delay
        }
    }, 1000);

    saveSpinResult(saveObj);
    isSpinning = false;
    setForgeSpinStatus(false);
}

// Loads last 10 spin history from Forge
async function loadHistoryFromServer() {
    try {
        const response = await fetch(`${API_BASE}/history`);
        const data = await response.json();
        last10History = Array.isArray(data.history) ? data.history.slice(-100) : [];
    } catch (e) {
        last10History = [];
        console.error("[History] Failed to load from Forge:", e);
    }
}

// POSTs the new result to Forge (RESTful endpoint)
async function saveSpinResult(resultObj) {
  try {
    await fetch(`${API_BASE}/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(resultObj)
    });
  } catch (e) {
    console.error("[History] Failed to save result to Forge:", e);
  }
}

function fadeOutAudio(audioElement, duration = 1000) {
    let step = 50; // ms per fade tick
    let vol = audioElement.volume;
    let fadeStep = vol / (duration / step);

    let fade = setInterval(() => {
        if (audioElement.volume - fadeStep > 0) {
            audioElement.volume -= fadeStep;
        } else {
            audioElement.volume = 0;
            audioElement.pause();
            audioElement.currentTime = 0;
            clearInterval(fade);
        }
    }, step);
}

// --- Audio helpers (promise-based) ------------------------------------
function safePlay(el) {
  return new Promise((res) => {
    if (!el) return res();
    try {
      el.pause?.(); el.currentTime = 0;
      const onEnd = () => { el.removeEventListener("ended", onEnd); res(); };
      el.addEventListener("ended", onEnd, { once: true });
      const p = el.play?.();
      if (p && p.catch) p.catch(() => res());
    } catch (_) { res(); }
  });
}

// Wait for an audio element to play and end (with a max fallback)
function waitForPlayThenEnded(el, maxMs = 8000) {
  return new Promise((res) => {
    if (!el) return setTimeout(res, 1200);
    let timeout = setTimeout(() => { cleanup(); res(); }, maxMs);
    function cleanup() {
      clearTimeout(timeout);
      el.removeEventListener("ended", onEnded);
    }
    function onEnded() { cleanup(); res(); }
    el.addEventListener("ended", onEnded, { once: true });
  });
}


/*  ============ Section 5a: Reveal Animation & Audio =============== */
function revealModifierSign(type, opts = {}) {
    modifierRevealInProgress = true;
    modifierPending = false;
    const {
      playRevealSound = true,
      playTypeSound = true,   // NEW: let the orchestrator decide
      slideFirst = false
    } = opts;

    
    const modifierSign = document.getElementById("modifierSign");
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "flipper";
    const img = document.getElementById("modifierSignImage");

    // Remove any previous flipper
    modifierSign.innerHTML = "";
    imgWrapper.appendChild(img);
    modifierSign.appendChild(imgWrapper);

    // Set image and make visible
    img.src = MODIFIER_CONFIG[type]?.image || "";
    img.style.display = "block";

    modifierSign.classList.remove("flipped");
    setTimeout(() => {
        modifierSign.classList.add("flipped");
        setTimeout(() => {
           if (playTypeSound) {
            const modAudio = MODIFIER_CONFIG[type]?.audio;
            if (modAudio) {
            modAudio.currentTime = 0;
            modAudio.play();
            }
            }
            modifierRevealInProgress = false;
        }, 650);
    }, 100);
}

// Modifier Reel Logic
function getModifierImagePath(type, filename) {
    return `/assets/drawing-slot-machine/images/slot_machine/modifiers/${type}/${filename}`;
}

function formatModifierResultName(filename) {
    return String(filename || "").replace(/\.[^.]+$/, "");
}

async function loadModifierReelImages(type) {
    const response = await fetch(`/assets/drawing-slot-machine/images/slot_machine/modifiers/${type}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Modifier image list failed for ${type}: ${response.status}`);

    const images = await response.json();
    if (!Array.isArray(images) || images.length === 0) {
        throw new Error(`Modifier image list is empty for ${type}`);
    }

    return images;
}

function setModifierReelTile(type, filename, imgEl, ui = {}) {
    const src = getModifierImagePath(type, filename);
    imgEl.src = encodeURI(src);
    imgEl.alt = formatModifierResultName(filename);
    imgEl.style.display = "block";
    if (ui.typeEl) {
        ui.typeEl.textContent = `${type.toUpperCase()} MODIFIER`;
    }
    if (ui.labelEl) {
        ui.labelEl.textContent = formatModifierResultName(filename);
    }
    if (ui.statusEl && ui.status) {
        ui.statusEl.textContent = ui.status;
    }
    return src;
}

async function waitForAnimationEnd(element, fallbackMs = 700) {
    return new Promise((resolve) => {
        if (!element) return resolve();

        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            element.removeEventListener("animationend", finish);
            element.removeEventListener("transitionend", finish);
            resolve();
        };

        const timeout = setTimeout(finish, fallbackMs);
        element.addEventListener("animationend", finish, { once: true });
        element.addEventListener("transitionend", finish, { once: true });
    });
}

async function spinModifierReel(type, images, imgEl, ui, slot) {
    const token = ++modifierReelSpinToken;
    const ticks = MODIFIER_SPIN_MIN_TICKS + Math.floor(Math.random() * MODIFIER_SPIN_EXTRA_TICKS);
    let selectedFilename = null;

    modifierReelSpinning = true;
    slot.classList.remove("slip-up", "slip-down", "jerk", "locked", "stamping");
    slot.classList.add("printing");
    if (ui.statusEl) ui.statusEl.textContent = "SCANNING...";

    for (let i = 0; i < ticks; i++) {
        if (token !== modifierReelSpinToken) return null;

        selectedFilename = pickRandom(images);
        const status = i < ticks - 5 ? "PRINTING..." : "EVALUATING...";
        setModifierReelTile(type, selectedFilename, imgEl, { ...ui, status });
        await sleep(MODIFIER_SPIN_BASE_DELAY_MS + (i * MODIFIER_SPIN_DECEL_MS));
    }

    if (token !== modifierReelSpinToken || !selectedFilename) return null;

    slot.classList.remove("printing");
    slot.classList.add("slip-up");
    playAudioCue(reelStopAudio[1], 600);
    await sleep(SLIP_ANIMATION_MS);

    slot.classList.remove("slip-up");
    slot.classList.add("jerk");
    await sleep(JERK_ANIMATION_MS);

    slot.classList.remove("jerk");
    slot.classList.add("stamping");
    if (ui.statusEl) ui.statusEl.textContent = "LOCKING...";
    await sleep(280);

    slot.classList.remove("stamping");
    slot.classList.add("locked");
    if (ui.statusEl) ui.statusEl.textContent = "FORGE TAG APPLIED";
    modifierReelSpinning = false;

    const result = {
        type,
        filename: selectedFilename,
        src: getModifierImagePath(type, selectedFilename)
    };

    modifierReelResult = result;
    document.dispatchEvent(new CustomEvent("modifier:complete", { detail: result }));
    console.log("[ModifierReel] result:", result);
    return result;
}

async function showModifierReel(type, opts = {}) {

    currentModifierReelType = type;
    modifierReelImages = [];
    modifierReelResult = null;
    const { slideFirst = true, playRevealSound = false } = opts;
    const overlay = document.getElementById("modifierReelOverlay");
    const reelContent = overlay?.querySelector(".modifier-reel-content");
    const header = document.getElementById("modifierReelHeader");
    const imgEl = document.getElementById("modifierReelTileImg");
    const typeEl = document.getElementById("modifierReelTypeLabel");
    const labelEl = document.getElementById("modifierReelTileLabel");
    const statusEl = document.getElementById("modifierReelStatus");
    const slot = document.getElementById("modifierReelSlot");
    if (!overlay || !imgEl || !slot) return null;

    if (header) header.textContent = `MODIFIER: ${type.toUpperCase()}`;
    imgEl.src = "";
    imgEl.style.display = "none";
    if (typeEl) typeEl.textContent = `${type.toUpperCase()} MODIFIER`;
    if (labelEl) labelEl.textContent = "";
    if (statusEl) statusEl.textContent = "READY TO PRINT";
    slot.classList.remove("slip-up", "slip-down", "jerk", "spinning", "printing", "stamping", "locked");
    if (reelContent) reelContent.classList.remove("out");

   const revealAudio = document.getElementById("modifierRevealAudio");
if (playRevealSound && revealAudio) {
    revealAudio.currentTime = 0;
    revealAudio.play();
}

    try {
        modifierReelImages = await loadModifierReelImages(type);
    } catch (e) {
        if (header) header.textContent = "No options for this modifier!";
        console.warn("[ModifierReel]", e);
        return null;
    }

    const ui = { typeEl, labelEl, statusEl };
    setModifierReelTile(type, pickRandom(modifierReelImages), imgEl, { ...ui, status: "READY TO PRINT" });

    const entranceComplete = slideFirst
        ? waitForAnimationEnd(reelContent, 760)
        : sleep(120);

    overlay.style.display = "flex";
    if (slideFirst) {
        await entranceComplete;
    } else if (entranceComplete) {
        await entranceComplete;
    }

    const spinResult = spinModifierReel(type, modifierReelImages, imgEl, ui, slot);

    const closeBtn = document.getElementById("modifierReelClose");
    if (closeBtn) closeBtn.onclick = () => {
        modifierReelSpinToken++;
        modifierReelSpinning = false;
        overlay.style.display = "none";
        imgEl.src = "";
        imgEl.style.display = "none";
        if (typeEl) typeEl.textContent = "";
        if (labelEl) labelEl.textContent = "";
        if (statusEl) statusEl.textContent = "";
        currentModifierReelType = null;
        modifierReelResult = null;
    };

    return spinResult;
}

/*
    ============= SECTION 6: EVENT DISPATCH & INTEGRATION HOOKS =============
*/

// --- Audio util: play from start and resolve on 'ended' (with fallback) ---
function playFromStartAndWait(el, maxMs = 8000) {
  return new Promise((res) => {
    if (!el || typeof el.play !== "function") return res();
    try {
      el.pause?.();
      el.currentTime = 0;
      let done = false;
      const onEnded = () => { if (done) return; done = true; el.removeEventListener("ended", onEnded); clearTimeout(t); res(); };
      el.addEventListener("ended", onEnded, { once: true });
      const t = setTimeout(onEnded, maxMs); // fallback
      el.play().catch(() => onEnded());
    } catch { res(); }
  });
}

async function runModifierSequenceAfterWin(detail) {
  const d = detail || {};
  const r = d.results || {};

  // Defer on jackpot; only run for normal wins
  const allJackpot = typeof d.allJackpot === "boolean"
    ? d.allJackpot
    : (JACKPOT_IMAGES.includes(r.species) && JACKPOT_IMAGES.includes(r.theme) && JACKPOT_IMAGES.includes(r.pose));
  if (allJackpot) return;

  // Must have a pending modifier
  if (!(modifierPending && modifierType && !modifierRevealInProgress)) return;

  // 1) Wait for SPIN-COMPLETE SFX to fully finish
  await waitForSpinCompleteSfxEnd();

  // 2) Extra delay you asked for
  await sleep(1000);

  // 3) Play trigger + flip together; show the SIGN FLIP right now
  const triggerAudio = document.getElementById("modifierTriggerAudio");
  try { triggerAudio && (triggerAudio.currentTime = 0, triggerAudio.play && triggerAudio.play()); } catch {}

  const flipAudio = document.getElementById("modifierRevealAudio");
  // Align the visual flip with the flip SFX, but don't replay flip sound inside reveal
  revealModifierSign(modifierType, { playRevealSound: false, playTypeSound: false });

  if (flipAudio && typeof flipAudio.play === "function") {
    try {
      flipAudio.currentTime = 0;
      await new Promise((res) => {
        flipAudio.addEventListener("ended", res, { once: true });
        flipAudio.play().catch(() => res());
      });
    } catch {}
  }

  // 4) Flip ended → start TYPE SFX (don’t block), then slide the modifier tile up and spin
  let modAudio = (typeof MODIFIER_CONFIG !== "undefined" && MODIFIER_CONFIG?.[modifierType]?.audio) || null;
  if (!modAudio) modAudio = document.getElementById(`modifierAudio_${modifierType}`);
  try { modAudio && (modAudio.currentTime = 0, modAudio.play && modAudio.play()); } catch {}

  // Bring up the modifier reel overlay and spin it (no extra flip SFX here)
  showModifierReel(modifierType, { slideFirst: true, playRevealSound: false });
}




// === Audio gating for Spin-Complete SFX ================================
// Choose which element is the spin-complete SFX. Prefer an explicit ID if you have it.
// Set window.FORGE_SPIN_COMPLETE_SFX_ID = "spinCompleteAudio" in your boot code if you like.
function getSpinCompleteAudioEl() {
  const id = window.FORGE_SPIN_COMPLETE_SFX_ID || "spinCompleteAudio";
  return document.getElementById(id) || document.getElementById("winAudio");
}

// Wait until the given <audio> actually plays and then ends (works even if play starts later)
function waitForPlayingThenEnded(el, maxMs = 10000) {
  return new Promise((resolve) => {
    if (!el || typeof el.play !== "function") return resolve();

    let done = false;
    const finish = () => { if (done) return; done = true; cleanup(); resolve(); };

    const onEnded = () => finish();
    const onPlay  = () => {
      // Once it starts, wait for 'ended'
      el.removeEventListener("play", onPlay);
      if (el.ended) finish(); else el.addEventListener("ended", onEnded, { once: true });
    };

    const cleanup = () => {
      el?.removeEventListener("play", onPlay);
      el?.removeEventListener("ended", onEnded);
      clearTimeout(t);
    };

    // If it’s already playing, just wait for 'ended'
    if (!el.paused && !el.ended && el.currentTime > 0) {
      el.addEventListener("ended", onEnded, { once: true });
    } else if (el.ended) {
      return resolve();
    } else {
      // Not started yet; wait for 'play', then 'ended'
      el.addEventListener("play", onPlay, { once: true });
    }

    const t = setTimeout(finish, maxMs); // safety fallback
  });
}

// Convenience: wait for whichever element we consider "spin complete" SFX
async function waitForSpinCompleteSfxEnd() {
  const el = getSpinCompleteAudioEl();
  await waitForPlayingThenEnded(el, 12000);
}

document.addEventListener("spin:complete", async (e) => {
  const d = e.detail || {};
  console.log("%c[EVENT] spin:complete", "color:#72FF2B;font-weight:bold;", d);
  try { await runModifierSequenceAfterWin(d); } catch (err) { console.warn("[ModifierSequence] error", err); }
});


document.addEventListener("reelRespin", function(e) {
    console.log("[EVENT] Reel", e.detail.reelIndex, "is respinning due to duplicate:", e.detail.filename);
});

document.addEventListener("jackpotChanceChanged", function(e) {
    console.log("[EVENT] Jackpot chance is now", e.detail.jackpotChance + "%");
});

/* === STREAMER.BOT/OBS EXAMPLES (optional stubs) === */
function sendStreamerBotTrigger(eventName, extraData = {}) {
  // Example—adjust URL to your SB HTTP/Routes setup:
  // fetch("http://127.0.0.1:6970/trigger", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ event: eventName, data: extraData })
  // }).catch(console.error);
  console.log("Streamer.bot event sent:", eventName, extraData);
}
document.addEventListener("jackpotHit", function(e) {
  console.log("[EVENT] Jackpot hit on reel", e.detail.reelIndex, "with", e.detail.filename);
  // Centralize all side-effects in Streamer.bot (OBS actions handled there)
  sendStreamerBotTrigger?.("JackpotHit", { reel: e.detail.reelIndex, file: e.detail.filename });
});



// =================== SECTION 9: IMAGE PRELOAD & LOADING INDICATOR ===================
/**
 * Preloads all slot machine images (category and jackpot), waits for all to finish.
 * Disables the spin button until done. Shows "loading" indicator.
 */
async function preloadAllImages() {
    if (awooButton) awooButton.disabled = true;
    if (loadingIndicator) loadingIndicator.style.display = "block";

    let preloadPromises = [];
    for (let i = 0; i < REEL_COUNT; i++) {
        try {
            const res = await fetch(JSON_PATHS[i]);
            allTileImages[i] = await res.json();
        } catch (e) {
            console.error(`[Error] Could not load JSON for ${REEL_CATEGORIES[i]}:`, e);
            allTileImages[i] = [];
        }
    }

    // Preload category images
    for (let i = 0; i < REEL_COUNT; i++) {
        for (let filename of allTileImages[i]) {
            preloadPromises.push(new Promise((resolve) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = resolve; // Don't block loading on missing file
                img.src = GRAPHICS_PATHS[i] + filename;
            }));
        }
    }
    // Preload jackpot images
    for (let filename of JACKPOT_IMAGES) {
        preloadPromises.push(new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = JACKPOT_PATH + filename;
        }));
    }

    await Promise.all(preloadPromises);
    console.log('All images preloaded!');

    if (awooButton) awooButton.disabled = false;
    if (loadingIndicator) loadingIndicator.style.display = "none";
}

// =================== SECTION 10: PAGE LOAD HOOK ===================

function startStreamToolsPolling() {
  let lastSpinRequestId = 0;
  let lastModifierTs = 0;

  async function poll() {
    try {
      const response = await fetch(`${API_BASE}/state`, { cache: "no-store" });
      const data = await response.json();
      const remoteState = data.state || {};

      if (remoteState.jackpot?.chance != null) {
        setJackpotChance(remoteState.jackpot.chance);
      }

      const modifier = remoteState.modifier || {};
      if (!localModifierTestMode && (modifier.ts || 0) !== lastModifierTs) {
        lastModifierTs = modifier.ts || 0;
        if (modifier.type) {
          modifierType = String(modifier.type).toLowerCase();
          modifierPending = true;
          console.log("[StreamTools] modifier set:", modifierType);
        } else {
          modifierPending = false;
          modifierType = null;
          flipOutModifierSign();
          console.log("[StreamTools] modifier cleared");
        }
      }

      const requestId = Number(remoteState.spinRequestId || 0);
      if (requestId > lastSpinRequestId) {
        lastSpinRequestId = requestId;
        window.slotMachine?.spin?.(remoteState.spinPayload || {});
      }
    } catch (error) {
      console.warn("[StreamTools] state poll failed:", error);
    }
  }

  poll();
  setInterval(poll, 1000);
}


window.addEventListener("DOMContentLoaded", async () => {
    // Late-bind reel DOM nodes now that the HTML exists
    reelElements = REEL_IDS.map(id => document.getElementById(id));
    setupCylinderReels();
    if (loadingIndicator) loadingIndicator.style.display = "block";
    await preloadAllImages();
    await loadHistoryFromServer();

    const awooButton = document.getElementById('awooPushButton');
    if (awooButton) {
        const pressButton = (event) => {
            if (isSpinning) return;
            event?.preventDefault?.();
            if (isButtonActive) return;
            isButtonActive = true;
            awooButton.classList.add("pressed");
            if (event?.pointerId != null) awooButton.setPointerCapture?.(event.pointerId);
            if (buttonSound) { buttonSound.currentTime = 0; buttonSound.play().catch(()=>{}); }
            isPausedFromHold = false;
            holdTimer = setTimeout(() => {
                if (buttonSound) { buttonSound.pause(); }
                isPausedFromHold = true;
            }, holdDelay);
        };

        const releaseButton = (event, shouldSpin = true) => {
            if (!isButtonActive) return;
            event?.preventDefault?.();
            awooButton.classList.remove("pressed");
            if (event?.pointerId != null && awooButton.hasPointerCapture?.(event.pointerId)) {
                awooButton.releasePointerCapture(event.pointerId);
            }
            clearTimeout(holdTimer);
            if (isPausedFromHold && buttonSound) buttonSound.play().catch(()=>{});
            isButtonActive = false;
            if (shouldSpin && !isSpinning) {
                setTimeout(() => {
                    safeSpinRequest();
                }, 120);
            }
        };

        awooButton.addEventListener("pointerdown", pressButton);
        awooButton.addEventListener("pointerup", (event) => releaseButton(event, true));
        awooButton.addEventListener("pointercancel", (event) => releaseButton(event, false));

        window.addEventListener("keydown", (event) => {
            if (event.code !== "Space" || event.repeat) return;
            pressButton(event);
        });

        window.addEventListener("keyup", (event) => {
            if (event.code !== "Space") return;
            releaseButton(event, true);
        });
    } else {
        console.log('Awoo button NOT found!');
    }

    await initJackpotFromServer();
    startStreamToolsPolling();
    applyUrlModifierTestMode();

});

// Main spin function, triggers all reels with random durations and resets
async function startSpin() {
    if (isSpinning) return; // Prevent overlap

    isSpinning = true;
    setForgeSpinStatus(true);

    // Plan forced jackpots on stop based on current jackpotChance
forceJackpotOnStop = [false, false, false];
let target = (jackpotChance >= 100) ? 3 : (jackpotChance >= 80) ? 2 : (jackpotChance >= 50) ? 1 : 0;
const order = [0,1,2].sort(() => Math.random() - 0.5);
for (let i = 0; i < target; i++) forceJackpotOnStop[order[i]] = true;

    forcedJackpotMin = 0;
    forcedJackpotTarget = 0;
    pendingRespins = [];
    currentResults = [null, null, null];
    jackpotLanded = [false, false, false];
    spinDirection = [1, 1, 1];

    await loadHistoryFromServer();

    for (let i = 0; i < REEL_COUNT; i++) {
        reelElements[i]?.classList.add("fast-spin");
        let spinDuration = SPIN_MIN_MS + Math.random() * (SPIN_MAX_MS - SPIN_MIN_MS);
        spinReel(i, spinDuration, 1);
    }
}

// Safe trigger path (handles modifier UI first)
function safeSpinRequest() {
    flipOutModifierSign();
    hideModifierReelWithAnimation(startSpin);
}

// --- Forge bridge export (lets Forge trigger a spin) ---
window.slotMachine = window.slotMachine || {};
window.slotMachine.spin = function (payload = {}) {
  // If you ever want to read metadata from Streamer.bot:
  // const { source, user, reason } = payload.query || payload;
  // console.log("Forge spin payload:", source, user, reason);
  safeSpinRequest();
};

/* =================== OPTIONAL LOADING INDICATOR ===================
<div id="slotLoadingIndicator" style="display:none;
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%,-50%);
    background: rgba(40,60,120,0.93);
    color: #fff; 
    padding: 16px 40px; 
    border-radius: 18px;
    font-size: 2rem;
    font-family: inherit;
    z-index: 9999;">
  Loading slot machine assets...
</div>
*/

/* 
/*
  StreamTools Slot Machine Overlay — PATCHED 2025‑09‑13
  Changes:
  - Removed duplicate/legacy Streamer.bot WebSocket handlers (Forge is the hub now)
  - Fixed spinningReels to use booleans (true/false) instead of 1/-1
  - Removed stray global fadeOutAudio(winAudio, 2000) call
  - Consolidated image preloader (kept the robust Section 9 version only)
  - Kept Forge spin-status emits at spin start/end

PATCH NOTES — 2025-09-16 (Dad/Drakar)
Ticket: Modifiers must NOT trigger on jackpot spins; reveal on the next normal winning spin.

Context:
- Prior build (2025-09-13) had two separate "winningSpin" listeners:
  1) One that immediately revealed a pending modifier.
  2) One that handled all-jackpot detection and emitted "jackpot:reset".
- Result: modifiers could reveal even when all three reels were jackpot, which we don’t want.

Change Summary:
- Removed the two duplicate listeners (old lines 682–701).
- Replaced them with a single unified "winningSpin" handler that:
  • Computes `allJackpot` by checking `JACKPOT_IMAGES` against all three reels.  
  • If `allJackpot`, emits `jackpot:reset` via `forgeSocket` and returns early (no modifier reveal).  
  • If NOT `allJackpot`, reveals the modifier only when:
      `modifierPending && modifierType && !modifierRevealInProgress`.

Behavioral Impact:
- Modifiers now stay queued if a jackpot hits; they will reveal on the *next normal* winning spin.
- Forge jackpot state still resets after an all-jackpot result (unchanged integration).
- No changes to boot preload, `startSpin()`, or jackpot init:
    • `initJackpotFromServer()` defined at 233–239, called once at 847.

Test Plan:
1) Force an all-jackpot spin with `modifierPending=true` and a valid `modifierType`.
   → Expect: no modifier reveal; console logs `"[EVENT] Winning spin!" ... { allJackpot: true }`.
2) Next normal winning spin.
   → Expect: modifier reveal sequence plays (SFX/UI OK).
3) Normal win without jackpot.
   → Expect: modifier reveals if pending.
4) Loss spins.
   → Expect: no modifier action.

Notes for Future Me (and Future Dad):
- Consider upgrading to a full post-spin funnel to deterministically order:
    jackpot → queued modifiers → current modifiers.
- If you want queued modifiers to persist across page reloads, consider `sessionStorage`.
- Audio is preloaded; keep modifier SFX awaited to avoid overlap.
- If integrating Sussy Spinner queueing with Streamer.bot, fire it from the modifier reveal branch.

Rollback:
- Revert to the two old listeners and remove the unified one inserted at line ~682.
*/
// 2025-09-16 Addendum
// - Removed a redundant "winningSpin" logger (3 lines) to avoid double logs.
// - This shifted later line numbers up by ~3 lines.
// - Unified "winningSpin" handler remains the source of truth for:
//     • allJackpot detection
//     • jackpot:reset emission
//     • deferring modifier reveal until next normal win
/*
PATCH NOTES — 2025-09-16 (Dad/Drakar)
Feature: Centralized POST-SPIN FUNNEL (finalized) + cleanup

Context:
- Duplicate funnel blocks existed (back-to-back). Outcome logic was also still handled
  inside a "winningSpin" listener, causing double-processing and ordering ambiguity.

Changes:
- handleSpinComplete(): now calls `handleSpinOutcome(saveObj)` instead of dispatching
  "winningSpin" directly (was lines 610–612).
- Removed duplicate POST-SPIN FUNNEL block (deleted lines 539–596).
- Removed internal "winningSpin" listener that handled jackpot/reset & modifier reveal
  (deleted lines 793–812). The funnel is now the single source of truth.
- (Dev) Added optional "spin:complete" logger for easier debugging of future widgets.

Behavioral Contract:
- Jackpot spin → emits forgeSocket "jackpot:reset"; modifiers DO NOT reveal.
- Normal winning spin → reveals pending modifier (if any).
- Emits:
  • "winningSpin" (back-compat)
  • "spin:complete" with { results, allJackpot, modifiersRan }

Test Plan:
1) Jackpot + pending modifier → { allJackpot: true, modifiersRan: false }, no reveal.
2) Next normal win → { allJackpot: false, modifiersRan: true }, modifier reveals.
3) Normal win without pending modifier → modifiersRan: false.
4) Loss: unaffected elsewhere.

Forge Org Note:
- Forge is the hub: widgets should listen to "spin:complete" going forward and avoid
  re-implementing outcome rules in their own listeners.

  2025-09-16 — Streamer.bot-only triggers
- Consolidated jackpotHit handling to a single listener that logs and calls Streamer.bot.
- Removed separate OBS trigger usage; Streamer.bot is now the sole integration point and will perform OBS WebSocket actions.
- Optional: removed sendOBSWebSocketTrigger helper to reduce surface area.
Rationale: Forge stays organized by routing all external side-effects through Streamer.bot. Overlays handle visuals; SB handles OBS.

/*
PATCH NOTES — 2025-09-16 (Dad/Drakar)
Feature: Streamer.bot-only triggers (drop OBS calls in overlay)

Context:
- We’re standardizing Forge as the hub and Streamer.bot as the single integration surface.
- The overlay should emit clean events and, if needed, ping Streamer.bot; OBS actions occur in SB.

Changes:
- Removed standalone jackpot logger (lines 670–672).
- Consolidated "jackpotHit" handling to a single listener that logs and calls Streamer.bot (replaced lines 719–722).
- Removed unused OBS helper (lines 715–717). If needed later, reintroduce or handle via SB.
- Left sendStreamerBotTrigger stub in place; included token-ready HTTP example for future wiring.

Behavior:
- On jackpot tile: overlay logs + fires Streamer.bot trigger; OBS scene/filter/stingers handled by SB.
- No overlay-side OBS WebSocket usage remains.

Rollback:
- Re-add the removed logger and OBS helper; restore old "jackpotHit" listener block.

2025-09-16 — Modifier timing polish
- Hooked modifier sequence to "spin:complete" (we removed winningSpin listeners earlier).
- Sequence: wait for win SFX → play trigger+flip together → on flip end play type SFX → slip-up then spin modifier reel.
- revealModifierSign(type, opts) now supports { playRevealSound, slideFirst }.
- Added playFromStartAndWait(audio) util for deterministic timing.

*/

/*============= END OF FILE ============= */
