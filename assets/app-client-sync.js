(() => {
  'use strict';
  if (window.__tgClientSyncLoaded) return;
  window.__tgClientSyncLoaded = true;

  const BASE = 'https://tcexzfztdgximrzuosqs.supabase.co';
  const KEY = 'sb_publishable_8H8_S7NTWvzPCLvYUe2C4g_k3Ltjfiz';
  const $ = id => document.getElementById(id);
  let clientRows = [];
  let selectedClient = null;

  function token() {
    try {
      const s = JSON.parse(localStorage.getItem('tg_session_v3') || localStorage.getItem('sb-tcexzfztdgximrzuosqs-auth-token') || 'null');
      return s && s.access_token ? s.access_token : '';
    } catch (_) { return ''; }
  }

  async function rpc(name, body) {
    const t = token();
    if (!t) throw new Error('Session expired. Please sign in again.');
    const r = await fetch(BASE + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!r.ok) throw new Error((data && (data.message || data.hint)) || 'Database request failed.');
    return data;
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

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function modeFromUrl() {
    const q = new URLSearchParams(location.search);
    const f = String(q.get('form') || '').toLowerCase();
    if (f.includes('repair')) return 'repair';
    if (f.includes('relocation')) return 'relocation';
    return 'application';
  }

  function suppressLegacyLookup(mode) {
    if (mode === 'application') return;
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

  function lockMode() {
    const mode = modeFromUrl();
    suppressLegacyLookup(mode);
    const select = $('formType');
    if (select) {
      select.disabled = false;
      select.value = mode === 'repair' ? 'Repair' : mode === 'relocation' ? 'Relocation' : 'New Application';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    suppressLegacyLookup(mode);
    const typeSection = document.querySelector('.form-type-section');
    if (typeSection) typeSection.style.display = 'none';
    if (new URLSearchParams(location.search).get('embed') === '1') {
      const side = document.querySelector('.sidebar'); if (side) side.style.display = 'none';
      const top = document.querySelector('.topbar'); if (top) top.style.display = 'none';
      const app = document.querySelector('.app'); if (app) { app.style.display = 'block'; app.style.gridTemplateColumns = '1fr'; }
    }
    return mode;
  }

  function cleanSiteTag(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  function clearAccountPreview() {
    const site = $('tgSiteTag');
    const preview = $('tgAccountPreview');
    const actual = $('accountNo');
    if (site) site.value = '';
    if (preview) { preview.value = ''; preview.placeholder = 'Enter Site Tag first'; }
    if (actual) actual.value = '';
  }

  function refreshAccountPreview() {
    const site = $('tgSiteTag');
    const num = $('tgClientNumber');
    const preview = $('tgAccountPreview');
    if (!site || !num || !preview) return;
    const cleaned = cleanSiteTag(site.value);
    site.value = cleaned;
    const number = String(num.value || '').replace(/\D/g, '').padStart(4, '0').slice(-4);
    num.value = number;
    if (!cleaned) {
      clearAccountPreview();
      return;
    }
    const account = cleaned + number;
    preview.value = account;
    preview.placeholder = '';
    const actual = $('accountNo');
    if (actual) actual.value = account;
  }

  async function loadNextClientNumber() {
    const num = $('tgClientNumber');
    if (!num) return;
    try {
      const data = await rpc('staff_next_client_number', {});
      num.value = (data && data.next_client_number) || '0001';
      const last = $('tgLastInstalled');
      if (last) last.textContent = data && data.last_account_no ? 'Last installed/account sequence: ' + data.last_account_no + ' → next ' + num.value : 'No previous installed client found. Starting at ' + num.value;
      refreshAccountPreview();
    } catch (e) {
      num.value = '0001';
      const last = $('tgLastInstalled');
      if (last) last.textContent = 'Unable to read last client number: ' + e.message;
      refreshAccountPreview();
    }
  }

  function installNewClientNumberSection(form, firstSection) {
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<div class="section-title"><h3>Client Account Number</h3><span>Automatic Sequence</span></div>' +
      '<div class="form-grid">' +
        '<div class="field"><label for="tgSiteTag">Site Tag</label><input id="tgSiteTag" name="Site Tag" value="" required maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Enter Site Tag"></div>' +
        '<div class="field"><label for="tgClientNumber">Client Number</label><input id="tgClientNumber" name="Client Number" value="0001" readonly inputmode="numeric"></div>' +
        '<div class="field wide"><label for="tgAccountPreview">Account Number</label><input id="tgAccountPreview" readonly value="" placeholder="Enter Site Tag first"><small id="tgLastInstalled">Checking last installed client…</small></div>' +
        '<div class="field full"><div class="form-type-help">Site Tag is blank by default and must be entered manually (example: SATR, WBRD, KRPP). Client Number is automatic and follows the latest client number in the database. The final Account Number will be Site Tag + Client Number.</div></div>' +
      '</div>';
    form.insertBefore(section, firstSection || form.firstChild);

    const originalAccount = $('accountNo');
    if (originalAccount) {
      originalAccount.readOnly = true;
      const field = originalAccount.closest('.field');
      if (field) field.style.display = 'none';
    }

    const site = $('tgSiteTag');
    site.addEventListener('input', function () {
      const raw = String(site.value || '');
      if (!raw.trim()) {
        clearAccountPreview();
        setTimeout(clearAccountPreview, 0);
        return;
      }
      refreshAccountPreview();
    });
    site.addEventListener('change', function () {
      if (!String(site.value || '').trim()) clearAccountPreview();
      else refreshAccountPreview();
    });
    site.addEventListener('blur', function () {
      if (!String(site.value || '').trim()) clearAccountPreview();
      else refreshAccountPreview();
    });
    clearAccountPreview();
    loadNextClientNumber();
  }

  function installPicker(mode) {
    const form = $('applicationForm');
    if (!form) return;
    const firstSection = form.querySelector('.section:not(.form-type-section)');
    if (mode === 'application') {
      installNewClientNumberSection(form, firstSection);
      return;
    }
    suppressLegacyLookup(mode);
    const section = document.createElement('div');
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

  function bindClearRefresh() {
    const clear = $('clearBtn');
    if (!clear) return;
    clear.addEventListener('click', function () {
      if (modeFromUrl() !== 'application') return;
      setTimeout(function () {
        clearAccountPreview();
        loadNextClientNumber();
      }, 100);
    });
  }

  async function init() {
    const form = $('applicationForm');
    if (!form) return;
    const mode = lockMode();
    suppressLegacyLookup(mode);
    installPicker(mode);
    suppressLegacyLookup(mode);
    if (mode !== 'application') await loadClients();
    bindClearRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80));
  else setTimeout(init, 80);
})();
