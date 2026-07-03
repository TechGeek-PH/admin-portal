(function() {
  const sidebar = document.querySelector('[data-admin-sidebar]');
  if (!sidebar) return;

  const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const links = Array.prototype.slice.call(sidebar.querySelectorAll('a[href]'));

  links.forEach(function(link) {
    const href = String(link.getAttribute('href') || '').split('#')[0].split('?')[0].toLowerCase();
    const isActive = href === page;
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
