// Final mode guard for the unified Application Form account-number UI.
(function () {
  'use strict';
  if (!/(^|\/)application_form\.html$/i.test(window.location.pathname)) return;

  function mode() {
    const p = new URLSearchParams(location.search);
    const requested = String(p.get('form') || p.get('mode') || '').toLowerCase();
    if (requested.includes('repair') || requested === 'service') return 'repair';
    if (requested.includes('relocation') || requested.includes('relocate') || requested.includes('transfer')) return 'relocation';
    if (requested.includes('install') || requested.includes('application') || requested === 'new') return 'application';
    const type = document.getElementById('formType');
    const value = String(type && type.value || '').toLowerCase();
    if (value.includes('repair')) return 'repair';
    if (value.includes('relocation')) return 'relocation';
    return 'application';
  }

  function dedicated() {
    const p = new URLSearchParams(location.search);
    return !!String(p.get('form') || p.get('mode') || '').trim();
  }

  function apply() {
    const current = mode();
    const isNew = current === 'application';
    const section = document.getElementById('tgClientAccountSection');
    const site = document.getElementById('tgSiteTag');
    const num = document.getElementById('tgClientNumber');
    const preview = document.getElementById('tgAccountPreview');
    const account = document.getElementById('accountNo');
    const accountField = account && (account.closest('.field') || account.parentElement);

    if (section) section.style.display = isNew ? '' : 'none';
    if (site) { site.required = isNew; site.disabled = !isNew; }
    if (num) num.disabled = !isNew;
    if (preview) preview.disabled = !isNew;

    if (account) account.readOnly = isNew;
    if (accountField && dedicated() && !isNew) accountField.style.display = 'none';
    if (accountField && dedicated() && isNew) accountField.style.display = 'none';
  }

  function setup() {
    apply();
    const type = document.getElementById('formType');
    if (type) type.addEventListener('change', function () { setTimeout(apply, 0); });
    const form = document.getElementById('applicationForm');
    if (form) form.addEventListener('reset', function () { setTimeout(apply, 100); });
    [50, 150, 350, 800, 1500, 3000].forEach(function (ms) { setTimeout(apply, ms); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
