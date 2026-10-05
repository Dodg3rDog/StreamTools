const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class TestCollection extends Map {
  filter(callback) {
    return new TestCollection([...this].filter(([key, value]) => callback(value, key, this)));
  }

  map(callback) {
    return [...this].map(([key, value]) => callback(value, key, this));
  }

  some(callback) {
    return [...this].some(([key, value]) => callback(value, key, this));
  }
}

function createFixture() {
  const ids = {
    guild: '100000000000000001',
    issuer: '100000000000000002',
    otherIssuer: '100000000000000003',
    first: '100000000000000004',
    second: '100000000000000005',
    source: '100000000000000006',
    tummy: '100000000000000007',
    text: '100000000000000008',
    role: '100000000000000009'
  };
  const state = { records: {} };
  const replies = [];
  const announcements = [];
  const tummyMessages = [];
  const directMessages = new Map();
  const settings = {
    durationSeconds: 300,
    exemptRoleIds: [],
    phrases: {
      eaten: ['EAT {issuer} -> {target} for {duration}'],
      unable: ['NO {issuer} -> {target}: {reason}'],
      released: ['OUT {target} -> {channel} by {issuer}'],
      permanent: ['PERMA {target} by {issuer}']
    }
  };
  const context = {
    module: { exports: {} },
    __dirname: path.join(__dirname, '../services'),
    require(name) {
      if (name === 'fs') return {
        readFileSync: () => JSON.stringify(state),
        mkdirSync() {},
        writeFileSync: (_file, value) => { state.records = JSON.parse(value).records; }
      };
      if (name === './voiceConfinementSettings') return {
        DEFAULT_PHRASES: settings.phrases,
        settingsStore: { load: () => settings }
      };
      if (name === 'discord.js') return { PermissionFlagsBits: { Administrator: 'Administrator', ManageRoles: 'ManageRoles', MoveMembers: 'MoveMembers' } };
      return require(name);
    },
    process: { env: {
      ENABLE_VOICE_CONFINEMENT: 'true',
      DISCORD_GUILD_ID: ids.guild,
      DISCORD_COMMAND_PREFIX: '!',
      VOICE_CONFINEMENT_CHANNEL_ID: ids.tummy,
      VOICE_CONFINEMENT_ROLE_ID: ids.role,
      VOICE_CONFINEMENT_DURATION_SECONDS: '300'
    } },
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Math
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/voiceConfinement.js'), 'utf8'), context);

  const confinementRole = { id: ids.role, name: 'Confined', editable: true, managed: false };
  const source = { id: ids.source, name: 'General Voice', isVoiceBased: () => true };
  const tummy = {
    id: ids.tummy,
    name: 'Tummy~Time',
    isVoiceBased: () => true,
    permissionsFor: () => ({ has: () => true }),
    send: async payload => tummyMessages.push(payload.content)
  };
  const text = { id: ids.text, isTextBased: () => true, send: async payload => announcements.push(payload.content) };
  const roles = new TestCollection([[ids.role, confinementRole]]);
  const members = new Map();
  const guild = {
    id: ids.guild,
    ownerId: '100000000000000099',
    roles: { cache: roles, fetch: async () => roles },
    channels: {
      cache: new Map([[ids.source, source], [ids.tummy, tummy], [ids.text, text]]),
      fetch: async id => guild.channels.cache.get(id) || null
    },
    members: {
      cache: members,
      me: { permissions: { has: () => true } },
      fetch: async id => members.get(id) || null,
      fetchMe: async () => guild.members.me
    }
  };

  function makeMember(id, name, channelId) {
    const cache = new TestCollection();
    const member = {
      id, displayName: name, user: { username: name, bot: false }, guild,
      manageable: true,
      permissions: { has: () => false },
      send: async payload => {
        const messages = directMessages.get(id) || [];
        messages.push(payload.content);
        directMessages.set(id, messages);
      },
      roles: {
        cache,
        add: async roleId => cache.set(roleId, roles.get(roleId)),
        remove: async roleId => {
          for (const idToRemove of Array.isArray(roleId) ? roleId : [roleId]) cache.delete(idToRemove);
        }
      },
      voice: {
        channelId,
        setChannel: async channel => { member.voice.channelId = typeof channel === 'string' ? channel : channel.id; },
        disconnect: async () => { member.voice.channelId = null; }
      }
    };
    members.set(id, member);
    return member;
  }

  const issuer = makeMember(ids.issuer, 'Issuer', ids.source);
  const otherIssuer = makeMember(ids.otherIssuer, 'Other', ids.source);
  const first = makeMember(ids.first, 'First', ids.source);
  const second = makeMember(ids.second, 'Second', ids.source);
  const client = {
    isReady: () => true,
    guilds: { cache: new Map([[ids.guild, guild]]), fetch: async id => id === ids.guild ? guild : null },
    channels: { cache: guild.channels.cache, fetch: guild.channels.fetch }
  };

  function message(author, content, mentioned = []) {
    return {
      guild, member: author, author: author.user, content,
      channelId: ids.text, channel: text,
      mentions: {
        members: new TestCollection(mentioned.map(member => [member.id, member])),
        users: new TestCollection(mentioned.map(member => [member.id, member.user]))
      },
      reply: async payload => replies.push(payload.content)
    };
  }

  return { api: context.module.exports, ids, state, replies, announcements, tummyMessages, directMessages, issuer, otherIssuer, first, second, client, message };
}

test('!eat confines every mentioned member and records the issuer and response channel', async () => {
  const fixture = createFixture();
  await fixture.api.handleVoiceConfinementMessage(
    fixture.message(fixture.issuer, '!eat @First @Second', [fixture.first, fixture.second])
  );

  assert.equal(fixture.api.getVoiceConfinementStatus().records.length, 2);
  assert.equal(fixture.first.voice.channelId, fixture.ids.tummy);
  assert.equal(fixture.second.voice.channelId, fixture.ids.tummy);
  assert.match(fixture.replies[0], /EAT Issuer -> First/);
  assert.match(fixture.replies[0], /EAT Issuer -> Second/);
  for (const record of Object.values(fixture.state.records)) {
    assert.equal(record.issuerId, fixture.ids.issuer);
    assert.equal(record.responseChannelId, fixture.ids.text);
  }
});

test('!eat accepts equivalent seconds and minutes duration overrides', async () => {
  for (const duration of ['60s', '1m']) {
    const fixture = createFixture();
    await fixture.api.handleVoiceConfinementMessage(
      fixture.message(fixture.issuer, `!eat @First ${duration}`, [fixture.first])
    );

    const record = Object.values(fixture.state.records)[0];
    assert.equal(record.durationSeconds, 60);
    assert.equal(record.releaseAt - record.startedAt, 60000);
    assert.match(fixture.replies[0], /for 1 minute/);
    assert.deepEqual(fixture.directMessages.get(fixture.ids.first), [fixture.tummyMessages[0]]);
    assert.match(fixture.tummyMessages[0], /Issuer ate you/);
    assert.match(fixture.tummyMessages[0], /1 minute/);
  }
});

test('!eat sends every target the same DM and Tummy~Time voice-chat notice', async () => {
  const fixture = createFixture();
  await fixture.api.handleVoiceConfinementMessage(
    fixture.message(fixture.issuer, '!eat @First @Second 90s', [fixture.first, fixture.second])
  );

  assert.equal(fixture.tummyMessages.length, 2);
  assert.deepEqual(fixture.directMessages.get(fixture.ids.first), [fixture.tummyMessages[0]]);
  assert.deepEqual(fixture.directMessages.get(fixture.ids.second), [fixture.tummyMessages[1]]);
  assert.match(fixture.tummyMessages[0], /<@100000000000000004>/);
  assert.match(fixture.tummyMessages[0], /90 seconds/);
  assert.match(fixture.tummyMessages[1], /<@100000000000000005>/);
  assert.match(fixture.tummyMessages[1], /90 seconds/);
});

test('!eat applies one duration override to every mentioned member', async () => {
  const fixture = createFixture();
  await fixture.api.handleVoiceConfinementMessage(
    fixture.message(fixture.issuer, '!eat @First @Second 90s', [fixture.first, fixture.second])
  );

  assert.deepEqual(
    Object.values(fixture.state.records).map((record) => record.durationSeconds),
    [90, 90]
  );
});

test('!eat rejects invalid duration overrides without confining anyone', async () => {
  const fixture = createFixture();
  await fixture.api.handleVoiceConfinementMessage(
    fixture.message(fixture.issuer, '!eat @First 0s', [fixture.first])
  );

  assert.equal(Object.keys(fixture.state.records).length, 0);
  assert.equal(fixture.first.voice.channelId, fixture.ids.source);
  assert.match(fixture.replies[0], /between 1s and 1440m/);
});

test('only the original issuer can release their targets with !vomit or !release', async () => {
  const fixture = createFixture();
  await fixture.api.handleVoiceConfinementMessage(
    fixture.message(fixture.issuer, '!eat @First @Second', [fixture.first, fixture.second])
  );
  fixture.api.startVoiceConfinement(fixture.client);

  await fixture.api.handleVoiceConfinementMessage(fixture.message(fixture.otherIssuer, '!release'));
  assert.equal(fixture.api.getVoiceConfinementStatus().records.length, 2);
  assert.match(fixture.replies.at(-1), /do not currently have anyone/);

  await fixture.api.handleVoiceConfinementMessage(fixture.message(fixture.issuer, '!vomit'));
  assert.equal(fixture.api.getVoiceConfinementStatus().records.length, 0);
  assert.equal(fixture.first.voice.channelId, fixture.ids.source);
  assert.equal(fixture.second.voice.channelId, fixture.ids.source);
  assert.equal(fixture.announcements.length, 2);
  assert.match(fixture.announcements.join('\n'), /OUT First/);
  assert.match(fixture.announcements.join('\n'), /OUT Second/);
});

test('release uses the permanent phrase when the target already left Tummy~Time', async () => {
  const fixture = createFixture();
  await fixture.api.handleVoiceConfinementMessage(
    fixture.message(fixture.issuer, '!eat @First', [fixture.first])
  );
  fixture.api.startVoiceConfinement(fixture.client);
  fixture.first.voice.channelId = null;

  await fixture.api.handleVoiceConfinementMessage(fixture.message(fixture.issuer, '!release'));
  assert.equal(fixture.api.getVoiceConfinementStatus().records.length, 0);
  assert.deepEqual(fixture.announcements, ['PERMA First by Issuer']);
});
