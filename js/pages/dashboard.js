import AppState from '../core/state.js';
import Toast    from '../core/toast.js';
import api      from '../core/api.js';

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function _initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function youtubeEmbed(url, title) {
  if (!url) return '';
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else id = u.searchParams.get('v');
    if (!id) return '';
    return `<iframe width="80" height="50" src="https://www.youtube.com/embed/${id}"
      frameborder="0" allowfullscreen
      style="border-radius:6px;flex-shrink:0"
      title="${_esc(title)}"></iframe>`;
  } catch { return ''; }
}


function animateCounter(el, target) {
  const duration = 1400;
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderChart(containerId, data) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const max = Math.max(...data.map(d => d.value), 1);
  wrap.innerHTML = data.map(d => `
    <div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${Math.round((d.value / max) * 100)}%" title="${_esc(d.label)}: ${d.value}"></div>
      <span class="chart-bar-label">${_esc(d.label)}</span>
    </div>
  `).join('');
}

function calcStrength(pwd) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return Math.min(4, s);
}

function getRole() { return (AppState.getUser()?.role ?? 'BUYER').toUpperCase(); }

async function initCreatorApplyBanner() {
  const banner = document.getElementById('creator-upgrade-banner');
  if (!banner) return;

  const ctaArea = document.getElementById('upgrade-cta-area');
  const res = await api.users.getRoleRequestStatus();

  if (res.ok && res.data?.request) {
    const { status, rejectionReason } = res.data.request;
    if (status === 'PENDING') {
      ctaArea.innerHTML = `
        <div class="upgrade-banner-status upgrade-banner-status--pending">
           Your application is under review — we'll email you within 48 hours.
        </div>`;
      return;
    }
    if (status === 'REJECTED') {
      ctaArea.innerHTML = `
        <div class="upgrade-banner-status upgrade-banner-status--rejected">
          ✕ Application not approved${rejectionReason ? `: ${rejectionReason}` : ''}.
        </div>
        <button class="btn btn--ghost" id="btn-apply-creator" style="margin-top:var(--space-3)">
          Re-apply
        </button>`;
    }
  }

  document.getElementById('btn-apply-creator')?.addEventListener('click', () => {
    document.getElementById('creator-apply-modal').classList.add('open');
    document.getElementById('apply-portfolio').value = '';
    document.getElementById('apply-software').value = '';
    document.getElementById('apply-bio').value = '';
    document.getElementById('apply-general-error').textContent = '';
    ['apply-portfolio-error', 'apply-software-error', 'apply-bio-error']
      .forEach(id => { document.getElementById(id).textContent = ''; });
  });

  document.getElementById('creator-apply-modal-close')?.addEventListener('click', () => {
    document.getElementById('creator-apply-modal').classList.remove('open');
  });
  document.getElementById('creator-apply-cancel')?.addEventListener('click', () => {
    document.getElementById('creator-apply-modal').classList.remove('open');
  });
  document.getElementById('creator-apply-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('creator-apply-modal')) {
      document.getElementById('creator-apply-modal').classList.remove('open');
    }
  });

  document.getElementById('creator-apply-submit')?.addEventListener('click', async () => {
    const portfolio = document.getElementById('apply-portfolio').value.trim();
    const software  = document.getElementById('apply-software').value.trim();
    const bio       = document.getElementById('apply-bio').value.trim();
    const generalEl = document.getElementById('apply-general-error');
    let valid = true;

    document.getElementById('apply-portfolio-error').textContent = '';
    document.getElementById('apply-software-error').textContent  = '';
    document.getElementById('apply-bio-error').textContent       = '';
    generalEl.textContent = '';

    if (!portfolio) {
      document.getElementById('apply-portfolio-error').textContent = 'Portfolio link is required';
      valid = false;
    } else {
      try {
      const u = new URL(portfolio);
      const host = u.hostname;
      if (u.protocol !== 'https:') throw new Error('not-https');
      if (!host.includes('.') || host === 'localhost') throw new Error('no-dot');
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(host)) throw new Error('private-ip');
      if ((host.split('.').pop()?.length ?? 0) < 2) throw new Error('bad-tld');
    } catch {
      document.getElementById('apply-portfolio-error').textContent = 'Must be a valid public https:// URL (e.g. https://behance.net/yourname)';
      valid = false;
    }
    }
    if (!software) {
      document.getElementById('apply-software-error').textContent = 'Please list your software';
      valid = false;
    }
    if (bio.length < 30) {
      document.getElementById('apply-bio-error').textContent = 'Minimum 30 characters';
      valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('creator-apply-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    const r = await api.users.submitRoleRequest({ portfolio, software, bio, message: '' });
    btn.disabled = false;
    btn.textContent = 'Submit Application';

    if (!r.ok) {
      generalEl.textContent = r.error ?? 'Failed to submit. Please try again.';
      return;
    }

    document.getElementById('creator-apply-modal').classList.remove('open');
    Toast.show('Application submitted! We\'ll review it within 48 hours. ✓', 'success');
    ctaArea.innerHTML = `
      <div class="upgrade-banner-status upgrade-banner-status--pending">
         Your application is under review — we'll email you within 48 hours.
      </div>`;
  });
}
function isCreator() { return ['CREATOR','ADMIN'].includes(getRole()); }

function applyRoleUI() {
  const buyerNav     = document.getElementById('buyer-nav');
  const creatorNav   = document.getElementById('creator-nav');
  const buyerOview   = document.getElementById('buyer-overview');
  const creatorOview = document.getElementById('creator-overview');
  const projSub      = document.getElementById('projects-subtitle');
  const overSub      = document.getElementById('overview-subtitle');

  if (isCreator()) {
    if (buyerNav)     buyerNav.style.display     = 'none';
    if (creatorNav)   creatorNav.style.display   = '';
    if (buyerOview)   buyerOview.style.display   = 'none';
    if (creatorOview) creatorOview.style.display = '';
    if (overSub)      overSub.textContent = 'Your performance at a glance';
    const creatorCta = document.getElementById('creator-marketplace-cta');
    if (creatorCta)   creatorCta.style.display = '';
  } else {
    if (buyerNav)     buyerNav.style.display     = '';
    if (creatorNav)   creatorNav.style.display   = 'none';
    if (buyerOview)   buyerOview.style.display   = '';
    if (creatorOview) creatorOview.style.display = 'none';
    if (overSub)      overSub.textContent = 'Your activity at a glance';
    const creatorCta = document.getElementById('creator-marketplace-cta');
    if (creatorCta)   creatorCta.style.display = 'none';
    if (projSub)      projSub.textContent = isCreator() ? 'Projects you\'ve bid on' : "Projects you've posted";
  }
}

async function loadBuyerOverview() {
  const [ordersRes, projectsRes] = await Promise.all([
    api.users.getOrders(),
    api.projects.list(),
  ]);

  if (ordersRes.ok && ordersRes.data?.orders) {
    const orders    = ordersRes.data.orders;
    const completed = orders.filter(o => ['PAID','COMPLETED'].includes(o.status) && o.type === 'TEMPLATE_PURCHASE');
    const totalSpent = completed.reduce((s, o) => s + Number(o.amount ?? 0), 0);

    const purchasesEl = document.getElementById('stat-purchases');
    const spentEl     = document.getElementById('stat-spent');
    if (purchasesEl) animateCounter(purchasesEl, completed.length);
    if (spentEl)     spentEl.textContent = totalSpent.toFixed(2);
  }

  const activeProjects = projectsRes.ok
    ? (projectsRes.data?.projects ?? []).filter(p => ['IN_PROGRESS','OPEN'].includes(p.status)).length
    : 0;
  const bprojEl = document.getElementById('stat-buyer-projects');
  if (bprojEl) animateCounter(bprojEl, activeProjects);

  // Saved — count from API, not localStorage
  const savedEl = document.getElementById('stat-saved');
  if (savedEl) {
    const favRes = await api.get('/users/favourites');
    const savedCount = favRes.ok ? (favRes.data?.favourites?.length ?? 0) : 0;
    animateCounter(savedEl, savedCount);
  }
  initCreatorApplyBanner();

  // Activity feed stays the same
  if (ordersRes.ok && ordersRes.data?.orders) {
    const orders     = ordersRes.data.orders;
    const activityEl = document.getElementById('buyer-activity-list');
    if (!activityEl) return;
    if (!orders.length) {
      activityEl.innerHTML = `
        <div class="empty-state" style="padding:24px 0">
          <h3>No purchases yet</h3>
          <a href="marketplace.html" class="btn btn--primary" style="margin-top:12px">Browse Templates</a>
        </div>`;
      return;
    }
    activityEl.innerHTML = orders.slice(0, 8).map(o => `
      <div class="activity-item">
        <div class="activity-dot" style="background:${o.status==='COMPLETED'?'var(--success)':o.status==='PAID'?'var(--info)':'var(--warning)'}"></div>
        <div class="activity-text">Order <strong>${_esc(String(o.id??'').slice(-6))}</strong> — $${Number(o.amount??0).toFixed(2)} · <span style="text-transform:capitalize">${_esc((o.status??'').toLowerCase())}</span></div>
        <div class="activity-time">${timeAgo(o.createdAt)}</div>
      </div>
    `).join('');
  }
}
async function loadCreatorOverview() {
  const [walletRes, ordersRes] = await Promise.all([api.payouts.getWallet(), api.users.getOrders()]);

 if (walletRes.ok && walletRes.data?.wallet) {
  const w = walletRes.data.wallet;
  const balEl     = document.getElementById('stat-balance');
  const revenueEl = document.getElementById('stat-revenue');
  if (balEl)     balEl.textContent = Number(w.availableBalance ?? 0).toFixed(2);
  if (revenueEl) revenueEl.textContent = Number(w.totalEarned ?? 0).toFixed(2);
}

  if (ordersRes.ok && ordersRes.data?.orders) {
    const orders    = ordersRes.data.orders;
    const completed = orders.filter(o => o.status === 'COMPLETED' && o.type === 'TEMPLATE_PURCHASE').length;    const active    = orders.filter(o => ['IN_PROGRESS','PAID'].includes(o.status)).length;
    const salesEl   = document.getElementById('stat-sales');
    const projEl    = document.getElementById('stat-projects');
    if (salesEl) animateCounter(salesEl, completed);
    if (projEl)  animateCounter(projEl, active);

    const activityEl = document.getElementById('activity-list');
    if (activityEl) {
      if (!orders.length) {
        activityEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No activity yet.</p>';
      } else {
        activityEl.innerHTML = orders.slice(0, 8).map(o => {
    const label = o.type === 'TEMPLATE_PURCHASE'
    ? (o.templateTitle ?? 'Template sale')
    : 'Project delivery';
    const dot = o.status==='COMPLETED' ? 'var(--success)' : o.status==='PAID' ? 'var(--info)' : 'var(--warning)';
    return `
    <div class="activity-item">
      <div class="activity-dot" style="background:${dot}"></div>
      <div class="activity-text">
        <strong>${_esc(label)}</strong> · $${Number(o.amount??0).toFixed(2)}
        <span style="color:var(--text-muted)"> from ${_esc(o.buyerName ?? 'Buyer')}</span>
        · <span style="text-transform:capitalize">${_esc((o.status??'').toLowerCase())}</span>
      </div>
      <div class="activity-time">${timeAgo(o.createdAt)}</div>
    </div>`;
}).join('');
      }
    }
  }
}


async function loadPurchases() {
  const list = document.getElementById('purchases-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading…</p>';
  const res = await api.users.getOrders();
  if (!res.ok || !res.data?.orders?.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛒</div><h3>No purchases yet</h3><a href="marketplace.html" class="btn btn--primary" style="margin-top:16px">Browse Templates</a></div>`;
    return;
  }
  const completed = res.data.orders.filter(o => ['PAID','COMPLETED'].includes(o.status) && o.type === 'TEMPLATE_PURCHASE');
if (!completed.length) { list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No purchases yet.</p>'; return; }
  list.innerHTML = completed.map(o => `
    <div class="project-item">
      <div class="project-thumb">▶</div>
      <div class="project-info">
        <h4>${_esc(o.templateTitle ?? o.template?.title ?? 'Template')}</h4>
        <p>$${Number(o.amount??0).toFixed(2)} · ${timeAgo(o.createdAt)}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${o.mongoTemplateId ? `<button class="btn btn--success btn--sm download-purchase-btn" data-template-id="${_esc(o.mongoTemplateId)}">⬇ Download</button>` : ''}        ${o.status === 'COMPLETED' && !o.rated
          ? `<button class="btn btn--ghost btn--sm rate-btn"
               data-order-id="${_esc(o.id)}"
               data-creator-id="${_esc(o.creatorId)}"
               style="color:var(--warning);border-color:rgba(245,158,11,0.3)">
               ⭐ Rate
             </button>`
          : o.rated ? `<span style="font-size:0.78rem;color:var(--text-muted)">Rated ✓</span>` : `<span class="badge badge--success">Purchased</span>`}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.download-purchase-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const templateId = btn.dataset.templateId;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    await api.restoreSession();
    const tokenRes = await api.get(`/templates/${templateId}/download-token`);
    if (!tokenRes.ok) {
      Toast.show(tokenRes.error || 'Download failed. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = '⬇ Download';
      return;
    }
    const BASE = window.FLOWVA_API_URL || 'http://127.0.0.1:5000/api';
    window.open(`${BASE}/templates/${templateId}/download?token=${encodeURIComponent(tokenRes.data.token)}`, '_blank');
    btn.disabled = false;
    btn.textContent = '⬇ Download';
  });
});

  list.querySelectorAll('.rate-btn').forEach(btn => {
    btn.addEventListener('click', () => openRatingModal(btn.dataset.orderId, btn.dataset.creatorId));
  });
}

