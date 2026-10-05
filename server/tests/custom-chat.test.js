const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Conversation, validate } = require('../../public/widgets/custom-chat/model');
const { normalize } = require('../services/customChat');
const message = (id, extra = {}) => ({ id, name: 'Viewer', userId: 'one', text: 'Hello!', platform: 'twitch', ...extra });

test('ignored accounts match login or display name across every theme without consuming a turn', () => {
  for (const theme of ['comic', 'soft', 'audience']) {
    const chat = new Conversation(validate({ theme, ignoredUsers: [' @Dodg3r_Bot ', 'NightBot'] }));
    assert.equal(chat.add(message('bot', {login:'dodg3r_bot', name:'Different display name'})), null);
    assert.equal(chat.add(message('other', {name:'NIGHTBOT', platform:'youtube'})), null);
    assert.equal(chat.add(message('viewer', {login:'nightbot_fan'})).side, 'left');
    assert.equal(chat.messages.length, 1);
    chat.config = validate({theme, ignoredUsers:[]});
    assert.ok(chat.add(message('allowed', {login:'dodg3r_bot', userId:'bot'})));
  }
});
test('alternation survives deletion, expiration, and history limits', () => {
  const chat = new Conversation(validate({ maxMessages: 3, lifetime: 10 }));
  for (let i = 0; i < 4; i++) chat.add(message(String(i)), 1000 + i);
  assert.deepEqual(chat.messages.map(m => m.side), ['right', 'left', 'right']);
  chat.remove('2', 'twitch');
  assert.deepEqual(chat.messages.map(m => m.side), ['right', 'right']);
  assert.equal(chat.add(message('4'), 1005).side, 'left');
  chat.prune(20000); assert.equal(chat.messages.length, 0);
});
test('filters do not consume sides; speaker mode keeps consecutive speakers together', () => {
  const chat = new Conversation(validate({ alternation: 'speaker', blockedWords: ['[bad]'], ignoredUsers: ['BOT'] }));
  assert.equal(chat.add(message('0', { text: '!command' })), null);
  assert.equal(chat.add(message('1', { name: 'bot' })), null);
  assert.equal(chat.add(message('2', { text: 'literal [bad] text' })), null);
  assert.equal(chat.add(message('3')).side, 'left');
  assert.equal(chat.add(message('4')).side, 'left');
  assert.equal(chat.add(message('5', { userId: 'two' })).side, 'right');
  assert.equal(chat.add(message('5')), null);
  chat.removeUser('one', 'twitch'); assert.equal(chat.messages.length, 1);
});
test('configuration rejects CSS injection and out-of-range values', () => {
  assert.throws(() => validate({ fontSize: 999 }));
  assert.throws(() => validate({ leftColor: 'red;display:none' }));
  assert.throws(() => validate({ ignoredUsers: 'bot' }));
});
test('normalizer handles old and current chat packets and malformed non-events', () => {
  assert.equal(normalize({ request: 'Hello' }), null);
  const old = normalize({ event: { source: 'Twitch', type: 'ChatMessage' }, data: { message: { msgId: 'a', displayName: 'A', message: '<script>unsafe</script>', userId: '1' } } });
  assert.equal(old.data.id, 'a'); assert.equal(old.data.text, '<script>unsafe</script>');
  const current = normalize({ event: { source: 'YouTube', type: 'Message' }, data: { id: 'b', message: 'Hi', user: { name: 'B', profileImageUrl: 'javascript:evil' } } });
  assert.equal(current.data.name, 'B'); assert.equal(current.data.avatar, '');
  assert.deepEqual(normalize({ event: { source: 'Twitch', type: 'ChatMessageDeleted' }, data: { messageId: 'a' } }), { type: 'remove', data: { id: 'a', platform: 'twitch' } });
});
