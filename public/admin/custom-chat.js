(() => {
  const el = id => document.getElementById(id);
  const form = el('chatSettingsForm');
  let saved, dirty = false, busy = false, ready = false, sequence = 0, generation = 0;
  const sampleIds = [];
  for (const [key, [label, type, fallback, limits]] of Object.entries(ChatModel.fields)) {
    const row = document.createElement('div'); row.className = 'field-row';
    const caption = document.createElement('label'); caption.htmlFor = 'chat-'+key; caption.textContent = label;
    const input = document.createElement(type === 'list' ? 'textarea' : type === 'select' ? 'select' : 'input'); input.id = 'chat-'+key; input.name = key;
    if (type === 'select') limits.forEach(value => input.append(new Option(({ audience: 'Audience silhouettes', random: 'Random character', mixed: 'Mixed furry crowd', wolf: 'Wolf', cat: 'Cat', rabbit: 'Rabbit', dragon: 'Dragon', fade: 'Fade out', slide: 'Fade and slide', shrink: 'Fade and shrink', none: 'None (instant)', comic: 'Comic book', soft: 'Soft bubbles', message: 'Alternate every message', speaker: key === 'audiencePlacement' ? 'Speaker’s character' : 'Switch when speaker changes', left: 'Left', right: 'Right' })[value] || value, value)));
    else if (type !== 'list') input.type = type;
    if (type === 'number') { input.min = limits[0]; input.max = limits[1]; input.step = 1; input.required = true; }
    row.append(caption, input); if (key.startsWith('crowd') || ['audienceBubbleColor','audiencePlacement','startingCrowd','characterHeight','silhouetteStyle','silhouetteColor'].includes(key)) row.dataset.audienceSetting = 'true';
    if (key === 'ignoredUsers') {
      const group = document.createElement('fieldset'); group.style.gridColumn = '1 / -1';
      const heading = document.createElement('legend'); heading.textContent = 'Ignored users — all chat themes';
      const help = document.createElement('p'); help.id = 'chat-ignore-help'; help.textContent = 'Add one account username per line, with or without @. Matching ignores capitalization. These users will not create messages or audience characters in any theme. Save chat settings to apply; remove a name to allow future messages again.';
      input.rows = 4; input.placeholder = 'dodg3r_bot\nnightbot\nstreamelements'; input.setAttribute('aria-describedby', help.id);
      group.append(heading, help, row); form.prepend(group);
    } else form.append(row);
  }
  const libraryPanel = document.createElement('section');
  libraryPanel.className='editor-panel silhouette-library'; libraryPanel.hidden=true;
  const libraryHeading = document.createElement('h3'); libraryHeading.textContent = 'Silhouette library';
  const libraryHelp = document.createElement('p'); libraryHelp.textContent = 'Transparent PNG, up to 2 MB and 2048 x 2048. Mixed furry crowd uses enabled general silhouettes. A Twitch login reserves the image for that viewer, displays its original colors, and replaces their previous assignment. Library changes apply immediately; disabling keeps an upload available for later.';
  const upload = document.createElement('input'); upload.type = 'file'; upload.accept = 'image/png'; upload.setAttribute('aria-label','Upload silhouette PNG');
  const uploadOwner = document.createElement('input'); uploadOwner.placeholder = 'Twitch login (optional; viewer-only image)'; uploadOwner.setAttribute('aria-label','Twitch login for new silhouette');
  const libraryStatus = document.createElement('p'); libraryStatus.setAttribute('role','status');
  const libraryRows = document.createElement('div');
  const layout=el('customChatEditor').querySelector('.custom-chat-layout');
  const openLibrary=document.createElement('button');openLibrary.type='button';openLibrary.textContent='Manage silhouette library';layout.before(openLibrary);layout.after(libraryPanel);
  const back=document.createElement('button');back.type='button';back.textContent='Back to chat settings';
  openLibrary.onclick=()=>{layout.hidden=true;libraryPanel.hidden=false;openLibrary.hidden=true;loadLibrary();search.focus();};
  back.onclick=()=>{libraryPanel.hidden=true;layout.hidden=false;openLibrary.hidden=false;openLibrary.focus();};
  const controls=document.createElement('div');controls.className='silhouette-controls';
  function control(text,input){const label=document.createElement('label');label.textContent=text;label.append(input);controls.append(label);return input;}
  const search=control('Search',document.createElement('input'));search.type='search';search.placeholder='Name, Twitch viewer, or species';
  function select(text,options){const input=control(text,document.createElement('select'));for(const [value,label] of options)input.add(new Option(label,value));return input;}
  const filter=select('Collection',[['all','All silhouettes'],['default','Defaults'],['general','General uploads'],['viewer','Viewer Chatsonas']]);
  const state=select('Status',[['all','All'],['enabled','Enabled'],['disabled','Disabled']]);
  const view=select('View',[['tiles','Tiles'],['list','List']]);
  const size=control('Thumbnail size',document.createElement('input'));size.type='range';size.min=140;size.max=300;size.step=10;size.value=190;
  try{view.value=localStorage.getItem('silhouette-view')==='list'?'list':'tiles';size.value=localStorage.getItem('silhouette-size')||190;}catch{}
  const paging=document.createElement('div');paging.className='widget-actions';
  const previous=document.createElement('button'),next=document.createElement('button'),count=document.createElement('span');previous.type=next.type='button';previous.textContent='Previous';next.textContent='Next';count.setAttribute('role','status');paging.append(previous,count,next);
  let libraryItems=[],page=0;
  previous.onclick=()=>{page--;renderLibrary();};next.onclick=()=>{page++;renderLibrary();};
  for(const input of [search,filter,state])input.addEventListener('input',()=>{page=0;renderLibrary();});
  function appearance(){libraryRows.dataset.view=view.value;libraryRows.style.setProperty('--thumb-size',size.value+'px');try{localStorage.setItem('silhouette-view',view.value);localStorage.setItem('silhouette-size',size.value);}catch{}}
  view.onchange=appearance;size.oninput=appearance;libraryRows.className='silhouette-results';appearance();
  libraryPanel.append(back,libraryHeading,libraryHelp,uploadOwner,upload,controls,libraryStatus,libraryRows,paging);
  function showLibrary(items) {
    libraryItems=items;renderLibrary();
  }
  function renderLibrary(){
    libraryRows.replaceChildren();const query=search.value.trim().toLowerCase();
    const items=libraryItems.filter(item=>[item.name,item.twitchLogin,item.twitchUserId,item.species,item.builtin?item.id:''].join(' ').toLowerCase().includes(query))
      .filter(item=>filter.value==='all'||(filter.value==='default'?item.builtin:filter.value==='viewer'?!!item.twitchLogin:!item.builtin&&!item.twitchLogin))
      .filter(item=>state.value==='all'||item.enabled===(state.value==='enabled'));
    const pages=Math.max(1,Math.ceil(items.length/12));page=Math.max(0,Math.min(page,pages-1));count.textContent=items.length+' results - Page '+(page+1)+' of '+pages;previous.disabled=page===0;next.disabled=page===pages-1;
    if(!items.length){const empty=document.createElement('p');empty.textContent='No silhouettes match your search.';libraryRows.append(empty);}
    for(const item of items.slice(page*12,page*12+12)){
      const row = document.createElement('div'); row.className = 'silhouette-card';
      if (!item.builtin) { const image = document.createElement('img'); image.src = '/api/custom-chat/silhouettes/'+item.id+'.png'; image.alt = item.name; image.className='silhouette-thumbnail';image.loading='lazy'; row.append(image); }
      else {const paths=[
    'M12 180 Q10 137 48 127 L42 112 28 106 43 95 34 86 49 79 43 15 72 47 91 41 111 7 119 70 133 83 149 91 135 107 119 110 114 128 Q148 135 155 180Z',
    'M13 180 Q17 139 49 130 L51 113 Q30 103 35 75 L32 23 67 48 Q84 42 102 48 L137 21 131 78 Q141 103 116 116 L120 131 Q151 139 153 180Z',
    'M17 180 Q17 142 51 132 L57 115 Q37 105 42 82 L55 70 Q34 9 51 3 Q72 -1 78 67 L94 66 Q95 4 113 2 Q139 5 115 76 Q140 101 113 117 L119 133 Q151 146 150 180Z',
    'M10 180 Q17 139 46 128 L43 114 28 104 43 96 32 84 49 79 Q48 63 60 54 L49 14 76 39 92 38 112 5 111 54 126 66 149 77 143 93 120 103 117 126 Q151 141 157 180Z'
];const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 170 180');svg.setAttribute('role','img');svg.setAttribute('aria-label',item.name);svg.classList.add('silhouette-thumbnail');const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',paths[['wolf','cat','rabbit','dragon'].indexOf(item.id)]||paths[0]);shape.setAttribute('fill','currentColor');svg.append(shape);row.append(svg);}
      const details=document.createElement('div');details.className='silhouette-details';const kind=document.createElement('strong');kind.textContent=item.builtin?'Default':item.twitchLogin?'Viewer Chatsona':'General upload';details.append(kind);
      const species=document.createElement('input');species.value=item.species||(item.builtin?item.id:'');species.maxLength=80;species.placeholder='Species (e.g. wolf, fox)';species.setAttribute('aria-label','Species for '+item.name);
      const name = document.createElement('input'); name.value = item.name; name.maxLength = 80; name.setAttribute('aria-label','Silhouette name: '+item.name);
      const owner = document.createElement('input'); owner.value = item.twitchLogin || ''; owner.placeholder = 'Twitch login (blank = general crowd)'; owner.setAttribute('aria-label','Twitch owner for '+item.name); owner.disabled = item.builtin;
      const label = document.createElement('label'); const enabled = document.createElement('input'); enabled.type='checkbox'; enabled.checked=item.enabled; label.append(enabled, document.createTextNode(' Enabled'));
      const save = document.createElement('button'); save.type='button'; save.textContent='Update silhouette';
      save.addEventListener('click',async () => { save.disabled=true; try { const data=await apiRequest('/api/custom-chat/silhouettes/'+item.id,{method:'PUT',auth:true,body:JSON.stringify({name:name.value,species:species.value,enabled:enabled.checked,twitchLogin:owner.value,twitchUserId:owner.value.trim().toLowerCase() === item.twitchLogin ? item.twitchUserId : ''})}); showLibrary(data.items); libraryStatus.textContent='Silhouette updated.'; } catch(error) { libraryStatus.textContent=error.message; } finally { save.disabled=false; } });
      details.append(name,species,owner,label,save);row.append(details); libraryRows.append(row);
      if (!item.builtin) {
        const remove=document.createElement('button'); remove.type='button'; remove.textContent='Delete image';
        remove.setAttribute('aria-label','Delete image: '+item.name);
        remove.addEventListener('click',async()=>{
          if(!window.confirm('Delete "'+item.name+'"'+(item.twitchLogin?' for '+item.twitchLogin:'')+' from the library? This removes its image and viewer assignment and cannot be undone here. Submission audit records are retained.')) return;
          remove.disabled=true; save.disabled=true;
          try { const data=await apiRequest('/api/custom-chat/silhouettes/'+item.id,{method:'DELETE',auth:true}); showLibrary(data.items); libraryStatus.textContent='Image deleted.'; }
          catch(error) { libraryStatus.textContent=error.message; }
          finally { remove.disabled=false; save.disabled=false; }
        });
        details.append(remove);
      }
    }
  }
  upload.addEventListener('change', async event => {
    event.stopPropagation(); const file=upload.files[0]; if(!file) return;
    if(file.size>2*1024*1024) { libraryStatus.textContent='Choose a PNG no larger than 2 MB.'; return; }
    upload.disabled=true;
    try {
      // Decode and re-encode to a static PNG; malformed images never reach storage.
      const bitmap=await createImageBitmap(file);
      if(bitmap.width>2048 || bitmap.height>2048) { bitmap.close(); throw new Error('Maximum dimensions are 2048 x 2048 pixels.'); }
      const canvas=document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
      canvas.getContext('2d').drawImage(bitmap,0,0); bitmap.close();
      const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')); if(!png) throw new Error('Could not read image.');
      const data=await apiRequest('/api/custom-chat/silhouettes',{method:'POST',auth:true,headers:{'Content-Type':'image/png','X-Twitch-Login':uploadOwner.value.trim()},body:png});
      showLibrary(data.items); libraryStatus.textContent='Uploaded. Rename it below, or disable it to keep it out of the crowd.'; upload.value='';
    } catch(error) { libraryStatus.textContent=error.message; } finally { upload.disabled=false; }
  });
  libraryPanel.addEventListener('input',event=>event.stopPropagation());
  libraryPanel.addEventListener('change',event=>event.stopPropagation());
  async function loadLibrary() { try { showLibrary((await apiRequest('/api/custom-chat/silhouettes',{cache:'no-store'})).items); } catch(error) { libraryStatus.textContent=error.message; } }
  function values() {
    return ChatModel.validate(Object.fromEntries(Object.entries(ChatModel.fields).map(([key, [, type]]) => {
      const input = form.elements[key];
      return [key, type === 'number' ? Number(input.value) : type === 'checkbox' ? input.checked : type === 'list' ? input.value.split('\n').map(value => value.trim()).filter(Boolean) : input.value];
    })));
  }
  function fill(appearance) {
    for (const [key, [, type]] of Object.entries(ChatModel.fields)) {
      if (type === 'checkbox') form.elements[key].checked = appearance[key];
      else form.elements[key].value = type === 'list' ? appearance[key].join('\n') : appearance[key];
    }
  }
  function send(type, data) { if (ready) el('chatPreviewFrame').contentWindow.postMessage({ type, data }, location.origin); }
  function updatePreview() { for (const key of ['leftColor', 'rightColor']) form.elements[key].parentElement.hidden = form.elements.theme.value === 'audience'; for (const row of form.querySelectorAll('[data-audience-setting]')) row.hidden = form.elements.theme.value !== 'audience'; try { send('chat-config', values()); } catch (error) { el('chatEditorStatus').textContent = error.message; } }
  function changed() { dirty = true; el('chatEditorStatus').textContent = 'Unsaved changes — preview only.'; updatePreview(); }
  form.addEventListener('input', changed); form.addEventListener('change', changed);
  form.addEventListener('submit', event => event.preventDefault());
  el('chatSocketUrl').addEventListener('input', () => { dirty = true; el('chatEditorStatus').textContent = 'Unsaved connection settings.'; });
  function sample(burst = false) {
    send('clear', {}); sampleIds.length = 0;
    const messages = [
      ['Mira', 'Did someone say comic-book chat?'],
      ['Rook', 'POW! This is looking pretty good.'],
      ['Mira', 'I like how the conversation moves from side to side.'],
      ['Rook', 'Long messages wrap inside their bubble, so everyone can follow along—even when chat gets excited!'],
      ['Mira', 'Next panel, please! ✨']
    ];
    const count = burst ? 20 : messages.length;
    for (let i = 0; i < count; i++) {
      let [name, text] = messages[i % messages.length]; if (form.elements.theme.value === 'audience') name = ['Mira', 'Rook', 'Ash', 'Luna', 'Finn'][i % 5]; const id = `sample-${++sequence}`; sampleIds.push(id);
      send('message', { id, name, userId: name, text, platform: 'twitch', color: name === 'Mira' ? '#9146ff' : '#007a68' });
    }
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== el('chatPreviewFrame').contentWindow) return;
    if (event.data?.type === 'chat-preview-state') { sampleIds.splice(0, sampleIds.length, ...event.data.ids); return; }
    if (event.data?.type !== 'chat-preview-ready') return;
    ready = true; updatePreview(); sample();
  });
  el('chatSample').addEventListener('click', () => sample());
  el('chatBurst').addEventListener('click', () => sample(true));
  el('chatDeleteSample').addEventListener('click', () => { const id = sampleIds.shift(); if (id) send('remove', { id, platform: 'twitch' }); });
  el('chatClearSample').addEventListener('click', () => { sampleIds.length = 0; send('clear', {}); });
  el('chatPreviewBackground').addEventListener('change', () => { el('chatPreviewCanvas').dataset.background = el('chatPreviewBackground').value; });
  el('chatDiscard').addEventListener('click', () => { if (!saved || busy) return; fill(saved.appearance); el('chatSocketUrl').value = 'ws://127.0.0.1:8080/'; dirty = false; updatePreview(); el('chatEditorStatus').textContent = 'Changes discarded.'; });
  el('chatSave').addEventListener('click', async () => {
    if (busy || !saved || !form.reportValidity()) return;
    let appearance; try { appearance = values(); } catch (error) { el('chatEditorStatus').textContent = error.message; return; }
    busy = true; el('chatSave').disabled = true;
    const controls = [...form.elements, el('chatSocketUrl')]; controls.forEach(input => { input.disabled = true; });
    try {
      saved = await apiRequest('/api/custom-chat/admin', { method: 'PUT', auth: true, body: JSON.stringify({ appearance, websocketUrl: '' }) });
      dirty = false; el('chatEditorStatus').textContent = 'Saved. Connected overlays receive the new appearance automatically.';
    } catch (error) { el('chatEditorStatus').textContent = error.message; }
    finally { busy = false; el('chatSave').disabled = false; controls.forEach(input => { input.disabled = false; }); }
  });
  window.customChatEditor = {
    canLeave: () => !busy && (!dirty || window.confirm('Discard unsaved Custom Chat changes?')),
    close() { ++generation; ready = false; dirty = false; el('customChatEditor').hidden = true; el('chatPreviewFrame').src = 'about:blank'; },
    async open() {
      const current = ++generation; el('customChatEditor').hidden = false;
      el('chatSave').disabled = true; saved = null;
      el('chatEditorStatus').textContent = 'Loading chat settings...';
      try {
        const data = await apiRequest('/api/custom-chat/admin', { auth: true, cache: 'no-store' });
        if (current !== generation) return;
        saved = data; fill(saved.appearance); loadLibrary(); el('chatSocketUrl').value = 'ws://127.0.0.1:8080/';
        el('chatConnection').textContent = 'Direct connection from OBS to local Streamer.bot'; el('chatSave').disabled = false;
        el('chatEditorStatus').textContent = 'Changes stay in preview until you save.';
        el('chatPreviewFrame').src = '/widgets/custom-chat/?preview=1';
      } catch (error) { if (current === generation) el('chatEditorStatus').textContent = error.message; }
    }
  };
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.setInterval(async () => {
    if (el('customChatEditor').hidden || busy) return;
    try { const data = await apiRequest('/api/custom-chat/admin', { auth: true, signal: AbortSignal.timeout(4000) }); el('chatConnection').textContent = 'Direct connection from OBS to local Streamer.bot'; } catch {}
  }, 10000);
})();