async function loadMyTemplates() {
  const list = document.getElementById('my-templates-list');
  if (!list) return;
  list.innerHTML = '<p class="loading-text">Loading…</p>';

  const pendingSection = document.getElementById('templates-pending-section');
  const pendingList    = document.getElementById('my-templates-pending-list');
  const pendingCount   = document.getElementById('templates-pending-count');

  const userId = AppState.getUser()?._id ?? AppState.getUser()?.id;
  const res = await api.templates.list({ creatorId: userId, limit: 50 });

  if (!res.ok) {
    list.innerHTML = '<p class="loading-text">Could not load templates.</p>';
    return;
  }

  const all     = res.data?.templates ?? [];
  const pending = all.filter(t => t.status === 'PENDING');
  const visible = all.filter(t => t.status !== 'PENDING' && t.status !== 'REJECTED');

  // Pending section
  if (pendingSection && pendingList && pendingCount) {
    if (pending.length) {
      pendingSection.classList.remove('is-hidden');
      pendingCount.textContent = pending.length;
      pendingList.innerHTML = pending.map(t => `
        <div class="project-item project-item--pending">
          <div class="project-thumb"></div>
          <div class="project-info">
            <h4>${_esc(t.title)}</h4>
            <p>Submitted ${timeAgo(t.createdAt)}</p>
          </div>
          <span class="pending-status-badge"> Awaiting Review</span>
        </div>
      `).join('');
    } else {
      pendingSection.classList.add('is-hidden');
      pendingList.innerHTML = '';
    }
  }

  if (!visible.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">▶</div><h3>No published templates yet</h3><button class="btn btn--primary" id="templates-empty-upload-btn">Upload Now</button></div>`;
    document.getElementById('templates-empty-upload-btn')?.addEventListener('click', () => {
      document.querySelector('[data-target=upload]')?.click();
    });
    return;
  }

  list.innerHTML = visible.map(t => {
  const id = t._id ?? t.id;
  return `
    <div class="project-item" data-id="${_esc(String(id))}">
      <div class="project-thumb">
        ${t.previewUrl
          ? `<img src="${_esc(t.previewUrl)}" style="width:60px;height:40px;object-fit:cover;border-radius:6px">`
          : '▶'}
      </div>
      <div class="project-info">
        <h4>${_esc(t.title)}</h4>
        <p>$${Number(t.price??0).toFixed(2)} · ${Number(t.purchaseCount??0)} sales · <span style="text-transform:capitalize">${_esc((t.status??'').toLowerCase())}</span></p>
      </div>
      <span class="badge ${t.status==='APPROVED'?'badge--success':t.status==='PENDING'?'badge--warning':'badge--accent'}">${_esc(t.status??'')}</span>
      <button class="btn btn--ghost btn--sm copy-link-btn"
  data-id="${_esc(String(id))}"
  style="font-size:0.78rem">
  → Copy Link
</button>
      <button class="btn btn--danger btn--sm delete-template-btn"
        data-id="${_esc(String(id))}"
        data-title="${_esc(t.title)}">
        ✕ Delete
      </button>
    </div>
  `;
}).join('');

list.querySelectorAll('.copy-link-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const link = `${window.location.origin}/marketplace.html?template=${btn.dataset.id}`;
    navigator.clipboard.writeText(link).then(() => {
      Toast.show('Link copied! Buyers must purchase to download.', 'success');
    }).catch(() => {
      Toast.show(link, 'info');
    });
  });
});

list.querySelectorAll('.delete-template-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id    = btn.dataset.id;
    const title = btn.dataset.title;
    if (!confirm(`Delete "${title}" permanently? Cannot be undone.`)) return;
    btn.disabled    = true;
    btn.textContent = 'Deleting…';
    const res = await api.templates.delete(id);
    if (!res.ok) {
      Toast.show(res.error ?? 'Delete failed', 'error');
      btn.disabled    = false;
      btn.textContent = '✕ Delete';
      return;
    }
    Toast.show(`"${title}" deleted ✓`, 'success');
    btn.closest('.project-item').remove();
  });
});
}

async function loadMyTutorials() {
  const list = document.getElementById('my-tutorials-list');
  if (!list) return;
  list.innerHTML = '<p class="loading-text">Loading…</p>';

  const pendingSection = document.getElementById('tutorials-pending-section');
  const pendingList    = document.getElementById('my-tutorials-pending-list');
  const pendingCount   = document.getElementById('tutorials-pending-count');

  const userId = AppState.getUser()?._id ?? AppState.getUser()?.id;
  const res = await api.tutorials.list({ creatorId: userId, limit: 50 });

  if (!res.ok) {
    list.innerHTML = '<p class="loading-text">Could not load tutorials.</p>';
    return;
  }

  const all     = res.data?.tutorials?.tutorials ?? res.data?.tutorials ?? [];
  const pending = all.filter(t => t.status === 'PENDING');
  const visible = all.filter(t => t.status !== 'PENDING' && t.status !== 'REJECTED');

  if (pendingSection && pendingList && pendingCount) {
    if (pending.length) {
      pendingSection.classList.remove('is-hidden');
      pendingCount.textContent = pending.length;
      pendingList.innerHTML = pending.map(t => `
        <div class="project-item project-item--pending">
          <div class="project-thumb"></div>
          <div class="project-info">
            <h4>${_esc(t.title)}</h4>
            <p>Submitted ${timeAgo(t.createdAt)}</p>
          </div>
          <span class="pending-status-badge">Awaiting Review</span>
        </div>
      `).join('');
    } else {
      pendingSection.classList.add('is-hidden');
      pendingList.innerHTML = '';
    }
  }

  if (!visible.length) {
    list.innerHTML = '<p class="loading-text">No published tutorials yet.</p>';
    return;
  }

list.innerHTML = visible.map(t => {
    const ytThumb = (() => {
      try {
        const u = new URL(t.youtubeUrl || '');
        const id = u.hostname.includes('youtu.be')
          ? u.pathname.slice(1)
          : u.searchParams.get('v');
        return id ? `<img src="https://img.youtube.com/vi/${id}/default.jpg"
          style="width:80px;height:50px;object-fit:cover;border-radius:6px;flex-shrink:0">` : '';
      } catch { return ''; }
    })();
    const thumb = ytThumb
      ? ytThumb
      : t.thumbnailUrl
        ? `<img src="${_esc(t.thumbnailUrl)}" style="width:80px;height:50px;object-fit:cover;border-radius:6px;flex-shrink:0">`
        : `<div style="width:80px;height:50px;background:var(--bg-overlay);border-radius:6px;display:flex;align-items:center;justify-content:center">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
           </div>`;
      const ytUrl = t.youtubeUrl || '';
    return `
    <div class="project-item" style="cursor:pointer" data-yturl="${_esc(ytUrl)}" data-title="${_esc(t.title)}">
      <div style="width:80px;flex-shrink:0">${thumb}</div>
      <div class="project-info" style="flex:1;min-width:0">
        <h4>${_esc(t.title)}</h4>
        <p>${_esc((t.category ?? t.software ?? '').toString())} · ${timeAgo(t.createdAt)}</p>
      </div>
      ${ytUrl ? `<a href="${_esc(ytUrl)}" target="_blank" rel="noopener"
        class="btn btn--ghost btn--sm"
        style="flex-shrink:0;font-size:0.78rem"
        onclick="event.stopPropagation()">▶ Watch</a>` : ''}
    </div>
  `;
}).join('');

list.querySelectorAll('.project-item[data-yturl]').forEach(card => {
  card.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const url   = card.dataset.yturl;
    const title = card.dataset.title;
    if (!url) return;

    function getYtId(u) {
      try {
        const p = new URL(u);
        if (p.hostname.includes('youtu.be')) return p.pathname.slice(1);
        return p.searchParams.get('v');
      } catch { return null; }
    }
    const ytId = getYtId(url);

    document.getElementById('tut-dash-modal')?.remove();
    const m = document.createElement('div');
    m.id = 'tut-dash-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    m.innerHTML = `
      <div style="background:var(--bg-raised);border-radius:var(--radius-lg);max-width:780px;width:100%;position:relative;overflow:hidden">
        <button id="tut-dash-close" style="position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text-primary);font-size:1.4rem;cursor:pointer;z-index:1">✕</button>
        <div style="padding:16px 20px;font-weight:700;border-bottom:1px solid var(--border)">${_esc(title)}</div>
        ${ytId
          ? `<iframe width="100%" height="420"
              src="https://www.youtube.com/embed/${ytId}?autoplay=1"
              frameborder="0" allow="autoplay;encrypted-media" allowfullscreen
              style="display:block;background:#000;"></iframe>`
          : `<video controls autoplay playsinline style="width:100%;max-height:480px;display:block;background:#000">
               <source src="${_esc(url)}" type="video/mp4">
             </video>`
        }
      </div>`;
    m.querySelector('#tut-dash-close').addEventListener('click', () => m.remove());
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { m.remove(); document.removeEventListener('keydown', esc); }
    });
    document.body.appendChild(m);
  });
});
}

function renderJobCard(j) {
  const c = j.content ?? {};
  const title = c.title ?? 'Untitled Role';
  const statusBadge = { open:'badge--accent', filled:'badge--success', closed:'badge--muted' }[j.status] ?? 'badge--muted';
  const statusLabel = j.status === 'open' ? 'Open' : j.status === 'filled' ? 'Filled' : 'Closed';
  const typeLabel = j.jobType === 'full-time' ? 'Full-Time Role' : 'Contract Role';
  const fields = (c.fields ?? []).slice(0, 3);
  const salary = c.salary && (c.salary.min || c.salary.max) ? `$${c.salary.min ?? '—'}–${c.salary.max ?? '—'} / ${_esc(c.salary.period ?? '')}` : '—';
  const actions = (!isCreator() && j.status === 'open')
    ? `<button class="btn btn--primary btn--sm view-applicants-btn" data-id="${_esc(j.id)}" data-title="${_esc(title)}"> View Applicants</button>` : '';
  return `
    <div class="project-item" data-id="${_esc(j.id)}" style="flex-direction:column;align-items:flex-start;gap:8px">
      <div style="display:flex;align-items:center;gap:10px;width:100%">
        <div class="project-thumb">${c.logoUrl ? `<img src="${_esc(c.logoUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">` : '💼'}</div>
        <div class="project-info" style="flex:1;min-width:0">
          <h4>${_esc(title)}</h4>
          <p><span style="font-size:0.72rem;background:var(--bg-overlay);border:1px solid var(--border);border-radius:4px;padding:2px 8px;color:var(--text-muted);margin-right:6px">${_esc(typeLabel)}</span>${_esc(c.company ?? '')} · Salary: ${_esc(salary)}</p>
        </div>
        <span class="badge ${statusBadge}" style="flex-shrink:0">${_esc(statusLabel)}</span>
      </div>
      ${fields.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${fields.map(f=>`<span style="font-size:0.72rem;background:var(--bg-overlay);border:1px solid var(--border);border-radius:4px;padding:2px 8px;color:var(--text-muted)">${_esc(f)}</span>`).join('')}</div>` : ''}
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:4px">${actions}</div>
    </div>`;
}

async function loadProjects() {
  const list = document.getElementById('projects-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading…</p>';
  const userId = AppState.getUser()?.id ?? AppState.getUser()?._id;

  // Load both freelance projects and roles in parallel
  const [res, jobsRes] = await Promise.all([
    api.projects.list(
      isCreator()
        ? { scope: 'dashboard', userId, role: 'creator' }
        : { scope: 'dashboard', userId, role: 'client' }
    ),
    !isCreator() ? api.jobs.list({ postedBy: userId }) : Promise.resolve({ ok: false }),
  ]);

  const projects = res.ok ? (res.data?.projects ?? []) : [];
  const jobs     = jobsRes.ok ? (jobsRes.data?.jobs ?? []) : [];

  if (!projects.length && !jobs.length) {
    list.innerHTML = isCreator()
      ? `<div class="empty-state" style="padding:40px 20px;text-align:center">
           <h3>No bids yet</h3>
           <p style="color:var(--text-muted);margin-top:8px;font-size:0.9rem">Browse the project marketplace and submit a bid.</p>
           <a href="project-marketplace.html" class="btn btn--primary" style="margin-top:16px">Browse Projects</a>
         </div>`
      : `<div class="empty-state" style="padding:40px 20px;text-align:center">
           <h3>No projects or roles yet</h3>
           <p style="color:var(--text-muted);margin-top:8px;font-size:0.9rem">Post a freelance project or a full-time role.</p>
         </div>`;
    return;
  }

  let html = '';
  if (projects.length) {
    html += `<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent-hover);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">Freelance Projects</div>`;
    html += projects.map(p => {
  const title = p.content?.title ?? p.title ?? 'Project';
 const statusBadge = {
    PENDING: 'badge--warning', OPEN: 'badge--accent', IN_PROGRESS: 'badge--warning',
    COMPLETED: 'badge--success', DISPUTED: 'badge--danger',
    DELIVERED: 'badge--warning', REVISION_REQUESTED: 'badge--warning',
  }[p.status] ?? 'badge--muted';

  const statusLabel = p.status === 'PENDING' ? 'Under Review' : p.status;

  // Determine project type label from content
  const projectType = p.content?.jobType === 'full-time' ? 'Full-Time Role'
    : p.content?.jobType === 'contract' ? 'Contract Role'
    : 'One-off Project';

  const actions = [];

  // Creator: deliver work
  if (isCreator() && p.status === 'IN_PROGRESS') {
    actions.push(`<button class="btn btn--primary btn--sm deliver-btn"
      data-id="${_esc(p.id)}" data-title="${_esc(title)}"> Deliver</button>`);
  }

  // Client: view bids on open freelance project
  if (!isCreator() && p.status === 'OPEN' && p.type !== 'JOB_ROLE') {
    actions.push(`<button class="btn btn--primary btn--sm view-bids-btn"
      data-id="${_esc(p.id)}" data-title="${_esc(title)}"> View Bids</button>`);
  }

  // Client: view applicants on open full-time/contract role
  if (!isCreator() && p.status === 'OPEN' && p.type === 'JOB_ROLE') {
    actions.push(`<button class="btn btn--primary btn--sm view-applicants-btn"
      data-id="${_esc(p.id)}" data-title="${_esc(title)}"> View Applicants</button>`);
  }

  // Client: approve or request revision
  if (!isCreator() && p.status === 'DELIVERED') {
    actions.push(`<button class="btn btn--success btn--sm approve-delivery-btn"
      data-id="${_esc(p.id)}">✓ Approve</button>`);
    actions.push(`<button class="btn btn--ghost btn--sm revision-btn"
      data-id="${_esc(p.id)}">↩ Revision</button>`);
  }

  // Client or creator: open dispute
  if (['IN_PROGRESS','DELIVERED','REVISION_REQUESTED'].includes(p.status)) {
    actions.push(`<button class="btn btn--danger btn--sm dispute-btn"
      data-id="${_esc(p.id)}">! Dispute</button>`);
  }

  // Open bids for creator
  if (isCreator() && p.status === 'OPEN') {
    actions.push(`<button class="btn btn--primary btn--sm open-bid-btn"
      data-id="${_esc(p.id)}" data-title="${_esc(title)}">Place Bid</button>`);
  }

 const desc = p.content?.description ?? '';
  const skills = (p.content?.skills ?? []).slice(0, 3);
  const deadline = p.biddingClosesAt
    ? new Date(p.biddingClosesAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
    : '—';
  return `
    <div class="project-item" data-id="${_esc(p.id)}" style="cursor:pointer;flex-direction:column;align-items:flex-start;gap:8px">
      <div style="display:flex;align-items:center;gap:10px;width:100%">
        <div class="project-thumb">📁</div>
        <div class="project-info" style="flex:1;min-width:0">
           <h4>${_esc(title)}</h4>
          <p>
            <span style="font-size:0.72rem;background:var(--bg-overlay);border:1px solid var(--border);border-radius:4px;padding:2px 8px;color:var(--text-muted);margin-right:6px">${_esc(projectType)}</span>
            Budget: $${p.budget ?? '—'} · Deadline: ${deadline}
          </p>
          ${p.status === 'PENDING' ? `<p style="font-size:0.78rem;color:var(--warning);margin:2px 0 0 0">⏳ Under admin review — will go live once approved</p>` : ''}
        </div>
            <span class="badge ${statusBadge}" style="flex-shrink:0">${_esc(statusLabel)}</span>      </div>
      ${desc ? `<p style="font-size:0.83rem;color:var(--text-secondary);line-height:1.5;margin:0 0 4px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${_esc(desc)}</p>` : ''}
      ${skills.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${skills.map(s => `<span style="font-size:0.72rem;background:var(--bg-overlay);border:1px solid var(--border);border-radius:4px;padding:2px 8px;color:var(--text-muted)">${_esc(s)}</span>`).join('')}</div>` : ''}
      <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;margin-top:4px">
        ${actions.join('')}
      </div>
    </div>`;
    }).join('');
  }
  if (jobs.length) {
    html += `<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7c3aed;margin:${projects.length ? '32px' : '0'} 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)">Full-Time &amp; Contract Roles</div>`;
    html += jobs.map(j => renderJobCard(j)).join('');
  }
  list.innerHTML = html;

// Deliver
list.querySelectorAll('.deliver-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    const title = btn.dataset.title;

    if (!document.getElementById('deliver-modal')) {
      const m = document.createElement('div');
      m.className = 'modal-overlay';
      m.id = 'deliver-modal';
      m.innerHTML = `
        <div class="modal" style="max-width:500px">
          <div class="modal-header">
            <h2>Deliver Work</h2>
            <button class="modal-close" onclick="document.getElementById('deliver-modal').classList.remove('open')">✕</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
            <p id="deliver-project-name" style="color:var(--text-muted);font-size:0.85rem"></p>
             <div class="form-group">
              <label class="form-label">Delivery File *</label>
              <input class="form-input" type="file" id="deliver-file-input" accept="video/*,image/*,.zip,.pdf,.ae,.prproj">
              <span style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;display:block">
                Upload your completed file — max 200MB
              </span>
              <div id="deliver-upload-progress" style="display:none;margin-top:8px;font-size:0.8rem;color:var(--accent-hover)"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Message to Client *</label>
              <textarea class="form-input" id="deliver-note" rows="3" placeholder="Describe what you delivered and any usage instructions…" style="resize:vertical"></textarea>
            </div>
            <div id="deliver-error" style="display:none;color:var(--danger);font-size:0.85rem"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--ghost" onclick="document.getElementById('deliver-modal').classList.remove('open')">Cancel</button>
            <button class="btn btn--primary" id="deliver-submit-btn">Submit Delivery</button>
          </div>
        </div>`;
      m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
      document.body.appendChild(m);
    }

    document.getElementById('deliver-project-name').textContent = `Project: ${title}`;
    const deliverFileInput = document.getElementById('deliver-file-input');
    if (deliverFileInput) deliverFileInput.value = '';
    document.getElementById('deliver-note').value = '';
    document.getElementById('deliver-error').style.display = 'none';
    document.getElementById('deliver-modal').classList.add('open');

    const oldBtn = document.getElementById('deliver-submit-btn');
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.replaceWith(newBtn);
    newBtn.addEventListener('click', async () => {
       const fileInput = document.getElementById('deliver-file-input');
      const note = document.getElementById('deliver-note').value.trim();
      const errEl = document.getElementById('deliver-error');
      const progressEl = document.getElementById('deliver-upload-progress');
      if (!fileInput.files?.[0]) { errEl.textContent = 'Please select a file to deliver'; errEl.style.display = 'block'; return; }
      if (note.length < 10) { errEl.textContent = 'Write a delivery message (min 10 characters)'; errEl.style.display = 'block'; return; }
      errEl.style.display = 'none';
      newBtn.disabled = true; newBtn.textContent = 'Uploading…';
      progressEl.style.display = 'block'; progressEl.textContent = 'Uploading file…';
      const fd = new FormData();
      fd.append('file', fileInput.files[0]);
      const up = await api.projects.uploadAttachment(fd);
      if (!up.ok || !up.data?.url) {
        errEl.textContent = 'File upload failed. Please try again.';
        errEl.style.display = 'block';
        newBtn.disabled = false; newBtn.textContent = 'Submit Delivery';
        progressEl.style.display = 'none';
        return;
      }
      progressEl.textContent = 'Submitting delivery…';
      const r = await api.projects.deliver(id, { deliveryNote: note, fileUrl: up.data.url });
      newBtn.disabled = false; newBtn.textContent = 'Submit Delivery';
      if (!r.ok) { errEl.textContent = r.error ?? 'Failed'; errEl.style.display = 'block'; return; }
      document.getElementById('deliver-modal').classList.remove('open');
      Toast.show('Delivery submitted! Waiting for client approval. ✓', 'success');
      loadProjects();
    });
  });
});

// Approve delivery
list.querySelectorAll('.approve-delivery-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!confirm('Approve this delivery? Payment will be released to the creator.')) return;
    btn.disabled = true;
    const r = await api.projects.approveDelivery(btn.dataset.id);
    btn.disabled = false;
    if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); return; }
    Toast.show('Delivery approved! Payment released. ✓', 'success');
    loadProjects();
  });
});

