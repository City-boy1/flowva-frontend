import AppState from './state.js';
import Toast from './toast.js';
import api from './api.js';

const NOTIF_KEY = 'fv_notifs';

function _loadNotifs() {
  try {
    const raw = sessionStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _saveNotifs(list) {
  try { sessionStorage.setItem(NOTIF_KEY, JSON.stringify(list)); } catch {}
}

async function _fetchRealNotifs() {
  if (!AppState.isLoggedIn()) return [];
  try {
    const [msgRes, orderRes, adminNotifRes] = await Promise.all([
  api.messages?.getConversations?.() ?? Promise.resolve({ ok: false }),
  api.users?.getOrders?.() ?? Promise.resolve({ ok: false }),
  api.notifications?.list?.() ?? Promise.resolve({ ok: false }),
]);

    const notifs = [];

    if (msgRes.ok && msgRes.data?.conversations) {
      msgRes.data.conversations.forEach((c) => {
        const msg = c.lastMessage;
        if (!msg || msg.senderId === AppState.getUser()?.id) return;
        notifs.push({
          id:             msg._id || msg.conversationId || Date.now(),
          icon:           'message',
          text:           `New message: "${String(msg.content || '').slice(0, 60)}..."`,
          time:           _timeAgo(msg.createdAt),
          read:           !!msg.read,
          href:           'messages.html',
          _raw_createdAt: msg.createdAt,
        });
      });
    }

    if (orderRes.ok && orderRes.data?.orders) {
      orderRes.data.orders.slice(0, 5).forEach((o) => {
        notifs.push({
          id: o.id || Date.now(),
          icon: o.status === 'COMPLETED' ? 'check' : o.status === 'PAID' ? 'dollar' : 'package',
          text: `Order ${String(o.id || '').slice(-6)} — $${Number(o.amount || 0).toFixed(2)} · ${o.status}`,
          time: _timeAgo(o.createdAt),
          read: true,
          href: 'dashboard.html#overview',
        });
      });
    }


    if (adminNotifRes.ok && adminNotifRes.data?.notifications) {
      adminNotifRes.data.notifications.forEach((n) => {
        const iconMap = {
          TEMPLATE_APPROVED:    'check',
          TEMPLATE_REJECTED:    'reject',
          TEMPLATE_UNPUBLISHED: 'package',
        };
        notifs.push({
          id:             n.id,
          icon:           iconMap[n.type] ?? 'package',
          text:           n.message,
          time:           _timeAgo(n.createdAt),
          read:           n.read,
          type:           n.type,
          templateId:     n.templateId ?? null,
          href:           'dashboard.html',
          _raw_createdAt: n.createdAt,
        });
      });
    }

    notifs.sort((a, b) => {
      const ta = a._raw_createdAt ? new Date(a._raw_createdAt).getTime() : 0;
      const tb = b._raw_createdAt ? new Date(b._raw_createdAt).getTime() : 0;
      return tb - ta;
    });
    _saveNotifs(notifs);
    return notifs;
  } catch {
    return _loadNotifs();
  }
}

function _timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function _escape(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function _buildNavbarHTML() {
  const user = AppState.getUser();
  const isLoggedIn = AppState.hasSession();
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const links = [
    { href: '/index.html', label: 'Home' },
    { href: '/marketplace.html', label: 'Marketplace' },
    { href: '/dashboard.html', label: 'Dashboard', authOnly: true },
    { href: '/creator.html', label: 'Creators' },
    { href: '/project-marketplace.html', label: 'Projects', guestOnly: true },
    { href: 'footer/post-a-job.html', label: 'Hire', guestOnly: true },
    { href: 'footer/community.html', label: 'Community', guestOnly: true },
    { href: '/messages.html', label: 'Messages', authOnly: true },
    { href: '/admin.html', label: 'Admin', authOnly: true, adminOnly: true },
  ];

 const navLinkHTML = links
    .filter(l => (!l.authOnly || isLoggedIn) && (!l.adminOnly || user?.role === 'ADMIN'))
    .map(l => `
      <a href="${l.href}" class="nav-link ${currentPage === l.href ? 'active' : ''} ${l.adminOnly ? 'nav-link--admin' : ''} ${l.guestOnly && isLoggedIn ? 'nav-link--desktop-hidden' : ''}" data-navlink>
        ${l.label}
      </a>`)
    .join('');

  const avatarLetter = _escape((user?.name || 'U').charAt(0).toUpperCase());
  const avatarName = _escape(user?.name ?? '');

  const avatarContent = user?.avatarUrl
    ? `<img src="${_escape(user.avatarUrl)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block;" alt="${avatarName}">`
    : `<span class="avatar avatar--md avatar--placeholder" style="font-size:0.9rem;font-family:var(--font-display);font-weight:700;">${avatarLetter}</span>`;

  const authSection = isLoggedIn ? `
    <div class="nav-user-menu" id="nav-user-menu">
      <button class="nav-avatar-btn" id="nav-avatar-btn" aria-haspopup="true" aria-expanded="false" title="${avatarName}">
        ${avatarContent}
      </button>
      <div class="nav-dropdown" id="nav-dropdown" role="menu" style="opacity:0;pointer-events:none;transform:translateY(-8px) scale(0.97);">
        <div class="nav-dropdown-header">
          <span class="nav-dropdown-name">${avatarName}</span>
          <span class="nav-dropdown-role">${_escape(user?.role ?? '')}</span>
        </div>
        <div class="nav-dropdown-divider"></div>
        <a href="/dashboard.html" class="nav-dropdown-item" role="menuitem">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span> Dashboard
        </a>
        ${user?.role === 'ADMIN' ? `
<a href="/admin.html" class="nav-dropdown-item" role="menuitem">
  <span><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span> Admin Panel
</a>` : ''}
        <a href="/dashboard.html#settings" class="nav-dropdown-item" role="menuitem"
          onclick="sessionStorage.setItem('fv_nav_target','settings')">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span> Settings
        </a>
        <div class="nav-dropdown-divider"></div>
        <button class="nav-dropdown-item nav-dropdown-item--danger" id="nav-logout-btn" role="menuitem">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span> Logout
        </button>
      </div>
    </div>
  ` : `
    <a href="/login.html" class="btn btn--ghost btn--sm">Login</a>
    <a href="/signup.html" class="btn btn--primary btn--sm">Sign Up</a>
  `;

  return `
    <nav class="navbar" id="main-navbar" role="navigation" aria-label="Main navigation">
      <div class="container nav-content">
        <a href="/index.html" class="nav-logo-link"><img src="/assets/images/logo.png" class="nav-logo-img" alt="FLOWVA" id="nav-logo-img"></a>

        <div class="nav-links" id="nav-links" role="menubar">
          ${navLinkHTML}
        </div>

        <div class="nav-actions">
          ${isLoggedIn ? `
            <div class="notif-wrapper" id="notif-wrapper">
              <button class="notif-btn" id="notif-btn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span class="notif-badge hidden" id="notif-badge">0</span>
              </button>
              <div class="notif-panel" id="notif-panel" role="dialog" aria-label="Notifications">
                <div class="notif-header">
                  <h4>Notifications</h4>
                  <button class="notif-mark-all" id="notif-mark-all">Mark all read</button>
                </div>
                <div class="notif-list" id="notif-list">
                  <p style="padding:16px;color:var(--text-muted);font-size:0.85rem">Loading…</p>
                </div>
              </div>
            </div>
          ` : ''}

          ${authSection}

          <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme"></button>

          <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </nav>
  `;
}

function _getNotifIcon(type) {
  const icons = {
    message: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    check:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    dollar:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    reject:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    package: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  };
  return icons[type] ?? icons.package;
}

function _showRejectionModal(message) {
  document.getElementById('_fv_reject_modal')?.remove();
  const modal = document.createElement('div');
  modal.id = '_fv_reject_modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;
    display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:var(--bg-raised);border-radius:var(--radius-lg);max-width:420px;
      width:100%;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.5);
      border:1px solid rgba(239,68,68,0.25)">
      <div style="background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05));
        padding:24px;text-align:center;border-bottom:1px solid var(--border)">
        <div style="width:52px;height:52px;background:rgba(239,68,68,0.15);border-radius:50%;
          display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:700;
          color:var(--text-primary);margin-bottom:4px">Template Not Approved</h3>
        <p style="font-size:0.82rem;color:var(--text-muted)">Review the feedback below and resubmit</p>
      </div>
      <div style="padding:20px 24px">
        <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;
          background:var(--bg-overlay);border-radius:var(--radius-md);
          padding:12px 14px;border-left:3px solid #ef4444">${message}</p>
      </div>
      <div style="padding:0 24px 20px;display:flex;gap:10px">
        <button id="_fv_reject_close" style="flex:1;padding:10px;border-radius:var(--radius-md);
          background:var(--bg-overlay);border:1px solid var(--border);color:var(--text-secondary);
          cursor:pointer;font-family:var(--font-body);font-size:0.88rem">Dismiss</button>
        <a href="dashboard.html#upload" style="flex:1;padding:10px;border-radius:var(--radius-md);
          background:var(--accent-hover);color:#fff;text-align:center;text-decoration:none;
          font-family:var(--font-body);font-size:0.88rem;font-weight:600;
          display:flex;align-items:center;justify-content:center">Resubmit Template</a>
      </div>
    </div>`;
  modal.querySelector('#_fv_reject_close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function _renderNotifications(notifs) {
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('notif-badge');
  if (!list) return;

  const unread = notifs.filter(n => !n.read).length;
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.classList.toggle('hidden', unread === 0);
  }

  if (!notifs.length) {
    list.innerHTML = `<div class="notif-empty"><p>You're all caught up!</p></div>`;
    return;
  }

  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}"
      data-notif-id="${n.id}"
      data-type="${n.type ?? ''}"
      data-template-id="${n.templateId ?? ''}"
      data-notif-text="${_escape(n.text)}"
      ${n.href ? `data-href="${n.href}"` : ''}
      style="cursor:pointer">
      <div class="notif-icon">${_getNotifIcon(n.icon)}</div>
      <div class="notif-text">
        <p>${_escape(n.text)}</p>
        <span>${_escape(n.time)}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const id      = item.dataset.notifId;
      const type    = item.dataset.type;
      const updated = notifs.map(n => String(n.id) === String(id) ? { ...n, read: true } : n);
      _saveNotifs(updated);
      _renderNotifications(updated);
      api.notifications?.markAllRead?.();

      if (type === 'TEMPLATE_APPROVED' && item.dataset.templateId) {
        window.location.href = `marketplace.html?highlight=${item.dataset.templateId}`;
        return;
      }

      if (type === 'TEMPLATE_REJECTED' || type === 'TEMPLATE_UNPUBLISHED') {
        _showRejectionModal(item.dataset.notifText);
        return;
      }

      if (item.dataset.href) window.location.href = item.dataset.href;
    });
  });
}

