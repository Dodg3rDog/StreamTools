(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChatAvatars = api.create();
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function create(request = fetch, now = Date.now) {
    const cache = new Map();
    return { async get(login) {
      if (typeof login !== 'string' || !/^[a-z0-9_]{1,25}$/i.test(login)) return '';
      const key = login.toLowerCase();
      const entry = cache.get(key);
      if (entry && entry.expires > now()) return entry.promise;
      const next = { expires: now() + 15000 };
      next.promise = (async () => {
        try {
          const response = await request('https://decapi.me/twitch/avatar/' + encodeURIComponent(key), { signal: AbortSignal.timeout(5000), referrerPolicy: 'no-referrer' });
          if (!response.ok) throw new Error('Avatar unavailable');
          const url = new URL((await response.text()).trim());
          if (url.protocol !== 'https:') throw new Error('Invalid avatar URL');
          next.expires = now() + 15 * 60 * 1000;
          return url.href;
        } catch { next.expires = now() + 60000; return ''; }
      })();
      cache.delete(key); cache.set(key, next);
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return next.promise;
    } };
  }
  return { create };
});