// Request revision
list.querySelectorAll('.revision-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const note = prompt('What needs to be revised?');
    if (!note || note.length < 5) return;
    const r = await api.projects.requestRevision(btn.dataset.id, note);
    if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); return; }
    Toast.show('Revision requested.', 'info');
    loadProjects();
  });
});

// Dispute
list.querySelectorAll('.dispute-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const reason = prompt('Describe the issue (min 10 characters):');
    if (!reason || reason.length < 10) return;
    if (!confirm('Open a dispute? Funds will be frozen until admin resolves it.')) return;
    const r = await api.projects.openDispute(btn.dataset.id, reason);
    if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); return; }
    Toast.show('Dispute opened. Admin will review within 48 hours.', 'warning');
    loadProjects();
  });
});

list.querySelectorAll('.view-bids-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const projectId = btn.dataset.id;
    const projectTitle = btn.dataset.title;
    btn.disabled = true; btn.textContent = 'Loading…';
    const res = await api.projects.getBids(projectId);
    btn.disabled = false; btn.textContent = '📋 View Bids';
    if (!res.ok) { Toast.show(res.error ?? 'Could not load bids', 'error'); return; }

    const bids = res.data?.bids ?? [];
    if (!document.getElementById('bids-modal')) {
      const m = document.createElement('div');
      m.className = 'modal-overlay';
      m.id = 'bids-modal';
      m.innerHTML = `
        <div class="modal" style="max-width:600px">
          <div class="modal-header">
            <h2 id="bids-modal-title">Bids</h2>
            <button class="modal-close" onclick="document.getElementById('bids-modal').classList.remove('open')">✕</button>
          </div>
          <div class="modal-body" id="bids-modal-body" style="max-height:65vh;overflow-y:auto"></div>
        </div>`;
      m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
      document.body.appendChild(m);
    }

    document.getElementById('bids-modal-title').textContent = `Bids for: ${projectTitle}`;
    const body = document.getElementById('bids-modal-body');

    if (!bids.length) {
      body.innerHTML = '<p style="color:var(--text-muted);padding:20px 0">No bids yet.</p>';
    } else {
      body.innerHTML = bids.map(b => `
        <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-3)" data-bid-id="${_esc(b.id)}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <strong style="font-size:0.9rem">${_esc(b.creatorName ?? 'Creator')}</strong>
              <span class="badge badge--${b.status==='ACCEPTED'?'success':b.status==='PENDING'?'warning':'muted'}" style="margin-left:8px">${_esc(b.status)}</span>
            </div>
            <strong style="color:var(--success);font-size:1rem">$${Number(b.amount??0).toFixed(2)}</strong>
          </div>
          <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:6px">⏱ ${b.content?.deliveryDays ?? '—'} days delivery</p>
          <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:10px">${_esc(b.content?.proposal ?? '')}</p>
          ${b.status === 'PENDING' ? `
            <div style="display:flex;gap:8px">
              <button class="btn btn--primary btn--sm accept-bid-btn"
              data-project-id="${_esc(projectId)}"
              data-bid-id="${_esc(b.id)}"
              data-creator-id="${_esc(b.creatorId ?? '')}"
              data-creator-name="${_esc(b.creatorName ?? 'Creator')}"
              data-amount="${Number(b.amount ?? 0)}">✓ Accept Bid</button>
              <button class="btn btn--danger btn--sm reject-bid-btn" data-project-id="${_esc(projectId)}" data-bid-id="${_esc(b.id)}">✕ Reject</button>
            </div>` : ''}
        </div>`).join('');

      body.querySelectorAll('.accept-bid-btn').forEach(ab => {
  ab.addEventListener('click', async () => {
    if (!confirm('Accept this bid? The project will move to In Progress and the creator will be notified.')) return;
    ab.disabled = true; ab.textContent = 'Accepting…';
    const r = await api.projects.acceptBid(ab.dataset.projectId, ab.dataset.bidId);
    if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); ab.disabled = false; ab.textContent = '✓ Accept Bid'; return; }
    document.getElementById('bids-modal').classList.remove('open');
    loadProjects();

    // ── Open escrow payment modal ──────────────────────────────────────────
    const bidAmount = Number(ab.closest('[data-bid-id]')
      ?.querySelector('strong')?.textContent?.replace('$','') ?? 0);
    openEscrowPaymentModal({
      projectId:  ab.dataset.projectId,
      bidId:      ab.dataset.bidId,
      creatorId:  ab.dataset.creatorId ?? '',
      creatorName: ab.closest('[data-bid-id]')?.querySelector('strong')?.closest('div')
                    ?.querySelector('strong')?.textContent ?? 'Creator',
      amount:     bidAmount,
    });
  });
});

      body.querySelectorAll('.reject-bid-btn').forEach(rb => {
        rb.addEventListener('click', async () => {
          rb.disabled = true; rb.textContent = 'Rejecting…';
          const r = await api.projects.rejectBid(rb.dataset.projectId, rb.dataset.bidId);
          if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); rb.disabled = false; rb.textContent = '✕ Reject'; return; }
          Toast.show('Bid rejected', 'info');
          rb.closest('[data-bid-id]').remove();
        });
      });
    }

    document.getElementById('bids-modal').classList.add('open');
  });
});

