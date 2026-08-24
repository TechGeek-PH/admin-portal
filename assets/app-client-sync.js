(() => {
  'use strict';
  if (window.__tgClientSyncLoaded) return;
  window.__tgClientSyncLoaded = true;

  const BASE = 'https://tcexzfztdgximrzuosqs.supabase.co';
  const KEY = 'sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz';
  const STORE = 'tg_session_v3';
  const SBSTORE = 'sb-tcexzfztdgximrzuosqs-auth-token';
  const $ = id => document.getElementById(id);

  let clientRows = [];
  let selectedClient = null;
  let sequenceReady = false;
  let sequenceData = null;
  let validatingSubmit = false;
  let bypassSubmitGuard = false;
  let originalAccountField = null;
  let explicitMode = null;

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(STORE) || localStorage.getItem(SBSTORE) || 'null');
    } catch (_) { return null; }
  }

  function saveSession(s) {
    if (!s || !s.access_token) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(s));
      localStorage.setItem(SBSTORE, JSON.stringify(s));
    } catch (_) {}
  }

  async function refreshSession() {
    const s = readSession();
    if (!s || !s.refresh_token) return null;
    try {
      const r = await fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!r.ok) return null;
      const next = await r.json();
      if (!next || !next.access_token) return null;
      saveSession(next);
      return next;
    } catch (_) { return null; }
  }

  async function rpc(name, body, retry) {
    let s = readSession();
    if (!s || !s.access_token) {
      s = await refreshSession();
      if (!s) throw new Error('Session expired. Please sign in again.');
    }

    let r = await fetch(BASE + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });

    if (r.status === 401 && retry !== false) {
      const refreshed = await refreshSession();
      if (refreshed) return rpc(name, body, false);
    }

    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!r.ok) throw new Error((data && (data.message || data.hint || data.details)) || 'Database request failed.');
    return data;
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function setValue(id, value) {
    const el = $(id);
    if (!el || value == null || value === '') return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function splitName(full) {
    const p = String(full || '').trim().split(/\s+/).filter(Boolean);
    if (p.length <= 1) return { first: p[0] || '', middle: '', last: '' };
    return { first: p.slice(0, -1).join(' '), middle: '', last: p[p.length - 1] };
  }

  function fillClient(c) {
    selectedClient = c;
    const n = splitName(c.client_name);
    setValue('accountNo', c.account_no);
    setValue('name', n.first || c.client_name);
    setValue('surname', n.last || c.client_name);
    setValue('contactNo', c.phone);
    setValue('emailAddress', c.email);
    setValue('currentServiceAddress', c.service_address);
    setValue('googleMapsLink', c.google_maps_link);
    setValue('plan', c.plan);
    setTimeout(() => setValue('speed', c.speed), 50);
    setValue('routerModel', c.modem_brand_model);
    setValue('serialNo', c.modem_serial_no);
    const box = $('tgClientSummary');
    if (box) box.innerHTML = '<b>' + escapeHtml(c.account_no || '') + '</b> · ' + escapeHtml(c.client_name || '') + '<br>' + escapeHtml(c.service_address || 'No service address') + '<br><span>' + escapeHtml(c.plan || '') + (c.speed ? ' · ' + escapeHtml(c.speed) : '') + '</span>';
  }

  function requestedMode() {
    const q = new URLSearchParams(location.search);
    const f = String(q.get('form') || q.get('mode') || '').trim().toLowerCase();
    if (!f) return null;
    if (f.includes('repair') || f === 'service') return 'repair';
    if (f.includes('relocation') || f.includes('relocate') || f.includes('transfer')) return 'relocation';
    if (f.includes('install') || f.includes('application') || f === 'new') return 'application';
    return null;
  }

  function modeFromForm() {
    const select = $('formType');
    const value = String(select && select.value || '').toLowerCase();
    if (value.includes('repair')) return 'repair';
    if (value.includes('relocation')) return 'relocation';
    return 'application';
  }

  function currentMode() {
    return explicitMode || modeFromForm();
  }

  function isDedicated() {
    return !!explicitMode;
  }

  function suppressLegacyLookup(mode) {
    if (!isDedicated() || mode === 'application') return;
    if (!document.getElementById('tgNoLegacyLookupStyle')) {
      const style = document.createElement('style');
      style.id = 'tgNoLegacyLookupStyle';
      style.textContent = '#tgExistingClientLookup{display:none!important}';
      document.head.appendChild(style);
    }
    const form = $('applicationForm');
    const removeLegacy = function () {
      const legacy = $('tgExistingClientLookup');
      if (!legacy) return;
      const account = $('accountNo');
      if (account && legacy.contains(account) && form) {
        const field = account.closest('.field') || account.parentElement;
        if (field) {
          field.style.display = 'none';
          form.appendChild(field);
        }
      }
      legacy.remove();
    };
    removeLegacy();
    if (!window.__tgNoLegacyLookupObserver && document.body) {
      window.__tgNoLegacyLookupObserver = new MutationObserver(removeLegacy);
      window.__tgNoLegacyLookupObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function applyDedicatedMode() {
    if (!isDedicated()) return;
    const mode = currentMode();
    suppressLegacyLookup(mode);
    const select = $('formType');
    if (select) {
      select.disabled = false;
      select.value = mode === 'repair' ? 'Repair' : mode === 'relocation' ? 'Relocation' : 'New Application';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const typeSection = document.querySelector('.form-type-section');
    if (typeSection) typeSection.style.display = 'none';
  }

  function applyEmbedShell() {
    const q = new URLSearchParams(location.search);
    if (q.get('embed') !== '1' && q.get('source') !== 'app-embed' && window.parent === window) return;
    const side = document.querySelector('.sidebar'); if (side) side.style.display = 'none';
    const top = document.querySelector('.topbar'); if (top) top.style.display = 'none';
    const app = document.querySelector('.app'); if (app) { app.style.display = 'block'; app.style.gridTemplateColumns = '1fr'; }
  }

  function cleanSiteTag(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  function formatClientNumber(value) {
    const digits = String(value == null ? '' : value).replace(/\D/g, '');
    if (!digits) return '';
    const normalized = String(Number(digits));
    if (!normalized || normalized === 'NaN' || normalized === '0') return '';
    return normalized.length < 4 ? normalized.padStart(4, '0') : normalized;
  }

  function setSequenceUnavailable(message) {
    sequenceReady = false;
    sequenceData = null;
    const num = $('tgClientNumber');
    const preview = $('tgAccountPreview');
    const actual = $('accountNo');
    if (num) num.value = '';
    if (preview) { preview.value = ''; preview.placeholder = 'Waiting for live client sequence'; }
    if (actual && currentMode() === 'application') actual.value = '';
    const last = $('tgLastInstalled');
    if (last) last.textContent = message || 'Unable to load the live client sequence. Do not submit yet.';
  }

  function clearNewAccountFields(clearSite) {
    const site = $('tgSiteTag');
    const preview = $('tgAccountPreview');
    const actual = $('accountNo');
    if (clearSite && site) site.value = '';
    if (preview) { preview.value = ''; preview.placeholder = sequenceReady ? 'Enter Site Tag first' : 'Waiting for live client sequence'; }
    if (actual && currentMode() === 'application') actual.value = '';
  }

  function refreshAccountPreview() {
    const site = $('tgSiteTag');
    const num = $('tgClientNumber');
    const preview = $('tgAccountPreview');
    if (!site || !num || !preview) return;
    const cleaned = cleanSiteTag(site.value);
    site.value = cleaned;
    const number = formatClientNumber(num.value);
    num.value = number;

    if (!sequenceReady || !number) {
      preview.value = '';
      preview.placeholder = 'Waiting for live client sequence';
      const actual = $('accountNo');
      if (actual && currentMode() === 'application') actual.value = '';
      return;
    }

    if (!cleaned) {
      clearNewAccountFields(false);
      preview.placeholder = 'Enter Site Tag first';
      return;
    }

    const account = cleaned + number;
    preview.value = account;
    preview.placeholder = '';
    const actual = $('accountNo');
    if (actual) actual.value = account;
  }

  function sequenceSummary(data) {
    if (!data) return 'Live sequence unavailable.';
    const next = data.next_client_number || '';
    const lastAccount = data.last_account_no || 'none';
    const count = Number(data.client_count || 0);
    const gaps = Number(data.missing_sequence_count || 0);
    return 'Global sequence: ' + lastAccount + ' → next ' + next + ' · ' + count + ' client records' + (gaps ? ' · ' + gaps + ' historical sequence gap' + (gaps === 1 ? '' : 's') : '');
  }

  async function loadNextClientNumber() {
    const num = $('tgClientNumber');
    if (!num || currentMode() !== 'application') return null;
    sequenceReady = false;
    const last = $('tgLastInstalled');
    if (last) last.textContent = 'Checking live global client sequence…';
    try {
      const data = await rpc('staff_next_client_number', {});
      const next = formatClientNumber(data && data.next_client_number);
      if (!next) throw new Error('Server returned an invalid client number.');
      sequenceData = data;
      sequenceReady = true;
      num.value = next;
      if (last) last.textContent = sequenceSummary(data);
      refreshAccountPreview();
      return data;
    } catch (e) {
      setSequenceUnavailable('Unable to read live client sequence: ' + e.message);
      return null;
    }
  }

  function ensureNewClientSection(form) {
    let section = $('tgClientAccountSection');
    if (section) return section;
    const firstSection = form.querySelector('.section:not(.form-type-section)');
    section = document.createElement('div');
    section.id = 'tgClientAccountSection';
    section.className = 'section';
    section.innerHTML = '<div class="section-title"><h3>Client Account Number</h3><span>Live Global Sequence</span></div>' +
      '<div class="form-grid">' +
        '<div class="field"><label for="tgSiteTag">Site Tag</label><input id="tgSiteTag" name="Site Tag" value="" required maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="SATR / WBRD / KRPP"></div>' +
        '<div class="field"><label for="tgClientNumber">Client Number</label><input id="tgClientNumber" name="Client Number" value="" readonly inputmode="numeric" placeholder="Loading…"></div>' +
        '<div class="field wide"><label for="tgAccountPreview">Account Number</label><input id="tgAccountPreview" readonly value="" placeholder="Waiting for live client sequence"><small id="tgLastInstalled">Checking live global client sequence…</small></div>' +
        '<div class="field full"><div class="form-type-help">Admin and Employee use the same global Client Number from the Clients database. The sequence follows the highest numeric account suffix, not the visible client count. Historical deleted/missing account numbers are not reused.</div></div>' +
      '</div>';
    form.insertBefore(section, firstSection || form.firstChild);

    const originalAccount = $('accountNo');
    if (originalAccount && !originalAccountField) originalAccountField = originalAccount.closest('.field') || originalAccount.parentElement;

    const site = $('tgSiteTag');
    if (site) {
      site.addEventListener('input', refreshAccountPreview);
      site.addEventListener('change', refreshAccountPreview);
      site.addEventListener('blur', refreshAccountPreview);
    }
    return section;
  }

  function showNewClientSection(show) {
    const section = $('tgClientAccountSection');
    const account = $('accountNo');
    if (section) section.style.display = show ? '' : 'none';
    if (account) account.readOnly = !!show;
    if (originalAccountField) {
      if (show) originalAccountField.style.display = 'none';
      else if (!isDedicated()) originalAccountField.style.display = '';
    }
    if (!show && account && !isDedicated()) account.value = '';
  }

  function installDedicatedExistingPicker(form) {
    if ($('tgDedicatedClientPicker')) return;
    suppressLegacyLookup(currentMode());
    const firstSection = form.querySelector('.section:not(.form-type-section)');
    const section = document.createElement('div');
    section.id = 'tgDedicatedClientPicker';
    section.className = 'section';
    section.innerHTML = '<div class="section-title"><h3>Select Existing Client</h3><span>Live Clients Database</span></div><div class="form-grid"><div class="field full"><label for="tgClientSearch">Client / Account Number</label><input id="tgClientSearch" list="tgClientList" autocomplete="off" placeholder="Type client name or account number"><datalist id="tgClientList"></datalist><small>Live list from Clients database. Selecting a client auto-fills account, contact, current address, plan and router details.</small></div><div class="field full"><div id="tgClientSummary" class="form-type-help">Select a client to load details.</div></div></div>';
    form.insertBefore(section, firstSection || form.firstChild);
    $('tgClientSearch').addEventListener('change', function () {
      const val = this.value.trim();
      const account = val.split(' — ')[0].trim().toUpperCase();
      const c = clientRows.find(x => String(x.account_no || '').toUpperCase() === account) || clientRows.find(x => (x.account_no + ' — ' + x.client_name) === val);
      if (c) fillClient(c);
    });
  }

  async function loadClients() {
    const list = $('tgClientList');
    if (!list) return;
    try {
      clientRows = await rpc('staff_client_lookup', {});
      list.innerHTML = clientRows.map(c => '<option value="' + escapeHtml((c.account_no || '') + ' — ' + (c.client_name || '')) + '"></option>').join('');
    } catch (e) {
      const s = $('tgClientSummary');
      if (s) s.textContent = 'Unable to load client list: ' + e.message;
    }
  }

  async function syncModeUi() {
    const mode = currentMode();
    const form = $('applicationForm');
    if (!form) return;
    ensureNewClientSection(form);
    showNewClientSection(mode === 'application');

    if (mode === 'application') {
      selectedClient = null;
      await loadNextClientNumber();
    } else if (isDedicated()) {
      suppressLegacyLookup(mode);
      installDedicatedExistingPicker(form);
      await loadClients();
    }
  }

  function showFormNotice(message, error) {
    const notice = $('notice');
    if (!notice) {
      if (error) alert(message);
      return;
    }
    notice.textContent = message;
    notice.classList.remove('is-hidden', 'ok', 'error', 'err');
    notice.classList.add(error ? 'error' : 'ok');
  }

  async function validateNewClientSequenceBeforeSubmit(event) {
    if (bypassSubmitGuard) {
      bypassSubmitGuard = false;
      return;
    }
    if (currentMode() !== 'application') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (validatingSubmit) return;

    const form = $('applicationForm');
    const site = $('tgSiteTag');
    const num = $('tgClientNumber');
    if (!form || !site || !num) return;

    const cleanedSite = cleanSiteTag(site.value);
    if (!cleanedSite) {
      showFormNotice('Site Tag is required before saving a New Installation.', true);
      site.focus();
      return;
    }

    validatingSubmit = true;
    try {
      const data = await rpc('staff_next_client_number', {});
      const latest = formatClientNumber(data && data.next_client_number);
      if (!latest) throw new Error('Unable to verify the live client sequence.');

      const changed = formatClientNumber(num.value) !== latest;
      sequenceData = data;
      sequenceReady = true;
      num.value = latest;
      site.value = cleanedSite;
      refreshAccountPreview();
      const last = $('tgLastInstalled');
      if (last) last.textContent = sequenceSummary(data);

      if (changed) {
        showFormNotice('Client Number refreshed to ' + latest + ' from the live database before saving.', false);
      }

      bypassSubmitGuard = true;
      form.requestSubmit();
    } catch (e) {
      setSequenceUnavailable('Unable to verify live client sequence: ' + e.message);
      showFormNotice('New Installation was not submitted because the live Client Number could not be verified. ' + e.message, true);
    } finally {
      validatingSubmit = false;
    }
  }

  function bindFormMode() {
    const select = $('formType');
    if (!select || isDedicated()) return;
    select.addEventListener('change', function () {
      setTimeout(syncModeUi, 0);
    });
  }

  function bindClearRefresh() {
    const clear = $('clearBtn');
    if (!clear) return;
    clear.addEventListener('click', function () {
      setTimeout(async function () {
        if (isDedicated()) applyDedicatedMode();
        clearNewAccountFields(true);
        await syncModeUi();
      }, 120);
    });
  }

  function bindLiveSequenceRefresh() {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && currentMode() === 'application') loadNextClientNumber();
    });
    window.addEventListener('focus', function () {
      if (currentMode() === 'application') loadNextClientNumber();
    });
    window.addEventListener('pageshow', function () {
      if (currentMode() === 'application') loadNextClientNumber();
    });
    window.addEventListener('tg-client-db-saved', function () {
      if (currentMode() === 'application') setTimeout(loadNextClientNumber, 150);
    });
  }

  async function init() {
    const form = $('applicationForm');
    if (!form) return;
    explicitMode = requestedMode();
    applyDedicatedMode();
    applyEmbedShell();
    bindFormMode();
    bindClearRefresh();
    bindLiveSequenceRefresh();
    form.addEventListener('submit', validateNewClientSequenceBeforeSubmit, true);
    await syncModeUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80));
  else setTimeout(init, 80);
})();
