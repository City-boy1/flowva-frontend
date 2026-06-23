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
  const postCta      = document.getElementById('post-project-cta');
  const projSub      = document.getElementById('projects-subtitle');
  const overSub      = document.getElementById('overview-subtitle');

  if (isCreator()) {
    if (buyerNav)     buyerNav.style.display     = 'none';
    if (creatorNav)   creatorNav.style.display   = '';
    if (buyerOview)   buyerOview.style.display   = 'none';
    if (creatorOview) creatorOview.style.display = '';
    if (overSub)      overSub.textContent = 'Your performance at a glance';
    if (postCta)      postCta.style.display = 'none';
    const creatorCta = document.getElementById('creator-marketplace-cta');
    if (creatorCta)   creatorCta.style.display = '';
  } else {
    if (buyerNav)     buyerNav.style.display     = '';
    if (creatorNav)   creatorNav.style.display   = 'none';
    if (buyerOview)   buyerOview.style.display   = '';
    if (creatorOview) creatorOview.style.display = 'none';
    if (overSub)      overSub.textContent = 'Your activity at a glance';
    if (postCta)      postCta.style.display = '';
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

  list.innerHTML = visible.map(t => `
    <div class="project-item">
      <div class="project-thumb">▣</div>
      <div class="project-info">
        <h4>${_esc(t.title)}</h4>
        <p>${_esc((t.software ?? '').toString())} · ${timeAgo(t.createdAt)}</p>
      </div>
    </div>
  `).join('');
}

