// flowva marketplace.js
import AppState from '../core/state.js';
import api      from '../core/api.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Shared utils ───────────────────────────────────────────────────────────
  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
  }

  function showToast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ── Top tab switch ─────────────────────────────────────────────────────────
  const TAB_STYLE_ACTIVE   = 'border-bottom:2px solid var(--accent-hover);color:var(--accent-hover);font-weight:600';
  const TAB_STYLE_INACTIVE = 'border-bottom:2px solid transparent;color:var(--text-muted);font-weight:500';

  function switchTab(tab) {
    document.querySelectorAll('.market-tab').forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.style.cssText = `padding:12px 28px;background:none;border:none;font-size:0.95rem;cursor:pointer;font-family:var(--font-body);${isActive ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE}`;
      btn.classList.toggle('active', isActive);
    });
    document.querySelectorAll('.market-tab-panel').forEach(panel => {
      panel.style.display = panel.id === `tab-${tab}` ? 'block' : 'none';
    });

    if (tab === 'tutorials' && !_tutLoaded) {
      _tutLoaded = true;
      loadTutorials();
    }
  }

  document.querySelectorAll('.market-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Read URL param ─────────────────────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') === 'tutorials' ? 'tutorials' : 'templates';

  // ══════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ══════════════════════════════════════════════════════════════════════════

  let allTemplates   = [];
  let filtered       = [];
  let visibleCount   = 12;
  let activeCategory = 'all';
  let favorites      = JSON.parse(localStorage.getItem('fv_favorites') || '[]');

  const grid         = document.getElementById('market-grid');
  const skeletonGrid = document.getElementById('skeleton-grid');
  const resultCount  = document.getElementById('result-count');
  const searchInput  = document.getElementById('market-search');
  const sortSelect   = document.getElementById('market-sort');
  const priceSelect  = document.getElementById('market-price');
  const pillsBar     = document.getElementById('category-pills');
  const loadMoreBtn  = document.getElementById('load-more');

  const CATEGORIES = [
   { value: 'all',       label: 'All' },
{ value: 'animation', label: 'Animation' },
{ value: 'logo',      label: 'Logo' },
{ value: 'social',    label: 'Social Media' },
{ value: 'motion',    label: 'Motion Graphics' },
{ value: 'intro',     label: 'Intro / Opener' },
{ value: 'flyer',     label: 'Flyer' },
{ value: 'branding',  label: 'Branding' },
{ value: 'youtube',   label: 'YouTube Kit' },
{ value: 'slides',    label: 'Slides' },
{ value: 'gaming',    label: 'Gaming' },
{ value: 'effects',   label: 'Effects' },
{ value: 'event',     label: 'Event' },
{ value: 'resume',    label: 'Resume' },
{ value: 'broadcast', label: 'Broadcast' },
  ];

  function buildCategoryPills() {
    if (!pillsBar) return;
    pillsBar.innerHTML = CATEGORIES.map(c => `
      <button class="filter-pill ${c.value === activeCategory ? 'active' : ''}"
        data-cat="${_esc(c.value)}" role="tab"
        aria-selected="${c.value === activeCategory}">
        ${_esc(c.label)}
      </button>`).join('');
    pillsBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        pillsBar.querySelectorAll('.filter-pill').forEach(b => {
          b.classList.toggle('active', b.dataset.cat === activeCategory);
          b.setAttribute('aria-selected', b.dataset.cat === activeCategory);
        });
        visibleCount = 12;
        applyFilters();
      });
    });
  }

  async function fetchTemplates() {
    skeletonGrid?.classList.remove('hidden');
    if (grid) grid.innerHTML = '';
    const res = await api.templates.list({ limit: 100 });
    skeletonGrid?.classList.add('hidden');
    if (!res.ok || !res.data?.templates) {
      if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px"><div style="font-size:2.5rem;margin-bottom:12px">⚠️</div><p style="color:var(--text-muted)">Failed to load templates. Please refresh.</p></div>`;
      return;
    }
    allTemplates = res.data.templates;
    buildCategoryPills();
    applyFilters();

    // Auto-open buy modal if redirected from home page with ?buy=templateId
const buyParam = new URLSearchParams(window.location.search).get('buy');
if (buyParam) {
  const target = allTemplates.find(
    t => String(t._id) === buyParam || String(t.id) === buyParam
  );
  if (target) {
    // Small delay so the grid renders first
    setTimeout(() => {
      openBuyModal(
        String(target._id ?? target.id),
        target.title,
        target.price,
      );
    }, 300);
  }
}

const templateParam = new URLSearchParams(window.location.search).get('template');
if (templateParam) {
  const target = allTemplates.find(
    t => String(t._id) === templateParam || String(t.id) === templateParam
  );
  if (target) {
    setTimeout(() => {
      const card = document.querySelector(`[data-id="${templateParam}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--accent-hover)';
        card.style.borderRadius = 'var(--radius-lg)';
        setTimeout(() => { card.style.outline = ''; }, 3000);
      }
    }, 400);
  }
}
  }

  function applyFilters() {
    const q     = (searchInput?.value ?? '').toLowerCase().trim();
    const price = priceSelect?.value ?? 'all';
    const sort  = sortSelect?.value  ?? 'trending';
    filtered = allTemplates.filter(t => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      if (q && !t.title.toLowerCase().includes(q) &&
          !(t.description ?? '').toLowerCase().includes(q) &&
          !(t.creator?.name ?? '').toLowerCase().includes(q)) return false;
      const p = Number(t.price ?? 0);
      if (price === 'free' && p !== 0) return false;
      if (price === 'low'  && p >= 20) return false;
      if (price === 'mid'  && (p < 20 || p > 35)) return false;
      if (price === 'high' && p <= 35) return false;
      return true;
    });
    filtered.sort((a, b) => {
      switch (sort) {
        case 'newest':       return new Date(b.createdAt) - new Date(a.createdAt);
        case 'best-selling': return (b.salesCount || 0) - (a.salesCount || 0);
        case 'rating':       return (b.rating || 0) - (a.rating || 0);
        case 'price-low':    return Number(a.price) - Number(b.price);
        case 'price-high':   return Number(b.price) - Number(a.price);
        default:             return (b.salesCount || 0) + (b.rating || 0) * 10 - ((a.salesCount || 0) + (a.rating || 0) * 10);
      }
    });
    if (resultCount) resultCount.textContent = `${filtered.length} template${filtered.length !== 1 ? 's' : ''}`;
    renderGrid();
  }

  function renderGrid() {
    if (!grid) return;
    const slice = filtered.slice(0, visibleCount);
    if (!slice.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px"><div style="font-size:2.5rem;margin-bottom:12px">🔍</div><p style="color:var(--text-muted)">No templates found. Try different filters.</p></div>`;
      loadMoreBtn?.classList.add('hidden');
      return;
    }

    const heartOutline = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const heartFilled  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    grid.innerHTML = slice.map(t => {
      const isFav = favorites.includes(String(t._id));
      return `
        <div class="template-card card--hover" data-id="${_esc(t._id)}">
          <div class="template-thumb">
            ${t.previewUrl
              ? `<img src="${_esc(t.previewUrl)}" alt="${_esc(t.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
              : `<div class="template-thumb-placeholder" style="background:linear-gradient(135deg,#1a0a3e,#4c1d95);width:100%;height:100%;display:flex;align-items:center;justify-content:center">
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="2" y1="17" x2="7" y2="17"/>
  </svg>
</div>`}
            <div class="template-overlay">
              <button class="btn btn--ghost btn--sm preview-btn"
                data-id="${_esc(t._id)}" 
                data-title="${_esc(t.title)}"
                data-preview="${_esc(t.previewUrl ?? '')}"
                data-previewvideo="${_esc(t.previewVideoUrl ?? '')}
                data-url="${_esc(t.fileUrl ?? '')}"
                data-type="${_esc(t.fileType ?? '')}">Preview</button>
              <button class="btn btn--primary btn--sm buy-btn"
                data-id="${_esc(t._id)}" data-title="${_esc(t.title)}"
                data-price="${_esc(t.price)}">Buy $${Number(t.price).toFixed(2)}</button>
            </div>
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${_esc(t._id)}"
              aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}">
              ${isFav ? heartFilled : heartOutline}
            </button>
          </div>
          <div class="template-body">
            <div class="template-meta">
              <h3 class="template-title">${_esc(t.title)}</h3>
              <span class="template-price">$${Number(t.price).toFixed(2)}</span>
            </div>
            ${t.creator?.name ? `<a href="creator.html?id=${_esc(t.creator.id ?? t.creatorId)}" style="font-size:0.78rem;color:var(--text-muted);text-decoration:none;display:block;margin-bottom:6px">by ${_esc(t.creator.name)}</a>` : ''}
            <div class="template-footer">
              <div class="template-rating"><span class="stars">${'★'.repeat(Math.round(Number(t.rating || 0)))}${'☆'.repeat(5 - Math.round(Number(t.rating || 0)))}</span><span>${Number(t.rating || 0).toFixed(1)}</span></div>
            </div>
          </div>
        </div>`;
    }).join('');

    filtered.length > visibleCount ? loadMoreBtn?.classList.remove('hidden') : loadMoreBtn?.classList.add('hidden');

    grid.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        // REPLACE WITH:
if (favorites.includes(id)) {
  favorites = favorites.filter(f => f !== id);
  btn.innerHTML = heartOutline;
  btn.classList.remove('active');
  api.delete(`/users/favourites/${id}`);
  showToast('Removed from favourites', 'info');
} else {
  favorites.push(id);
  btn.innerHTML = heartFilled;
  btn.classList.add('active');
  api.post('/users/favourites', { templateId: id });
  showToast('Added to favourites', 'success');
}
      });
    });

    grid.querySelectorAll('.preview-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openPreviewModal(btn.dataset.id, btn.dataset.title, btn.dataset.preview, btn.dataset.url, btn.dataset.type);
      });
    });

    grid.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openBuyModal(btn.dataset.id, btn.dataset.title, btn.dataset.price);
      });
    });
  }

  // ── Template Preview Modal ─────────────────────────────────────────────────
  function openPreviewModal(id, title, previewUrl, fileUrl, fileType) {
  const modal   = document.getElementById('preview-modal');
  const titleEl = document.getElementById('modal-title');
  const thumbEl = document.getElementById('modal-thumb');
  if (!modal) return;
  if (titleEl) titleEl.textContent = title;

  // Find previewVideoUrl from allTemplates
  const t = allTemplates.find(x => String(x._id ?? x.id) === String(id));
  const previewVideoUrl = t?.previewVideoUrl ?? '';
  const isVideo = fileType === 'video' && previewVideoUrl;

  if (thumbEl) {
    thumbEl.style.background = '';
    if (isVideo) {
      thumbEl.innerHTML = `
        <video controls autoplay muted loop playsinline
          style="width:100%;max-height:400px;display:block;background:#000;
          border-radius:0 0 var(--radius-xl) var(--radius-xl)">
          <source src="${_esc(previewVideoUrl)}" type="video/mp4">
        </video>`;
    } else if (previewUrl) {
      thumbEl.innerHTML = `
        <img src="${_esc(previewUrl)}" alt="${_esc(title)}"
          style="width:100%;max-height:400px;object-fit:cover;
          border-radius:0 0 var(--radius-xl) var(--radius-xl)">`;
    } else {
      thumbEl.style.background = 'linear-gradient(135deg,#1a0a3e,#4c1d95)';
      thumbEl.innerHTML = `<span style="font-size:4rem">🎬</span>`;
    }
  }
  modal.classList.add('open');
}

  // ── Buy Modal ──────────────────────────────────────────────────────────────
  // ── Buy Modal — payment method selector ───────────────────────────────────
let _pendingBuyId   = null;
let _pendingBuyData = null;

function openBuyModal(id, title, price) {
  if (!AppState.isLoggedIn()) {
    showToast('Please login to purchase', 'info');
    setTimeout(() => { window.location.href = 'login.html'; }, 700);
    return;
  }

  _pendingBuyId   = id;
  _pendingBuyData = { title, price: Number(price) };

  document.getElementById('flowva-buy-modal')?.remove();

  const p           = Number(price);
  const creatorCut  = (p * 0.7).toFixed(2);
  const platformCut = (p * 0.3).toFixed(2);

  const modal = document.createElement('div');
  modal.id = 'flowva-buy-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);
    z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px`;

  modal.innerHTML = `
    <div style="background:var(--bg-raised);border-radius:var(--radius-lg);
      max-width:420px;width:100%;overflow:hidden;
      box-shadow:0 24px 80px rgba(0,0,0,0.5)">

      <!-- Header -->
      <div style="padding:20px 24px 16px;border-bottom:1px solid var(--border);
        display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:var(--font-display);font-weight:700;font-size:1rem">
          Complete Purchase
        </span>
        <button id="buy-modal-close" style="background:none;border:none;
          color:var(--text-muted);font-size:1.3rem;cursor:pointer">✕</button>
      </div>

      <!-- Template info -->
      <div style="padding:20px 24px;border-bottom:1px solid var(--border)">
        <div style="font-weight:600;margin-bottom:12px;font-size:0.95rem">${_esc(title)}</div>
        <div style="display:flex;justify-content:space-between;
          font-size:0.82rem;color:var(--text-muted);margin-bottom:6px">
          <span>Creator receives</span>
          <span style="color:var(--success)">$${creatorCut}</span>
        </div>
        <div style="display:flex;justify-content:space-between;
          font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">
          <span>Platform fee</span>
          <span>$${platformCut}</span>
        </div>
        <div style="display:flex;justify-content:space-between;
          font-weight:700;font-size:1.1rem;padding-top:10px;
          border-top:1px solid var(--border)">
          <span>Total</span>
          <span style="color:var(--accent-hover)">$${p.toFixed(2)}</span>
        </div>
      </div>

      <!-- Pay button -->
      <div style="padding:20px 24px">
        <button id="helio-pay-btn"
          style="width:100%;padding:14px;border-radius:var(--radius-md);
          border:none;background:var(--accent-hover);color:#fff;
          font-weight:700;font-size:1rem;cursor:pointer;
          font-family:var(--font-body);display:flex;align-items:center;
          justify-content:center;gap:10px;transition:opacity 0.2s">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          Pay with Card
        </button>
        <p style="text-align:center;font-size:0.75rem;color:var(--text-muted);
          margin-top:10px">
          Secured by Helio · Visa & Mastercard accepted
        </p>
        <p id="buy-modal-error" style="display:none;color:var(--danger);
          font-size:0.82rem;text-align:center;margin-top:8px"></p>
      </div>
    </div>`;

  document.getElementById('buy-modal-close', modal)?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#helio-pay-btn').addEventListener('click', async () => {
    const btn   = modal.querySelector('#helio-pay-btn');
    const errEl = modal.querySelector('#buy-modal-error');
    errEl.style.display = 'none';
    btn.disabled    = true;
    btn.style.opacity = '0.6';
    btn.textContent = 'Redirecting…';

    const callbackUrl = `${window.location.origin}/marketplace.html?payment=success&id=${_pendingBuyId}`;
    const res = await api.templates.purchase(_pendingBuyId, callbackUrl);

    if (!res.ok) {
      btn.disabled    = false;
      btn.style.opacity = '1';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg> Pay with Card`;
      errEl.textContent = res.error ?? 'Payment could not be started. Please try again.';
      errEl.style.display = 'block';
      return;
    }

    if (res.data?.authorizationUrl) {
      modal.remove();
      showToast('Redirecting to secure payment…', 'info');
      setTimeout(() => { window.location.href = res.data.authorizationUrl; }, 500);
    } else {
      btn.disabled    = false;
      btn.style.opacity = '1';
      errEl.textContent = 'Could not start payment. Please try again.';
      errEl.style.display = 'block';
    }
  });

  document.body.appendChild(modal);
}

  loadMoreBtn?.addEventListener('click', () => { visibleCount += 12; renderGrid(); });
  searchInput?.addEventListener('input',  () => { visibleCount = 12; applyFilters(); });
  sortSelect?.addEventListener('change',  () => { visibleCount = 12; applyFilters(); });
  priceSelect?.addEventListener('change', () => { visibleCount = 12; applyFilters(); });
  window.getFavoriteTemplates = () => favorites;

  // ══════════════════════════════════════════════════════════════════════════
  // TUTORIALS
  // ══════════════════════════════════════════════════════════════════════════

  let _tutLoaded       = false;
  let allTutorials     = [];
  let tutFiltered      = [];
  let tutVisibleCount  = 12;
  let activeSoftware   = '';

  const SOFTWARE_TABS = [
    { label: 'All',           value: '' },
    { label: 'Photoshop',     value: 'photoshop' },
    { label: 'Canva',         value: 'canva' },
    { label: 'Figma',         value: 'figma' },
    { label: 'Illustrator',   value: 'illustrator' },
    { label: 'After Effects', value: 'after-effects' },
    { label: 'Benime',        value: 'benime' },
    { label: 'Plotagon',      value: 'plotagon' },
  ];

  function buildSoftwareBar() {
    const bar = document.getElementById('tut-software-bar');
    if (!bar) return;
    bar.innerHTML = SOFTWARE_TABS.map(s => `
      <button class="filter-pill ${activeSoftware === s.value ? 'active' : ''}"
        data-sw="${_esc(s.value)}">
        ${_esc(s.label)}
      </button>`).join('');
    bar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSoftware = btn.dataset.sw;
        bar.querySelectorAll('.filter-pill').forEach(b =>
          b.classList.toggle('active', b.dataset.sw === activeSoftware)
        );
        applyTutorialFilters();
      });
    });
  }

  async function loadTutorials() {
    const skeleton = document.getElementById('tut-skeleton');
    const tutGrid  = document.getElementById('tut-grid');
    const empty    = document.getElementById('tut-empty');

    skeleton?.classList.remove('hidden');
    tutGrid?.classList.add('hidden');
    empty?.classList.add('hidden');

    const res = await api.tutorials.list({ limit: 100 });

    skeleton?.classList.add('hidden');

    if (!res.ok || !res.data?.tutorials?.length) {
      empty?.classList.remove('hidden');
      return;
    }

    allTutorials = res.data.tutorials;
const tutCountEl = document.getElementById('tut-result-count');
if (tutCountEl) tutCountEl.textContent = `${allTutorials.length} tutorial${allTutorials.length !== 1 ? 's' : ''}`;
    buildSoftwareBar();
    applyTutorialFilters();
  }

  function applyTutorialFilters() {
    const q = (document.getElementById('tut-search')?.value ?? '').toLowerCase().trim();
    tutFiltered = allTutorials.filter(t => {
      if (activeSoftware && (t.category ?? '').toLowerCase() !== activeSoftware) return false;
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
    tutVisibleCount = 12;
    renderTutorials();
  }

  function renderTutorials() {
    const tutGrid = document.getElementById('tut-grid');
    const empty   = document.getElementById('tut-empty');
    const more    = document.getElementById('tut-load-more');
    if (!tutGrid) return;

    const slice = tutFiltered.slice(0, tutVisibleCount);

    if (!slice.length) {
      tutGrid.classList.add('hidden');
      empty?.classList.remove('hidden');
      more?.classList.add('hidden');
      return;
    }

    tutGrid.classList.remove('hidden');
    empty?.classList.add('hidden');

    tutGrid.innerHTML = slice.map((t, i) => {
      const software    = t.category ?? 'General';
      const creatorName = t.creator?.name ?? t.creatorName ?? 'Creator';
      const duration    = t.duration ? `${Math.floor(t.duration / 60)}m` : '';
      const gradients   = ['linear-gradient(135deg,#1a0a3e,#4c1d95)','linear-gradient(135deg,#0c1445,#1e3a5f)','linear-gradient(135deg,#0a2018,#0f4030)'];

      return `
        <div class="tutorial-card" data-videourl="${_esc(t.videoUrl ?? '')}" data-title="${_esc(t.title)}"
          style="cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);
          border-radius:var(--radius-lg);overflow:hidden;transition:var(--transition-base)"
          onmouseenter="this.style.borderColor='var(--border-hover)';this.style.transform='translateY(-2px)'"
          onmouseleave="this.style.borderColor='var(--border)';this.style.transform='none'">

          <!-- Thumb -->
          <div style="position:relative;aspect-ratio:16/9;overflow:hidden;background:${gradients[i % gradients.length]}">
            ${t.thumbnailUrl
              ? `<img src="${_esc(t.thumbnailUrl)}" alt="${_esc(t.title)}" loading="lazy"
                  style="width:100%;height:100%;object-fit:cover;display:block">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">
  <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
</div>`}

            <!-- Play overlay -->
            <div style="position:absolute;inset:0;background:rgba(0,0,0,0);display:flex;
              align-items:center;justify-content:center;transition:background 0.2s"
              onmouseenter="this.style.background='rgba(0,0,0,0.35)'"
              onmouseleave="this.style.background='rgba(0,0,0,0)'">
              <div style="width:52px;height:52px;background:rgba(255,255,255,0.15);
                backdrop-filter:blur(6px);border-radius:50%;display:flex;
                align-items:center;justify-content:center;
                border:2px solid rgba(255,255,255,0.4)">
                <span style="color:#fff;font-size:1.2rem;margin-left:3px">▶</span>
              </div>
            </div>

            <!-- Software badge -->
            <span style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.65);
              backdrop-filter:blur(4px);color:#fff;font-size:0.72rem;font-weight:600;
              padding:3px 10px;border-radius:20px;letter-spacing:0.03em">
              ${_esc(software)}
            </span>

            <!-- FREE badge -->
            <span style="position:absolute;top:10px;right:10px;background:var(--success);
              color:#fff;font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:20px">
              FREE
            </span>

            ${duration ? `<span style="position:absolute;bottom:8px;right:10px;
              background:rgba(0,0,0,0.65);color:#fff;font-size:0.72rem;
              padding:2px 8px;border-radius:20px">${_esc(duration)}</span>` : ''}
          </div>

          <!-- Body -->
          <div style="padding:var(--space-4)">
            <h3 style="font-family:var(--font-display);font-size:0.95rem;font-weight:700;
              margin-bottom:6px;line-height:1.35;
              display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
              ${_esc(t.title)}
            </h3>
            ${t.description ? `<p style="font-size:0.8rem;color:var(--text-muted);line-height:1.5;
              margin-bottom:10px;
              display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
              ${_esc(t.description)}</p>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;
              font-size:0.78rem;color:var(--text-muted);border-top:1px solid var(--border);
              padding-top:10px;margin-top:auto">
              <span>by ${_esc(creatorName)}</span>
              <span style="color:var(--accent-hover);font-weight:600;font-size:0.8rem">▶ Watch free</span>
            </div>
          </div>
        </div>`;
    }).join('');

    tutFiltered.length > tutVisibleCount ? more?.classList.remove('hidden') : more?.classList.add('hidden');

    // Wire click — video modal
    tutGrid.querySelectorAll('.tutorial-card').forEach(card => {
      card.addEventListener('click', () => {
        const url   = card.dataset.videourl;
        const title = card.dataset.title;
        if (!url) return;
        openVideoModal(url, title);
      });
    });
  }

  document.getElementById('tut-load-more')?.addEventListener('click', () => {
    tutVisibleCount += 12;
    renderTutorials();
  });

  document.getElementById('tut-search')?.addEventListener('input', applyTutorialFilters);

  // ── Video play modal (shared) ──────────────────────────────────────────────
  function openVideoModal(url, title) {
    const existing = document.getElementById('tut-play-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'tut-play-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg-raised);border-radius:var(--radius-lg);
        max-width:860px;width:100%;position:relative;overflow:hidden;
        box-shadow:0 24px 80px rgba(0,0,0,0.6)">
        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:16px 20px;border-bottom:1px solid var(--border)">
          <span style="font-family:var(--font-display);font-weight:700;font-size:1rem">
            ${_esc(title)}
          </span>
          <button id="tut-modal-close" style="background:none;border:none;
            color:var(--text-muted);font-size:1.4rem;cursor:pointer;
            line-height:1;padding:4px 8px;border-radius:var(--radius-sm);
            transition:var(--transition-base)"
            onmouseenter="this.style.color='var(--text-primary)'"
            onmouseleave="this.style.color='var(--text-muted)'">✕</button>
        </div>
        <video controls autoplay playsinline
          style="width:100%;max-height:500px;display:block;background:#000">
          <source src="${_esc(url)}" type="video/mp4">
          Your browser does not support video playback.
        </video>
      </div>`;

    modal.querySelector('#tut-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); }
    });
    document.body.appendChild(modal);
  }

  // ── Modal close (templates) ────────────────────────────────────────────────
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.querySelectorAll('video').forEach(v => { v.pause(); v.src = ''; });
            overlay.classList.remove('open');
        }
    });
});
 document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        overlay?.querySelectorAll('video').forEach(v => { v.pause(); v.src = ''; });
        overlay?.classList.remove('open');
    });
});

  // ── Init ───────────────────────────────────────────────────────────────────
  switchTab(initialTab);
  await fetchTemplates();
  // Handle return from Helio payment
  const paymentStatus = urlParams.get('payment');
  const paymentId     = urlParams.get('id');
  if (paymentStatus === 'success' && paymentId) {
    // Clean URL without reloading
    window.history.replaceState({}, '', 'marketplace.html');
    // Poll backend to confirm order is PAID
    showToast('Confirming your payment…', 'info');
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const tokenRes = await api.get(`/templates/${paymentId}/download-token`);
      if (tokenRes.ok) {
        clearInterval(poll);
        showToast('Payment confirmed! Your download is ready. ✓', 'success');
        // Show download button
        const BASE = window.FLOWVA_API_URL || 'http://127.0.0.1:5000/api';
        window.open(
          `${BASE}/templates/${paymentId}/download?token=${encodeURIComponent(tokenRes.data.token)}`,
          '_blank'
        );
      } else if (attempts >= 8) {
        clearInterval(poll);
        showToast('Payment received — check your dashboard to download.', 'info');
      }
    }, 3000);
  }
  if (initialTab === 'tutorials') {
    _tutLoaded = true;
    await loadTutorials();
  }

});
