const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validate, defaults } = require('../../public/widgets/custom-chat/model');
const configPath = path.join(__dirname, '../data/custom-chat.json');
let saved;
const clients = new Set();
let socket, retry, status = 'Not connected', generation = 0;
function load() {
  if (saved) return saved;
  try { saved = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; saved = { appearance: { ...defaults }, websocketUrl: process.env.STREAMERBOT_WS_URL || '' }; }
  saved.appearance = validate(saved.appearance);
  return saved;
}
function broadcast(type, data) {
  const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) { if (!client.write(frame)) client.end(); }
}
function setStatus(value) { status = value; broadcast('connection', { status }); }
function safeImage(value) {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
function normalize(packet) {
  const platform = String(packet.event?.source || '').toLowerCase();
  const type = packet.event?.type;
  const d = packet.data || {};
  if (!['twitch', 'youtube'].includes(platform)) return null;
  if (['ChatMessageDeleted', 'MessageDeleted'].includes(type)) return { type: 'remove', data: { id: String(d.targetMessageId || d.messageId || d.id || ''), platform } };
  if (type === 'ChatCleared') return { type: 'clear', data: { platform } };
  if (['UserBanned', 'UserTimedOut'].includes(type)) return { type: 'remove-user', data: { userId: String(d.targetUser?.id || d.user?.id || d.userId || ''), platform } };
  if (!['ChatMessage', 'Message'].includes(type)) return null;
  const m = typeof d.message === 'object' ? d.message : d;
  const text = typeof m.message === 'string' ? m.message : typeof m.text === 'string' ? m.text : '';
  if (!text) return null;
  return { type: 'message', data: {
    id: String(m.msgId || m.messageId || m.eventId || m.id || crypto.randomUUID()), platform,
    userId: String(m.userId || m.user?.id || m.channelId || ''),
    login: String(m.user?.login || m.username || m.userName || m.displayName || '').toLowerCase(),
    name: String(m.displayName || m.user?.name || m.user?.login || m.userName || m.name || 'Viewer').slice(0, 100),
    text: text.slice(0, 2000), avatar: safeImage(m.profileImageUrl || m.profileImage || m.user?.profileImageUrl),
    emotes: (Array.isArray(m.emotes) ? m.emotes : []).slice(0, 100).map(e => ({ name: String(e.name || e.Name || ''), url: safeImage(e.imageUrl || e.ImageUrl || e.url) })).filter(e => e.name && e.url)
  } };
}
function connect() {
  clearTimeout(retry);
  const url = load().websocketUrl;
  const ownGeneration = ++generation;
  if (socket) socket.close();
  if (!url) { setStatus('Configure the Streamer.bot WebSocket address in Admin.'); return; }
  setStatus('Connecting');
  let ws;
  try { ws = socket = new WebSocket(url); } catch { setStatus('Invalid WebSocket address. Update it in Admin.'); return; }
  const send = data => { if (ws.readyState === 1) ws.send(JSON.stringify(data)); };
  let subscribed = false;
  const subscribe = () => {
    if (subscribed) return; subscribed = true;
    send({ request: 'Subscribe', id: 'chat-subscribe', events: { Twitch: ['ChatMessage', 'ChatMessageDeleted', 'ChatCleared', 'UserBanned', 'UserTimedOut'], YouTube: ['Message', 'MessageDeleted'] } });
  };
  let fallback;
  ws.addEventListener('open', () => { fallback = setTimeout(subscribe, 1500); });
  ws.addEventListener('message', event => {
    if (ownGeneration !== generation) return;
    let packet; try { packet = JSON.parse(event.data); } catch { return; }
    if (packet.request === 'Hello') {
      clearTimeout(fallback);
      if (packet.authentication) {
        if (!process.env.STREAMERBOT_WS_PASSWORD) { setStatus('Authentication required: configure STREAMERBOT_WS_PASSWORD on the server.'); ws.close(); return; }
        const { salt, challenge } = packet.authentication;
        const hash = value => crypto.createHash('sha256').update(value).digest('base64');
        send({ request: 'Authenticate', id: 'chat-auth', authentication: hash(hash(process.env.STREAMERBOT_WS_PASSWORD + salt) + challenge) });
      } else subscribe();
      return;
    }
    if (packet.id === 'chat-auth') { if (packet.status === 'ok') subscribe(); else { setStatus('Streamer.bot authentication failed.'); ws.close(); } return; }
    if (packet.id === 'chat-subscribe') { setStatus(packet.status === 'ok' ? 'Connected' : 'Chat subscription rejected'); return; }
    const normalized = normalize(packet); if (normalized) broadcast(normalized.type, normalized.data);
  });
  ws.addEventListener('error', () => { if (ownGeneration === generation) setStatus('Connection failed; check the WebSocket address and Streamer.bot server.'); });
  ws.addEventListener('close', () => { clearTimeout(fallback); if (ownGeneration === generation) { if (status === 'Connected') setStatus('Disconnected; reconnecting'); retry = setTimeout(connect, 10000); retry.unref?.(); } });
}
function save(input) {
  const appearance = validate(input.appearance);
  const websocketUrl = String(input.websocketUrl || '').trim();
  if (websocketUrl) {
    const url = new URL(websocketUrl);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Use a ws:// or wss:// address without embedded credentials.');
  }
  const previousUrl = load().websocketUrl;
  const next = { appearance, websocketUrl };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath + '.tmp', JSON.stringify(next, null, 2));
  fs.renameSync(configPath + '.tmp', configPath); saved = next;
  broadcast('config', appearance);
  if (previousUrl !== websocketUrl) connect();
  return next;
}
function attach(req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders(); clients.add(res);
  res.write(`event: config\ndata: ${JSON.stringify(load().appearance)}\n\n`);
  if (!socket && !retry) connect();
  res.write(`event: connection\ndata: ${JSON.stringify({ status })}\n\n`);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => { clients.delete(res); clearInterval(heartbeat); });
}
module.exports = { load, save, attach, connect, normalize, getStatus: () => status };
