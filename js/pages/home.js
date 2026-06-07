/**
 * FLOWVA — Home Page
 * Fetches real data from API. No hardcoded templates or creators.
 * Falls back to empty states on errors.
 * Uses: AppState, Toast, api — all from global modules.
 */
import AppState from '../core/state.js';
import Toast    from '../core/toast.js';
import api      from '../core/api.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ─── Persist favourites across pages ────────────────────────────────────
  const _favKey = 'fv_favorites';
  const favorites = new Set(JSON.parse(localStorage.getItem(_favKey) || '[]'));

  function _saveFavs() {
    localStorage.setItem(_favKey, JSON.stringify([...favorites]));
  }

  // ─── Safe HTML escape ────────────────────────────────────────────────────
  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
  }

  // ─── Category definitions ────────────────────────────────────────────────
  // These are UI labels — the 'value' matches what your backend uses for ?cat=
  const CATEGORIES = [
    { label: 'All',            value: '',          icon: '✦' },
    { label: 'Flyers',         value: 'flyer',     icon: '📄' },
    { label: 'Logos',          value: 'logo',      icon: '🎯' },
    { label: 'Animations',     value: 'animation', icon: '🎬' },
    { label: 'Social Media',   value: 'social',    icon: '📱' },
    { label: 'Branding Kits',  value: 'branding',  icon: '🎨' },
    { label: 'Motion Graphics',value: 'motion',    icon: '⚡' },
    { label: 'YouTube',        value: 'youtube',   icon: '▶️' },
    { label: 'Resume',         value: 'resume',    icon: '📋' },
  ];

  // ─── Software tab definitions for tutorials ──────────────────────────────
  const SOFTWARE_TABS = [
    { label: 'All',          value: '' },
    { label: 'Photoshop',    value: 'photoshop' },
    { label: 'Canva',        value: 'canva' },
    { label: 'Figma',        value: 'figma' },
    { label: 'Illustrator',  value: 'illustrator' },
    { label: 'After Effects',value: 'after-effects' },
    { label: 'Benime',       value: 'benime' },
    { label: 'Plotagon',     value: 'plotagon' },
  ];

  // ─── Gradient fallbacks for templates without preview images ─────────────
  const GRADIENTS = [
    'linear-gradient(135deg,#1a0a3e,#4c1d95)',
    'linear-gradient(135deg,#0c1445,#1e3a5f)',
    'linear-gradient(135deg,#0f2027,#203a43)',
    'linear-gradient(135deg,#1a0533,#6b21a8)',
    'linear-gradient(135deg,#0a1628,#1e3a5f)',
    'linear-gradient(135deg,#0d0d1a,#1a0a3e)',
    'linear-gradient(135deg,#0a2018,#0f4030)',
    'linear-gradient(135deg,#1a1208,#3d2c00)',
  ];

  function _gradient(index) {
    return GRADIENTS[index % GRADIENTS.length];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY BAR
  // ─────────────────────────────────────────────────────────────────────────
  let activeCat = '';

  function renderCategories() {
    const wrap = document.getElementById('categories-scroll');
    if (!wrap) return;

    wrap.innerHTML = CATEGORIES.map(c => `
      <button
        class="category-pill ${activeCat === c.value ? 'active' : ''}"
        data-cat="${_esc(c.value)}"
        role="listitem"
        aria-pressed="${activeCat === c.value}"
      >
        <span class="category-pill-icon">${c.icon}</span>
        ${_esc(c.label)}
      </button>
    `).join('');

    wrap.querySelectorAll('.category-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCat = btn.dataset.cat;
        renderCategories(); // re-render active state
        loadTemplates(activeCat);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATES
  // ─────────────────────────────────────────────────────────────────────────

 async function loadTemplates(cat = '') {
  const carousel  = document.getElementById('trending-carousel');
  const skeleton  = document.getElementById('trending-skeleton');
  const empty     = document.getElementById('trending-empty');
  const grid      = document.getElementById('trending-grid');
  if (!grid) return;

  skeleton?.classList.remove('hidden');
  carousel?.classList.add('hidden');
  empty?.classList.add('hidden');

  try {
    const params = { limit: 6, sort: 'newest' };
    if (cat) params.category = cat;
    const res = await api.templates.list(params);
    skeleton?.classList.add('hidden');
    if (!res.ok || !res.data?.templates?.length) {
      empty?.classList.remove('hidden');
      return;
    }
    carousel?.classList.remove('hidden');
    renderTemplates(grid, res.data.templates);
  } catch {
    skeleton?.classList.add('hidden');
    empty?.classList.remove('hidden');
  }
}

function renderTemplates(grid, templates) {
  grid.innerHTML = templates.map((t, i) => {
    const isFav = favorites.has(t._id || t.id);
    const previewUrl = t.previewUrl || '';
    const price = Number(t.price ?? 0).toFixed(2);
    const creatorName = t.creator?.name ?? t.creator?.username ?? t.creatorName ?? t.creatorId ?? 'Creator';
    const creatorId = t.creator?._id ?? t.creator?.id ?? '';
    const templateId = t._id ?? t.id;
    const fileUrl = t.fileUrl ?? '';
    const fileType = t.fileType ?? '';

    const thumbHTML = previewUrl
      ? `<img class="thumb-img" src="${_esc(previewUrl)}" alt="${_esc(t.title)}" loading="lazy">
         ${fileType === 'video' && fileUrl
           ? `<video class="thumb-video" src="${_esc(fileUrl)}" muted loop playsinline preload="none"></video>`
           : ''}`
      : `<div class="template-thumb-placeholder" style="background:${_gradient(i)}">
           <span style="font-size:2.5rem">${_catEmoji(t.category)}</span>
         </div>`;

    return `
      <article class="template-card card--hover carousel-slide reveal"
  data-id="${_esc(String(templateId))}"
  oncontextmenu="return false"
  style="user-select:none">
        <div class="template-thumb">
          ${thumbHTML}
          <div class="template-overlay">
            <button class="btn btn--ghost btn--sm preview-btn"
              data-id="${_esc(String(templateId))}"
              data-fileurl="${_esc(fileUrl)}"
              data-filetype="${_esc(fileType)}"
              aria-label="Preview ${_esc(t.title)}">
              ▶ Preview
            </button>
            <button class="btn btn--primary btn--sm buy-btn"
              data-id="${_esc(String(templateId))}"
              data-title="${_esc(t.title)}"
              data-price="${_esc(String(price))}"
              aria-label="Buy ${_esc(t.title)}">
              Buy $${price}
            </button>
          </div>
          <button class="template-fav ${isFav ? 'active' : ''}"
            data-id="${_esc(String(templateId))}"
            aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}"
            aria-pressed="${isFav}">
            ${isFav ? '♥' : '♡'}
          </button>
          <span class="template-category-pill">
            <span class="badge badge--accent">${_esc(t.category || 'template')}</span>
          </span>
        </div>
        <div class="template-body">
          <div class="template-meta">
            <h3 class="template-title">${_esc(t.title)}</h3>
            <span class="template-price">$${price}</span>
          </div>
          <p class="template-creator">
            by <a href="creator.html?id=${_esc(String(creatorId))}">${_esc(creatorName)}</a>
          </p>
          <div class="template-footer">
            <div class="template-rating">
              <span class="stars">★★★★★</span>
              <span>${Number(t.rating ?? 0).toFixed(1)}</span>
            </div>
            <span class="trending-badge">🔥 New</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  _bindTemplateEvents(grid, templates);
  _initCarousel();
  _triggerReveal(grid);
}

function _initCarousel() {
  const track    = document.getElementById('trending-grid');
  const dotsWrap = document.getElementById('carousel-dots');
  const prevBtn  = document.getElementById('carousel-prev');
  const nextBtn  = document.getElementById('carousel-next');
  if (!track) return;

  const slides     = track.querySelectorAll('.carousel-slide');
  const slideWidth = () => slides[0]?.getBoundingClientRect().width + 20 || 0;
  const perView    = () => window.innerWidth <= 560 ? 1 : window.innerWidth <= 900 ? 2 : 3;
  let current      = 0;
  const total      = Math.ceil(slides.length / perView());

  // Dots
  if (dotsWrap) {
    dotsWrap.innerHTML = Array.from({ length: total }, (_, i) =>
      `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="Slide ${i+1}"></button>`
    ).join('');
    dotsWrap.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', () => goTo(+dot.dataset.i));
    });
  }

  function goTo(index) {
    current = Math.max(0, Math.min(index, total - 1));
    track.style.transform = `translateX(-${current * slideWidth() * perView()}px)`;
    dotsWrap?.querySelectorAll('.carousel-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
  }

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));

  // Touch swipe
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? current + 1 : current - 1);
  });

  // Auto-advance
  let timer = setInterval(() => goTo((current + 1) % total), 5000);
  track.addEventListener('mouseenter', () => clearInterval(timer));
  track.addEventListener('mouseleave', () => {
    timer = setInterval(() => goTo((current + 1) % total), 5000);
  });

  window.addEventListener('resize', () => goTo(0));
  _initVideoAutoplay();
}

function _initVideoAutoplay() {
  const videos = document.querySelectorAll('.thumb-video');
  if (!videos.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      const card  = video.closest('.template-card');
      // Don't autoplay if card is being hovered
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6 && !card?.matches(':hover')) {
        video.play().then(() => video.classList.add('playing')).catch(() => {});
      } else {
        video.pause();
        video.classList.remove('playing');
        video.currentTime = 0;
      }
    });
  }, { threshold: 0.6 });

  videos.forEach(v => {
    observer.observe(v);

    const card = v.closest('.template-card');
    if (!card) return;

    // Pause on hover — overlay with buy/preview buttons takes over
    card.addEventListener('mouseenter', () => {
      v.pause();
      v.classList.remove('playing');
    });

    // Resume autoplay when mouse leaves (only if still in viewport)
    card.addEventListener('mouseleave', () => {
      const rect = card.getBoundingClientRect();
      const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (inView) {
        v.play().then(() => v.classList.add('playing')).catch(() => {});
      }
    });

    // Stop on click too — modal will open instead
    card.addEventListener('click', () => {
      v.pause();
      v.classList.remove('playing');
    });
  });
}
  function _catEmoji(cat) {
    const map = {
      flyer: '📄', logo: '🎯', animation: '🎬', social: '📱',
      branding: '🎨', motion: '⚡', youtube: '▶️', resume: '📋',
      intro: '🎬', effects: '⚡', slides: '📊',
    };
    return map[cat] || '✨';
  }

  function _bindTemplateEvents(grid, templates) {
    // Favourite toggle
    grid.querySelectorAll('.template-fav').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (favorites.has(id)) {
          favorites.delete(id);
          btn.classList.remove('active');
          btn.textContent = '♡';
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('aria-label', 'Add to favourites');
        } else {
          favorites.add(id);
          btn.classList.add('active');
          btn.textContent = '♥';
          btn.setAttribute('aria-pressed', 'true');
          btn.setAttribute('aria-label', 'Remove from favourites');
          Toast.show('Added to favourites ♥', 'success');
        }
        _saveFavs();
      });
    });

    // Buy button — triggers Paystack flow
    grid.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();

        if (!AppState.isLoggedIn()) {
          Toast.show('Please login to purchase templates', 'info');
          setTimeout(() => { window.location.href = 'login.html'; }, 800);
          return;
        }

        const templateId = btn.dataset.id;
        const title      = btn.dataset.title;
        const price      = btn.dataset.price;

       // Send to marketplace page which has the full payment modal
        window.location.href = `marketplace.html?buy=${_esc(String(templateId))}`;
      });
    });

    // Preview button — opens modal
    grid.querySelectorAll('.preview-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const id = btn.dataset.id;
    const t  = templates.find(x => String(x._id ?? x.id) === String(id));
    if (t) openPreviewModal({
      ...t,
      fileUrl:  btn.dataset.fileurl  || t.fileUrl  || '',
      fileType: btn.dataset.filetype || t.fileType || '',
    });
  });
});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TUTORIALS
  // ─────────────────────────────────────────────────────────────────────────
  let activeSoftware = '';

  function renderSoftwareTabs() {
    const wrap = document.getElementById('software-tabs');
    if (!wrap) return;

    wrap.innerHTML = SOFTWARE_TABS.map(s => `
      <button
        class="software-tab ${activeSoftware === s.value ? 'active' : ''}"
        data-software="${_esc(s.value)}"
        role="tab"
        aria-selected="${activeSoftware === s.value}"
      >
        ${_esc(s.label)}
      </button>
    `).join('');

    wrap.querySelectorAll('.software-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSoftware = btn.dataset.software;
        renderSoftwareTabs();
        loadTutorials(activeSoftware);
      });
    });
  }

//loadTutorials function ──
  async function loadTutorials(software) {
    const sw       = software || '';
    const grid     = document.getElementById('tutorials-grid');
    const skeleton = document.getElementById('tutorials-skeleton');
    const empty    = document.getElementById('tutorials-empty');
    if (!grid) return;

    skeleton?.classList.remove('hidden');
    grid.classList.add('hidden');
    empty?.classList.add('hidden');

    let res;
    try {
      const params = { limit: 3, sort: 'newest' };
      if (sw) params.software = sw;

      res = await api.tutorials.list(params);

      console.log('tutorials res.ok:', res.ok);
      console.log('tutorials res.data:', JSON.stringify(res.data));

      skeleton?.classList.add('hidden');

     const list = Array.isArray(res.data?.tutorials) ? res.data.tutorials : [];

      if (!res.ok || !list.length) {
        empty?.classList.remove('hidden');
        return;
      }

      grid.classList.remove('hidden');
      renderTutorials(grid, list);

    } catch (err) {
      console.error('tutorials error:', err);
      skeleton?.classList.add('hidden');
      empty?.classList.remove('hidden');
    }
  }

  function renderTutorials(grid, tutorials) {
  grid.innerHTML = tutorials.map((t, i) => {
    const thumbUrl   = t.thumbnailUrl ?? t.thumbnail_url ?? '';
    const software   = t.software ?? t.category ?? 'General';
    const duration   = t.duration ?? '';
    const creatorName = t.creator?.name ?? t.creatorName ?? 'Creator';

    const thumbHTML = thumbUrl
      ? `<img src="${_esc(thumbUrl)}" alt="${_esc(t.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`
      : `<div class="tutorial-thumb-placeholder" style="background:${_gradient(i + 3)}">
           <span style="font-size:2.5rem">🎓</span>
         </div>`;

    return `
      <div class="tutorial-card reveal"
        data-videourl="${_esc(t.videoUrl ?? '')}"
        data-title="${_esc(t.title)}"
        style="cursor:pointer"
        aria-label="Watch tutorial: ${_esc(t.title)}">
        <div class="tutorial-thumb">
          ${thumbHTML}
          <div class="tutorial-play">
            <div class="tutorial-play-btn" aria-hidden="true">▶</div>
          </div>
          <span class="tutorial-software-badge">${_esc(software)}</span>
        </div>
        <div class="tutorial-body">
          <h3 class="tutorial-title">${_esc(t.title)}</h3>
          <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;margin-top:4px">
            ${_esc((t.description ?? '').slice(0, 90))}${(t.description ?? '').length > 90 ? '…' : ''}
          </p>
          <div class="tutorial-meta">
            <span>by ${_esc(creatorName)}${duration ? ` · ${_esc(String(duration))}` : ''}</span>
            <span class="tutorial-free">FREE</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  _triggerReveal(grid);

  // ── ADD START — wire video play modal ──
  grid.querySelectorAll('.tutorial-card').forEach(card => {
    card.addEventListener('click', () => {
      const url   = card.dataset.videourl;
      const title = card.dataset.title;
      if (!url) return;

      const existing = document.getElementById('tut-play-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'tut-play-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
      modal.innerHTML = `
        <div style="background:var(--bg-raised);border-radius:var(--radius-lg);max-width:780px;width:100%;position:relative;overflow:hidden">
          <button id="tut-modal-close" style="position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text-primary);font-size:1.4rem;cursor:pointer;z-index:1">✕</button>
          <div style="padding:16px 20px;font-weight:700;border-bottom:1px solid var(--border)">${_esc(title)}</div>
          <video controls autoplay playsinline style="width:100%;max-height:480px;display:block;background:#000">
            <source src="${_esc(url)}" type="video/mp4">
          </video>
        </div>`;

      modal.querySelector('#tut-modal-close').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    });
  });
}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATORS
  // ─────────────────────────────────────────────────────────────────────────

  async function loadCreators() {
    const grid     = document.getElementById('creators-grid');
    const skeleton = document.getElementById('creators-skeleton');
    if (!grid) return;

    try {
      const res = await api.users.getCreators({ limit: 4, sort: 'top' });

      skeleton?.classList.add('hidden');

      if (!res.ok || !res.data?.creators?.length) {
        // Hide skeleton, show nothing (creators section still shows with empty grid)
        return;
      }

      grid.classList.remove('hidden');
      renderCreators(grid, res.data.creators);

    } catch {
      skeleton?.classList.add('hidden');
    }
  }

  function renderCreators(grid, creators) {
    grid.innerHTML = creators.map(c => {
      const name      = c.name ?? 'Creator';
      const role      = c.role ?? c.specialty ?? 'Creator';
      const initials  = name.slice(0, 2).toUpperCase();
      const color     = c.avatarColor ?? _colorFromName(name);
      const templates = Number(c.totalTemplates ?? c.templates ?? 0);
      const rating    = Number(c.averageRating  ?? c.rating    ?? 0).toFixed(1);
      const followers = _formatCount(c.followerCount ?? c.followers ?? 0);
      const creatorId = c._id ?? c.id ?? '';

      const avatarHTML = c.avatarUrl
        ? `<img src="${_esc(c.avatarUrl)}"
               alt="${_esc(name)}"
               class="avatar avatar--lg"
               style="width:72px;height:72px;object-fit:cover;border-radius:50%;margin:0 auto var(--space-4);">`
        : `<div class="avatar avatar--lg avatar--placeholder"
               style="background:${color};font-size:1rem;margin:0 auto var(--space-4);">
             ${_esc(initials)}
           </div>`;

      return `
        <a href="creator.html?id=${_esc(String(creatorId))}"
           class="creator-card reveal"
           aria-label="View ${_esc(name)}'s profile">
          ${avatarHTML}
          <h3>${_esc(name)}</h3>
          <p class="role">${_esc(role)}</p>
          <div class="creator-card-stats">
            <div class="creator-card-stat">
              <span>${templates}</span>
              <span>Templates</span>
            </div>
            <div class="creator-card-stat">
              <span>${rating}★</span>
              <span>Rating</span>
            </div>
            <div class="creator-card-stat">
              <span>${followers}</span>
              <span>Followers</span>
            </div>
          </div>
        </a>
      `;
    }).join('');

    _triggerReveal(grid);
  }

  function _colorFromName(name) {
    const palette = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ec4899','#14b8a6','#f97316'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  function _formatCount(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0','') + 'k';
    return String(n);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PREVIEW MODAL
  // ─────────────────────────────────────────────────────────────────────────

  function openPreviewModal(template) {
    const modal  = document.getElementById('preview-modal');
    const title  = document.getElementById('modal-title');
    const thumb  = document.getElementById('modal-thumb');
    const footer = document.getElementById('modal-footer');
    if (!modal) return;

    const price     = Number(template.price ?? 0).toFixed(2);
    const previewUrl = template.previewUrl ?? template.preview_url ?? '';
    const templateId = template._id ?? template.id;

    title.textContent = template.title;

const previewVideoUrl = template.previewVideoUrl ?? '';
const isVideo = template.fileType === 'video' && previewVideoUrl;

if (isVideo) {
  thumb.innerHTML = `
    <video controls autoplay muted loop playsinline
      style="width:100%;max-height:360px;border-radius:0 0 var(--radius-xl) var(--radius-xl);background:#000">
      <source src="${_esc(previewVideoUrl)}" type="video/mp4">
    </video>`;
} else if (previewUrl) {
  thumb.innerHTML = `
    <img src="${_esc(previewUrl)}" alt="${_esc(template.title)}"
      style="width:100%;max-height:360px;object-fit:cover;
      border-radius:0 0 var(--radius-xl) var(--radius-xl);">`;
} else {
  thumb.style.background = _gradient(0);
  thumb.innerHTML = `<span style="font-size:5rem">${_catEmoji(template.category)}</span>`;
}

    if (footer) {
      footer.innerHTML = `
        <span style="color:var(--text-secondary);font-size:0.9rem">
          Category: <strong style="color:var(--text-primary)">${_esc(template.category ?? 'Template')}</strong>
        </span>
        <div style="display:flex;gap:10px">
          <button class="btn btn--ghost btn--sm modal-close-btn">Close</button>
          <button class="btn btn--primary btn--sm modal-buy-btn"
            data-id="${_esc(String(templateId))}"
            data-title="${_esc(template.title)}"
            data-price="${_esc(String(price))}">
            Buy $${price}
          </button>
        </div>
      `;

      footer.querySelector('.modal-close-btn')?.addEventListener('click', closeModal);
      footer.querySelector('.modal-buy-btn')?.addEventListener('click', async btn => {
        const b = btn.currentTarget;
        if (!AppState.isLoggedIn()) {
          Toast.show('Please login to purchase', 'info');
          setTimeout(() => { window.location.href = 'login.html'; }, 800);
          return;
        }
       window.location.href = `marketplace.html?buy=${_esc(String(b.dataset.id))}`;
      });
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('preview-modal');
    modal?.classList.remove('open');
    document.body.style.overflow = '';
    // stop any video playing inside
    modal?.querySelectorAll('video').forEach(v => v.pause());
  }

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('preview-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ─────────────────────────────────────────────────────────────────────────
  // HERO BUTTONS
  // ─────────────────────────────────────────────────────────────────────────

  document.getElementById('btn-browse')?.addEventListener('click', () => {
    window.location.href = 'marketplace.html';
  });

  document.getElementById('btn-creator')?.addEventListener('click', () => {
    if (AppState.isLoggedIn()) {
      window.location.href = 'dashboard.html';
    } else {
      window.location.href = 'signup.html';
    }
  });

  document.getElementById('btn-view-all')?.addEventListener('click', () => {
    window.location.href = 'marketplace.html';
  });

  document.getElementById('btn-post-project')?.addEventListener('click', () => {
    if (AppState.isLoggedIn()) {
      window.location.href = 'dashboard.html?tab=projects';
    } else {
      Toast.show('Please login or sign up to post a project', 'info');
      setTimeout(() => { window.location.href = 'signup.html'; }, 800);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HERO ANIMATED COUNTERS
  // ─────────────────────────────────────────────────────────────────────────

  function animateCounter(el) {
    const target   = parseInt(el.dataset.target, 10);
    const suffix   = el.dataset.suffix || '';
    const duration = 1800;
    const start    = performance.now();

    const step = now => {
      const p      = Math.min((now - start) / duration, 1);
      const eased  = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const statsSection = document.getElementById('hero-stats');
  if (statsSection) {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        statsSection.querySelectorAll('[data-target]').forEach(animateCounter);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(statsSection);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REVEAL HELPER
  // ─────────────────────────────────────────────────────────────────────────

  function _triggerReveal(container) {
    // Give reveal.js a tick to pick up new elements, or do it manually here
    requestAnimationFrame(() => {
      container.querySelectorAll('.reveal').forEach(el => {
        if (!el.classList.contains('active')) el.classList.add('active');
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INIT — run all loaders in parallel
  // ─────────────────────────────────────────────────────────────────────────

  renderCategories();
  renderSoftwareTabs();

  await Promise.allSettled([
    loadTemplates(),
    loadTutorials(),
    loadCreators(),
  ]);

});