list.querySelectorAll('.view-applicants-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const jobId    = btn.dataset.id;
    const jobTitle = btn.dataset.title;
    btn.disabled = true; btn.textContent = 'Loading…';
    const res = await api.jobs.getApplicants(jobId);
    btn.disabled = false; btn.textContent = ' View Applicants';
    if (!res.ok) { Toast.show(res.error ?? 'Could not load applicants', 'error'); return; }

    const applicants = res.data?.applicants ?? [];

    if (!document.getElementById('applicants-modal')) {
      const m = document.createElement('div');
      m.className = 'modal-overlay';
      m.id = 'applicants-modal';
      m.innerHTML = `
        <div class="modal" style="max-width:620px">
          <div class="modal-header">
            <h2 id="applicants-modal-title">Applicants</h2>
            <button class="modal-close" onclick="document.getElementById('applicants-modal').classList.remove('open')">✕</button>
          </div>
          <div class="modal-body" id="applicants-modal-body" style="max-height:65vh;overflow-y:auto"></div>
        </div>`;
      m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
      document.body.appendChild(m);
    }

    document.getElementById('applicants-modal-title').textContent = `Applicants for: ${jobTitle}`;
    const body = document.getElementById('applicants-modal-body');

    if (!applicants.length) {
      body.innerHTML = '<p style="color:var(--text-muted);padding:20px 0">No applications yet.</p>';
    } else {
      body.innerHTML = applicants.map(a => `
        <div class="card" style="padding:var(--space-4);margin-bottom:var(--space-3)" data-applicant-id="${_esc(a.userId)}">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            ${a.avatarUrl
              ? `<img src="${_esc(a.avatarUrl)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0">`
              : `<div style="width:44px;height:44px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0;font-size:0.9rem">
                  ${_esc((a.name || '?').charAt(0).toUpperCase())}
                 </div>`}
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:0.95rem">${_esc(a.name ?? 'Applicant')}</div>
              <div style="font-size:0.78rem;color:var(--text-muted)">${_esc(a.field ?? '')} · Applied ${timeAgo(a.appliedAt)}</div>
            </div>
            <span class="badge badge--${a.status === 'ACCEPTED' ? 'success' : a.status === 'REJECTED' ? 'danger' : 'warning'}"
              style="flex-shrink:0">${_esc(a.status ?? 'PENDING')}</span>
          </div>

          ${a.coverLetter ? `<p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:10px;padding:10px 14px;background:var(--bg-overlay);border-radius:var(--radius-md)">${_esc(a.coverLetter)}</p>` : ''}

          ${a.portfolioUrl ? `<a href="${_esc(a.portfolioUrl)}" target="_blank" rel="noopener" style="font-size:0.8rem;color:var(--accent-hover);display:inline-flex;align-items:center;gap:4px;margin-bottom:10px">
            → View Portfolio
          </a>` : ''}

          ${a.status === 'PENDING' ? `
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn--success btn--sm accept-applicant-btn"
                data-job-id="${_esc(jobId)}"
                data-user-id="${_esc(a.userId)}"
                data-name="${_esc(a.name ?? '')}">
                ✓ Accept
              </button>
              <button class="btn btn--danger btn--sm reject-applicant-btn"
                data-job-id="${_esc(jobId)}"
                data-user-id="${_esc(a.userId)}"
                data-name="${_esc(a.name ?? '')}">
                ✕ Reject
              </button>
              <a href="creator.html?id=${_esc(a.userId)}" target="_blank"
                class="btn btn--ghost btn--sm" style="font-size:0.78rem">
                View Profile
              </a>
            </div>` : ''}
        </div>`).join('');

      // Accept applicant
      body.querySelectorAll('.accept-applicant-btn').forEach(ab => {
  ab.addEventListener('click', async () => {
    if (!confirm(`Accept ${ab.dataset.name} for this role?`)) return;
    ab.disabled = true; ab.textContent = 'Accepting…';
    const r = await api.jobs.acceptApplicant(ab.dataset.jobId, ab.dataset.userId);
    if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); ab.disabled = false; ab.textContent = '✓ Accept'; return; }
    Toast.show(`${ab.dataset.name} accepted!`, 'success');
    document.getElementById('applicants-modal').classList.remove('open');
    const convId = r.data?.conversationId;
    if (convId) sessionStorage.setItem('fv_open_conversation', convId);
    sessionStorage.setItem('fv_nav_target', 'messages');
    setTimeout(() => { window.location.href = 'messages.html'; }, 600);
  });
});
      // Reject applicant
      body.querySelectorAll('.reject-applicant-btn').forEach(rb => {
        rb.addEventListener('click', async () => {
          if (!confirm(`Reject ${rb.dataset.name}'s application?`)) return;
          rb.disabled = true; rb.textContent = 'Rejecting…';
          const r = await api.jobs.rejectApplicant(rb.dataset.jobId, rb.dataset.userId);
          if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); rb.disabled = false; rb.textContent = '✕ Reject'; return; }
          Toast.show(`${rb.dataset.name} rejected.`, 'info');
          rb.closest('[data-applicant-id]').remove();
        });
      });
    }

    document.getElementById('applicants-modal').classList.add('open');
  });
});

list.querySelectorAll('.open-bid-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const wrap = document.getElementById('bid-form-wrap');
    const titleEl = document.getElementById('bid-project-title');
    if (titleEl) titleEl.textContent = `Bidding on: ${btn.dataset.title}`;
    wrap.style.display = 'block';
    wrap.dataset.projectId = btn.dataset.id;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('bid-amount')?.focus();
  });
});

document.getElementById('bid-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('bid-form-wrap').style.display = 'none';
});

document.getElementById('bid-submit-btn')?.addEventListener('click', async () => {
  const wrap     = document.getElementById('bid-form-wrap');
  const projectId = wrap.dataset.projectId;
  const amount   = parseFloat(document.getElementById('bid-amount')?.value);
  const days     = parseInt(document.getElementById('bid-days')?.value, 10);
  const proposal = document.getElementById('bid-proposal')?.value.trim();
  const errEl    = document.getElementById('bid-error');
  errEl.style.display = 'none';

  if (!amount || amount < 1) { errEl.textContent = 'Enter a valid bid amount'; errEl.style.display = 'block'; return; }
  if (!days   || days < 1)   { errEl.textContent = 'Enter delivery days';       errEl.style.display = 'block'; return; }
  if (!proposal)             { errEl.textContent = 'Write a proposal';          errEl.style.display = 'block'; return; }

  const btn = document.getElementById('bid-submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  const res = await api.projects.submitBid(projectId, {
    amount, deliveryDays: days, proposal,
  });

  btn.disabled = false; btn.textContent = 'Submit Bid';

  if (!res.ok) {
    errEl.textContent = res.error ?? 'Failed to submit bid';
    errEl.style.display = 'block';
    return;
  }

  Toast.show('Bid submitted successfully! ✓', 'success');
  wrap.style.display = 'none';
  document.getElementById('bid-amount').value = '';
  document.getElementById('bid-days').value = '';
  document.getElementById('bid-proposal').value = '';
});

list.querySelectorAll('.project-item').forEach(card => {
  card.style.cursor = 'pointer';
  card.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    const id = card.dataset.id;
    if (id) openProjectDetailModal(id);
  });
});
}

// ── Favourites ────────────────────────────────────────────────────────────────
async function loadFavourites() {
  const list = document.getElementById('favourites-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading…</p>';

  const res  = await api.get('/users/favourites');
  const ids  = res.ok ? (res.data?.favourites ?? []) : [];

  if (!ids.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;text-align:center">
        <h3>No favourites yet</h3>
        <p style="color:var(--text-muted);margin-top:8px">Heart a template in the marketplace to save it here</p>
        <a href="marketplace.html" class="btn btn--primary" style="margin-top:16px">Browse Templates</a>
      </div>`;
    return;
  }

  const results   = await Promise.all(ids.map(id => api.templates.get(id)));
  const templates = results.filter(r => r.ok).map(r => r.data?.template).filter(Boolean);

  if (!templates.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Could not load saved templates.</p>';
    return;
  }

  list.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--space-4)">
      ${templates.map(t => `
        <div class="card card--hover" style="padding:0;overflow:hidden">
          ${t.previewUrl
            ? `<img src="${_esc(t.previewUrl)}" style="width:100%;height:130px;object-fit:cover;display:block">`
            : `<div style="width:100%;height:130px;background:linear-gradient(135deg,#1a0a3e,#4c1d95);display:flex;align-items:center;justify-content:center;font-size:2.5rem">▶</div>`}
          <div style="padding:var(--space-4)">
            <h4 style="margin-bottom:4px;font-size:0.92rem">${_esc(t.title)}</h4>
            <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">$${Number(t.price).toFixed(2)}</p>
            <a href="marketplace.html" class="btn btn--ghost btn--sm" style="width:100%;text-align:center;display:block">View in Marketplace</a>
          </div>
        </div>
      `).join('')}
    </div>`;
}

// ── Following ─────────────────────────────────────────────────────────────────
async function loadFollowing() {
  const list = document.getElementById('following-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading…</p>';
  const res = await api.users.getFollowing();
  if (!res.ok || !res.data?.following?.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;text-align:center">
        <h3>Not following anyone yet</h3>
        <p style="color:var(--text-muted);margin-top:8px">Discover creators on the marketplace</p>
        <a href="creator.html" class="btn btn--primary btn--sm" style="margin-top:16px">Browse Creators</a>
      </div>`;
    return;
  }

  const currentUserId = AppState.getUser()?.id ?? AppState.getUser()?._id;

  list.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-4)">
      ${res.data.following.map(c => {
        // followerCount from API — real server value
        const followers = Number(c.followerCount ?? 0);
        const color = (() => {
          const colors = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6'];
          let hash = 0;
          const id = c.id ?? '';
          for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
          return colors[Math.abs(hash) % colors.length];
        })();
        return `
          <div class="card card--hover" style="padding:var(--space-4)">
            <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)">
              <a href="creator.html?id=${_esc(c.id)}" style="display:flex;align-items:center;gap:var(--space-3);text-decoration:none;flex:1;min-width:0">
                ${c.avatarUrl
                  ? `<img src="${_esc(c.avatarUrl)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0">`
                  : `<div style="width:44px;height:44px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:0.9rem;flex-shrink:0">
                      ${_esc((c.name||'?').charAt(0).toUpperCase())}
                     </div>`
                }
                <div style="min-width:0">
                  <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-primary)">${_esc(c.name)}</div>
                  <div style="font-size:0.78rem;color:var(--text-muted)">${followers.toLocaleString()} follower${followers !== 1 ? 's' : ''}</div>
                </div>
              </a>
              <button class="btn btn--ghost btn--sm unfollow-btn"
                data-id="${_esc(c.id)}"
                data-name="${_esc(c.name)}"
                style="flex-shrink:0;font-size:0.78rem">
                Unfollow
              </button>
            </div>
            ${c.bio ? `<p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${_esc(c.bio)}</p>` : ''}
          </div>`;
      }).join('')}
    </div>`;

  // Wire unfollow buttons
  list.querySelectorAll('.unfollow-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name;
      btn.disabled    = true;
      btn.textContent = '…';
      const res = await api.users.toggleFollow(id);
      if (!res.ok) {
        btn.disabled    = false;
        btn.textContent = 'Unfollow';
        Toast.show(res.error || 'Could not unfollow', 'error');
        return;
      }
      Toast.show(`Unfollowed ${name}`, 'info');
      // Reload the panel to reflect updated follower counts
      loadFollowing();
    });
  });
}

function updatePayoutMethodOptions(country, selectedValue = '') {
  const select      = document.getElementById('payout-method');
  const accountInput = document.getElementById('payout-account');
  if (!select) return;
  const opts = PAYOUT_OPTIONS[country] ?? PAYOUT_OPTIONS.default;
  select.innerHTML = opts.map(o =>
    `<option value="${_esc(o.value)}"${o.value===selectedValue?' selected':''}>${_esc(o.label)}</option>`
  ).join('');
  if (accountInput) accountInput.placeholder = PAYOUT_PLACEHOLDERS[select.value] ?? 'Account details';
}

async function loadPayoutHistory() {
  const el = document.getElementById('payout-history-list');
  if (!el) return;
  const res = await api.payouts.getHistory();
  if (!res.ok || !res.data?.history?.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No payouts yet.</p>';
    return;
  }
  el.innerHTML = res.data.history.map(tx => `
    <div class="activity-item" style="border-bottom:1px solid var(--border);padding:var(--space-3) 0">
      <div class="activity-dot" style="background:${tx.status==='COMPLETED'?'var(--success)':tx.status==='PENDING'?'var(--warning)':'var(--text-muted)'}"></div>
      <div class="activity-text"><strong>$${Number(tx.amount??0).toFixed(2)}</strong> via ${_esc(tx.method??'—')}</div>
      <div class="activity-time">${_esc(tx.status??'')}</div>
    </div>
  `).join('');
}

