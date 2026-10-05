const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function fixture() {
  const record = { guildId: '123456789012345678', userId: '223456789012345678', userName: 'Test member', status: 'confined', removedRoleIds: ['role1'], releaseAt: Date.now() + 300000 };
  let additions = 0;
  const state = { records: { [`${record.guildId}:${record.userId}`]: record } };
  const context = {
    module: { exports: {} }, __dirname: __dirname,
    require(name) {
      if (name === 'fs') return { readFileSync: () => JSON.stringify(state), mkdirSync() {}, writeFileSync() {} };
      if (name === './voiceConfinementSettings') return {
        DEFAULT_PHRASES: { eaten: ['eaten'], unable: ['unable'], released: ['released'], permanent: ['permanent'] },
        settingsStore: { load: () => null }
      };
      if (name === 'discord.js') return { PermissionFlagsBits: {} };
      return require(name);
    },
    process: { env: { ENABLE_VOICE_CONFINEMENT: 'true', DISCORD_TOKEN: 'never-expose' } },
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/voiceConfinement.js'), 'utf8'), context);
  const api = context.module.exports;
  const member = { id: record.userId, user: { username: 'Test member' }, voice: {}, roles: { cache: new Map(), async add() { additions++; await new Promise(resolve => setTimeout(resolve, 15)); } } };
  const guild = { members: { fetch: async () => member }, roles: { fetch: async () => {}, cache: new Map([['role1', { editable: true }]]) } };
  const client = { isReady: () => true, guilds: { cache: new Map([[record.guildId, guild]]) } };
  return { api, client, record, additions: () => additions };
}
test('Howler status exposes records without environment secrets and rejects offline release', async () => {
  const { api, record } = fixture();
  const status = api.getVoiceConfinementStatus();
  assert.equal(status.records.length, 1);
  assert.equal(status.ready, false);
  assert.equal(JSON.stringify(status).includes('never-expose'), false);
  await assert.rejects(api.releaseVoiceConfinementFromAdmin(record.guildId, record.userId), /not connected/);
});
test('concurrent Admin releases restore roles once and clear the record', async () => {
  const f = fixture();
  f.api.startVoiceConfinement(f.client);
  const results = await Promise.all([
    f.api.releaseVoiceConfinementFromAdmin(f.record.guildId, f.record.userId),
    f.api.releaseVoiceConfinementFromAdmin(f.record.guildId, f.record.userId)
  ]);
  assert.equal(f.additions(), 1);
  assert.equal(results[0].pending, false);
  assert.equal(f.api.getVoiceConfinementStatus().records.length, 0);
});
