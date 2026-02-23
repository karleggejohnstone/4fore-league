// components/nav.js — Shared site navigation component
// Include AFTER supabase.js and auth.js on every page that uses it.
//
// Usage:
//   <div id="nav-root"></div>
//   <script src="components/nav.js"></script>
//
// Optional config (set BEFORE this script):
//   window.navConfig = {
//     active:   'home',      // 'home' | 'round' | 'dashboard' | 'account'
//     noNav:    false,       // true = skip injection entirely
//     showUser: true,        // show user name + avatar in topbar
//   };

(function () {
  const cfg = window.navConfig || {};
  if (cfg.noNav) return;

  // Resolve asset path relative to this script's location
  const scriptEl = document.currentScript;
  const scriptSrc = scriptEl ? scriptEl.src : '';
  const base = scriptSrc ? scriptSrc.replace('components/nav.js', '') : '';
  const logoSrc   = base + 'assets/logo.svg';

  // ── Render placeholder synchronously (avoids FOUC) ──────────
  const root = document.getElementById('nav-root') || (() => {
    const el = document.createElement('div');
    el.id = 'nav-root';
    document.body.prepend(el);
    return el;
  })();

  root.innerHTML = `
    <nav class="topbar site-nav" id="siteNav">
      <a href="${base}index.html" class="topbar-logo">
        <img src="${logoSrc}" alt="4FORE League" height="28">
      </a>
      <div class="topbar-right" id="navLinks">
        <span style="color:rgba(245,240,232,0.3);font-size:0.8rem;">Loading…</span>
      </div>
      <button class="nav-hamburger" id="navHamburger" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </nav>
    <div class="nav-drawer" id="navDrawer" aria-hidden="true"></div>
  `;

  // ── Hamburger toggle ─────────────────────────────────────────
  const hamburger = document.getElementById('navHamburger');
  const drawer    = document.getElementById('navDrawer');

  hamburger.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
  });

  // Close drawer on outside click
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) {
      drawer.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
    }
  });

  // ── Async: fill links once auth resolves ────────────────────
  (async () => {
    const active = cfg.active || null;

    let session = null;
    let isComm  = false;
    let profile = null;

    try {
      session = await window.auth.getSession();
      if (session) {
        isComm = await window.auth.canAccess('commissioner');
        if (cfg.showUser !== false) {
          const res = await window.auth.getProfile(session.user.id);
          profile = res.data;
        }
      }
    } catch (e) {
      // auth not available or network error — show minimal nav
    }

    const userName = profile?.display_name
      || session?.user?.email?.split('@')[0]
      || '';
    const userInitial = userName.charAt(0).toUpperCase() || '?';

    // Build link HTML
    function link(href, label, key) {
      const isActive = active === key ? ' active' : '';
      return `<a href="${base}${href}" class="nav-link${isActive}">${label}</a>`;
    }

    const desktopLinks = [
      link('round.html', 'Start Round', 'round'),
      isComm  ? link('dashboard.html', 'Dashboard', 'dashboard') : '',
      session ? link('account.html', 'Account', 'account') : '',
    ].filter(Boolean).join('');

    const desktopAuth = session
      ? `<div class="topbar-user">
           <div class="topbar-avatar">${userInitial}</div>
           <span>${escHtml(userName)}</span>
         </div>
         <button class="btn-signout" onclick="window.auth.signOut()">Sign Out</button>`
      : `<a href="${base}login.html" class="nav-link${active === 'login' ? ' active' : ''}">Sign In</a>`;

    document.getElementById('navLinks').innerHTML = desktopLinks + desktopAuth;

    // Mobile drawer
    const drawerLinks = [
      `<a href="${base}index.html" class="nav-link${active === 'home' ? ' active' : ''}">Home</a>`,
      `<a href="${base}round.html" class="nav-link${active === 'round' ? ' active' : ''}">Start Round</a>`,
      isComm  ? `<a href="${base}dashboard.html" class="nav-link${active === 'dashboard' ? ' active' : ''}">Dashboard</a>` : '',
      session ? `<a href="${base}account.html" class="nav-link${active === 'account' ? ' active' : ''}">Account</a>` : '',
      session
        ? `<button class="btn-signout" onclick="window.auth.signOut()" style="margin-top:8px;">Sign Out</button>`
        : `<a href="${base}login.html" class="nav-link">Sign In</a>`,
    ].filter(Boolean).join('');

    drawer.innerHTML = drawerLinks;
  })();

  function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
})();
