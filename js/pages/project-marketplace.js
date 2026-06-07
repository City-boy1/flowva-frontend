import AppState from '../core/state.js';
import api from '../core/api.js';

document.addEventListener('DOMContentLoaded', async () => {

  let allProjects = [];
  let filtered = [];
  let visibleCount = 12;

  const grid       = document.getElementById('pm-grid');
  const skeleton   = document.getElementById('pm-skeleton');
  const countEl    = document.getElementById('result-count');
  const searchEl   = document.getElementById('pm-search');
  const catEl      = document.getElementById('pm-category');
  const sortEl     = document.getElementById('pm-sort');
  const loadMoreBtn= document.getElementById('pm-load-more');

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

  function daysLeft(dateStr) {
    if (!dateStr) return '—';
    const diff = new Date(dateStr) - Date.now();
    const d = Math.ceil(diff / 86400000);
    if (d < 0) return 'Expired';
    if (d === 0) return 'Today';
    return `${d}d left`;
  }

  function formatBudget(b) {
    return b ? `$${Number(b).toLocaleString()}` : '—';
  }

  function starsHtml(score) {
    const s = Math.round(Number(score ?? 0));
    return '★'.repeat(s) + '☆'.repeat(5 - s);
  }

  // ── Fetch ──────────────────────────────────────────────────────
  async function fetchProjects() {
    skeleton?.classList.remove('hidden');
    grid.innerHTML = '';

    const res = await api.projects.list({ limit: 50 });
    skeleton?.classList.add('hidden');

    if (!res.ok || !res.data?.projects) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px"><p style="color:var(--text-muted)">Failed to load projects. Please refresh.</p></div>`;
      return;
    }

    // Only OPEN projects (backend already filters, but double-check)
    allProjects = (res.data.projects ?? []).filter(p => p.status === 'OPEN');
    applyFilters();
  }

  // ── Filter ─────────────────────────────────────────────────────
  function applyFilters() {
    const q    = (searchEl?.value ?? '').toLowerCase().trim();
    const cat  = catEl?.value ?? '';
    const sort = sortEl?.value ?? 'newest';

    filtered = allProjects.filter(p => {
      const title = (p.content?.title ?? '').toLowerCase();
      const desc  = (p.content?.description ?? '').toLowerCase();
      if (cat && p.content?.category !== cat) return false;
      if (q && !title.includes(q) && !desc.includes(q)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      switch (sort) {
        case 'budget-high': return (b.budget ?? 0) - (a.budget ?? 0);
        case 'budget-low':  return (a.budget ?? 0) - (b.budget ?? 0);
        case 'deadline':    return new Date(a.biddingClosesAt ?? 0) - new Date(b.biddingClosesAt ?? 0);
        default:            return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    if (countEl) countEl.textContent = `${filtered.length} project${filtered.length !== 1 ? 's' : ''}`;
    renderGrid();
  }

  // ── Render ─────────────────────────────────────────────────────
  function renderGrid() {
    const slice = filtered.slice(0, visibleCount);

    if (!slice.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px"><div style="font-size:2.5rem;margin-bottom:12px">📭</div><p style="color:var(--text-muted)">No projects found.</p></div>`;
      loadMoreBtn?.classList.add('hidden');
      return;
    }

    grid.innerHTML = slice.map(p => {
      const c         = p.content ?? {};
      const bidCount  = p.bids?.length ?? p._count?.bids ?? 0;
      const skills    = (c.skills ?? []).slice(0, 4);
      // clientRating comes from the enriched list endpoint
      const rating    = p.clientRating ?? 0;
      const ratingCount = p.clientRatingCount ?? 0;
      const clientName  = p.clientName ?? 'Client';
      const clientInit  = clientName.charAt(0).toUpperCase();

      return `
        <div class="pm-card" data-id="${_esc(p.id)}">
          <div class="pm-card-header">
            <h3 class="pm-card-title">${_esc(c.title ?? 'Untitled Project')}</h3>
            <span class="badge badge--success" style="flex-shrink:0">${_esc(formatBudget(p.budget))}</span>
          </div>
          <div class="pm-card-meta">
            <span class="pm-meta-item">⏰ ${_esc(daysLeft(p.biddingClosesAt))}</span>
            <span class="pm-meta-item">📋 ${bidCount} bid${bidCount !== 1 ? 's' : ''}</span>
            ${c.category ? `<span class="pm-meta-item">🏷️ ${_esc(c.category)}</span>` : ''}
          </div>
          <p class="pm-card-desc">${_esc(c.description ?? '')}</p>
          ${skills.length ? `<div class="pm-skills">${skills.map(s => `<span class="pm-skill-tag">${_esc(s)}</span>`).join('')}</div>` : ''}
          <div class="pm-card-footer">
            <div class="pm-client-info">
              <div class="pm-client-avatar">${_esc(clientInit)}</div>
              <div>
                <div style="font-weight:500;color:var(--text-secondary)">${_esc(clientName)}</div>
                ${rating > 0
                  ? `<div style="color:var(--warning);font-size:0.7rem">${starsHtml(rating)} <span style="color:var(--text-muted)">(${ratingCount})</span></div>`
                  : `<div style="font-size:0.7rem;color:var(--text-muted)">No ratings yet</div>`}
              </div>
            </div>
            <button class="btn btn--primary btn--sm bid-btn"
              data-id="${_esc(p.id)}"
              data-title="${_esc(c.title ?? '')}">
              Place Bid
            </button>
          </div>
        </div>`;
    }).join('');

    // Card click → detail modal
    grid.querySelectorAll('.pm-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.bid-btn')) return;
        const id = card.dataset.id;
        const p  = allProjects.find(x => x.id === id);
        if (p) openDetailModal(p);
      });
    });

    // Bid buttons
    grid.querySelectorAll('.bid-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openBidModal(btn.dataset.id, btn.dataset.title);
      });
    });

    loadMoreBtn?.classList.toggle('hidden', filtered.length <= visibleCount);
  }

  // ── Detail Modal ───────────────────────────────────────────────
  function openDetailModal(p) {
    const c         = p.content ?? {};
    const bidCount  = p.bids?.length ?? p._count?.bids ?? 0;
    const rating    = p.clientRating ?? 0;
    const ratingCount = p.clientRatingCount ?? 0;
    const clientName  = p.clientName ?? 'Client';

    document.getElementById('detail-title').textContent = c.title ?? 'Project Details';

    document.getElementById('detail-body').innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-3)">
        <span class="badge badge--success">Budget: ${formatBudget(p.budget)}</span>
        <span class="badge badge--warning">⏰ Deadline: ${daysLeft(p.biddingClosesAt)}</span>
        <span class="badge badge--muted">📋 ${bidCount} bids</span>
        ${c.category ? `<span class="badge badge--accent">🏷️ ${_esc(c.category)}</span>` : ''}
      </div>
      <div>
        <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:6px">Description</div>
        <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.7">${_esc(c.description ?? '')}</p>
      </div>
      ${(c.skills ?? []).length ? `
        <div>
          <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:6px">Skills Required</div>
          <div class="pm-skills">${(c.skills).map(s => `<span class="pm-skill-tag">${_esc(s)}</span>`).join('')}</div>
        </div>` : ''}
      <div style="padding:var(--space-4);border-radius:var(--radius-md);background:var(--bg-overlay);border:1px solid var(--border)">
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">Posted by</div>
        <div style="font-weight:600;font-size:0.9rem">${_esc(clientName)}</div>
        ${rating > 0
          ? `<div style="color:var(--warning);font-size:0.8rem;margin-top:2px">${starsHtml(rating)} <span style="color:var(--text-muted);font-size:0.75rem">${Number(rating).toFixed(1)} (${ratingCount} reviews)</span></div>`
          : `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">No ratings yet</div>`}
      </div>
      ${(c.attachments ?? []).length ? `
        <div>
          <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:6px">Attachments</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${(c.attachments).map((url, i) => `
              <a href="${_esc(url)}" target="_blank" rel="noopener"
                 style="font-size:0.8rem;padding:6px 14px;border-radius:var(--radius-full);background:var(--bg-overlay);border:1px solid var(--border);color:var(--accent-hover);text-decoration:none">
                📎 File ${i + 1}
              </a>`).join('')}
          </div>
        </div>` : ''}`;

    const footer = document.getElementById('detail-footer');
    const isCreator = ['CREATOR','ADMIN'].includes((AppState.getUser()?.role ?? '').toUpperCase());
    footer.innerHTML = isCreator
      ? `<button class="btn btn--ghost modal-close">Close</button>
         <button class="btn btn--primary" id="detail-bid-btn" data-id="${_esc(p.id)}" data-title="${_esc(c.title ?? '')}">Place Bid</button>`
      : `<button class="btn btn--ghost modal-close">Close</button>`;

    document.getElementById('detail-bid-btn')?.addEventListener('click', btn => {
      document.getElementById('detail-modal').classList.remove('open');
      openBidModal(btn.currentTarget.dataset.id, btn.currentTarget.dataset.title);
    });

    document.getElementById('detail-modal').classList.add('open');
  }

  // ── Bid Modal ──────────────────────────────────────────────────
  let _pendingBidProjectId = null;

  function openBidModal(projectId, projectTitle) {
    const user = AppState.getUser();
    if (!user) {
      showToast('Please login to bid', 'info');
      setTimeout(() => { window.location.href = 'login.html'; }, 700);
      return;
    }
    const role = (user.role ?? '').toUpperCase();
    if (!['CREATOR','ADMIN'].includes(role)) {
      showToast('Only creators can place bids', 'info');
      return;
    }

    _pendingBidProjectId = projectId;
    document.getElementById('bid-project-title-display').textContent = `Project: ${projectTitle}`;
    document.getElementById('bid-amount').value   = '';
    document.getElementById('bid-delivery').value = '';
    document.getElementById('bid-proposal').value = '';
    document.getElementById('bid-samples').value  = '';
    document.getElementById('bid-error').style.display = 'none';
    document.getElementById('bid-modal').classList.add('open');
  }

  document.getElementById('bid-submit-btn')?.addEventListener('click', async () => {
    if (!_pendingBidProjectId) return;

    const amount   = parseFloat(document.getElementById('bid-amount').value);
    const delivery = parseInt(document.getElementById('bid-delivery').value);
    const proposal = document.getElementById('bid-proposal').value.trim();
    const samples  = document.getElementById('bid-samples').value
      .split(',').map(s => s.trim()).filter(s => s.startsWith('http'));
    const errorEl  = document.getElementById('bid-error');

    if (!amount || amount < 1)        { errorEl.textContent = 'Enter a valid bid amount'; errorEl.style.display='block'; return; }
    if (!delivery || delivery < 1)    { errorEl.textContent = 'Enter delivery time in days'; errorEl.style.display='block'; return; }
    if (proposal.length < 50)         { errorEl.textContent = 'Proposal must be at least 50 characters'; errorEl.style.display='block'; return; }
    errorEl.style.display = 'none';

    const btn = document.getElementById('bid-submit-btn');
    btn.disabled = true; btn.textContent = 'Submitting…';

    const res = await api.projects.submitBid(_pendingBidProjectId, {
      amount,
      deliveryDays: delivery,
      proposal,
      sampleUrls: samples,
    });

    btn.disabled = false; btn.textContent = 'Submit Bid';

    if (!res.ok) {
      errorEl.textContent = res.error ?? 'Failed to submit bid';
      errorEl.style.display = 'block';
      return;
    }

    document.getElementById('bid-modal').classList.remove('open');
    showToast('Bid submitted successfully! 🎉', 'success');
    // Update bid count locally
    const p = allProjects.find(x => x.id === _pendingBidProjectId);
    if (p) { p.bids = p.bids ?? []; p.bids.push(res.data.bid); }
    applyFilters();
  });

  // ── Post Project ───────────────────────────────────────────────
  document.getElementById('btn-post-project')?.addEventListener('click', () => {
    const user = AppState.getUser();
    if (!user) {
      showToast('Please login to post a project', 'info');
      setTimeout(() => { window.location.href = 'login.html'; }, 700);
      return;
    }
    // Set min date to today
    const dateInput = document.getElementById('proj-deadline');
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
    document.getElementById('post-project-modal').classList.add('open');
  });

  document.getElementById('post-project-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const title    = document.getElementById('proj-title').value.trim();
    const desc     = document.getElementById('proj-desc').value.trim();
    const budget   = parseFloat(document.getElementById('proj-budget').value);
    const deadline = document.getElementById('proj-deadline').value;
    const category = document.getElementById('proj-category').value;
    const software = document.getElementById('proj-software').value.trim();
    const skillsRaw= document.getElementById('proj-skills').value;
    const skills   = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const errorEl  = document.getElementById('post-project-error');

    if (!title)              { errorEl.textContent = 'Project title is required'; errorEl.style.display='block'; return; }
    if (desc.length < 20)    { errorEl.textContent = 'Description must be at least 20 characters'; errorEl.style.display='block'; return; }
    if (!budget || budget<5) { errorEl.textContent = 'Enter a valid budget (min $5)'; errorEl.style.display='block'; return; }
    if (!deadline)           { errorEl.textContent = 'Deadline is required'; errorEl.style.display='block'; return; }
    errorEl.style.display = 'none';

    const btn = document.getElementById('post-project-submit');
    btn.disabled = true; btn.textContent = 'Submitting…';

   
    const fileInput = document.getElementById('proj-attachments');
    const attachmentUrls = [];
     if (fileInput.files.length > 0) {
      btn.textContent = 'Uploading files…';
      for (const file of fileInput.files) {
        if (file.size > 10 * 1024 * 1024) {
          errorEl.textContent = `File "${file.name}" exceeds 10MB limit`;
          errorEl.style.display = 'block';
          btn.disabled = false; btn.textContent = 'Submit Project';
          return;
        }
        const fd = new FormData();
        fd.append('file', file);
        const up = await api.projects.uploadAttachment(fd);
        if (!up.ok || !up.data?.url) {
          errorEl.textContent = `Failed to upload "${file.name}"`;
          errorEl.style.display = 'block';
          btn.disabled = false; btn.textContent = 'Submit Project';
          return;
        }
        attachmentUrls.push(up.data.url);
      }
    }

     btn.textContent = 'Submitting…';
    await api.restoreSession();
    const res = await api.projects.create({
      title,
      description: desc,
      category,
      skills,
      budget,
      currency: 'USD',
      deadline,
      attachments: attachmentUrls,
    });

    btn.disabled = false; btn.textContent = 'Submit Project';

    if (!res.ok) {
      errorEl.textContent = res.error ?? 'Failed to post project';
      errorEl.style.display = 'block';
      return;
    }

    document.getElementById('post-project-modal').classList.remove('open');
    document.getElementById('post-project-form').reset();
    showToast('Project submitted! It will appear after admin approval. ✅', 'success');
  });

  // ── Modal close wiring ─────────────────────────────────────────
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.remove('open'));
  });

  // ── Listeners ──────────────────────────────────────────────────
  searchEl?.addEventListener('input', () => { visibleCount = 12; applyFilters(); });
  catEl?.addEventListener('change',   () => { visibleCount = 12; applyFilters(); });
  sortEl?.addEventListener('change',  () => { visibleCount = 12; applyFilters(); });
  loadMoreBtn?.addEventListener('click', () => { visibleCount += 12; renderGrid(); });

  await fetchProjects();
});