async function loadProjects() {
  const list = document.getElementById('projects-list');
  if (!list) return;
  list.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Loading…</p>';
  const userId = AppState.getUser()?.id ?? AppState.getUser()?._id;
const res = await api.projects.list(
  isCreator()
    ? { scope: 'dashboard', userId, role: 'creator' }
    : { scope: 'dashboard', userId, role: 'client' }
);
  if (!res.ok || !res.data?.projects?.length) {
    list.innerHTML = isCreator()
      ? `<div class="empty-state" style="padding:40px 20px;text-align:center">
           <h3>No bids yet</h3>
           <p style="color:var(--text-muted);margin-top:8px;font-size:0.9rem">
             Browse the project marketplace and submit a bid to see your projects here.
           </p>
           <a href="project-marketplace.html" class="btn btn--primary" style="margin-top:16px">
             Browse Projects
           </a>
         </div>`
      : `<div class="empty-state" style="padding:40px 20px;text-align:center">
           <h3>No projects yet</h3>
           <p style="color:var(--text-muted);margin-top:8px;font-size:0.9rem">
             Post your first project and get bids from talented creators.
           </p>
           <a href="project-marketplace.html" class="btn btn--primary" style="margin-top:16px">
             Post a Project
           </a>
         </div>`;
    return;
  }
  list.innerHTML = res.data.projects.map(p => {
  const title = p.content?.title ?? p.title ?? 'Project';
  const statusBadge = {
    OPEN: 'badge--accent', IN_PROGRESS: 'badge--warning',
    COMPLETED: 'badge--success', DISPUTED: 'badge--danger',
    DELIVERED: 'badge--warning', REVISION_REQUESTED: 'badge--warning',
  }[p.status] ?? 'badge--muted';

  const actions = [];

  // Creator: deliver work
  if (isCreator() && p.status === 'IN_PROGRESS') {
    actions.push(`<button class="btn btn--primary btn--sm deliver-btn"
      data-id="${_esc(p.id)}" data-title="${_esc(title)}"> Deliver</button>`);
  }

  // Client: view bids on open project
  if (!isCreator() && p.status === 'OPEN') {
    actions.push(`<button class="btn btn--primary btn--sm view-bids-btn"
      data-id="${_esc(p.id)}" data-title="${_esc(title)}"> View Bids</button>`);
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
          <p>Budget: $${p.budget ?? '—'} · Deadline: ${deadline}</p>
        </div>
        <span class="badge ${statusBadge}" style="flex-shrink:0">${_esc(p.status ?? '')}</span>
      </div>
      ${desc ? `<p style="font-size:0.83rem;color:var(--text-secondary);line-height:1.5;margin:0 0 4px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${_esc(desc)}</p>` : ''}
      ${skills.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${skills.map(s => `<span style="font-size:0.72rem;background:var(--bg-overlay);border:1px solid var(--border);border-radius:4px;padding:2px 8px;color:var(--text-muted)">${_esc(s)}</span>`).join('')}</div>` : ''}
      <div style="display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap;margin-top:4px">
        ${actions.join('')}
      </div>
    </div>`;
}).join('');

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
    document.getElementById('deliver-file-url').value = '';
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
              <button class="btn btn--primary btn--sm accept-bid-btn" data-project-id="${_esc(projectId)}" data-bid-id="${_esc(b.id)}">✓ Accept Bid</button>
              <button class="btn btn--danger btn--sm reject-bid-btn" data-project-id="${_esc(projectId)}" data-bid-id="${_esc(b.id)}">✕ Reject</button>
            </div>` : ''}
        </div>`).join('');

      body.querySelectorAll('.accept-bid-btn').forEach(ab => {
        ab.addEventListener('click', async () => {
          if (!confirm('Accept this bid? The project will move to In Progress and the creator will be notified.')) return;
          ab.disabled = true; ab.textContent = 'Accepting…';
          const r = await api.projects.acceptBid(ab.dataset.projectId, ab.dataset.bidId);
          if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); ab.disabled = false; ab.textContent = '✓ Accept Bid'; return; }
          Toast.show('Bid accepted! Project is now In Progress. Proceed to payment to fund escrow.', 'success');
          document.getElementById('bids-modal').classList.remove('open');
          loadProjects();
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

  const walletRes = await api.payouts.getWallet();
  if (walletRes.ok && walletRes.data?.wallet) {
    const w = walletRes.data.wallet;
    if (balEl)     balEl.textContent = `$${Number(w.availableBalance ?? 0).toFixed(2)} USDC`;
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
    const addrEl = document.getElementById('payout-wallet-address');
    if (addrEl) addrEl.textContent = s?.solanaAddress ?? 'Not set';
  } else {
    if (usdcInfo) usdcInfo.style.display = 'none';
  }

  // Save wallet address
  document.getElementById('save-wallet-btn')?.addEventListener('click', async () => {
    const addr = document.getElementById('new-wallet-address')?.value.trim();
    if (!addr || addr.length < 32) { Toast.show('Enter a valid Solana wallet address', 'warning'); return; }
    const res = await api.payouts.updateSettings({ primaryMethod: 'USDC_WALLET', solanaAddress: addr });
    if (!res.ok) { Toast.show(res.error ?? 'Failed to save', 'error'); return; }
    Toast.show('Wallet address updated ✓', 'success');
    document.getElementById('payout-wallet-address').textContent = addr;
    document.getElementById('new-wallet-address').value = '';
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
  const dropZone   = document.getElementById('drop-zone');
  const fileInput  = document.getElementById('file-input');
  const uploadForm = document.getElementById('upload-form');
  let templateFile = null;

  function showLocalPreview(file) {
    const wrap  = document.getElementById('auto-preview-wrap');
    const box   = document.getElementById('auto-preview-box');
    const info  = document.getElementById('file-info');
    const inner = document.getElementById('file-info-inner');
    if (!wrap || !box) return;

    if (info && inner) {
      info.style.display = 'block';
      const emoji = file.type.startsWith('image/') ? '🖼' : file.type.startsWith('video/') ? '▶' : '📦';
      inner.innerHTML = `
        <span>${emoji}</span>
        <span style="font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(file.name)}</span>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(file.size/1024/1024).toFixed(1)}MB</span>`;
    }

    wrap.style.display = 'block';
    box.innerHTML = '';

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      img.src = URL.createObjectURL(file);
      box.appendChild(img);
    }  else if (file.type.startsWith('video/')) {
  // Show actual playable video so creator can verify it's correct
  const vid = document.createElement('video');
  vid.controls   = true;
  vid.muted      = true;
  vid.playsInline = true;
  vid.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:var(--radius-md);';
  vid.src = URL.createObjectURL(file);
  box.appendChild(vid);
} else {
      box.innerHTML = `<div style="text-align:center"><div style="font-size:0.85rem;color:var(--text-muted)">Preview will be auto-generated on upload</div></div>`;
    }
  }

  function handleFile(file) {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    const isPdf   = file.type === 'application/pdf';
    const isZip   = file.type === 'application/zip' || file.type === 'application/x-zip-compressed';

    if (isZip) {
      Toast.show('ZIP files are not supported. Please upload a video, image, or PDF template.', 'error');
      return;
    }
    if (!isVideo && !isImage && !isPdf) {
      Toast.show('Unsupported file type. Please upload a video, image, or PDF.', 'error');
      return;
    }

    const maxBytes = isVideo ? 70 * 1024 * 1024
                   : isImage ?  5 * 1024 * 1024
                   :            10 * 1024 * 1024; // pdf
    const maxLabel = isVideo ? '70MB' : isImage ? '5MB' : '10MB';
    if (file.size > maxBytes) {
      Toast.show(`${isVideo ? 'Video' : isImage ? 'Image' : 'PDF'} files must be under ${maxLabel}. Please compress and try again.`, 'error');
      return;
    }
    templateFile = file;
    showLocalPreview(file);
  }
  dropZone?.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone?.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
  fileInput?.addEventListener('change', () => handleFile(fileInput.files?.[0]));

  uploadForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const title    = document.getElementById('tmpl-title')?.value.trim();
    const category = document.getElementById('tmpl-category')?.value;
    const price    = document.getElementById('tmpl-price')?.value;
    const desc     = document.getElementById('tmpl-desc')?.value.trim();
    const software = document.getElementById('tmpl-software')?.value.trim();
    const errorEl  = document.getElementById('upload-error');

    if (!title || !category || !price || !desc) {
      if (errorEl) { errorEl.textContent = 'Please fill all required fields.'; errorEl.style.display = 'block'; }
      return;
    }
    if (!templateFile) {
      if (errorEl) { errorEl.textContent = 'Please select a template file.'; errorEl.style.display = 'block'; }
      return;
    }
    if (errorEl) errorEl.style.display = 'none';

    const formData = new FormData();
    formData.append('title',       title);
    formData.append('category',    category);
    formData.append('price',       price);
    formData.append('description', desc);
    formData.append('software',    JSON.stringify(software ? software.split(',').map(s => s.trim()) : []));
    formData.append('tags',        JSON.stringify([]));
    formData.append('currency',    'USD');
    formData.append('file',        templateFile);

    const btn = document.getElementById('upload-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }

    // Refresh token before starting — large uploads can outlive a short-lived JWT
    await api.restoreSession().catch(() => {});

    if (btn) btn.textContent = 'Uploading 0%…';

    const res = await api.upload('/templates', formData, pct => {
  if (btn) btn.textContent = pct < 100
    ? `Uploading ${pct}%…`
    : '⚙️ Processing on server…';  // ← shows after 100% while Cloudinary processes
});

    if (btn) { btn.disabled = false; btn.textContent = 'Submit for Review'; }
    if (!res.ok) {
      // Show specific field errors from Zod if present
      if (res.data?.errors?.length) {
        const msgs = res.data.errors.map(e => `${e.field}: ${e.message}`).join('\n');
        if (errorEl) { errorEl.textContent = msgs; errorEl.style.display = 'block'; }
      } else {
        Toast.show(res.data?.message ?? res.error ?? 'Upload failed', 'error');
      }
      return;
    }

    Toast.show('Template submitted! Pending admin review before going live.', 'success');
    uploadForm.reset();
    templateFile = null;
    document.getElementById('auto-preview-wrap').style.display = 'none';
    document.getElementById('file-info').style.display = 'none';
    activateTab('templates');
  });
}

async function initTutorialUploadPanel() {
  const dropZone  = document.getElementById('tutorial-drop-zone');
const tplSelect = document.getElementById('tut-template');
if (tplSelect) {
  const userId = AppState.getUser()?.id ?? AppState.getUser()?._id;
  const res = await api.templates.list({ creatorId: userId, limit: 50, status: 'APPROVED' });
  if (res.ok && res.data?.templates?.length) {
    res.data.templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = String(t._id ?? t.id);
      opt.textContent = t.title;
      tplSelect.appendChild(opt);
    });
  }
}
  const fileInput = document.getElementById('tutorial-file-input');
  const previewEl = document.getElementById('tutorial-preview');
  const tutForm   = document.getElementById('tutorial-form');
  let tutorialFile = null;

  dropZone?.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  function handleTutorialFile(f) {
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      Toast.show('Please select a video file (MP4 or WebM).', 'error');
      return;
    }
    if (f.size > 70 * 1024 * 1024) {
      Toast.show('Tutorial videos must be under 70MB. Please compress your video first (try HandBrake or ffmpeg).', 'error');
      return;
    }
    tutorialFile = f;
    renderTutPreview(f);
  }

  dropZone?.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleTutorialFile(e.dataTransfer.files[0]); });
  fileInput?.addEventListener('change', () => handleTutorialFile(fileInput.files?.[0]));

  function renderTutPreview(f) {
    if (!previewEl) return;
    previewEl.innerHTML = `<div class="preview-file"><span>▶</span><span style="font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(f.name)}</span><span style="font-size:0.75rem;color:var(--text-muted)">${(f.size/1024/1024).toFixed(1)}MB</span></div>`;
  }

  tutForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const title    = document.getElementById('tut-title')?.value.trim();
    const software = document.getElementById('tut-software')?.value;
    const desc     = document.getElementById('tut-desc')?.value.trim();
    const errorEl  = document.getElementById('tutorial-error');
    if (!title || !software || !desc) {
      if (errorEl) { errorEl.textContent = 'Please fill all required fields.'; errorEl.style.display = 'block'; } return;
    }
    if (tutorialFile.size > 70 * 1024 * 1024) {
      if (errorEl) { errorEl.textContent = 'Video must be under 70MB. Please compress it first.'; errorEl.style.display = 'block'; } return;
    }
    if (errorEl) errorEl.style.display = 'none';
    const formData = new FormData();
    formData.append('title',       title);
    formData.append('software',    software);
    formData.append('description', desc);
    const linkedTemplate = document.getElementById('tut-template')?.value;
    if (linkedTemplate) formData.append('templateId', linkedTemplate);
    formData.append('video', tutorialFile);
    const btn = document.getElementById('tutorial-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }

    // Refresh token before starting — large uploads can outlive a short-lived JWT
    await api.restoreSession().catch(() => {});

    if (btn) btn.textContent = 'Uploading 0%…';
    // Spinner that cycles while Cloudinary processes after 100%
    let spinInterval = null;
    const spinFrames = ['⚙️ Processing ·', '⚙️ Processing ··', '⚙️ Processing ···', '⚙️ Processing ····'];
    let spinIdx = 0;

    const res = await api.tutorials.upload(formData, pct => {
      if (pct < 100) {
        if (spinInterval) { clearInterval(spinInterval); spinInterval = null; }
        if (btn) btn.textContent = `Uploading ${pct}%…`;
      } else {
        if (!spinInterval) {
          spinInterval = setInterval(() => {
            if (btn) btn.textContent = spinFrames[spinIdx % spinFrames.length];
            spinIdx++;
          }, 400);
        }
      }
    });

    if (spinInterval) { clearInterval(spinInterval); spinInterval = null; }
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Tutorial for Review'; }
    if (!res.ok) { Toast.show(res.error ?? 'Upload failed', 'error'); return; }
    Toast.show('Tutorial submitted for review!', 'success');
    tutForm.reset(); tutorialFile = null;
    if (previewEl) previewEl.innerHTML = '';
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

document.addEventListener('DOMContentLoaded', () => {
  if (!AppState.isLoggedIn()) { window.location.replace('login.html'); return; }

  applyRoleUI();

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
  activateTab(pendingTarget || hash || 'overview');

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