async function initPayoutPanel() {
  const balEl     = document.getElementById('payout-balance');
  const pendingEl = document.getElementById('payout-pending');
  if (balEl)     balEl.textContent = '…';
  if (pendingEl) pendingEl.textContent = 'Loading…';

  // Ensure we have a fresh user object with country populated
  const meRes = await api.auth.me();
  if (meRes.ok && meRes.data?.user) {
    AppState.setAuth(AppState.getToken(), { ...AppState.getUser(), ...meRes.data.user });
  }
  const userCountry = (AppState.getUser()?.country ?? '').toUpperCase();
  const isGhana     = userCountry === 'GH';

  // Show Paystack payout block for Ghanaian creators
  const paystackWrap = document.getElementById('paystack-payout-wrap');
  if (paystackWrap) paystackWrap.style.display = isGhana ? 'block' : 'none';

  const walletRes = await api.payouts.getWallet();
  if (walletRes.ok && walletRes.data?.wallet) {
    const w = walletRes.data.wallet;
    if (balEl)     balEl.textContent = `$${Number(w.availableBalance ?? 0).toFixed(2)} USD`;
    if (pendingEl) pendingEl.textContent = `$${Number(w.pendingBalance ?? 0).toFixed(2)} pending`;
  } else {
    if (balEl)     balEl.textContent = '$—';
    if (pendingEl) pendingEl.textContent = 'Could not load balance';
  }

  const settingsRes = await api.payouts.getSettings();
  const s = settingsRes.ok ? settingsRes.data?.settings : null;
  const method = (s?.primaryMethod ?? 'USDC_WALLET').toUpperCase();

  const usdcInfo = document.getElementById('payout-usdc-info');

  if (method === 'USDC_WALLET') {
    if (usdcInfo) usdcInfo.style.display = 'block';
    const skrillEl = document.getElementById('skrill-email');
    const greyEl   = document.getElementById('grey-account');
    const psAcctEl = document.getElementById('paystack-account');
    const psTypeEl = document.getElementById('paystack-type');
    if (skrillEl) skrillEl.value = s?.skrillEmail ?? '';
    if (greyEl)   greyEl.value   = s?.greyAccount ?? '';
    if (psAcctEl && s?.paystackAccount) psAcctEl.value = s.paystackAccount;
    if (psTypeEl && s?.paystackType)    psTypeEl.value = s.paystackType;
  } else {
    if (usdcInfo) usdcInfo.style.display = 'none';
  }

document.getElementById('save-wallet-btn')?.addEventListener('click', async () => {
    const skrill = document.getElementById('skrill-email')?.value.trim();
    const grey   = document.getElementById('grey-account')?.value.trim();
    const psType = document.getElementById('paystack-type')?.value ?? '';
    const psAcct = document.getElementById('paystack-account')?.value.trim() ?? '';
    if (!skrill && !grey && !(isGhana && psAcct)) {
        Toast.show('Please enter at least one payout method', 'warning');
        return;
    }
    const res = await api.payouts.updateSettings({
        skrillEmail:     skrill,
        greyAccount:     grey,
        paystackType:    isGhana ? psType  : undefined,
        paystackAccount: isGhana ? psAcct  : undefined,
    });
    if (!res.ok) { Toast.show(res.error ?? 'Failed to save payout details', 'error'); return; }
    Toast.show('Payout details saved ✓', 'success');
  });

  loadPayoutHistory();
}

async function initSettingsPanel() {
  const saveBtn = document.getElementById('prefs-save-btn');
  if (!saveBtn) return;

  // Always re-fetch preferences on every visit
  const prefRes = await api.users.getPreferences();
  if (prefRes.ok && prefRes.data?.preferences) {
    const p = prefRes.data.preferences;
    const emailEl  = document.getElementById('pref-email-notif');
    const marketEl = document.getElementById('pref-marketing');
    const publicEl = document.getElementById('pref-public-profile');
    if (emailEl)  emailEl.checked  = p.emailNotif    ?? true;
    if (marketEl) marketEl.checked = p.marketing     ?? false;
    if (publicEl) publicEl.checked = p.publicProfile ?? true;
  }

  // Guard only the listener binding, not the whole function
  // Replace button to strip any old listeners
  const freshBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(freshBtn, saveBtn);

  freshBtn.addEventListener('click', async () => {
    freshBtn.disabled = true;
    const prefs = {
      emailNotif:    document.getElementById('pref-email-notif')?.checked    ?? true,
      marketing:     document.getElementById('pref-marketing')?.checked      ?? false,
      publicProfile: document.getElementById('pref-public-profile')?.checked ?? true,
    };
    const res = await api.users.savePreferences(prefs);
    freshBtn.disabled = false;
    if (!res.ok) { Toast.show(res.error ?? 'Failed to save preferences', 'error'); return; }
    Toast.show('Preferences saved ✓', 'success');
  });
    saveBtn.disabled = true;
    const prefs = {
      emailNotif:    document.getElementById('pref-email-notif')?.checked    ?? true,
      marketing:     document.getElementById('pref-marketing')?.checked      ?? false,
      publicProfile: document.getElementById('pref-public-profile')?.checked ?? true,
    };
    const res = await api.users.savePreferences(prefs);
    
  const user = AppState.getUser();
  if (!user) return;

  const nameEl     = document.getElementById('profile-name');
  const emailEl    = document.getElementById('profile-email');
  const bioEl      = document.getElementById('profile-bio');
  const countryEl  = document.getElementById('profile-country');
  const avatarPrev = document.getElementById('settings-avatar-preview');
  const bioCount   = document.getElementById('bio-char-count');

  if (nameEl)    nameEl.value    = user.name    ?? '';
  if (emailEl)   emailEl.value   = user.email   ?? '';
  if (bioEl)     bioEl.value     = user.bio     ?? '';
  if (countryEl) countryEl.value = user.country ?? 'GH';

  if (avatarPrev) {
  if (user.avatarUrl) {
    avatarPrev.innerHTML = `<img src="${_esc(user.avatarUrl)}" class="avatar-preview-img" alt="Avatar">`;
    document.getElementById('avatar-delete-btn')?.classList.remove('hidden');
  } else {
    avatarPrev.textContent = _initials(user.name ?? '');
    avatarPrev.style.fontSize = '1.4rem';
    document.getElementById('avatar-delete-btn')?.classList.add('hidden');
  }
  avatarPrev.classList.add('settings-avatar-ready');
}

  if (bioEl && bioCount) {
    bioCount.textContent = `${bioEl.value.length} / 500`;
    bioEl.addEventListener('input', () => { bioCount.textContent = `${bioEl.value.length} / 500`; });
  }

  const idEl     = document.getElementById('info-user-id');
  const roleEl   = document.getElementById('info-role');
  const joinedEl = document.getElementById('info-joined');
  const earlyEl  = document.getElementById('info-early');
  const statusEl = document.getElementById('info-status');
  if (idEl)     idEl.textContent = `…${(user.id ?? user._id ?? '').slice(-8)}`;
  if (roleEl)   roleEl.textContent = user.role ?? '—';
  if (joinedEl) joinedEl.textContent = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—';
  if (earlyEl)  earlyEl.innerHTML = user.isEarlyAdopter ? '<span class="badge badge--accent">✦ Early Adopter</span>' : 'No';
  if (statusEl) statusEl.innerHTML = user.status === 'ACTIVE' ? '<span class="badge badge--success">Active</span>' : `<span class="badge badge--warning">${_esc(user.status??'—')}</span>`;

  const sessionEl = document.getElementById('session-info');
  if (sessionEl) {
    const ua = navigator.userAgent;
    const browser = ua.includes('Chrome')?'Chrome':ua.includes('Firefox')?'Firefox':ua.includes('Safari')?'Safari':ua.includes('Edge')?'Edge':'Browser';
    const os = ua.includes('Windows')?'Windows':ua.includes('Mac')?'macOS':ua.includes('Linux')?'Linux':ua.includes('Android')?'Android':'iOS';
    sessionEl.textContent = `${browser} on ${os} · Signed in now`;
  }

  const avatarBtn   = document.getElementById('avatar-upload-btn');
  const avatarInput = document.getElementById('avatar-file-input');
  avatarBtn?.addEventListener('click', () => avatarInput?.click());
  
  document.getElementById('avatar-delete-btn')?.addEventListener('click', async () => {
  const deleteBtn = document.getElementById('avatar-delete-btn');
  if (!confirm('Remove your profile photo? Your initials will be shown instead.')) return;
  deleteBtn.disabled = true;
  deleteBtn.textContent = 'Removing…';
  const res = await api.delete('/users/avatar');
  deleteBtn.disabled = false;
  deleteBtn.textContent = 'Remove Photo';
  if (!res.ok) { Toast.show(res.error ?? 'Failed to remove photo', 'error'); return; }
  AppState.setAuth(AppState.getToken(), { ...AppState.getUser(), avatarUrl: null });
  const updatedUser = AppState.getUser();
  if (avatarPrev) {
    avatarPrev.innerHTML = '';
    avatarPrev.textContent = _initials(updatedUser?.name ?? '');
    avatarPrev.style.fontSize = '1.4rem';
  }
  deleteBtn.classList.add('hidden');
  Toast.show('Profile photo removed ✓', 'success');
});

  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { Toast.show('Image must be under 2MB', 'error'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      Toast.show('Please use a JPG, PNG, or WebP image', 'error');
      return;
    }
    avatarBtn.disabled = true; avatarBtn.textContent = 'Uploading…';
    const formData = new FormData();
    formData.append('avatar', file);

    await api.restoreSession().catch(() => {});

    const res = await api.users.uploadAvatar(formData);
    avatarBtn.disabled = false; avatarBtn.textContent = 'Change Photo';

    if (!res.ok) {
      Toast.show(res.error ?? 'Upload failed. Please try again.', 'error');
      avatarInput.value = '';
      return;
    }
    if (res.data?.avatarUrl) {
  AppState.setAuth(AppState.getToken(), { ...AppState.getUser(), avatarUrl: res.data.avatarUrl });
  if (avatarPrev) avatarPrev.innerHTML = `<img src="${_esc(res.data.avatarUrl)}" class="avatar-preview-img" alt="Avatar">`;
  document.getElementById('avatar-delete-btn')?.classList.remove('hidden');
    }
    Toast.show('Photo updated ✓', 'success');
    avatarInput.value = '';
  });

  document.getElementById('profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('profile-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    const res = await api.users.updateProfile({
      name:    document.getElementById('profile-name')?.value.trim(),
      bio:     document.getElementById('profile-bio')?.value.trim(),
      country: document.getElementById('profile-country')?.value,
    });
    btn.disabled = false; btn.textContent = 'Save Changes';
    if (!res.ok) { Toast.show(res.error ?? 'Failed to save', 'error'); return; }
    AppState.setAuth(AppState.getToken(), { ...AppState.getUser(), ...res.data.user });
    Toast.show('Profile saved ✓', 'success');
  });

  const EYE_OPEN = `
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor" stroke-width="1.8"/>
      <circle cx="12" cy="12" r="3"
          stroke="currentColor" stroke-width="1.8"/>
  </svg>
`;

const EYE_CLOSED = `
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"/>
        <line x1="1" y1="1" x2="23" y2="23"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"/>
    </svg>
`;

function bindToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.innerHTML = EYE_CLOSED; // initial state (password hidden)

  btn.addEventListener('click', () => {
    const input = document.getElementById(inputId);
    if (!input) return;

    const isPass = input.type === 'password';

    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass ? EYE_OPEN : EYE_CLOSED;
  });
}
  bindToggle('curr-pass-toggle','current-password');
  bindToggle('new-pass-toggle','new-password');
  bindToggle('delete-pass-toggle','delete-password');

  document.getElementById('new-password')?.addEventListener('input', function () {
    const strength = calcStrength(this.value);
    const colors = ['','#ef4444','#f97316','#eab308','#22c55e'];
    ['sb1','sb2','sb3','sb4'].forEach((id,i) => {
      const bar = document.getElementById(id);
      if (bar) bar.style.background = i < strength ? colors[strength] : '';
    });
  });

  document.getElementById('password-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const currentPass = document.getElementById('current-password')?.value;
    const newPass     = document.getElementById('new-password')?.value;
    const confirmPass = document.getElementById('confirm-password')?.value;
    const currErr     = document.getElementById('current-pass-error');
    const newErr      = document.getElementById('new-pass-error');
    const confErr     = document.getElementById('confirm-pass-error');
    if (currErr) currErr.textContent = '';
    if (newErr)  newErr.textContent  = '';
    if (confErr) confErr.textContent = '';
    let valid = true;
    if (!currentPass) { if (currErr) currErr.textContent = 'Enter your current password'; valid = false; }
    if (!newPass || newPass.length < 6) { if (newErr) newErr.textContent = 'Min 6 characters'; valid = false; }
    if (newPass !== confirmPass) { if (confErr) confErr.textContent = 'Passwords do not match'; valid = false; }
    if (!valid) return;
    const btn = document.getElementById('password-save-btn');
    btn.disabled = true; btn.textContent = 'Updating…';
    const res = await api.users.changePassword({ currentPassword: currentPass, newPassword: newPass });
    btn.disabled = false; btn.textContent = 'Update Password';
    if (!res.ok) {
      const msg = res.error ?? 'Failed to update password';
      if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect')) {
        if (currErr) currErr.textContent = msg;
      } else { Toast.show(msg, 'error'); }
      return;
    }
    Toast.show('Password updated ✓', 'success');
    document.getElementById('password-form').reset();
    ['sb1','sb2','sb3','sb4'].forEach(id => { const bar = document.getElementById(id); if (bar) bar.style.background = ''; });
  });

  const deleteModal = document.getElementById('delete-modal');
  const deleteError = document.getElementById('delete-error');

  document.getElementById('open-delete-modal')?.addEventListener('click', () => {
    deleteModal?.classList.add('open');
    const dp = document.getElementById('delete-password');
    if (dp) dp.value = '';
    if (deleteError) deleteError.textContent = '';
  });

  function closeDeleteModal() {
    deleteModal?.classList.remove('open');
    const dp = document.getElementById('delete-password');
    if (dp) dp.value = '';
    if (deleteError) deleteError.textContent = '';
  }

  document.getElementById('delete-modal-close')?.addEventListener('click', closeDeleteModal);
  document.getElementById('delete-cancel')?.addEventListener('click', closeDeleteModal);
  deleteModal?.addEventListener('click', e => { if (e.target === deleteModal) closeDeleteModal(); });

  document.getElementById('delete-confirm')?.addEventListener('click', async () => {
    const password = document.getElementById('delete-password')?.value;
    if (!password) { if (deleteError) deleteError.textContent = 'Password is required'; return; }
    const btn = document.getElementById('delete-confirm');
    btn.disabled = true; btn.textContent = 'Deleting…';
    const res = await api.users.deleteAccount(password);
    btn.disabled = false; btn.textContent = 'Delete My Account';
    if (!res.ok) { if (deleteError) deleteError.textContent = res.error ?? 'Failed to delete account'; return; }
    AppState.clearAuth();
    sessionStorage.clear();
    Toast.show('Account deleted. Sorry to see you go.', 'info');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
  });
}

