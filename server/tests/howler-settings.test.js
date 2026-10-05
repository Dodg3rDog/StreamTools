const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_PHRASES, createSettingsStore } = require('../services/voiceConfinementSettings');
test('settings persist, deduplicate roles, allow clearing roles, and reject invalid writes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'howler-settings-'));
  try {
    const file = path.join(dir, 'settings.json');
    const store = createSettingsStore(file);
    assert.equal(store.load(), null);
    store.save({ durationSeconds: 600, exemptRoleIds: ['123456789012345678', '123456789012345678'] });
    assert.deepEqual(createSettingsStore(file).load(), {
      durationSeconds: 600,
      exemptRoleIds: ['123456789012345678'],
      phrases: Object.fromEntries(Object.entries(DEFAULT_PHRASES).map(([key, values]) => [key, [...values]]))
    });
    for (const durationSeconds of [29, 86401, 30.5, '300']) assert.throws(() => store.save({ durationSeconds, exemptRoleIds: [] }));
    assert.throws(() => store.save({ durationSeconds: 60, exemptRoleIds: ['not-a-role'] }));
    assert.throws(() => store.save({ durationSeconds: 60, exemptRoleIds: [], phrases: { eaten: [] } }));
    assert.equal(createSettingsStore(file).load().durationSeconds, 600);
    const phrases = {
      eaten: ['Eaten {target}'],
      unable: ['Unable: {reason}'],
      released: ['Released {target} to {channel}'],
      permanent: ['Kept {target}']
    };
    store.save({ durationSeconds: 30, exemptRoleIds: [], phrases });
    assert.deepEqual(createSettingsStore(file).load(), { durationSeconds: 30, exemptRoleIds: [], phrases });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