async function _initNavbar() {
  const mount = document.getElementById('shared-navbar');
  if (!mount) return;

  mount.innerHTML = _buildNavbarHTML();

  await api.restoreSession();

if (AppState.isLoggedIn()) {
  const user = AppState.getUser();
  const lastFetch = sessionStorage.getItem('fv_me_fetched');
  const stale = !lastFetch || Date.now() - parseInt(lastFetch) > 5 * 60 * 1000;

  if (stale || !user?.avatarUrl) {
    api.auth.me().then(meRes => {
      if (meRes.ok && meRes.data?.user) {
        AppState.setAuth(AppState.getToken(), meRes.data.user);
        sessionStorage.setItem('fv_me_fetched', Date.now().toString());
        // Patch avatar in-place without re-rendering the navbar
        const updatedUser = meRes.data.user;
        const avatarBtn = document.getElementById('nav-avatar-btn');
        if (avatarBtn && updatedUser.avatarUrl) {
          avatarBtn.innerHTML = `<img src="${_escape(updatedUser.avatarUrl)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block;" alt="${_escape(updatedUser.name ?? '')}">`;
        }
      }
    });
  }
}

  // Inject dropdown styles once
  if (!document.getElementById('nav-dropdown-styles')) {
    const style = document.createElement('style');
    style.id = 'nav-dropdown-styles';
    style.textContent = `
    .nav-link--desktop-hidden { display: none; }
@media (max-width: 768px) { .nav-link--desktop-hidden { display: flex; } }
      .nav-user-menu { position: relative; }

      .nav-avatar-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        border-radius: 50%;
        transition: var(--transition-base);
      }

      .nav-avatar-btn:hover img,
      .nav-avatar-btn:hover .avatar--placeholder {
        box-shadow: 0 0 0 3px var(--accent-glow);
      }

      .nav-avatar-btn img {
        border-radius: 50%;
        transition: box-shadow var(--transition-base);
      }

      .nav-dropdown {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        width: 220px;
        background: var(--bg-raised);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        opacity: 0;
        pointer-events: none;
        transform: translateY(-8px) scale(0.97);
        transition: var(--transition-slow);
        z-index: var(--z-dropdown);
        overflow: hidden;
      }

      .nav-dropdown.open {
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: translateY(0) scale(1) !important;
      }

      .nav-dropdown-header {
        padding: 16px 18px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .nav-dropdown-name {
        font-weight: 700;
        font-size: 0.9rem;
        color: var(--text-primary);
        font-family: var(--font-display);
      }

      .nav-dropdown-role {
        font-size: 0.72rem;
        color: var(--accent-hover);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }

      .nav-dropdown-divider {
        height: 1px;
        background: var(--border);
        margin: 4px 0;
      }

      .nav-dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 11px 18px;
        font-size: 0.875rem;
        color: var(--text-secondary);
        transition: var(--transition-base);
        cursor: pointer;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        font-family: var(--font-body);
        text-decoration: none;
      }

      .nav-dropdown-item:hover {
        background: var(--accent-soft);
        color: var(--text-primary);
      }

      .nav-dropdown-item--danger { color: var(--danger); }
      .nav-dropdown-item--danger:hover {
        background: rgba(239,68,68,0.1);
        color: var(--danger);
      }
    `;
    document.head.appendChild(style);
  }

  // Scroll effect
  const navbar = document.getElementById('main-navbar');
  const onScroll = () => navbar?.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile toggle
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('mobile-open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    navLinks.querySelectorAll('[data-navlink]').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('mobile-open');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  // Avatar dropdown
  const avatarBtn = document.getElementById('nav-avatar-btn');
  const dropdown = document.getElementById('nav-dropdown');
  if (avatarBtn && dropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      avatarBtn.setAttribute('aria-expanded', open);
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !avatarBtn.contains(e.target)) {
        dropdown.classList.remove('open');
        avatarBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById('nav-logout-btn');
  logoutBtn?.addEventListener('click', async () => {
    try { await api.auth.logout(); } catch {}
    AppState.clearAuth();
    sessionStorage.clear();
    Toast.show('Logged out successfully', 'info');
    setTimeout(() => { window.location.href = '/index.html'; }, 600);
  });

  // ── Theme toggle ──
  const themeBtn = document.getElementById('theme-toggle');

  const ICON_MOON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const ICON_SUN  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

  if (themeBtn) {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    themeBtn.innerHTML = current === 'light' ? ICON_MOON : ICON_SUN;

    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('flowva-theme', next);
      themeBtn.innerHTML = next === 'light' ? ICON_MOON : ICON_SUN;
    });
  }

  // Notifications
  const notifBtn = document.getElementById('notif-btn');
  const notifPanel = document.getElementById('notif-panel');
  const markAllBtn = document.getElementById('notif-mark-all');

  if (notifBtn && notifPanel) {
    _fetchRealNotifs().then(_renderNotifications);

    notifBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const open = notifPanel.classList.toggle('open');
      notifBtn.setAttribute('aria-expanded', open);
      if (open) {
        const notifs = await _fetchRealNotifs();
        _renderNotifications(notifs);
      }
    });

    document.addEventListener('click', (e) => {
      if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
        notifPanel.classList.remove('open');
        notifBtn.setAttribute('aria-expanded', 'false');
      }
    });

    markAllBtn?.addEventListener('click', async () => {
  const notifs = _loadNotifs().map(n => ({ ...n, read: true }));
  _saveNotifs(notifs);
  _renderNotifications(notifs);
  await api.notifications?.markAllRead?.();
  Toast.show('All notifications marked as read', 'success');
});
  }
}

export function pushNotification(icon, text) {
  const notifs = _loadNotifs();
  notifs.unshift({ id: Date.now(), icon, text, time: 'Just now', read: false });
  _saveNotifs(notifs);
  const list = document.getElementById('notif-list');
  if (list) _renderNotifications(notifs);
}

document.addEventListener('DOMContentLoaded', async () => {
  await _initNavbar();
});