function initUploadPanel() {
  // ── Wizard state ──────────────────────────────────────────────────────────
  let wizStep = 1;
  let wizCategory = null;    // e.g. 'motion', 'design', 'animation', '3d', 'universal'
  let wizDevice   = 'desktop';
  let templateFile = null;
  let previewFile  = null;
  let thumbFile    = null;

  // Detect device
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  wizDevice = isMobile ? 'mobile' : 'desktop';
  const hintEl = document.getElementById('wiz-device-hint');
  if (hintEl) hintEl.textContent = `We detected you're on a ${wizDevice === 'mobile' ? 'mobile device' : 'desktop'}. Choose your template category below.`;

  if (isMobile) {
    document.querySelector('.wiz-tab[data-device="mobile"]')?.classList.add('active');
    document.querySelector('.wiz-tab[data-device="desktop"]')?.classList.remove('active');
    document.getElementById('wiz-cats-desktop').style.display = 'none';
    document.getElementById('wiz-cats-mobile').style.display = 'grid';
  }

  // ── Helper: go to step ────────────────────────────────────────────────────
  function goTo(step) {
    wizStep = step;
    document.querySelectorAll('.wizard-screen').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === step);
    });
    document.querySelectorAll('.upload-step').forEach(el => {
      const n = parseInt(el.dataset.step);
      el.classList.toggle('active', n === step);
    });
  }

  // ── Step 1: device tabs ───────────────────────────────────────────────────
  document.querySelectorAll('.wiz-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      wizDevice = tab.dataset.device;
      document.querySelectorAll('.wiz-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.getElementById('wiz-cats-desktop').style.display = wizDevice === 'desktop' ? 'grid' : 'none';
      document.getElementById('wiz-cats-mobile').style.display  = wizDevice === 'mobile'  ? 'grid' : 'none';
      wizCategory = null;
      document.getElementById('wiz-next-1').disabled = true;
      document.querySelectorAll('.wiz-cat-card').forEach(c => c.classList.remove('selected'));
    });
  });

  // ── Step 1: category select ───────────────────────────────────────────────
  const CAT_ACCEPT = {
    motion:           'video/mp4,.aep,.aet,.mogrt,.prproj,.drp,.fcpxml,.motion,.veg,.hfp',
    design:           '.psd,.psb,.ai,.eps,.svg,.ait,.indd,.idml,.indt,.cdr,.cdt,.afdesign,.afphoto,.afpub,.sketch,.fig,.procreate,.kra,.pxd',
    animation:        '.blend,.c4d,.ma,.mb,.max,.moho,.xsh,.fla,.xfl',
    '3d':             '.obj,.fbx,.glb,.gltf,.stl',
    universal:        'image/png,image/jpeg,application/pdf,video/mp4,video/quicktime,.gif',
    'mobile-design':  '.plp,.ibis,.pxd',
    'mobile-animation':'.alm,.kmproject,.vnproj',
    capcut:           '',
  };

  document.querySelectorAll('.wiz-cat-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.wiz-cat-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      wizCategory = card.dataset.cat;
      document.getElementById('wiz-next-1').disabled = false;
    });
  });

  document.getElementById('wiz-next-1')?.addEventListener('click', () => {
    // Update accepted file types for step 2
    const accept = CAT_ACCEPT[wizCategory] ?? '';
    document.getElementById('wiz-file-input').accept = accept;
    const hintText = {
      motion: 'AEP, MOGRT, PRPROJ, DRP, MP4…',
      design: 'PSD, AI, EPS, SVG, FIG, INDD…',
      animation: 'BLEND, C4D, MA, FLA, SPINE…',
      '3d': 'OBJ, FBX, GLB, GLTF, STL…',
      universal: 'PNG, JPG, PDF, MP4, MOV, GIF',
      'mobile-design': 'PLP, IbisPaint (.ibis), PXD…',
      'mobile-animation': 'ALM (Alight), KMPROJECT (Kinemaster), VNProj…',
      capcut: 'Paste CapCut link in Details step',
    }[wizCategory] ?? '';
    const hintSpan = document.getElementById('wiz-accepted-hint');
    if (hintSpan) hintSpan.textContent = `— Accepted: ${hintText}`;
    goTo(2);
  });

  // ── Step 2: file drops ────────────────────────────────────────────────────
  function bindDrop(zoneId, inputId, infoId, onFile) {
    const zone  = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const info  = document.getElementById(infoId);
    zone?.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone?.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone?.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files[0]) { input.files = e.dataTransfer.files; onFile(e.dataTransfer.files[0], info); } });
    input?.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0], info); });
  }

  function showFileInfo(file, infoEl) {
    if (!infoEl) return;
    const emoji = file.type.startsWith('image/') ? '🖼' : file.type.startsWith('video/') ? '▶' : '📦';
    infoEl.style.display = 'flex';
    infoEl.innerHTML = `<span>${emoji}</span><span style="font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(file.name)}</span><span style="font-size:0.75rem;color:var(--text-muted)">${(file.size/1024/1024).toFixed(1)}MB</span>`;
  }

  bindDrop('wiz-drop-zone', 'wiz-file-input', 'wiz-file-info', (file, info) => {
    templateFile = file;
    showFileInfo(file, info);
    document.getElementById('wiz-next-2').disabled = !thumbFile;
  });

  bindDrop('wiz-preview-zone', 'wiz-preview-input', 'wiz-preview-info', (file, info) => {
    if (file.size > 200 * 1024 * 1024) { Toast.show('Preview video must be under 200MB', 'error'); return; }
    previewFile = file;
    showFileInfo(file, info);
  });

  bindDrop('wiz-thumb-zone', 'wiz-thumb-input', null, (file) => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { Toast.show('Thumbnail must be JPEG or PNG', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { Toast.show('Thumbnail must be under 5MB', 'error'); return; }
    thumbFile = file;
    const preview = document.getElementById('wiz-thumb-preview');
    const img     = document.getElementById('wiz-thumb-img');
    if (preview && img) { img.src = URL.createObjectURL(file); preview.style.display = 'block'; }
    document.getElementById('wiz-next-2').disabled = !templateFile;
  });

  document.getElementById('wiz-back-2')?.addEventListener('click', () => goTo(1));
  document.getElementById('wiz-next-2')?.addEventListener('click', () => goTo(3));

  // ── Step 3: details ───────────────────────────────────────────────────────
  document.getElementById('wiz-price')?.addEventListener('input', function () {
    const p = parseFloat(this.value) || 0;
    document.getElementById('wiz-creator-earn').textContent  = `$${(p * 0.8).toFixed(2)}`;
    document.getElementById('wiz-platform-earn').textContent = `$${(p * 0.2).toFixed(2)}`;
  });

  document.getElementById('wiz-back-3')?.addEventListener('click', () => goTo(2));
  document.getElementById('wiz-next-3')?.addEventListener('click', () => {
    const title  = document.getElementById('wiz-title')?.value.trim();
    const subcat = document.getElementById('wiz-subcategory')?.value;
    const price  = document.getElementById('wiz-price')?.value;
    const desc   = document.getElementById('wiz-desc')?.value.trim();
    const errEl  = document.getElementById('wiz-details-error');
    if (!title || !subcat || !price || !desc) {
      errEl.textContent = 'Please fill all required fields.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    // Populate review
    const catLabel = { motion:'Motion Graphics', design:'Graphic Design', animation:'Animation 2D/3D', '3d':'3D Assets', universal:'Universal Export', 'mobile-design':'Mobile Design', 'mobile-animation':'Mobile Animation', capcut:'CapCut Link' };
    document.getElementById('rev-category').textContent = catLabel[wizCategory] ?? wizCategory;
    document.getElementById('rev-title').textContent    = title;
    document.getElementById('rev-price').textContent    = `$${parseFloat(price).toFixed(2)} USD`;
    document.getElementById('rev-software').textContent = document.getElementById('wiz-software')?.value || '—';
    document.getElementById('rev-file').textContent     = templateFile?.name ?? '—';

    // Show thumb preview in review
    const revThumb = document.getElementById('wiz-review-thumb');
    if (revThumb && thumbFile) {
      revThumb.innerHTML = `<img src="${URL.createObjectURL(thumbFile)}" style="width:100%;max-width:320px;border-radius:var(--radius-md);border:1px solid var(--border)">`;
    }

    goTo(4);
  });

  // ── Step 4: submit ────────────────────────────────────────────────────────
  document.getElementById('wiz-back-4')?.addEventListener('click', () => goTo(3));

  document.getElementById('wiz-submit-btn')?.addEventListener('click', async () => {
    const errEl = document.getElementById('wiz-submit-error');
    errEl.style.display = 'none';

    const formData = new FormData();
    formData.append('title',       document.getElementById('wiz-title').value.trim());
    formData.append('category',    document.getElementById('wiz-subcategory').value);
    formData.append('price',       document.getElementById('wiz-price').value);
    formData.append('description', document.getElementById('wiz-desc').value.trim());
    formData.append('software',    JSON.stringify(
      (document.getElementById('wiz-software')?.value || '')
        .split(',').map(s => s.trim()).filter(Boolean)
    ));
    formData.append('tags',     JSON.stringify([]));
    formData.append('currency', 'USD');
    formData.append('file',     templateFile);
    if (thumbFile)   formData.append('thumbnail', thumbFile);
    if (previewFile) formData.append('preview',   previewFile);

    const btn = document.getElementById('wiz-submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-9-9"/></svg> Uploading 0%…`;

    await api.restoreSession().catch(() => {});
    const res = await api.upload('/templates', formData, pct => {
      btn.innerHTML = pct < 100
        ? `Uploading ${pct}%…`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-9-9"/></svg> Processing…`;
    });

    btn.disabled = false;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Submit for Review`;

    if (!res.ok) {
      errEl.textContent = res.data?.message ?? res.error ?? 'Upload failed. Please try again.';
      errEl.style.display = 'block';
      return;
    }

    Toast.show('Template submitted! Pending admin review before going live.', 'success');
    // Reset wizard
    templateFile = null; previewFile = null; thumbFile = null; wizCategory = null;
    document.querySelectorAll('.wiz-cat-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('wiz-next-1').disabled = true;
    document.getElementById('wiz-next-2').disabled = true;
    document.getElementById('wiz-file-info').style.display   = 'none';
    document.getElementById('wiz-preview-info').style.display = 'none';
    document.getElementById('wiz-thumb-preview').style.display = 'none';
    goTo(1);
    activateTab('templates');
  });
}

async function initTutorialUploadPanel() {
  const tutForm = document.getElementById('tutorial-form');

  // Wire video file input
  const videoInput = document.getElementById('tut-video-input');
  const videoZone  = document.getElementById('tut-video-zone');
  const videoInfo  = document.getElementById('tut-video-info');
  const videoName  = document.getElementById('tut-video-name');
  const videoSize  = document.getElementById('tut-video-size');

  let selectedVideo = null;

  function setVideo(file) {
    if (!file) return;
    const allowed = ['video/mp4','video/quicktime','video/webm','video/x-msvideo'];
    if (!allowed.includes(file.type)) { Toast.show('Please upload MP4, MOV, or WEBM', 'error'); return; }
    if (file.size > 500 * 1024 * 1024) { Toast.show('Video must be under 500MB', 'error'); return; }
    selectedVideo = file;
    videoName.textContent = file.name;
    videoSize.textContent = `${(file.size / 1024 / 1024).toFixed(1)}MB`;
    videoInfo.style.display = 'flex';
  }

  videoInput?.addEventListener('change', () => {
    if (videoInput.files?.[0]) setVideo(videoInput.files[0]);
  });

  videoZone?.addEventListener('dragover', e => { e.preventDefault(); videoZone.classList.add('dragover'); });
  videoZone?.addEventListener('dragleave', () => videoZone.classList.remove('dragover'));
  videoZone?.addEventListener('drop', e => {
    e.preventDefault();
    videoZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) setVideo(e.dataTransfer.files[0]);
  });

  // Populate linked templates dropdown
  const tutTemplateSelect = document.getElementById('tut-template');
  if (tutTemplateSelect && isCreator()) {
    const userId = AppState.getUser()?._id ?? AppState.getUser()?.id;
    const res = await api.templates.list({ creatorId: userId, limit: 50 });
    const approved = (res.data?.templates ?? []).filter(t => t.status === 'APPROVED');
    approved.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t._id ?? t.id;
      opt.textContent = t.title;
      tutTemplateSelect.appendChild(opt);
    });
  }

  tutForm?.addEventListener('submit', async e => {
    e.preventDefault();

    const title    = document.getElementById('tut-title')?.value.trim();
    const software = document.getElementById('tut-software')?.value;
    const desc     = document.getElementById('tut-desc')?.value.trim();
    const errorEl  = document.getElementById('tutorial-error');

    if (!title || !software || !desc) {
      if (errorEl) { errorEl.textContent = 'Please fill all required fields.'; errorEl.style.display = 'block'; }
      return;
    }
    if (!selectedVideo) {
      if (errorEl) { errorEl.textContent = 'Please select a video file to upload.'; errorEl.style.display = 'block'; }
      return;
    }
    if (errorEl) errorEl.style.display = 'none';

    const linkedTemplate = document.getElementById('tut-template')?.value;
    const btn = document.getElementById('tutorial-submit-btn');
    const progressWrap = document.getElementById('tut-upload-progress');
    const progressBar  = document.getElementById('tut-progress-bar');
    const progressText = document.getElementById('tut-progress-text');

    if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
    if (progressWrap) progressWrap.style.display = 'block';

    await api.restoreSession().catch(() => {});

    const formData = new FormData();
    formData.append('video',       selectedVideo);
    formData.append('title',       title);
    formData.append('category',    software);
    formData.append('description', desc);
    formData.append('isFree',      'true');
    if (linkedTemplate) formData.append('templateId', linkedTemplate);

    // Use XHR for upload progress
    const token = AppState.getToken();
    const BASE  = window.FLOWVA_API_URL || 'https://flowva-backend-ztai.onrender.com/api';

    const res = await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/tutorials`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.withCredentials = true;

      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          if (progressBar)  progressBar.style.width = `${pct}%`;
          if (progressText) progressText.textContent = pct < 100
            ? `Uploading… ${pct}%`
            : 'Processing on YouTube — this may take a moment…';
        }
      });

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ ok: xhr.status < 400, data, error: data.message || null });
        } catch {
          resolve({ ok: false, error: 'Response parse error' });
        }
      };
      xhr.onerror = () => resolve({ ok: false, error: 'Network error' });
      xhr.send(formData);
    });

    if (btn) { btn.disabled = false; btn.textContent = 'Submit Tutorial for Review'; }
    if (progressWrap) progressWrap.style.display = 'none';
    if (progressBar)  progressBar.style.width = '0%';

    if (!res.ok) {
      Toast.show(res.error ?? 'Upload failed', 'error');
      return;
    }

    Toast.show('Tutorial submitted for review! Admin will approve it before it goes live.', 'success');
    tutForm.reset();
    selectedVideo = null;
    if (videoInfo)  videoInfo.style.display  = 'none';
    loadMyTutorials();
  });
}
let _uploadInited    = false;
let _tutUploadInited = false;
let _settingsInited  = false;

