const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PHRASES = Object.freeze({
  eaten: Object.freeze([
    '{issuer} just swallowed {target} whole, and they were mighty tasty~ Maybe we\'ll see them again shortly...',
    '{target} disappeared down {issuer}\'s gullet. Tummy~Time begins now.',
    '{issuer} made a snack of {target}. Down the hatch~'
  ]),
  unable: Object.freeze([
    '{issuer} tried to swallow {target}, but {reason}.',
    '{target} escaped {issuer}\'s appetite because {reason}.',
    'Howler could not help {issuer} eat {target}: {reason}.'
  ]),
  released: Object.freeze([
    '{issuer} finally let {target} back out. Welcome back to {channel}~',
    '{target} wriggled free of {issuer} and returned to {channel}.',
    '{issuer} released {target}, who has been returned safely to {channel}.'
  ]),
  permanent: Object.freeze([
    '{target} was not in Tummy~Time when release came. It seems {issuer} kept this one~',
    '{issuer}\'s belly is suspiciously quiet. {target} never made it back to voice chat.',
    '{target} vanished before they could be returned. That may have been a permanent vore by {issuer}~'
  ])
});

const PHRASE_KEYS = Object.keys(DEFAULT_PHRASES);

function normalizePhrases(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};

  for (const key of PHRASE_KEYS) {
    const phrases = source[key] == null ? DEFAULT_PHRASES[key] : source[key];
    if (!Array.isArray(phrases) || phrases.length < 1 || phrases.length > 100) {
      throw new Error(`${key} phrases must contain between 1 and 100 entries.`);
    }

    const normalized = phrases.map(phrase => {
      if (typeof phrase !== 'string') throw new Error(`${key} phrases must be text.`);
      const trimmed = phrase.trim();
      if (!trimmed || trimmed.length > 500) {
        throw new Error(`${key} phrases must contain between 1 and 500 characters.`);
      }
      return trimmed;
    });

    result[key] = [...new Set(normalized)];
  }

  return result;
}

function createSettingsStore(filePath = path.join(__dirname, '../data/discord/voice-confinement-settings.json')) {
  let cached;
  function validate(value) {
    if (!value || !Number.isInteger(value.durationSeconds) || value.durationSeconds < 30 || value.durationSeconds > 86400) {
      throw new Error('Duration must be a whole number between 30 and 86400 seconds.');
    }
    if (!Array.isArray(value.exemptRoleIds) || value.exemptRoleIds.length > 250 || value.exemptRoleIds.some(id => typeof id !== 'string' || !/^\d{17,20}$/.test(id))) {
      throw new Error('Exempt roles must be valid Discord role IDs (maximum 250).');
    }
    return {
      durationSeconds: value.durationSeconds,
      exemptRoleIds: [...new Set(value.exemptRoleIds)],
      phrases: normalizePhrases(value.phrases)
    };
  }
  return {
    load() {
      if (cached !== undefined) return cached;
      try { cached = validate(JSON.parse(fs.readFileSync(filePath, 'utf8'))); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      return cached;
    },
    save(value) {
      const validated = validate(value);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath + '.tmp', JSON.stringify(validated, null, 2) + '\n', { mode: 0o600 });
      fs.renameSync(filePath + '.tmp', filePath);
      cached = validated;
      return validated;
    }
  };
}
module.exports = { DEFAULT_PHRASES, createSettingsStore, settingsStore: createSettingsStore() };
