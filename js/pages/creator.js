/**
 * FLOWVA — Creator Profile Page
 */

import AppState from '../core/state.js';
import api      from '../core/api.js';
import Toast    from '../core/toast.js';

document.addEventListener('DOMContentLoaded', async () => {

  const params      = new URLSearchParams(window.location.search);
  const creatorId   = params.get('id');
  const currentUser = AppState.getUser();

  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
  }

  function _initials(name = '') {
    return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  function _colorFromId(id = '') {
    const colors = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  if (creatorId) {
    await loadCreatorProfile(creatorId);
    return;
  }

  await loadCreatorsDirectory();

  // ── Single creator profile ────────────────────────────────────────────────
  async function loadCreatorProfile(id) {
    setProfileLoading(true);

    const [creatorRes, templatesRes] = await Promise.all([
      api.users.getCreatorById(id),
      api.templates.list({ creatorId: id, limit: 12, status: 'APPROVED' }),
    ]);

    setProfileLoading(false);

    if (!creatorRes.ok) {
      document.querySelector('.creator-hero')?.insertAdjacentHTML('afterend',
        `<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
          <div style="font-size:3rem;margin-bottom:12px">😕</div>
          <h3>Creator not found</h3>
          <a href="creator.html" class="btn btn--ghost btn--sm" style="margin-top:16px">Browse Creators</a>
        </div>`
      );
      return;
    }

    const creator   = creatorRes.data.creator;
    const templates = templatesRes.ok ? (templatesRes.data?.templates ?? []) : [];

    document.title = `${creator.name} — FLOWVA`;

    // Avatar
    const avatarEl = document.getElementById('creator-avatar-init');
    if (avatarEl) {
      if (creator.avatarUrl) {
        avatarEl.outerHTML = `<img id="creator-avatar-init"
          src="${_esc(creator.avatarUrl)}"
          alt="${_esc(creator.name)}"
          style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:4px solid var(--bg-base)">`;
      } else {
        avatarEl.textContent      = _initials(creator.name);
        avatarEl.style.background = _colorFromId(creator.id);
      }
    }

    // Info
    const nameEl = document.getElementById('creator-name');
    const roleEl = document.getElementById('creator-role');
    const bioEl  = document.getElementById('creator-bio');
    const tagsEl = document.getElementById('creator-tags');

    if (nameEl) nameEl.textContent = creator.name;
    if (roleEl) roleEl.textContent = 'Motion Graphics Creator';
    if (bioEl)  bioEl.textContent  = creator.bio || 'No bio yet.';

    if (tagsEl) {
      const tags = [];
      if (creator.country) tags.push(creator.country);
      if (creator.isEarlyAdopter) tags.push('⭐ Early Adopter');
      tagsEl.innerHTML = tags.map(t =>
        `<span class="badge badge--accent">${_esc(t)}</span>`
      ).join('');
    }

    // Stats — use real server values
    let followerCount = Number(creator.followerCount ?? 0);
   const totalSales  = templates.reduce((s, t) => s + (t.purchaseCount || 0), 0);

    const statTemplates = document.querySelector('[data-stat="templates"]');
    const statSales     = document.querySelector('[data-stat="sales"]');
    const statRating    = document.querySelector('[data-stat="rating"]');
    const statFollowers = document.querySelector('[data-stat="followers"]');

    if (statTemplates) statTemplates.textContent = templates.length;
    if (statSales)     statSales.textContent     = totalSales.toLocaleString();
    if (statRating)    statRating.textContent    = creator.averageRating > 0
      ? `${Number(creator.averageRating).toFixed(1)} ★`
      : 'No ratings';
    if (statFollowers) statFollowers.textContent = followerCount.toLocaleString();

    // Hide actions if own profile
    const actionsEl = document.querySelector('.creator-actions');
    if (actionsEl && currentUser?.id === creator.id) {
      actionsEl.innerHTML = `<a href="dashboard.html" class="btn btn--ghost btn--sm">Edit Profile</a>`;
    } else if (actionsEl) {
      // Rate button — only for logged-in non-owners
      if (AppState.isLoggedIn()) {
        const rateBtn = document.createElement('button');
        rateBtn.className   = 'btn btn--ghost';
        rateBtn.textContent = '⭐ Rate';
        rateBtn.addEventListener('click', () => openRateModal(creator));
        actionsEl.appendChild(rateBtn);
      }
    }

    // Message button
    document.getElementById('msg-btn')?.addEventListener('click', () => {
      if (!AppState.isLoggedIn()) {
        Toast.show('Please login to message creators', 'info');
        setTimeout(() => { window.location.href = 'login.html'; }, 700);
        return;
      }
      if (currentUser?.id === creator.id) {
        Toast.show("You can't message yourself", 'info');
        return;
      }
      openMessageModal(creator);
    });

    // ── Follow button ────────────────────────────────────────────────────────
    const followBtn = document.getElementById('follow-btn');

    // Seed from real API response
    let following = creator.isFollowedByViewer === true;

    function renderFollowBtn() {
      if (!followBtn) return;
      followBtn.textContent = following ? '✓ Following' : '+ Follow';
      followBtn.className   = `btn ${following ? 'btn--ghost' : 'btn--primary'}`;
    }

    // Render correct state immediately on load
    renderFollowBtn();

    followBtn?.addEventListener('click', async () => {
      if (!AppState.isLoggedIn()) {
        Toast.show('Please login to follow creators', 'info');
        setTimeout(() => { window.location.href = 'login.html'; }, 700);
        return;
      }
      if (currentUser?.id === creator.id) {
        Toast.show("You can't follow yourself", 'info');
        return;
      }

      // Optimistic update
      following     = !following;
      followerCount = following ? followerCount + 1 : followerCount - 1;
      renderFollowBtn();
      if (statFollowers) statFollowers.textContent = followerCount.toLocaleString();

      followBtn.disabled = true;
      const res = await api.users.toggleFollow(creator.id);
      followBtn.disabled = false;

      if (!res.ok) {
        // Revert on failure
        following     = !following;
        followerCount = following ? followerCount + 1 : followerCount - 1;
        renderFollowBtn();
        if (statFollowers) statFollowers.textContent = followerCount.toLocaleString();
        Toast.show(res.error || 'Could not update follow', 'error');
        return;
      }

      // Sync with server response
      following     = res.data?.following ?? following;
      followerCount = res.data?.followerCount ?? followerCount;
      renderFollowBtn();
      if (statFollowers) statFollowers.textContent = followerCount.toLocaleString();

      Toast.show(following ? `Now following ${creator.name}` : `Unfollowed ${creator.name}`, 'info');
    });

    // ── Tabs ─────────────────────────────────────────────────────────────────
    async function loadRatings() {
      const panel = document.getElementById('tab-reviews');
      if (!panel) return;
      panel.innerHTML = '<p style="color:var(--text-muted);padding:20px">Loading reviews…</p>';
      const res = await api.users.getCreatorRatings(id);
      if (!res.ok || !res.data?.ratings?.length) {
        panel.innerHTML = '<p style="color:var(--text-muted);padding:20px">No reviews yet.</p>';
        return;
      }
      panel.innerHTML = `<div style="display:flex;flex-direction:column;gap:var(--space-5);max-width:700px">
        ${res.data.ratings.map(r => `
          <div class="card" style="padding:var(--space-5)">
            <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:12px">
              <div class="avatar avatar--sm avatar--placeholder" style="background:#7c3aed;font-size:0.7rem">
                ${_esc(_initials(r.rater?.name || '?'))}
              </div>
              <div>
                <div style="font-weight:600;font-size:0.9rem">${_esc(r.rater?.name || 'Anonymous')}</div>
                <div style="color:#f59e0b;font-size:0.85rem">${'★'.repeat(r.score)}${'☆'.repeat(5 - r.score)}</div>
              </div>
              <div style="margin-left:auto;font-size:0.75rem;color:var(--text-muted)">
                ${new Date(r.createdAt).toLocaleDateString()}
              </div>
            </div>
            ${r.review ? `<p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6">${_esc(r.review)}</p>` : ''}
          </div>
        `).join('')}
      </div>`;
    }

    document.querySelectorAll('.creator-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.creator-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.creator-tab-panel').forEach(p => p.classList.add('hidden'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`)?.classList.remove('hidden');
        if (tab.dataset.tab === 'reviews') loadRatings();
      });
    });

    renderTemplatesGrid(templates, creator);
  }

  // ── Rate Modal ────────────────────────────────────────────────────────────
  async function openRateModal(creator) {
    // First check if viewer has a completed order with this creator
    const ordersRes = await api.users.getOrders();
    const completedOrder = ordersRes.ok
      ? (ordersRes.data?.orders ?? []).find(o =>
          o.creatorId === creator.id &&
          o.status === 'COMPLETED' &&
          !o.rated
        )
      : null;

    if (!completedOrder) {
      Toast.show('You can only rate creators after a completed order with them', 'info');
      return;
    }

    document.getElementById('rate-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'rate-modal';
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;backdrop-filter:blur(4px)`;
    modal.innerHTML = `
      <div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-lg);padding:var(--space-6);width:100%;max-width:400px;box-shadow:var(--shadow-lg)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)">
          <h3 style="font-family:var(--font-display);font-size:1.1rem">Rate ${_esc(creator.name)}</h3>
          <button id="rate-close" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--text-muted);padding:4px">✕</button>
        </div>
        <div style="display:flex;gap:10px;font-size:2.2rem;margin-bottom:var(--space-4);cursor:pointer" id="star-row">
          ${[1,2,3,4,5].map(n => `<span data-score="${n}" style="opacity:0.3;cursor:pointer;transition:opacity 0.1s">★</span>`).join('')}
        </div>
        <textarea id="rate-review" placeholder="Leave a review (optional)" rows="3"
          style="width:100%;background:var(--bg-overlay);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-3);color:var(--text-primary);font-family:var(--font-body);font-size:0.9rem;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        <p id="rate-error" style="color:var(--danger);font-size:0.82rem;margin-top:8px;display:none"></p>
        <div style="display:flex;justify-content:flex-end;gap:var(--space-3);margin-top:var(--space-4)">
          <button class="btn btn--ghost btn--sm" id="rate-cancel">Cancel</button>
          <button class="btn btn--primary btn--sm" id="rate-submit">Submit Rating</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    let selectedScore = 0;
    const stars = modal.querySelectorAll('#star-row span');

    function paintStars(upTo) {
      stars.forEach(s => s.style.opacity = Number(s.dataset.score) <= Number(upTo) ? '1' : '0.3');
    }

    stars.forEach(star => {
      star.addEventListener('mouseover', () => paintStars(star.dataset.score));
      star.addEventListener('mouseout',  () => paintStars(selectedScore));
      star.addEventListener('click',     () => { selectedScore = Number(star.dataset.score); paintStars(selectedScore); });
    });

    const close = () => modal.remove();
    document.getElementById('rate-close')?.addEventListener('click', close);
    document.getElementById('rate-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.getElementById('rate-submit')?.addEventListener('click', async () => {
      const errEl = document.getElementById('rate-error');
      if (!selectedScore) {
        errEl.textContent = 'Please select a star rating';
        errEl.style.display = 'block';
        return;
      }
      const btn = document.getElementById('rate-submit');
      btn.disabled = true; btn.textContent = 'Submitting…';
      const res = await api.users.rateCreator({
        orderId:  completedOrder.id,
        score:    selectedScore,
        review:   document.getElementById('rate-review')?.value.trim(),
      });
      if (!res.ok) {
        btn.disabled = false; btn.textContent = 'Submit Rating';
        errEl.textContent = res.error || 'Failed to submit';
        errEl.style.display = 'block';
        return;
      }
      Toast.show('Rating submitted! ⭐', 'success');
      close();
      // Refresh rating stats on page
      const statsRes = await api.users.getCreatorById(creator.id);
      if (statsRes.ok) {
        const updated = statsRes.data.creator;
        const statRating = document.querySelector('[data-stat="rating"]');
        if (statRating) statRating.textContent = creator.averageRating > 0
      ? `${Number(creator.averageRating).toFixed(1)} ★ (${creator.ratingCount})`
      : 'No ratings';
      }
    });
  }

  // ── Render templates grid ─────────────────────────────────────────────────
  function renderTemplatesGrid(templates, creator) {
    const grid = document.getElementById('creator-templates-grid');
    if (!grid) return;

    if (!templates.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:60px 20px;text-align:center">
          <div style="font-size:3rem;margin-bottom:12px">🎬</div>
          <p style="color:var(--text-muted)">No templates published yet.</p>
        </div>`;
      return;
    }

    grid.innerHTML = templates.map(t => `
      <div class="template-card card--hover">
        <div class="template-thumb">
          ${t.previewUrl
            ? `<img src="${_esc(t.previewUrl)}" alt="${_esc(t.title)}" style="width:100%;height:100%;object-fit:cover">`
            : `<div class="template-thumb-placeholder" style="background:linear-gradient(135deg,#1a0a3e,#4c1d95);width:100%;height:100%;display:flex;align-items:center;justify-content:center">
                <span style="font-size:2rem">🎬</span>
               </div>`
          }
          <div class="template-overlay">
            <button class="btn btn--primary btn--sm buy-btn"
              data-id="${_esc(t._id)}"
              data-price="${_esc(t.price)}"
              data-title="${_esc(t.title)}">
              Buy $${Number(t.price).toFixed(2)}
            </button>
          </div>
        </div>
        <div class="template-body">
          <div class="template-meta">
            <h3 class="template-title">${_esc(t.title)}</h3>
            <span class="template-price">$${Number(t.price).toFixed(2)}</span>
          </div>
          <div class="template-footer">
            <div class="template-rating">
              <span class="stars">${'★'.repeat(Math.round(Number(t.rating || 0)))}${'☆'.repeat(5 - Math.round(Number(t.rating || 0)))}</span>
              <span>${Number(t.rating || 0).toFixed(1)}</span>
            </div>
            <span style="font-size:0.78rem;color:var(--text-muted)">${t.purchaseCount || 0} sales</span>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!AppState.isLoggedIn()) {
          Toast.show('Please login to purchase', 'info');
          setTimeout(() => { window.location.href = 'login.html'; }, 700);
          return;
        }
        window.location.href = `marketplace.html?buy=${btn.dataset.id}`;
      });
    });
  }

  // ── Message modal ─────────────────────────────────────────────────────────
  function openMessageModal(creator) {
    document.getElementById('msg-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'msg-modal';
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;backdrop-filter:blur(4px)`;
    modal.innerHTML = `
      <div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-lg);padding:var(--space-6);width:100%;max-width:480px;box-shadow:var(--shadow-lg)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5)">
          <h3 style="font-family:var(--font-display);font-size:1.1rem">Message ${_esc(creator.name)}</h3>
          <button id="msg-modal-close" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:var(--text-muted);padding:4px">✕</button>
        </div>
        <textarea id="msg-modal-input" placeholder="Hi! I'd like to discuss a project with you…"
          maxlength="1000" rows="4"
          style="width:100%;background:var(--bg-overlay);border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--space-3);color:var(--text-primary);font-family:var(--font-body);font-size:0.9rem;resize:vertical;outline:none;box-sizing:border-box"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:var(--space-3);margin-top:var(--space-4)">
          <button class="btn btn--ghost btn--sm" id="msg-modal-cancel">Cancel</button>
          <button class="btn btn--primary btn--sm" id="msg-modal-send">Send Message</button>
        </div>
        <p id="msg-modal-error" style="color:var(--danger);font-size:0.82rem;margin-top:8px;display:none"></p>
      </div>`;
    document.body.appendChild(modal);

    const input   = document.getElementById('msg-modal-input');
    const sendBtn = document.getElementById('msg-modal-send');
    const errorEl = document.getElementById('msg-modal-error');

    const close = () => modal.remove();
    document.getElementById('msg-modal-close')?.addEventListener('click', close);
    document.getElementById('msg-modal-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    input?.focus();

    sendBtn?.addEventListener('click', async () => {
      const content = input?.value.trim();
      if (!content) {
        errorEl.textContent  = 'Please write a message first.';
        errorEl.style.display = 'block';
        return;
      }
      sendBtn.disabled    = true;
      sendBtn.textContent = 'Sending…';
      errorEl.style.display = 'none';
      const res = await api.messages.startConversation(creator.id, { content });
      if (!res.ok) {
        sendBtn.disabled    = false;
        sendBtn.textContent = 'Send Message';
        errorEl.textContent  = res.error || 'Failed to send. Please try again.';
        errorEl.style.display = 'block';
        return;
      }
      const convId = res.data?.message?.conversationId;
      if (convId) sessionStorage.setItem('fv_open_conv', convId);
      Toast.show('Message sent! Opening conversation…', 'success');
      setTimeout(() => { window.location.href = 'messages.html'; }, 800);
    });
  }

  // ── Profile loading state ─────────────────────────────────────────────────
  function setProfileLoading(loading) {
  document.querySelectorAll('.skeleton-text').forEach(el => {
    el.classList.toggle('skeleton-pulse', loading);
  });
  document.querySelector('.creator-actions')
    ?.style.setProperty('opacity', loading ? '0' : '1');
}

  // ══════════════════════════════════════════════════════════════════════════
  // MODE B — Creators directory listing
  // ══════════════════════════════════════════════════════════════════════════
  async function loadCreatorsDirectory() {
    const hero = document.querySelector('.creator-hero');
    if (hero) {
      hero.innerHTML = `
        <div class="creator-banner"></div>
        <div class="creator-profile-wrap container" style="flex-direction:column;align-items:flex-start;gap:var(--space-4)">
          <h1 style="font-family:var(--font-display);font-size:2rem">Browse Creators</h1>
          <p style="color:var(--text-muted)">Discover talented motion graphics creators on FLOWVA</p>
          <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;width:100%;max-width:500px">
            <input type="text" id="creator-search" placeholder="Search by name, bio, country…"
              class="form-input" style="flex:1;min-width:200px">
            <button class="btn btn--primary btn--sm" id="creator-search-btn">Search</button>
          </div>
        </div>`;
    }

    document.querySelector('.creator-stats-bar')?.style.setProperty('display','none');
    document.querySelector('.creator-bio')?.style.setProperty('display','none');
    document.querySelector('.creator-tabs')?.style.setProperty('display','none');

    const content = document.querySelector('.creator-content');
    if (content) {
      content.innerHTML = `
        <div id="creators-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-5);padding:var(--space-6) 0">
          <div class="empty-state" style="grid-column:1/-1;padding:40px">
            <p style="color:var(--text-muted)">Loading creators…</p>
          </div>
        </div>
        <div id="creators-pagination" style="display:flex;justify-content:center;gap:var(--space-3);padding:var(--space-6) 0"></div>`;
    }

    let currentPage   = 1;
    let currentSearch = '';

    async function fetchAndRender(page = 1, search = '') {
      const grid = document.getElementById('creators-grid');
      if (grid) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:40px"><p style="color:var(--text-muted)">Loading…</p></div>`;

      const res = await api.users.getCreators({ page, limit: 20, ...(search ? { search } : {}) });

      if (!res.ok || !res.data?.creators?.length) {
        if (grid) grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;padding:60px 20px;text-align:center">
            <div style="font-size:3rem;margin-bottom:12px">👥</div>
            <h3>No creators found</h3>
            <p style="color:var(--text-muted);margin-top:8px">${search ? 'Try a different search term' : 'Be the first to join as a creator!'}</p>
          </div>`;
        return;
      }

      const { creators, pages } = res.data;

      if (grid) {
        grid.innerHTML = creators.map(c => `
          <a href="creator.html?id=${_esc(c.id)}" class="card card--hover"
            style="display:flex;flex-direction:column;gap:var(--space-3);padding:var(--space-5);text-decoration:none;cursor:pointer">
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              ${c.avatarUrl
                ? `<img src="${_esc(c.avatarUrl)}" alt="${_esc(c.name)}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0">`
                : `<div style="width:52px;height:52px;border-radius:50%;background:${_colorFromId(c.id)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;color:#fff;flex-shrink:0">
                    ${_esc(_initials(c.name))}
                   </div>`
              }
              <div style="min-width:0">
                <div style="font-weight:700;font-family:var(--font-display);font-size:0.95rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${_esc(c.name)}
                </div>
                <div style="font-size:0.78rem;color:var(--text-muted)">${_esc(c.country || '')}</div>
              </div>
              ${c.isEarlyAdopter ? `<span class="badge badge--accent" style="margin-left:auto;flex-shrink:0">⭐ Early</span>` : ''}
            </div>
            <p style="font-size:0.84rem;color:var(--text-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
              ${_esc(c.bio || 'Motion graphics creator on FLOWVA.')}
            </p>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:var(--space-3);border-top:1px solid var(--border)">
              <span style="font-size:0.78rem;color:var(--text-muted)">${Number(c.followerCount || 0).toLocaleString()} followers</span>
              <span class="btn btn--ghost btn--sm">View Profile →</span>
            </div>
          </a>
        `).join('');
      }

      const pagination = document.getElementById('creators-pagination');
      if (pagination && pages > 1) {
        pagination.innerHTML = Array.from({ length: pages }, (_, i) => i + 1).map(p => `
          <button class="btn btn--sm ${p === page ? 'btn--primary' : 'btn--ghost'}" data-page="${p}">${p}</button>
        `).join('');
        pagination.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            currentPage = parseInt(btn.dataset.page, 10);
            fetchAndRender(currentPage, currentSearch);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        });
      } else if (pagination) {
        pagination.innerHTML = '';
      }
    }

    document.getElementById('creator-search-btn')?.addEventListener('click', () => {
      currentSearch = document.getElementById('creator-search')?.value.trim() ?? '';
      currentPage   = 1;
      fetchAndRender(currentPage, currentSearch);
    });
    document.getElementById('creator-search')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        currentSearch = e.target.value.trim();
        currentPage   = 1;
        fetchAndRender(currentPage, currentSearch);
      }
    });

    await fetchAndRender();
  }
});