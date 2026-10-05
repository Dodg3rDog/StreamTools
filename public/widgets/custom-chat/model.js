(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChatModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const fields = {
    theme: ['Theme', 'select', 'comic', ['comic', 'soft', 'audience']],
    audiencePlacement: ['Audience: bubble placement', 'select', 'speaker', ['speaker', 'random']],
    crowdSize: ['Audience: maximum characters', 'number', 8, [1, 20]],
    startingCrowd: ['Audience: decorative starting crowd', 'number', 3, [0, 20]],
    characterHeight: ['Audience: character height (px)', 'number', 150, [60, 300]],
    crowdIdle: ['Audience: idle timeout (seconds; 0 = stay)', 'number', 900, [0, 7200]],
    silhouetteStyle: ['Audience: silhouettes', 'select', 'mixed', ['mixed', 'wolf', 'cat', 'rabbit', 'dragon']],
    audienceBubbleColor: ['Bubble color', 'color', '#fff5cf'],
    silhouetteColor: ['Audience: silhouette color', 'color', '#090909'],
    alternation: ['Conversation layout', 'select', 'message', ['message', 'speaker']],
    firstSide: ['First bubble side', 'select', 'left', ['left', 'right']],
    leftColor: ['Left bubble', 'color', '#fff5cf'], rightColor: ['Right bubble', 'color', '#d9f3ff'],
    inkColor: ['Ink / outline', 'color', '#171923'], textColor: ['Message text', 'color', '#171923'],
    fontFamily: ['Font', 'select', 'Trebuchet MS', ['Trebuchet MS', 'Arial', 'Verdana', 'Georgia', 'Comic Sans MS']],
    fontSize: ['Font size (px)', 'number', 26, [12, 64]],
    outline: ['Outline thickness (px)', 'number', 3, [0, 8]],
    bubbleWidth: ['Maximum bubble width (%)', 'number', 78, [40, 95]],
    gap: ['Message gap (px)', 'number', 18, [4, 60]],
    padding: ['Canvas margin (px)', 'number', 24, [12, 80]],
    tailSize: ['Speech tail size (px)', 'number', 16, [6, 28]],
    exitAnimation: ['Exit animation', 'select', 'fade', ['fade', 'slide', 'shrink', 'none']],
    exitDuration: ['Exit duration (milliseconds)', 'number', 600, [0, 5000]],
    maxMessages: ['Visible messages', 'number', 8, [1, 40]],
    lifetime: ['Message lifetime (seconds; 0 = until overflow)', 'number', 45, [0, 3600]],
    useTwitchColors: ['Use Twitch name colors', 'checkbox', true],
    showNames: ['Show names', 'checkbox', true], showAvatars: ['Show profile pictures', 'checkbox', true],
    showPlatform: ['Show platform', 'checkbox', true], showEmotes: ['Show emotes', 'checkbox', true],
    shadow: ['Comic shadow', 'checkbox', true], animation: ['Animate arrivals', 'checkbox', true],
    twitch: ['Twitch messages', 'checkbox', true], youtube: ['YouTube messages', 'checkbox', true],
    hideCommands: ['Hide !commands', 'checkbox', true],
    ignoredUsers: ['Ignored usernames (one per line)', 'list', []], blockedWords: ['Blocked words (literal, one per line)', 'list', []]
  };
  const defaults = Object.fromEntries(Object.entries(fields).map(([key, spec]) => [key, spec[2]]));
  function validate(input) {
    const result = {};
    for (const [key, [label, type, fallback, limits]] of Object.entries(fields)) {
      const value = input?.[key] ?? fallback;
      const valid = type === 'number' ? Number.isInteger(value) && value >= limits[0] && value <= limits[1]
        : type === 'checkbox' ? typeof value === 'boolean'
        : type === 'color' ? typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value)
        : type === 'select' ? limits.includes(value)
        : Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === 'string' && item.length <= 100);
      if (!valid) throw new Error(`Invalid ${label}.`);
      result[key] = type === 'list' ? value.map(item => item.trim()).filter(Boolean) : value;
    }
    return result;
  }
  function isIgnored(message, config) {
    const normalize = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
    const names = [message?.login, message?.name].map(normalize).filter(Boolean);
    return (config.ignoredUsers || []).some(user => names.includes(normalize(user)));
  }
  class Conversation {
    constructor(config = defaults) { this.config = config; this.clear(); }
    clear() { this.messages = []; this.emoteRuns = new Map(); this.lastSide = null; this.lastSpeaker = null; }
    add(message, now = Date.now()) {
      const c = this.config;
      if (!message || !message.id || !message.text || !['twitch', 'youtube'].includes(message.platform) || !c[message.platform]) return null;
      this.prune(now);
      if (this.messages.some(item => item.platform === message.platform && (item.parts || [item]).some(part => part.id === message.id))) return null;
      if (c.hideCommands && message.text.trim().startsWith('!')) return null;
      const name = String(message.name || 'Viewer');
      if (isIgnored(message, c)) return null;
      if (c.blockedWords.some(word => message.text.toLowerCase().includes(word.toLowerCase()))) return null;
      const speaker = `${message.platform}:${message.userId || name.toLowerCase()}`;
      const tokens = message.text.trim().split(/\s+/);
      const emoteNames = new Set((message.emotes || []).filter(e => /^https:\/\//i.test(e.url || '')).map(e => e.name));
      const repeatedEmote = tokens.length && tokens.every(token => token === tokens[0]) && emoteNames.has(tokens[0]) ? tokens[0] : null;
      const singleEmote = c.showEmotes && tokens.length === 1 && !!repeatedEmote;
      const run = this.emoteRuns.get(speaker);
      if (c.showEmotes && repeatedEmote && run === repeatedEmote) return null;
      this.emoteRuns.delete(speaker);
      if (singleEmote) this.emoteRuns.set(speaker, repeatedEmote);
      if (this.emoteRuns.size > 1000) this.emoteRuns.delete(this.emoteRuns.keys().next().value);
      const previous = this.messages.at(-1);
      if (c.theme === 'audience' && !singleEmote && previous && !previous.singleEmote && speaker === this.lastSpeaker && previous.speaker === speaker && previous.parts.length < 3 && previous.text.length + message.text.length < 4000) {
        previous.parts.push({...message, text:String(message.text).slice(0,2000)});
        previous.text = previous.parts.map(part => part.text).join('\n');
        previous.emotes = previous.parts.flatMap(part => part.emotes || []);
        previous.at = now; previous.revision = (previous.revision || 0) + 1;
        return previous;
      }
      const side = this.lastSide === null ? c.firstSide : c.alternation === 'speaker' && speaker === this.lastSpeaker ? this.lastSide : this.lastSide === 'left' ? 'right' : 'left';
      const entry = { ...message, name, text: String(message.text).slice(0, 2000), side, at: now, speaker, singleEmote, parts: [{...message, text:String(message.text).slice(0,2000)}] };
      this.lastSide = side; this.lastSpeaker = speaker;
      if (c.theme === 'audience') this.messages = this.messages.filter(item => item.speaker !== speaker);
      this.messages.push(entry); this.prune(now);
      return entry;
    }
    remove(id, platform) {
      for (const item of this.messages) {
        if ((platform && item.platform !== platform) || !item.parts.some(part => part.id === id)) continue;
        item.parts = item.parts.filter(part => part.id !== id);
        item.text = item.parts.map(part => part.text).join('\n');
        item.emotes = item.parts.flatMap(part => part.emotes || []);
        item.revision = (item.revision || 0) + 1;
      }
      this.messages = this.messages.filter(item => item.parts.length);
    }
    removeUser(userId, platform) { this.messages = this.messages.filter(item => !(item.userId === userId && item.platform === platform)); }
    prune(now = Date.now()) {
      this.messages = this.messages.filter(item => !this.config.lifetime || now - item.at < this.config.lifetime * 1000).slice(-this.config.maxMessages);
    }
  }
  return { fields, defaults, validate, isIgnored, Conversation };
});
