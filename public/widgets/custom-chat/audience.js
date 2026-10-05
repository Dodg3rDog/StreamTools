(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChatAudience = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function hash(text) { let value = 0; for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0; return value; }
  class Crowd {
    constructor() { this.slots = []; this.seed = Math.random(); }
    sync(config, now = Date.now()) {
      this.slots = this.slots.filter(slot => slot.index < config.crowdSize && (!slot.user || !config.crowdIdle || now - slot.seen < config.crowdIdle * 1000));
      for (let i = 0; this.slots.length < Math.min(config.startingCrowd, config.crowdSize) && i < config.crowdSize; i++) {
        if (!this.slots.some(slot => slot.index === i)) this.slots.push({ index: i, user: '', seen: now, variant: i % 4 });
      }
    }
    position(slot, width, config) {
      // Shuffle seats across the full canvas, with a small random offset per seat.
      const order = Array.from({length:config.crowdSize}, (_,i)=>i);
      // Mix the index before hashing so adjacent seats do not keep their order.
      order.sort((a,b)=>Math.sin((a+1)*127.1+this.seed*1000)-Math.sin((b+1)*127.1+this.seed*1000));
      const cell = width / config.crowdSize;
      const jitter = Math.sin(slot.index*311.7+this.seed*100) * .1;
      const size = Math.min(config.characterHeight * .85, cell * 1.1);
      const x = (order.indexOf(slot.index)+.5+jitter)*cell;
      return {x:Math.max(size/2,Math.min(width-size/2,x)),size};
    }
    touch(message, config, now = Date.now()) {
      this.sync(config, now);
      const user = message.platform + ':' + (message.userId || message.name.toLowerCase());
      let slot = this.slots.find(slot => slot.user === user);
      if (!slot) {
        slot = this.slots.find(slot => !slot.user);
        if (!slot && this.slots.length < config.crowdSize) {
          const index = Array.from({ length: config.crowdSize }, (_, i) => i).find(i => !this.slots.some(slot => slot.index === i));
          slot = { index }; this.slots.push(slot);
        }
        if (!slot) slot = [...this.slots].sort((a, b) => a.seen - b.seen)[0];
        slot.user = user; slot.variant = hash(user) % 4;
      }
      slot.login = String(message.login || message.name || '').toLowerCase(); slot.twitchUserId = message.platform === 'twitch' ? String(message.userId || '') : '';
      slot.name = message.name;
      slot.seen = now;
      return slot.index;
    }
    choose(message, config) {
      const own = this.slots.find(slot => slot.user === message.platform + ':' + (message.userId || message.name.toLowerCase()));
      if (ownedAsset(own)) return own.index;
      const generic = this.slots.filter(slot => !ownedAsset(slot));
      if (config.audiencePlacement === 'random' && generic.length) return generic[hash(message.id) % generic.length].index;
      return own?.index;
    }
  }
  // Original vector silhouettes: wolf, cat, rabbit, and horned dragon.
  const shapes = [
    'M12 180 Q10 137 48 127 L42 112 28 106 43 95 34 86 49 79 43 15 72 47 91 41 111 7 119 70 133 83 149 91 135 107 119 110 114 128 Q148 135 155 180Z',
    'M13 180 Q17 139 49 130 L51 113 Q30 103 35 75 L32 23 67 48 Q84 42 102 48 L137 21 131 78 Q141 103 116 116 L120 131 Q151 139 153 180Z',
    'M17 180 Q17 142 51 132 L57 115 Q37 105 42 82 L55 70 Q34 9 51 3 Q72 -1 78 67 L94 66 Q95 4 113 2 Q139 5 115 76 Q140 101 113 117 L119 133 Q151 146 150 180Z',
    'M10 180 Q17 139 46 128 L43 114 28 104 43 96 32 84 49 79 Q48 63 60 54 L49 14 76 39 92 38 112 5 111 54 126 66 149 77 143 93 120 103 117 126 Q151 141 157 180Z'
  ];
  let library = ['wolf','cat','rabbit','dragon'].map(id => ({id,enabled:true,builtin:true}));
  function setLibrary(items) { library = items; }
  function ownedAsset(slot) {
    if(!slot?.user?.startsWith('twitch:')) return null;
    return library.find(item => item.enabled && item.twitchLogin && (item.twitchUserId ? item.twitchUserId === slot.twitchUserId : item.twitchLogin === slot.login));
  }
  function renderCrowd(layer, crowd, config) {
    layer.replaceChildren();
    layer.style.height = config.characterHeight + 'px';
    layer.style.color = config.silhouetteColor;
    const kinds = ['wolf', 'cat', 'rabbit', 'dragon'];
    for (const slot of crowd.slots) {
      const figure = document.createElement('div'); figure.className = 'audience-character';
      const position = crowd.position(slot, layer.clientWidth, config);
      figure.style.left = position.x + 'px';
      figure.style.height = `${85 + (slot.variant % 3) * 7}%`;
      figure.style.width = position.size + 'px';
      const available = library.filter(item => item.enabled && !item.twitchLogin && (config.silhouetteStyle === 'mixed' || item.id === config.silhouetteStyle));
      const asset = ownedAsset(slot) || available[hash(slot.user || String(slot.index)) % available.length];
      if (!asset) continue;
      if (asset.twitchLogin) {
        const img = document.createElement('img'); img.src = '/api/custom-chat/silhouettes/' + asset.id + '.png'; img.alt = '';
        Object.assign(img.style,{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center bottom'});
        figure.append(img); layer.append(figure); continue;
      }
      if (!asset.builtin) {
        const mask = document.createElement('div');
        const url = '/api/custom-chat/silhouettes/' + asset.id + '.png';
        Object.assign(mask.style, {width:'100%',height:'100%',backgroundColor:'currentColor',mask: `url("${url}") center bottom / contain no-repeat`,webkitMask: `url("${url}") center bottom / contain no-repeat`});
        figure.append(mask); layer.append(figure); continue;
      }
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 170 180');
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', shapes[kinds.indexOf(asset.id)]);
      shape.setAttribute('fill', 'currentColor'); svg.append(shape); figure.append(svg); layer.append(figure);
    }
  }
  function layout(chat, nodes, messages, crowd, config) {
    const margin = Math.max(config.padding, 12), hidden = [];
    const width = chat.clientWidth, height = chat.clientHeight;
    for (const [index, message] of messages.entries()) {
      const key = message.platform + ':' + message.id, node = nodes.get(key);
      if (!node) continue;
      const seat = message.audienceSeat;
      if (!crowd.slots.some(slot => slot.index === seat)) { hidden.push(key); continue; }
      const anchor = crowd.position(crowd.slots.find(slot => slot.index === seat), width, config).x;
      node.style.position = 'absolute'; node.style.width = Math.max(80, Math.min(320, width * config.bubbleWidth / 100, width - margin * 2)) + 'px';
      node.style.maxHeight = Math.max(50, height - config.characterHeight - margin * 2 - 30) + 'px';
      node.style.overflow = 'visible';
      const bubbleWidth = node.offsetWidth, bubbleHeight = node.offsetHeight;
      const left = Math.max(margin, Math.min(anchor - bubbleWidth / 2, width - margin - bubbleWidth));
      const top = height - config.characterHeight - 18 - bubbleHeight;
      if (top < margin) { hidden.push(key); continue; }
      node.style.left = left + 'px'; node.style.top = top + 'px';
      node.style.setProperty('--anchor', Math.max(18, Math.min(bubbleWidth - 24, anchor - left)) + 'px');
      // Keep every bubble anchored to its character; newer bubbles cover older ones.
      node.style.zIndex = String(index + 2);
    }
    return hidden;
  }
  return { Crowd, renderCrowd, layout, setLibrary, ownedAsset };
});