async function openProjectDetailModal(projectId) {
  const res = await api.get(`/projects/${projectId}`);
  if (!res.ok) { Toast.show('Could not load project', 'error'); return; }
  const p = res.data?.project;
  const c = p.content ?? {};

  if (!document.getElementById('proj-detail-modal')) {
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'proj-detail-modal';
    m.innerHTML = `
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h2 id="pdm-title">Project</h2>
          <button class="modal-close" onclick="document.getElementById('proj-detail-modal').classList.remove('open')">✕</button>
        </div>
        <div class="modal-body" id="pdm-body"></div>
        <div class="modal-footer" id="pdm-footer"></div>
      </div>`;
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
    document.body.appendChild(m);
  }

  document.getElementById('pdm-title').textContent = c.title ?? 'Project';
  document.getElementById('pdm-body').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <span class="badge badge--success">$${Number(p.budget??0).toLocaleString()}</span>
      <span class="badge badge--${p.status==='OPEN'?'accent':p.status==='IN_PROGRESS'?'warning':'success'}">${p.status}</span>
      ${p.biddingClosesAt ? `<span class="badge badge--muted">Deadline: ${new Date(p.biddingClosesAt).toLocaleDateString()}</span>` : ''}
    </div>
    <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:16px">${_esc(c.description??'')}</p>
    ${(c.skills??[]).length ? `<div style="margin-bottom:16px"><strong style="font-size:0.8rem;color:var(--text-muted)">SKILLS</strong><div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">${c.skills.map(s=>`<span class="badge badge--muted">${_esc(s)}</span>`).join('')}</div></div>` : ''}`;

  const footer = document.getElementById('pdm-footer');
  if (isCreator() && p.status === 'OPEN') {
    footer.innerHTML = `
      <button class="btn btn--ghost" onclick="document.getElementById('proj-detail-modal').classList.remove('open')">Close</button>
      <button class="btn btn--primary" id="pdm-bid-btn">Place Bid</button>`;
    document.getElementById('pdm-bid-btn').onclick = () => {
      document.getElementById('proj-detail-modal').classList.remove('open');
      const wrap = document.getElementById('bid-form-wrap');
      document.getElementById('bid-project-title').textContent = `Bidding on: ${c.title}`;
      wrap.style.display = 'block';
      wrap.dataset.projectId = p.id;
      wrap.scrollIntoView({ behavior: 'smooth' });
    };
  } else {
    footer.innerHTML = `<button class="btn btn--ghost" onclick="document.getElementById('proj-detail-modal').classList.remove('open')">Close</button>`;
  }
  document.getElementById('proj-detail-modal').classList.add('open');
}

async function loadRatings() {
  const list = document.getElementById('ratings-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading…</p>';

  const userId = AppState.getUser()?.id ?? AppState.getUser()?._id;
  const res = await api.users.getCreatorRatings(userId);

  if (!res.ok || !res.data?.ratings?.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;text-align:center">
        <h3>No reviews yet</h3>
        <p style="color:var(--text-muted);margin-top:8px">Reviews appear here after buyers rate your work</p>
      </div>`;
    return;
  }

  const ratings = res.data.ratings;
  const avg = (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1);

  list.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-4);margin-bottom:var(--space-6);
      background:var(--bg-overlay);border:1px solid var(--border);border-radius:var(--radius-lg);
      padding:var(--space-5)">
      <div style="text-align:center">
        <div style="font-size:2.5rem;font-weight:800;font-family:var(--font-display);color:var(--accent)">${avg}</div>
        <div style="color:#f59e0b;font-size:1.1rem">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">${ratings.length} review${ratings.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--space-4)" id="ratings-feed">
      ${ratings.map(r => `
        <div class="card" style="padding:var(--space-5)" data-rating-id="${_esc(r.id)}">
          <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3)">
            <div style="width:38px;height:38px;border-radius:50%;background:#7c3aed;display:flex;
              align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;color:#fff;flex-shrink:0">
              ${_esc((r.rater?.name || '?').charAt(0).toUpperCase())}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:0.9rem">${_esc(r.rater?.name || 'Anonymous')}</div>
              <div style="color:#f59e0b;font-size:0.82rem">${'★'.repeat(r.score)}${'☆'.repeat(5 - r.score)}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);flex-shrink:0">
              ${new Date(r.createdAt).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}
            </div>
          </div>
          ${r.review ? `<p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin-bottom:var(--space-3)">${_esc(r.review)}</p>` : ''}
          ${r.reply ? `
            <div style="background:var(--bg-overlay);border-left:3px solid var(--accent);border-radius:0 var(--radius-md) var(--radius-md) 0;
              padding:var(--space-3) var(--space-4);margin-top:var(--space-3)">
              <div style="font-size:0.75rem;color:var(--accent);font-weight:600;margin-bottom:4px">Your reply</div>
              <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5;margin:0">${_esc(r.reply)}</p>
            </div>` : `
            <div style="margin-top:var(--space-3)" id="reply-area-${_esc(r.id)}">
              <button class="btn btn--ghost btn--sm reply-toggle-btn" data-id="${_esc(r.id)}"
                style="font-size:0.78rem">↩ Reply</button>
              <div class="reply-form" id="reply-form-${_esc(r.id)}" style="display:none;margin-top:var(--space-3)">
                <textarea class="form-input" rows="2" placeholder="Write a reply…"
                  id="reply-text-${_esc(r.id)}"
                  style="font-size:0.85rem;resize:vertical;margin-bottom:var(--space-2)"></textarea>
                <div style="display:flex;gap:var(--space-2)">
                  <button class="btn btn--primary btn--sm reply-submit-btn" data-id="${_esc(r.id)}">Send Reply</button>
                  <button class="btn btn--ghost btn--sm reply-cancel-btn" data-id="${_esc(r.id)}">Cancel</button>
                </div>
              </div>
            </div>`}
        </div>
      `).join('')}
    </div>`;

  _bindReplyEvents();
}

function _bindReplyEvents() {
  document.querySelectorAll('.reply-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = document.getElementById(`reply-form-${btn.dataset.id}`);
      if (form) { form.style.display = 'block'; btn.style.display = 'none'; }
    });
  });

  document.querySelectorAll('.reply-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const form   = document.getElementById(`reply-form-${btn.dataset.id}`);
      const toggle = document.querySelector(`.reply-toggle-btn[data-id="${btn.dataset.id}"]`);
      if (form)   form.style.display   = 'none';
      if (toggle) toggle.style.display = 'inline-flex';
    });
  });

  document.querySelectorAll('.reply-submit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id    = btn.dataset.id;
      const text  = document.getElementById(`reply-text-${id}`)?.value.trim();
      if (!text) { Toast.show('Please write a reply first', 'warning'); return; }
      btn.disabled = true; btn.textContent = 'Sending…';
      const res = await api.post(`/users/ratings/${id}/reply`, { reply: text });
      btn.disabled = false; btn.textContent = 'Send Reply';
      if (!res.ok) { Toast.show(res.error || 'Failed to send reply', 'error'); return; }
      Toast.show('Reply sent ✓', 'success');
      loadRatings();
    });
  });
}

async function loadCreatorCharts() {
  const res = await api.users.getOrders();
  if (!res.ok || !res.data?.orders) return;
  const orders = res.data.orders;

  const months = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({ label: d.toLocaleString('default', { month: 'short' }), date: d });
  }

  const revenueData = months.map(m => ({
    label: m.label,
    value: orders
      .filter(o =>
        o.status === 'COMPLETED' &&
        new Date(o.createdAt).getMonth() === m.date.getMonth() &&
        new Date(o.createdAt).getFullYear() === m.date.getFullYear()
      )
      .reduce((s, o) => s + Number(o.amount ?? 0), 0),
  }));

  const salesData = months.map(m => ({
    label: m.label,
    value: orders.filter(o =>
      o.status === 'COMPLETED' &&
      new Date(o.createdAt).getMonth() === m.date.getMonth() &&
      new Date(o.createdAt).getFullYear() === m.date.getFullYear()
    ).length,
  }));

  renderChart('revenue-chart', revenueData);
  renderChart('sales-chart',   salesData);
  renderChart('views-chart',   salesData);
  renderChart('conv-chart',    salesData);
}

function activateTab(target) {
  document.querySelectorAll('.dash-nav-item').forEach(i => i.classList.toggle('active', i.dataset.target === target));
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${target}`));
  history.replaceState(null, '', `#${target}`);

  if (target === 'payout'            && isCreator())       initPayoutPanel();
  if (target === 'ratings'           && isCreator())       loadRatings();
  if (target === 'templates'         && isCreator())       loadMyTemplates();
  if (target === 'tutorials-upload'  && isCreator())       loadMyTutorials();
  if (target === 'purchases'         && !isCreator())      loadPurchases();
  if (target === 'projects')                               loadProjects();
  if (target === 'following')                              loadFollowing();
  if (target === 'favourites')                             loadFavourites();
  if (target === 'faqs') { /* static content, nothing to load */ }
if (target === 'community-guidelines') { /* static content, nothing to load */ }
  if (target === 'upload'            && !_uploadInited)   { initUploadPanel();         _uploadInited    = true; }
  if (target === 'tutorials-upload'  && !_tutUploadInited){ initTutorialUploadPanel(); _tutUploadInited = true; }
  if (target === 'settings') { initSettingsPanel(); }
}

