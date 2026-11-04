(() => {
  'use strict';
  const nav = document.querySelector('.primary-nav');
  const toggle = nav?.querySelector('.mobile-nav-toggle');
  if (!nav || !toggle || toggle.dataset.mobileNavReady === '1') return;
  toggle.dataset.mobileNavReady = '1';

  const key = 'hekomi-mobile-nav-collapsed';
  const apply = collapsed => {
    document.body.classList.toggle('mobile-nav-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expand navigation' : 'Collapse navigation');
    toggle.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
    const icon = toggle.querySelector('span');
    if (icon) icon.textContent = collapsed ? '⌃' : '⌄';
  };

  let saved = false;
  try { saved = sessionStorage.getItem(key) === '1'; } catch { /* Storage may be unavailable. */ }
  apply(saved);

  toggle.addEventListener('click', () => {
    const collapsed = !document.body.classList.contains('mobile-nav-collapsed');
    apply(collapsed);
    try { sessionStorage.setItem(key, collapsed ? '1' : '0'); } catch { /* Optional preference. */ }
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (!window.matchMedia('(max-width:760px)').matches) return;
      apply(false);
      try { sessionStorage.setItem(key, '0'); } catch { /* Optional preference. */ }
    });
  });
})();
