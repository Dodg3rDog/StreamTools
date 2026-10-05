(() => {
  const preview = new URLSearchParams(location.search).get('preview') === '1';
  const chat = document.getElementById('chat');
  const conversation = new ChatModel.Conversation();
  const crowd = new ChatAudience.Crowd();
  let crowdLayer;
  const nodes = new Map();
  const exits = new Map();
  function retire(key, node, immediate = false) {
    nodes.delete(key);
    if (immediate || config.exitAnimation === 'none' || !config.exitDuration || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { node.remove(); return; }
    // Freeze the old position while the remaining conversation reflows.
    const rect = node.getBoundingClientRect(), parentRect = chat.getBoundingClientRect();
    node.classList.remove('new');
    Object.assign(node.style, { position: 'absolute', left: `${rect.left - parentRect.left}px`, top: `${rect.top - parentRect.top}px`, width: `${rect.width}px`, margin: '0', pointerEvents: 'none' });
    node.classList.add('exiting');
    node.style.zIndex = '1';
    node.setAttribute('aria-hidden', 'true');
    const finish = () => { clearTimeout(timer); animation?.cancel(); node.remove(); exits.delete(key); };
    let animation;
    const timer = setTimeout(finish, config.exitDuration + 100);
    exits.set(key, { node, finish });
    const transform = config.exitAnimation === 'slide' ? `translateX(${node.dataset.side === 'left' ? '-' : ''}30px)` : config.exitAnimation === 'shrink' ? 'scale(0.8)' : 'none';
    animation = node.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform }], { duration: config.exitDuration, easing: 'ease-out', fill: 'forwards' });
    animation.onfinish = finish;
    // Bound transient nodes even during a large message burst.
    if (exits.size > 40) exits.values().next().value.finish();
  }
  function removeImmediately(predicate) {
    for (const [key, node] of nodes) if (predicate(node)) retire(key, node, true);
    for (const exit of [...exits.values()]) if (predicate(exit.node)) exit.finish();
  }
  let config = ChatModel.validate({});
  const imageUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  function apply(value) {
    try { config = ChatModel.validate(value); } catch { return; }
    conversation.config = config;
    conversation.messages = conversation.messages.filter(message => !ChatModel.isIgnored(message, config));
    crowd.slots = crowd.slots.filter(slot => !ChatModel.isIgnored(slot, config));
    const vars = { left: config.theme === 'audience' ? config.audienceBubbleColor : config.leftColor, right: config.theme === 'audience' ? config.audienceBubbleColor : config.rightColor, ink: config.inkColor, text: config.textColor, font: config.fontFamily, 'font-size': config.fontSize+'px', outline: config.outline+'px', width: config.bubbleWidth+'%', gap: config.gap+'px', padding: Math.max(config.padding, config.tailSize+8)+'px', tail: config.tailSize+'px' };
    for (const [key, value] of Object.entries(vars)) chat.style.setProperty('--'+key, value);
    chat.className = `${config.theme} ${config.shadow ? 'shadow' : ''} ${config.animation ? 'animate' : ''}`;
    for (const exit of [...exits.values()]) exit.finish();
    nodes.clear(); chat.replaceChildren();
    crowdLayer = null;
    if (config.theme === 'audience') {
      crowd.sync(config);
      for (const message of conversation.messages) { crowd.touch(message, config); message.audienceSeat = crowd.choose(message, config); }
      crowdLayer = document.createElement('div'); crowdLayer.className = 'audience-crowd'; crowdLayer.setAttribute('aria-hidden', 'true'); chat.append(crowdLayer);
    }
    render();
  }
  function create(message) {
    const bubble = document.createElement('article'); bubble.className = `bubble ${message.side} new`;
    bubble.dataset.side = message.side; bubble.dataset.revision = String(message.revision || 0);
    bubble.dataset.messageId = message.id; bubble.dataset.platform = message.platform; bubble.dataset.userId = message.userId || '';
    const header = document.createElement('header');
    if (config.showAvatars) {
      const holder = document.createElement('span'); holder.className = 'avatar avatar-placeholder';
      holder.textContent = message.name.slice(0, 1).toUpperCase(); holder.setAttribute('aria-hidden', 'true');
      header.append(holder);
      const showAvatar = url => {
        if (!imageUrl(url) || !holder.isConnected) return;
        const avatar = document.createElement('img'); avatar.className = 'avatar'; avatar.src = imageUrl(url); avatar.alt = ''; avatar.referrerPolicy = 'no-referrer';
        avatar.onload = () => { if (holder.isConnected) holder.replaceWith(avatar); };
      };
      // Render immediately; avatar loading must never reorder the conversation.
      Promise.resolve().then(() => {
        if (imageUrl(message.avatar)) showAvatar(message.avatar);
        else if (!preview && message.platform === 'twitch') ChatAvatars.get(message.login).then(showAvatar);
      });
    }
    if (config.showNames) {
      const name = document.createElement('span'); name.className = 'chatter-name'; name.textContent = message.name;
      if (config.useTwitchColors && message.platform === 'twitch' && /^#[a-f0-9]{6}$/i.test(message.color || '')) name.style.color = message.color;
      header.append(name);
    }
    if (config.showPlatform) { const platform = document.createElement('span'); platform.className = 'platform'; platform.textContent = message.platform; header.append(platform); }
    if (header.childNodes.length) bubble.append(header);
    const content = document.createElement('div'); content.className = message.singleEmote ? 'content single-emote' : 'content';
    const emotes = new Map((message.emotes || []).filter(item => imageUrl(item.url)).map(item => [item.name, item.url]));
    for (const part of message.text.split(/(\s+)/)) {
      if (config.showEmotes && emotes.has(part)) {
        const img = document.createElement('img'); img.className = 'emote'; img.alt = part; img.src = emotes.get(part); img.referrerPolicy = 'no-referrer'; img.onerror = () => img.replaceWith(document.createTextNode(part)); content.append(img);
      } else content.append(document.createTextNode(part));
    }
    bubble.append(content); bubble.addEventListener('animationend', () => bubble.classList.remove('new'), { once: true });
    return bubble;
  }
  function render() {
    conversation.prune();
    const keys = new Set(conversation.messages.map(message => message.platform+':'+message.id));
    for (const [key, node] of nodes) if (!keys.has(key)) { retire(key, node); }
    for (const message of conversation.messages) {
      const key = message.platform+':'+message.id;
      if (nodes.has(key) && nodes.get(key).dataset.revision !== String(message.revision || 0)) { const old = nodes.get(key); const replacement = create(message); replacement.classList.remove('new'); old.replaceWith(replacement); nodes.set(key, replacement); }
      if (!nodes.has(key)) { const node = create(message); nodes.set(key, node); chat.append(node); }
    }
    if (config.theme === 'audience') {
      crowd.sync(config);
      ChatAudience.renderCrowd(crowdLayer, crowd, config);
      const hidden = new Set(ChatAudience.layout(chat, nodes, conversation.messages, crowd, config));
      for (const key of hidden) { const node = nodes.get(key); if (node) retire(key, node, true); }
      conversation.messages = conversation.messages.filter(message => !hidden.has(message.platform + ':' + message.id));
      if (preview) parent.postMessage({ type: 'chat-preview-state', ids: conversation.messages.map(message => message.id) }, location.origin);
      return;
    }
    // Keep the most recent oversized message readable; remove older overflow.
    const contentHeight = () => [...nodes.values()].reduce((sum, node) => sum + node.offsetHeight, 0) + Math.max(0, nodes.size - 1) * config.gap + Math.max(config.padding, config.tailSize + 8) * 2;
    while (contentHeight() > chat.clientHeight && conversation.messages.length > 1) {
      const oldest = conversation.messages.shift(); const key = oldest.platform+':'+oldest.id;
      const node = nodes.get(key); if (node) retire(key, node);
    }
    const last = [...nodes.values()].at(-1);
    if (preview) parent.postMessage({ type: 'chat-preview-state', ids: conversation.messages.map(message => message.id) }, location.origin);
    if (last && last.offsetHeight > chat.clientHeight - config.padding * 2) { last.style.maxHeight = `calc(100% - ${config.padding * 2}px)`; last.style.overflow = 'hidden'; }
  }
  function receive(type, data) {
    if (type === 'remove') { const group = conversation.messages.find(item => (!data.platform || item.platform === data.platform) && item.parts.some(part => part.id === data.id)); if (group) removeImmediately(node => node.dataset.messageId === group.id && node.dataset.platform === group.platform); else removeImmediately(node => node.dataset.messageId === data.id && (!data.platform || node.dataset.platform === data.platform)); }
    if (type === 'remove-user') removeImmediately(node => node.dataset.userId === data.userId && node.dataset.platform === data.platform);
    if (type === 'clear') removeImmediately(node => !data?.platform || node.dataset.platform === data.platform);
    if (type === 'message') {
      const added = conversation.add(data);
      if (added && config.theme === 'audience') {
        crowd.touch(added, config); if (added.audienceSeat === undefined) added.audienceSeat = crowd.choose(added, config);
        // Keep separate speaking turns; layout stacks bubbles above their character.
      }
    }
    else if (type === 'remove') conversation.remove(data.id, data.platform);
    else if (type === 'remove-user') conversation.removeUser(data.userId, data.platform);
    else if (type === 'clear') { if (data?.platform) conversation.messages = conversation.messages.filter(item => item.platform !== data.platform); else conversation.clear(); }
    render();
  }
  async function refreshSilhouettes() {
    try { const response = await fetch('/api/custom-chat/silhouettes', {cache:'no-store'}); if(response.ok) { ChatAudience.setLibrary((await response.json()).items); render(); } } catch {}
  }
  refreshSilhouettes(); window.setInterval(refreshSilhouettes, 5000);
  apply(config);
  if (preview) {
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== parent) return;
      const { type, data } = event.data || {};
      if (type === 'chat-config') apply(data);
      if (['message', 'remove', 'clear'].includes(type)) receive(type, data);
    });
    parent.postMessage({ type: 'chat-preview-ready' }, location.origin);
  } else {
    let lastConfig = '';
    async function refreshConfig() {
      try {
        const response = await fetch('/api/custom-chat/config', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
        if (!response.ok) return;
        const data = await response.json(); const signature = JSON.stringify(data.appearance);
        if (signature !== lastConfig) { apply(data.appearance); lastConfig = signature; }
      } catch { /* Keep the last settings while the server restarts. */ }
    }
    refreshConfig().finally(() => {
      const stop = ChatSocket.start(receive, status => { document.title = `Custom Chat - ${status}`; });
      window.addEventListener('pagehide', stop, { once: true });
    });
    const poll = setInterval(refreshConfig, 5000);
    window.addEventListener('pagehide', () => clearInterval(poll), { once: true });
  }
  window.setInterval(render, 1000);
  window.addEventListener('resize', render);
})();