function openRatingModal(orderId, creatorId) {
  // Inject modal if not already present
  if (!document.getElementById('rating-modal')) {
    const m = document.createElement('div');
    m.className = 'modal-overlay';
    m.id = 'rating-modal';
    m.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-header">
          <h2>Rate this Creator</h2>
          <button class="modal-close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-4)">
          <div style="display:flex;gap:var(--space-2);justify-content:center" id="star-row">
            ${[1,2,3,4,5].map(n => `
              <button class="star-pick" data-score="${n}"
                style="font-size:2rem;background:none;border:none;cursor:pointer;
                color:var(--text-muted);transition:color 0.15s">☆</button>`).join('')}
          </div>
          <div class="form-group">
            <label class="form-label">Review (optional)</label>
            <textarea class="form-input" id="rating-review" rows="3"
              placeholder="Tell others about your experience…" style="resize:vertical"></textarea>
          </div>
          <div id="rating-error" style="display:none;color:var(--danger);font-size:0.85rem"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn--ghost modal-close">Cancel</button>
          <button class="btn btn--primary" id="rating-submit-btn">Submit Rating</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    // Star interaction
    const stars = m.querySelectorAll('.star-pick');
    let selectedScore = 0;
    stars.forEach(s => {
      s.addEventListener('mouseenter', () => {
        stars.forEach(x => x.textContent = Number(x.dataset.score) <= Number(s.dataset.score) ? '★' : '☆');
      });
      s.addEventListener('mouseleave', () => {
        stars.forEach(x => x.textContent = Number(x.dataset.score) <= selectedScore ? '★' : '☆');
        stars.forEach(x => x.style.color = Number(x.dataset.score) <= selectedScore ? 'var(--warning)' : 'var(--text-muted)');
      });
      s.addEventListener('click', () => {
        selectedScore = Number(s.dataset.score);
        stars.forEach(x => {
          const on = Number(x.dataset.score) <= selectedScore;
          x.textContent = on ? '★' : '☆';
          x.style.color = on ? 'var(--warning)' : 'var(--text-muted)';
        });
      });
    });

    m.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => m.classList.remove('open')));
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });

    m._getScore = () => selectedScore;
    m._resetScore = () => { selectedScore = 0; stars.forEach(x => { x.textContent = '☆'; x.style.color = 'var(--text-muted)'; }); };
  }

  const modal = document.getElementById('rating-modal');
  modal._resetScore();
  document.getElementById('rating-review').value = '';
  document.getElementById('rating-error').style.display = 'none';
  modal._orderId   = orderId;
  modal._creatorId = creatorId;
  modal.classList.add('open');

  const submitBtn = document.getElementById('rating-submit-btn');
  // Remove old listener to avoid stacking
  const newBtn = submitBtn.cloneNode(true);
  submitBtn.replaceWith(newBtn);
  newBtn.addEventListener('click', async () => {
    const score  = modal._getScore();
    const review = document.getElementById('rating-review').value.trim();
    const errEl  = document.getElementById('rating-error');
    if (!score) { errEl.textContent = 'Please select a star rating'; errEl.style.display='block'; return; }
    newBtn.disabled = true; newBtn.textContent = 'Submitting…';
    const res = await api.users.rateCreator({ orderId: modal._orderId, creatorId: modal._creatorId, score, review });
    newBtn.disabled = false; newBtn.textContent = 'Submit Rating';
    if (!res.ok) { errEl.textContent = res.error ?? 'Failed to submit rating'; errEl.style.display='block'; return; }
    modal.classList.remove('open');
    Toast.show('Rating submitted ✓', 'success');
    // Reload purchases to reflect rated state
    loadPurchases();
  });
}

async function openEscrowPaymentModal({ projectId, bidId, creatorId, creatorName, amount }) {
  const modal   = document.getElementById('escrow-payment-modal');
  const errEl   = document.getElementById('escrow-pay-error');
  const fee     = +(amount * 0.20).toFixed(2);
  const total   = +(amount + fee).toFixed(2);

  document.getElementById('escrow-amount-display').textContent = `$${amount.toFixed(2)}`;
  document.getElementById('escrow-fee-display').textContent    = `$${fee.toFixed(2)}`;
  document.getElementById('escrow-total-display').textContent  = `$${total.toFixed(2)}`;
  if (errEl) errEl.style.display = 'none';

  // Fresh country check — same pattern as initPayoutPanel
  const meRes = await api.auth.me().catch(() => ({ ok: false }));
  if (meRes.ok && meRes.data?.user) {
    AppState.setAuth(AppState.getToken(), { ...AppState.getUser(), ...meRes.data.user });
  }
  const isGhana = (AppState.getUser()?.country ?? '').toUpperCase() === 'GH';

  // Show/hide Paystack payment option
  const psOpt = document.getElementById('escrow-paystack-opt');
  if (psOpt) psOpt.style.display = isGhana ? '' : 'none';

  const methodSel      = document.getElementById('escrow-pay-method');
  const cardFields     = document.getElementById('escrow-card-fields');
  const paystackFields = document.getElementById('escrow-paystack-fields');

  function refreshMethodUI() {
    const v = methodSel.value;
    if (cardFields)     cardFields.style.display     = v === 'card'     ? 'block' : 'none';
    if (paystackFields) paystackFields.style.display = v === 'paystack' ? 'block' : 'none';
  }
  // Default to Paystack for Ghana, card otherwise
  methodSel.value = isGhana ? 'paystack' : 'card';
  refreshMethodUI();

  // Remove stale listeners by cloning the select
  const freshMethod = methodSel.cloneNode(true);
  methodSel.replaceWith(freshMethod);
  freshMethod.value = isGhana ? 'paystack' : 'card';
  refreshMethodUI();
  freshMethod.addEventListener('change', () => {
    const v = freshMethod.value;
    if (cardFields)     cardFields.style.display     = v === 'card'     ? 'block' : 'none';
    if (paystackFields) paystackFields.style.display = v === 'paystack' ? 'block' : 'none';
  });

  // Card number / expiry formatting
  const cardNumEl = document.getElementById('escrow-card-number');
  const cardExpEl = document.getElementById('escrow-card-expiry');
  if (cardNumEl) {
    const freshNum = cardNumEl.cloneNode(true);
    cardNumEl.replaceWith(freshNum);
    freshNum.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim().slice(0,19);
    });
  }
  if (cardExpEl) {
    const freshExp = cardExpEl.cloneNode(true);
    cardExpEl.replaceWith(freshExp);
    freshExp.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g,'').replace(/^(\d{2})(\d)/,'$1/$2').slice(0,5);
    });
  }

  // Close handlers
  ['escrow-modal-close','escrow-modal-cancel'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const fresh = el.cloneNode(true);
    el.replaceWith(fresh);
    fresh.addEventListener('click', () => modal.classList.remove('open'));
  });
  modal.onclick = e => { if (e.target === modal) modal.classList.remove('open'); };

  // Pay button — clone to strip stale listeners
  const payBtn = document.getElementById('escrow-pay-btn');
  const freshPayBtn = payBtn.cloneNode(true);
  payBtn.replaceWith(freshPayBtn);

  freshPayBtn.addEventListener('click', async () => {
    if (errEl) errEl.style.display = 'none';
    const method = document.getElementById('escrow-pay-method')?.value
                ?? freshMethod.value;

    // ── Validate ──────────────────────────────────────────────────────────
    if (method === 'card') {
      const num = document.getElementById('escrow-card-number')?.value.replace(/\s/g,'');
      const exp = document.getElementById('escrow-card-expiry')?.value;
      const cvv = document.getElementById('escrow-card-cvv')?.value;
      if (!num || num.length < 13 || !exp || !cvv || cvv.length < 3) {
        if (errEl) { errEl.textContent = 'Please complete your card details'; errEl.style.display = 'block'; }
        return;
      }
    }
    if (method === 'paystack') {
      const num = document.getElementById('escrow-paystack-number')?.value.trim();
      if (!num) {
        if (errEl) { errEl.textContent = 'Please enter your mobile money or bank account number'; errEl.style.display = 'block'; }
        return;
      }
    }

    freshPayBtn.disabled    = true;
    freshPayBtn.textContent = 'Processing…';

    let payRes;

    if (method === 'paystack') {
      // ── Paystack MoMo / Bank charge ──────────────────────────────────
      payRes = await api.payments.paystackMomoCharge({
        projectId,
        bidId,
        amount:   total,
        currency: 'GHS',
        phone:    document.getElementById('escrow-paystack-number')?.value.trim(),
        network:  document.getElementById('escrow-paystack-network')?.value,
        meta:     { creatorId, creatorName },
      });
    } else if (method === 'card') {
      // ── Card via your payment initializer ────────────────────────────
      payRes = await api.payments.initialize({
        projectId,
        bidId,
        amount:      total,
        currency:    'USD',
        callbackUrl: `${window.location.origin}/payment-callback.html`,
        meta:        { creatorId, creatorName, type: 'escrow' },
      });
      // For card, redirect to hosted payment page
      if (payRes.ok && payRes.data?.authorizationUrl) {
        window.location.href = payRes.data.authorizationUrl;
        return;
      }
    } else {
      // PayPal or other — initialize generic
      payRes = await api.payments.initialize({
        projectId,
        bidId,
        amount:      total,
        currency:    'USD',
        method,
        callbackUrl: `${window.location.origin}/payment-callback.html`,
        meta:        { creatorId, creatorName, type: 'escrow' },
      });
      if (payRes.ok && payRes.data?.authorizationUrl) {
        window.location.href = payRes.data.authorizationUrl;
        return;
      }
    }

    freshPayBtn.disabled    = false;
    freshPayBtn.textContent = '🔒 Pay & Fund Escrow';

    if (!payRes.ok) {
      if (errEl) {
        errEl.textContent = payRes.error ?? 'Payment failed. Please try again.';
        errEl.style.display = 'block';
      }
      return;
    }

    // ── Payment succeeded — fund escrow on backend ────────────────────
    const escrowRes = await api.projects.fundEscrow({
      projectId,
      bidId,
      amount:    total,
      method,
      reference: payRes.data?.reference ?? payRes.data?.data?.reference ?? '',
    });

    if (!escrowRes.ok) {
      if (errEl) {
        errEl.textContent = escrowRes.error ?? 'Escrow funding failed. Contact support.';
        errEl.style.display = 'block';
      }
      return;
    }

    modal.classList.remove('open');
    Toast.show('Escrow funded! The creator has been notified to begin work. ✓', 'success');

    // ── Auto-open message thread with the creator ─────────────────────
    if (creatorId) {
      const msgRes = await api.messages.startConversation(
        creatorId,
        `Hi! I just funded the escrow for our project. Looking forward to working with you! 🎉`
      );
      if (msgRes.ok) {
        const convId = msgRes.data?.conversationId ?? msgRes.data?.conversation?._id ?? creatorId;
        sessionStorage.setItem('fv_open_conversation', convId);
      }
      // Navigate to messages regardless
      sessionStorage.setItem('fv_nav_target', 'messages');
      setTimeout(() => { window.location.href = 'messages.html'; }, 800);
    }

    loadProjects();
  });

  modal.classList.add('open');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!AppState.isLoggedIn()) { window.location.replace('login.html'); return; }

  applyRoleUI();

  const hireEntry = document.getElementById('hire-entry');
const projectsWrap = document.getElementById('projects-list-wrap');
const toggleBtn = document.getElementById('toggle-projects-btn');

if (!isCreator() && hireEntry) {
    hireEntry.style.display = 'block';
    // Auto-expand if coming from a deep link or redirect
    const autoExpand = !!(sessionStorage.getItem('fv_nav_target') === 'projects' || window.location.hash === '#projects');
    let projectsVisible = autoExpand;
    if (autoExpand) {
        projectsWrap.style.display = 'block';
        loadProjects();
        if (toggleBtn) toggleBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg> Hide projects`;
    }
    toggleBtn?.addEventListener('click', () => {
        projectsVisible = !projectsVisible;
        projectsWrap.style.display = projectsVisible ? 'block' : 'none';

        toggleBtn.innerHTML = projectsVisible
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg> Hide projects`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> View my projects`;
        if (projectsVisible) loadProjects();
    });
} else if (isCreator() && projectsWrap) {
    projectsWrap.style.display = 'block';
    const browseBar = document.createElement('div');
    browseBar.style.cssText = 'margin-bottom:var(--space-5)';
    browseBar.innerHTML = `<a href="project-marketplace.html" class="btn btn--primary btn--sm">🔎 Browse Project Marketplace</a>`;
    projectsWrap.parentNode.insertBefore(browseBar, projectsWrap);
}

  const sidebarToggleBtn = document.getElementById('sidebar-toggle');
  const sidebar          = document.getElementById('dash-sidebar');

  function closeSidebarOutside(e) {
    if (!sidebar.contains(e.target) && e.target !== sidebarToggleBtn) {
      sidebar.classList.remove('mobile-open');
      document.removeEventListener('click', closeSidebarOutside);
    }
  }

  sidebarToggleBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('mobile-open');
    if (sidebar?.classList.contains('mobile-open')) {
      setTimeout(() => document.addEventListener('click', closeSidebarOutside), 0);
    }
  });

  document.querySelectorAll('.dash-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      activateTab(item.dataset.target);
      if (window.innerWidth <= 900) {
        sidebar?.classList.remove('mobile-open');
        document.removeEventListener('click', closeSidebarOutside);
      }
    });
  });

  const pendingTarget = sessionStorage.getItem('fv_nav_target');
  sessionStorage.removeItem('fv_nav_target');
  const hash = window.location.hash.slice(1);
  const initialTab = pendingTarget || hash || 'overview';
  activateTab(initialTab);


  // Auto-expand projects list for buyers landing on #projects
  if (initialTab === 'projects' && !isCreator()) {
    const projectsWrapEl = document.getElementById('projects-list-wrap');
    const toggleBtnEl    = document.getElementById('toggle-projects-btn');
    if (projectsWrapEl) projectsWrapEl.style.display = 'block';
    if (toggleBtnEl) toggleBtnEl.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg> Hide projects`;
    loadProjects();
  }

  if (isCreator()) {
    loadCreatorOverview();
    loadCreatorCharts();
  } else {
    loadBuyerOverview();
  }

  document.getElementById('btn-post-project-dash')?.addEventListener('click', () => {
    Toast.show('Project posting coming soon!', 'info');
  });

  api.messages.getConversations().then(res => {
    if (!res.ok) return;
    const convos  = res.data?.conversations ?? [];
    const userId  = AppState.getUser()?.id ?? AppState.getUser()?._id;
    const unread  = convos.filter(c => c.lastMessage && !c.lastMessage.read && c.lastMessage.recipientId === userId).length;
    ['msg-badge-buyer','msg-badge-creator'].forEach(id => {
      const badge = document.getElementById(id);
      if (badge && unread > 0) { badge.textContent = unread; badge.style.display = 'inline-flex'; }
    });
    const countText = document.getElementById('msg-count-text');
    if (countText && unread > 0) countText.textContent = `You have ${unread} unread message${unread > 1 ? 's' : ''}`;
  }).catch(() => {});
});