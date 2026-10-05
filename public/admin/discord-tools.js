(() => {
  const el = id => document.getElementById(id);
  let loading = false;
  let releasing = false;
  let settingsDirty = false;
  let settingsSaving = false;
  let savedSettings = null;
  let roleIds = [];
  let roleNames = new Map();
  const phraseFields = {
    eaten: el('howlerEatenPhrases'),
    unable: el('howlerUnablePhrases'),
    released: el('howlerReleasedPhrases'),
    permanent: el('howlerPermanentPhrases')
  };
  function renderRoles() {
    el('howlerExemptRoles').replaceChildren();
    for (const id of roleIds) {
      const row = document.createElement('li');
      const name = document.createElement('span'); name.textContent = `${roleNames.get(id) || 'Role'} (${id})`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${roleNames.get(id) || id} exemption`);
      remove.addEventListener('click', () => { roleIds = roleIds.filter(value => value !== id); markDirty(); renderRoles(); });
      row.append(name, remove); el('howlerExemptRoles').append(row);
    }
  }
  function markDirty() { settingsDirty = true; el('howlerSettingsStatus').textContent = 'Unsaved settings.'; }
  function resetSettings() {
    if (!savedSettings) return;
    roleIds = savedSettings.exemptRoles.map(role => role.id);
    el('howlerDuration').value = savedSettings.durationSeconds;
    for (const [key, field] of Object.entries(phraseFields)) {
      field.value = (savedSettings.phrases?.[key] || []).join('\n');
    }
    settingsDirty = false; renderRoles();
  }
  function addRole(id) {
    if (!/^\d{17,20}$/.test(id)) { el('howlerSettingsStatus').textContent = 'Select a role or enter a valid Discord role ID.'; return; }
    if (!roleIds.includes(id)) { roleIds.push(id); markDirty(); renderRoles(); }
    el('howlerRoleId').value = '';
  }
  el('howlerDuration').addEventListener('input', markDirty);
  Object.values(phraseFields).forEach(field => field.addEventListener('input', markDirty));
  el('howlerAddRole').addEventListener('click', () => addRole(el('howlerRolePicker').value));
  el('howlerAddRoleId').addEventListener('click', () => addRole(el('howlerRoleId').value.trim()));
  el('howlerResetSettings').addEventListener('click', () => { resetSettings(); el('howlerSettingsStatus').textContent = 'Changes discarded.'; });
  el('howlerSettingsForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!savedSettings || settingsSaving) return;
    settingsSaving = true;
    const controls = [...el('howlerSettingsForm').querySelectorAll('input, select, textarea, button')];
    controls.forEach(control => { control.disabled = true; });
    try {
      const phrases = Object.fromEntries(Object.entries(phraseFields).map(([key, field]) => [
        key,
        field.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
      ]));
      const data = await apiRequest('/api/discord/admin/howler/settings', { auth: true, method: 'PUT', body: JSON.stringify({ durationSeconds: Number(el('howlerDuration').value), exemptRoleIds: roleIds, phrases }) });
      savedSettings = data.howler; settingsDirty = false;
      renderHowler(data.howler);
      el('howlerSettingsStatus').textContent = 'Saved. New confinements use these settings immediately.';
    } catch (error) { el('howlerSettingsStatus').textContent = error.message; }
    finally { settingsSaving = false; controls.forEach(control => { control.disabled = false; }); }
  });
  window.addEventListener('beforeunload', event => { if (settingsDirty) { event.preventDefault(); event.returnValue = ''; } });
  function renderHowler(data) {
    savedSettings = data;
    roleNames = new Map([...data.availableRoles || [], ...data.exemptRoles].map(role => [role.id, role.name]));
    const chosenRole = el('howlerRolePicker').value;
    el('howlerRolePicker').replaceChildren(new Option('Select a Discord role', ''));
    (data.availableRoles || []).forEach(role => el('howlerRolePicker').append(new Option(role.name, role.id)));
    el('howlerRolePicker').value = chosenRole;
    if (!settingsDirty) resetSettings();
    el('howlerSaveSettings').disabled = settingsSaving;

    el('howlerStatus').textContent = `${data.enabled ? 'Enabled' : 'Disabled'} · ${data.ready ? 'Connected' : 'Not connected'} · ${data.records.length} active records`;
    const rows = [
      ['Eat command', data.command], ['Release commands', data.releaseCommands.join(' or ')], ['Duration', `${data.durationSeconds} seconds`],
      ['Confinement channel', data.channel.name], ['Confinement role', data.confinementRole.name],
      ['Log channel', data.logChannel.name], ['Roles suspended', data.suspendedRoles.map(role => role.name).join(', ') || 'None'],
      ['Exempt roles', data.exemptRoles.map(role => role.name).join(', ') || 'None']
    ];
    el('howlerConfig').replaceChildren();
    for (const [name, value] of rows) {
      const dt = document.createElement('dt'); dt.textContent = name;
      const dd = document.createElement('dd'); dd.textContent = value;
      el('howlerConfig').append(dt, dd);
    }
    el('howlerRecords').replaceChildren();
    if (!data.records.length) el('howlerRecords').textContent = 'No active confinements or pending role restorations.';
    for (const record of data.records) {
      const card = document.createElement('article'); card.className = 'howler-record';
      const title = document.createElement('h4'); title.textContent = record.userName || record.userId;
      const details = document.createElement('p');
      const due = record.nextRetryAt || record.releaseAt;
      details.textContent = `${record.status} · Duration: ${record.durationSeconds} seconds · ${record.nextRetryAt ? 'Retry' : 'Release'}: ${new Date(due).toLocaleString()} · Original channel: ${record.originalChannel.name} · Pending roles: ${record.removedRoles.map(role => role.name).join(', ') || 'None'} · Restore attempts: ${record.restoreAttempts}`;
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = record.status === 'restore_failed' ? 'Retry restoration' : 'Release now';
      button.disabled = !data.ready || record.busy || releasing;
      button.addEventListener('click', () => release(record));
      card.append(title, details, button); el('howlerRecords').append(card);
    }
  }
  async function refresh() {
    if (loading || releasing || settingsSaving) return;
    if (!el('tokenInput').value.trim()) {
      el('discordBotStatus').textContent = el('howlerStatus').textContent = 'Enter the Admin bearer token, then refresh.';
      return;
    }
    loading = true;
    try {
      const data = await apiRequest('/api/discord/admin/status', { auth: true, cache: 'no-store', signal: AbortSignal.timeout(8000) });
      el('discordBotStatus').textContent = `${data.bot.name} · ${data.bot.enabled ? 'Enabled' : 'Disabled'} · ${data.bot.ready ? 'Connected' : 'Not connected'} · ${data.bot.guildCount} servers${data.bot.pingMs === null ? '' : ` · ${data.bot.pingMs} ms gateway latency`}`;
      renderHowler(data.howler);
    } catch (error) {
      el('discordBotStatus').textContent = el('howlerStatus').textContent = `Status unavailable: ${error.message}`;
      el('howlerConfig').replaceChildren(); el('howlerRecords').replaceChildren();
    } finally { loading = false; }
  }
  async function release(record) {
    if (releasing || !window.confirm(`Release ${record.userName || record.userId} and restore their roles now? This may move or disconnect them from voice.`)) return;
    releasing = true;
    el('howlerRecords').querySelectorAll('button').forEach(button => { button.disabled = true; });
    el('howlerActionStatus').textContent = 'Restoring roles and releasing confinement...';
    try {
      const data = await apiRequest('/api/discord/admin/howler/release', { auth: true, method: 'POST', body: JSON.stringify({ guildId: record.guildId, userId: record.userId }), signal: AbortSignal.timeout(30000) });
      el('howlerActionStatus').textContent = data.pending ? 'Restoration is still pending. Howler will retry; check its Discord log for details.' : 'Confinement record cleared. Check Howler’s Discord log for the voice-action result.';
    } catch (error) { el('howlerActionStatus').textContent = `${error.message} Refresh status before trying again.`; }
    finally { releasing = false; refresh(); }
  }
  el('discordStatusRefresh').addEventListener('click', refresh);
  el('howlerRefresh').addEventListener('click', refresh);
  document.addEventListener('discord-tools-open', refresh);
  window.setInterval(() => {
    if (document.querySelector('[data-admin-section="howler"].active, [data-admin-section="discord-home"].active')) refresh();
  }, 15000);
  el('statusRow').hidden = true;
  refresh();
})();
