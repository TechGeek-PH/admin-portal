(function() {
  const BUILD_KEY = "20260706-v4";
  const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const currentSearch = String(window.location.search || '');

  // Force the Statement of Account page to open the latest deployed build.
  // This bypasses an older cached copy that still shows the obsolete logo error.
  if (currentFile === 'statement_of_account.html' && currentSearch.indexOf('build=' + BUILD_KEY) === -1) {
    window.location.replace('statement_of_account_v3.html');
    return;
  }

  const sidebar = document.querySelector('[data-admin-sidebar]');
  if (!sidebar) return;

  const links = Array.prototype.slice.call(sidebar.querySelectorAll('a[href]'));

  links.forEach(function(link) {
    const rawHref = String(link.getAttribute('href') || '');
    const cleanHref = rawHref.split('#')[0].split('?')[0].toLowerCase();

    // All admin pages now open the cache-busting SOA loader.
    if (cleanHref === 'statement_of_account.html' || cleanHref === 'statement_of_account_v3.html') {
      link.setAttribute('href', 'statement_of_account_v3.html');
    }

    const activeHref = String(link.getAttribute('href') || '').split('#')[0].split('?')[0].toLowerCase();
    const isSoaPage = currentFile === 'statement_of_account.html' || currentFile === 'statement_of_account_v3.html';
    const isActive = activeHref === currentFile || (isSoaPage && activeHref === 'statement_of_account_v3.html');
    link.classList.toggle('is-active', isActive);

    if (isActive) {
      const group = link.closest('.nav-group');
      if (group) {
        group.classList.add('is-open');
        const toggle = group.querySelector('.nav-toggle');
        if (toggle) toggle.classList.add('is-active');
      }
    }
  });
})();
