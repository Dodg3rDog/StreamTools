(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChatSocket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
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
    id: String(m.msgId || m.messageId || m.eventId || m.id || ('local-' + Date.now() + '-' + Math.random().toString(36).slice(2))), platform,
    userId: String(m.userId || m.user?.id || m.channelId || ''),
    login: String(m.user?.login || m.username || m.userName || m.displayName || '').toLowerCase(),
    color: /^#[a-f0-9]{6}$/i.test(m.color || m.user?.color || '') ? (m.color || m.user.color) : '',
    name: String(m.displayName || m.user?.name || m.user?.login || m.userName || m.name || 'Viewer').slice(0, 100),
    text: text.slice(0, 2000), avatar: safeImage(m.profileImageUrl || m.profileImage || m.user?.profileImageUrl),
    emotes: (Array.isArray(m.emotes) ? m.emotes : []).slice(0, 100).map(e => ({ name: String(e.name || e.Name || ''), url: safeImage(e.imageUrl || e.ImageUrl || e.url) })).filter(e => e.name && e.url)
  } };
}

function start(receive, onStatus, Socket = WebSocket) {
  let socket, retry, fallback, stopped = false;
  function connect() {
    if (stopped) return;
    onStatus('Connecting to local Streamer.bot');
    const ws = socket = new Socket('ws://127.0.0.1:8080/');
    let subscribed = false;
    const subscribe = () => {
      if (subscribed || ws.readyState !== 1) return;
      subscribed = true;
      ws.send(JSON.stringify({ request: 'Subscribe', id: 'custom-chat', events: {
        Twitch: ['ChatMessage', 'ChatMessageDeleted', 'ChatCleared', 'UserBanned', 'UserTimedOut'],
        YouTube: ['Message', 'MessageDeleted', 'UserBanned'], General: ['Custom']
      }}));
    };
    ws.addEventListener('open', () => { fallback = setTimeout(subscribe, 300); });
    ws.addEventListener('message', event => {
      let packet; try { packet = JSON.parse(event.data); } catch { return; }
      if (packet.request === 'Hello') {
        clearTimeout(fallback);
        if (packet.authentication) { onStatus('Local Streamer.bot requires authentication; this connection needs setup.'); return; }
        subscribe(); return;
      }
      if (packet.id === 'custom-chat') { onStatus(packet.status === 'ok' ? 'Connected to local Streamer.bot' : 'Subscription rejected'); return; }
      if (packet.event?.source?.toLowerCase() === 'general' && packet.event?.type === 'Custom' && packet.data?.name === 'ClearChat') { receive('clear', {}); return; }
      const result = normalize(packet); if (result) receive(result.type, result.data);
    });
    ws.addEventListener('error', () => onStatus('Local Streamer.bot unavailable. Run this overlay on the Streamer.bot PC.'));
    ws.addEventListener('close', () => { clearTimeout(fallback); if (!stopped) { onStatus('Disconnected; retrying local Streamer.bot'); retry = setTimeout(connect, 5000); } });
  }
  connect();
  return () => { stopped = true; clearTimeout(retry); clearTimeout(fallback); socket?.close(); };
}
return { normalize, start };
});
