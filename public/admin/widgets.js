(() => {
  const el = id => document.getElementById(id);
  const editor = window.streamtoolsOverlayEditor;
  const builtins = [
    { slug: 'custom-chat', name: 'Custom Chat', url: '/widgets/custom-chat/', description: 'Comic speech bubbles that alternate left and right, with a live chat connection and an isolated sample preview.' },
    { slug: 'pishock', name: 'PiShock Status', url: '/widgets/pishock-status/', description: 'Connection status and activity display with multiple view modes.' },
    { slug: 'drawing', name: 'Drawing Slot Machine', url: '/widgets/drawing-slot-machine/', description: 'Drawing prompt slot machine. Use its built-in controls to operate it.' },
    { slug: 'code-break', name: 'Code Break Protocol', url: '/widgets/chat-games/apps/code-break-protocol/', description: 'Chat game overlay with optional on-screen controls.' },
    { slug: 'emote-sync', name: 'Emote Sync Protocol', url: '/widgets/chat-games/apps/emote-sync-protocol/', description: 'Emote chat game with optional on-screen controls.' }
  ].map(item => ({ ...item, kind: 'widget' }));
  let items = [...builtins];
  let selected = null;
  let initialized = false;
  let requestId = 0;
  function renderList() {
    const search = el('widgetSearch').value.trim().toLowerCase();
    const filter = el('widgetFilter').value;
    const list = el('widgetList');
    list.replaceChildren();
    const matches = items.filter(item => (filter === 'all' || item.kind === filter) && item.name.toLowerCase().includes(search));
    for (const item of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'widget-library-item';
      button.classList.toggle('active', selected?.slug === item.slug && selected?.kind === item.kind);
      button.setAttribute('aria-pressed', String(selected?.slug === item.slug && selected?.kind === item.kind));
      button.textContent = item.name;
      button.addEventListener('click', () => select(item));
      list.append(button);
    }
    if (!matches.length) list.textContent = 'No matching items.';
  }
  async function loadLibrary(preferredSlug) {
    const id = ++requestId;
    el('widgetLibraryStatus').textContent = 'Loading overlays...';
    try {
      const token = el('tokenInput').value.trim();
      const response = await fetch('/api/overlays/purchased', { cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load overlays.');
      if (id !== requestId) return;
      items = [...builtins, ...data.overlays.map(item => ({ ...item, kind: 'overlay', description: 'Customize appearance and behavior, preview sample events, and save the live configuration.' }))];
      el('widgetLibraryStatus').textContent = `${items.length} items available`;
      renderList();
      if (preferredSlug) select(items.find(item => item.slug === preferredSlug && item.kind === 'overlay'));
    } catch (error) {
      if (id !== requestId) return;
      el('widgetLibraryStatus').textContent = `${error.message} Enter your bearer token above and refresh. Built-in widgets remain available.`;
      renderList();
    }
  }
  function updateUrl() {
    if (!selected) return;
    const url = new URL(selected.url, location.origin);
    el('widgetOptions').querySelectorAll('[data-param]').forEach(input => {
      if (input.type === 'checkbox') url.searchParams.set(input.dataset.param, String(input.checked));
      else if (input.value) url.searchParams.set(input.dataset.param, input.value);
    });
    el('widgetUrl').value = url.href;
    el('widgetOpen').href = url.href;
  }
  function option(labelText, param, values, initial) {
    const row = document.createElement('div'); row.className = 'field-row';
    const label = document.createElement('label'); label.textContent = labelText;
    const input = document.createElement(values ? 'select' : 'input');
    input.id = `widget-option-${param}`; label.htmlFor = input.id; input.dataset.param = param;
    if (values) { values.forEach(value => input.append(new Option(value || 'Default', value))); input.value = initial || ''; }
    else { input.type = 'checkbox'; input.checked = initial; }
    input.addEventListener('change', updateUrl); row.append(label, input); el('widgetOptions').append(row);
  }
  function select(item) {
    if (!item || !editor.canLeave() || !window.customChatEditor.canLeave()) return;
    window.customChatEditor.close();
    editor.clear(); selected = item;
    el('widgetTitle').textContent = item.name;
    el('widgetDescription').textContent = item.description;
    el('widgetActions').hidden = false;
    el('widgetEditor').hidden = item.kind !== 'overlay';
    el('widgetBuiltin').hidden = item.kind !== 'widget' || item.slug === 'custom-chat';
    el('widgetDimensions').textContent = item.kind === 'overlay' ? 'Default OBS canvas: 1920 × 1080. Match any canvas dimensions in the settings below.' : 'Use the browser-source dimensions recommended by the widget; resize in OBS as needed.';
    el('widgetOptions').replaceChildren();
    if (item.slug === 'pishock') {
      option('View mode', 'mode', ['', 'compact', 'mini', 'visual', 'console', 'radial', 'gauge', 'signals', 'viewer', 'ticker', 'stage']);
      option('Transparent background', 'transparent', null, false);
      option('Show boot animation', 'boot', null, true);
    } else if (['code-break', 'emote-sync'].includes(item.slug)) option('Show controls', 'controls', null, false);
    else if (item.kind === 'widget') el('widgetOptions').textContent = 'Open this widget to use its existing controls. No URL customization options are exposed here yet.';
    updateUrl(); renderList();
    if (item.kind === 'overlay') editor.open(item.slug);
    if (item.slug === 'custom-chat') { el('widgetDimensions').textContent = 'Suggested OBS browser source: 600 × 900; transparent background.'; window.customChatEditor.open(); }
  }
  el('widgetSearch').addEventListener('input', renderList);
  el('widgetFilter').addEventListener('change', renderList);
  el('widgetRefresh').addEventListener('click', () => loadLibrary());
  el('widgetNew').addEventListener('click', () => editor.create());
  el('widgetCopy').addEventListener('click', async () => {
    const input = el('widgetUrl');
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(input.value); copied = true; } catch {}
    }
    if (!copied) {
      // LAN HTTP pages cannot use the secure-context Clipboard API.
      input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
      try { copied = document.execCommand('copy'); } catch {}
    }
    if (copied) {
      el('widgetCopy').focus();
      el('widgetLibraryStatus').textContent = 'OBS URL copied.';
    } else {
      input.focus(); input.select();
      el('widgetLibraryStatus').textContent = 'Browser blocked clipboard access. URL selected; press Ctrl+C (Cmd+C on Mac) to copy.';
    }
  });
  document.addEventListener('widgets-open', () => { if (!initialized) { initialized = true; renderList(); loadLibrary(); } });
  document.addEventListener('widgets-left', () => { selected = null; el('widgetEditor').hidden = true; el('widgetBuiltin').hidden = true; el('widgetActions').hidden = true; el('widgetTitle').textContent = 'Choose a widget or overlay'; renderList(); });
  document.addEventListener('overlay-created', event => loadLibrary(event.detail));
})();
