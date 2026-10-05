const { test } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('../../public/widgets/custom-chat/socket');
test('direct client uses localhost and forwards chat and immediate moderation deletion', async () => {
 let socket;
 class FakeSocket extends EventTarget {
  constructor(url) { super(); assert.equal(url, 'ws://127.0.0.1:8080/'); this.readyState = 1; socket = this; }
  send(raw) { this.subscription = JSON.parse(raw); }
  close() {}
  packet(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
 }
 const received = [], statuses = [];
 const stop = start((type, data) => received.push({ type, data }), status => statuses.push(status), FakeSocket);
 try {
  socket.dispatchEvent(new Event('open'));
  socket.packet({request:'Hello'});
  assert.equal(socket.subscription.request, 'Subscribe');
  socket.packet({id:'custom-chat',status:'ok'});
  socket.packet({event:{source:'Twitch',type:'ChatMessage'},data:{message:{msgId:'one',displayName:'Viewer',message:'Hello'}}});
  socket.packet({event:{source:'Twitch',type:'ChatMessageDeleted'},data:{targetMessageId:'one'}});
  assert.deepEqual(received.map(x=>x.type), ['message','remove']);
  assert.equal(received[1].data.id, 'one');
  assert.ok(statuses.includes('Connected to local Streamer.bot'));
 } finally { stop(); }
});
