import AppState from '../core/state.js';
import api from '../core/api.js';

document.addEventListener('DOMContentLoaded', async () => {

  let allProjects = [];
let filtered = [];
let visibleCount = 12;
let activeKind = 'project';
let _dataReady = false;
 // 'project' | 'job'

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
    loadMoreBtn?.classList.add('hidden');

    const [pRes, jRes] = await Promise.all([
      api.projects.list({ limit: 50 }),
      api.jobs.list({ limit: 50 }),
    ]);
    skeleton?.classList.add('hidden');

    const projects = pRes.ok ? (pRes.data?.projects ?? []).filter(p => p.status === 'OPEN').map(p => ({ ...p, kind: 'project' })) : [];
    const jobs     = jRes.ok ? (jRes.data?.jobs ?? []).filter(j => j.status === 'open').map(j => ({ ...j, kind: 'job' })) : [];

    allProjects = [...projects, ...jobs];
    _dataReady = true;
    applyFilters();
  }

  // ── Toggle wiring ──────────────────────────────────────────────
  const TOGGLE_CONTEXT = {
    project: {
      pills: ['Fixed scope', 'Fixed deadline', 'Fixed price'],
      desc: 'One-off projects open for bids — place a bid to win the work.',
      postLabel: '+ Post a Freelance Project',
      postHref: 'post-a-job.html?type=freelance',
      count: (n) => `${n} project${n !== 1 ? 's' : ''}`,
    },
    job: {
      pills: ['Ongoing engagement', 'Long-term commitment', 'Monthly retainer'],
      desc: 'Contract and full-time roles — submit your application to be considered.',
      postLabel: '+ Post a Contract Role',
      postHref: 'post-a-job.html?type=contract',
      count: (n) => `${n} role${n !== 1 ? 's' : ''}`,
    },
  };

  function switchKind(kind) {
    activeKind = kind;
    document.body.setAttribute('data-pm-type', kind === 'job' ? 'contract' : 'freelance');

    // Toggle button active states
    document.querySelectorAll('.pm-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === (kind === 'job' ? 'contract' : 'freelance'));
    });

    // Slide the track
    const activeBtn = document.querySelector(`.pm-type-btn[data-type="${kind === 'job' ? 'contract' : 'freelance'}"]`);
    const track = document.getElementById('pm-toggle-track');
    if (track && activeBtn) {
      track.style.width = `${activeBtn.offsetWidth}px`;
      track.style.transform = `translateX(${activeBtn.offsetLeft - 5}px)`;
    }

    // Context banner
    const ctx = TOGGLE_CONTEXT[kind];
    const pillsEl = document.getElementById('pm-context-pills');
    const descEl  = document.getElementById('pm-context-desc');
    const postBtn = document.getElementById('pm-post-btn');
    if (pillsEl) pillsEl.innerHTML = ctx.pills.map(p => `<span class="pm-context-pill">${p}</span>`).join('');
    if (descEl)  descEl.textContent = ctx.desc;
    if (postBtn) { postBtn.textContent = ctx.postLabel; postBtn.href = ctx.postHref; }

    visibleCount = 12;
    applyFilters();
  }

  // Bind toggle buttons
  document.querySelectorAll('.pm-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchKind(btn.dataset.type === 'contract' ? 'job' : 'project');
    });
  });

  // Init track position after layout
  requestAnimationFrame(() => {
    const activeBtn = document.querySelector('.pm-type-btn.active');
    const track = document.getElementById('pm-toggle-track');
    if (track && activeBtn) {
      track.style.width = `${activeBtn.offsetWidth}px`;
      track.style.transform = `translateX(${activeBtn.offsetLeft - 5}px)`;
    }
    // Init context banner
    switchKind('project');
  });

  window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.pm-type-btn.active');
    const track = document.getElementById('pm-toggle-track');
    if (track && activeBtn) {
      track.style.width = `${activeBtn.offsetWidth}px`;
      track.style.transform = `translateX(${activeBtn.offsetLeft - 5}px)`;
    }
  });

  // ── Filter ─────────────────────────────────────────────────────
  function applyFilters() {
    if (!_dataReady) return;
    const q    = (searchEl?.value ?? '').toLowerCase().trim();
    const cat  = catEl?.value ?? '';
    const sort = sortEl?.value ?? 'newest';

    filtered = allProjects.filter(p => {
      // Kind filter — this is what drives the toggle
      if (p.kind !== activeKind) return false;
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

    if (countEl) countEl.textContent = TOGGLE_CONTEXT[activeKind].count(filtered.length);
    renderGrid();
  }

  // ── Render ─────────────────────────────────────────────────────
  function renderGrid() {
    if (!_dataReady) return;
    const slice = filtered.slice(0, visibleCount);

    if (!slice.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px">
  <div style="margin-bottom:16px;opacity:0.35">
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
      <line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  </div>
  <p style="font-weight:600;color:var(--text-secondary);margin-bottom:6px">No ${activeKind === 'job' ? 'roles' : 'projects'} found</p>
  <p style="font-size:0.85rem;color:var(--text-muted)">Try different filters or be the first to post one.</p>
</div>`;
      loadMoreBtn?.classList.add('hidden');
      return;
    }

    grid.innerHTML = slice.map(p => {
      if (p.kind === 'job') return renderJobCard(p);
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
            <span class="pm-meta-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${_esc(daysLeft(p.biddingClosesAt))}</span>
          <span class="pm-meta-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> ${bidCount} bid${bidCount !== 1 ? 's' : ''}</span>
          ${c.category ? `<span class="pm-meta-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ${_esc(c.category)}</span>` : ''}
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
    if (e.target.closest('.bid-btn') || e.target.closest('.apply-job-btn')) return;
    const id = card.dataset.id;
    const item = allProjects.find(x => x.id === id);
    if (!item) return;
    if (item.kind === 'job') openJobDetailModal(item);
    else openDetailModal(item);
  });
  });

    // Bid buttons
    grid.querySelectorAll('.bid-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openBidModal(btn.dataset.id, btn.dataset.title);
      });
    });

    // Apply buttons (jobs)
    grid.querySelectorAll('.apply-job-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openApplyModal(btn.dataset.id, btn.dataset.title);
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
        <span class="badge badge--warning"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Deadline: ${daysLeft(p.biddingClosesAt)}</span>
        <span class="badge badge--muted"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> ${bidCount} bids</span>
      ${c.category ? `<span class="badge badge--accent"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ${_esc(c.category)}</span>` : ''}
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

  function openJobDetailModal(j) {
  const c = j.content ?? {};
  const salary = c.salary && (c.salary.min || c.salary.max)
    ? `$${c.salary.min ?? '—'}–$${c.salary.max ?? '—'} / ${c.salary.period ?? ''}`
    : 'Not specified';
  const typeLabel = j.jobType === 'full-time' ? 'Full-Time' : 'Contract';

  document.getElementById('detail-title').textContent = c.title ?? 'Job Details';

  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-3)">
      <span class="badge badge--accent">${_esc(typeLabel)}</span>
      ${c.location ? `<span class="badge badge--muted">📍 ${_esc(c.location)}${c.city ? `, ${_esc(c.city)}` : ''}</span>` : ''}
      <span class="badge badge--success">💰 ${_esc(salary)}</span>
    </div>

    ${c.company ? `
    <div style="display:flex;align-items:center;gap:12px;padding:var(--space-3);border-radius:var(--radius-md);background:var(--bg-overlay);border:1px solid var(--border)">
      ${c.logoUrl ? `<img src="${_esc(c.logoUrl)}" style="width:40px;height:40px;border-radius:6px;object-fit:contain">` : ''}
      <div>
        <div style="font-weight:600;font-size:0.95rem">${_esc(c.company)}</div>
        ${c.website ? `<a href="${_esc(c.website)}" target="_blank" rel="noopener" style="font-size:0.78rem;color:var(--accent-hover)">${_esc(c.website)}</a>` : ''}
      </div>
    </div>` : ''}

    <div>
      <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:6px">About the Role</div>
      <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.7;white-space:pre-line">${_esc(c.description ?? '')}</p>
    </div>

    ${(c.fields ?? []).length ? `
    <div>
      <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:6px">Skills / Fields</div>
      <div class="pm-skills">${(c.fields).map(f => `<span class="pm-skill-tag">${_esc(f)}</span>`).join('')}</div>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
      <div style="padding:var(--space-3);border-radius:var(--radius-md);background:var(--bg-overlay);border:1px solid var(--border)">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Job Type</div>
        <div style="font-weight:600;font-size:0.88rem">${_esc(typeLabel)}</div>
      </div>
      <div style="padding:var(--space-3);border-radius:var(--radius-md);background:var(--bg-overlay);border:1px solid var(--border)">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Location</div>
        <div style="font-weight:600;font-size:0.88rem">${_esc(c.location ?? '—')}</div>
      </div>
      <div style="padding:var(--space-3);border-radius:var(--radius-md);background:var(--bg-overlay);border:1px solid var(--border)">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">Salary</div>
        <div style="font-weight:600;font-size:0.88rem">${_esc(salary)}</div>
      </div>
      ${c.city ? `
      <div style="padding:var(--space-3);border-radius:var(--radius-md);background:var(--bg-overlay);border:1px solid var(--border)">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:2px">City</div>
        <div style="font-weight:600;font-size:0.88rem">${_esc(c.city)}</div>
      </div>` : ''}
    </div>`;

  // Footer — show Apply button only for CREATOR/ADMIN, hide for the client (BUYER)
  const footer = document.getElementById('detail-footer');
  const user = AppState.getUser();
  const role = (user?.role ?? '').toUpperCase();
  const isCreator = ['CREATOR', 'ADMIN'].includes(role);

  footer.innerHTML = isCreator
    ? `<button class="btn btn--ghost modal-close">Close</button>
       <button class="btn btn--primary" id="detail-apply-btn"
         data-id="${_esc(j.id)}" data-title="${_esc(c.title ?? '')}">
         Apply Now
       </button>`
    : `<button class="btn btn--ghost modal-close">Close</button>`;

  document.getElementById('detail-apply-btn')?.addEventListener('click', btn => {
    document.getElementById('detail-modal').classList.remove('open');
    openApplyModal(btn.currentTarget.dataset.id, btn.currentTarget.dataset.title);
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

  function renderJobCard(j) {
    const c = j.content ?? {};
    const typeLabel = j.jobType === 'full-time' ? 'Full-Time' : 'Contract';
    const fields = (c.fields ?? []).slice(0, 4);
    const salary = c.salary && (c.salary.min || c.salary.max)
      ? `$${c.salary.min ?? '—'}–${c.salary.max ?? '—'}/${_esc(c.salary.period ?? '')}` : '—';
    const svgBuilding = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="14" rx="1"/><path d="M9 21V11h6v10"/><path d="M3 7l9-4 9 4"/></svg>`;
    const svgCash     = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>`;
    const svgPin      = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
    return `
      <div class="pm-card" data-id="${_esc(j.id)}" data-kind="job">
        <div class="pm-card-header">
          <h3 class="pm-card-title">${_esc(c.title ?? 'Untitled Role')}</h3>
          <span class="badge badge--accent" style="flex-shrink:0">${_esc(typeLabel)}</span>
        </div>
        <div class="pm-card-meta">
          <span class="pm-meta-item">${svgBuilding} ${_esc(c.company ?? '')}</span>
          <span class="pm-meta-item">${svgCash} ${_esc(salary)}</span>
          <span class="pm-meta-item">${svgPin} ${_esc(c.location ?? '')}</span>
        </div>
        <p class="pm-card-desc">${_esc(c.description ?? '')}</p>
        ${fields.length ? `<div class="pm-skills">${fields.map(f => `<span class="pm-skill-tag">${_esc(f)}</span>`).join('')}</div>` : ''}
        <div class="pm-card-footer">
          <div></div>
          <button class="btn btn--primary btn--sm apply-job-btn" data-id="${_esc(j.id)}" data-title="${_esc(c.title ?? '')}">Apply</button>
        </div>
      </div>`;
  }

  let _pendingApplyJobId = null;

  function openApplyModal(jobId, jobTitle) {
    const user = AppState.getUser();
    if (!user) { showToast('Please login to apply', 'info'); setTimeout(() => window.location.href = 'login.html', 700); return; }
    if (!['CREATOR','ADMIN'].includes((user.role ?? '').toUpperCase())) { showToast('Only creators can apply', 'info'); return; }
    _pendingApplyJobId = jobId;

    // Populate and open the apply modal in the HTML
    const titleEl = document.getElementById('apply-project-title-display');
    if (titleEl) titleEl.textContent = jobTitle;
    const coverEl = document.getElementById('apply-cover');
    if (coverEl) coverEl.value = '';
    const rateEl = document.getElementById('apply-rate');
    if (rateEl) rateEl.value = '';
    const startEl = document.getElementById('apply-start');
    if (startEl) startEl.value = '';
    const portEl = document.getElementById('apply-portfolio');
    if (portEl) portEl.value = '';
    const errEl = document.getElementById('apply-error');
    if (errEl) errEl.style.display = 'none';
    const submitBtn = document.getElementById('apply-submit-btn');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Application'; }
    document.getElementById('apply-modal')?.classList.add('open');
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

  document.getElementById('apply-submit-btn')?.addEventListener('click', async () => {
    const cover     = document.getElementById('apply-cover')?.value.trim() ?? '';
    const portfolio = document.getElementById('apply-portfolio')?.value.trim() ?? '';
    const errEl     = document.getElementById('apply-error');

    if (cover.length < 20) {
      errEl.textContent = 'Cover letter must be at least 20 characters.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    const btn = document.getElementById('apply-submit-btn');
    btn.disabled = true; btn.textContent = 'Submitting...';

    const res = await api.jobs.apply(_pendingApplyJobId, {
      coverLetter: cover,
      portfolioUrl: portfolio || undefined,
    });

    btn.disabled = false; btn.textContent = 'Submit Application';

    if (!res.ok) {
      errEl.textContent = res.error ?? 'Failed to submit application.';
      errEl.style.display = 'block';
      return;
    }

    document.getElementById('apply-modal')?.classList.remove('open');
    showToast("Application submitted! We'll notify the client.", 'success');
  });

document.getElementById('btn-post-project')?.addEventListener('click', () => {
    const user = AppState.getUser();
    if (!user) {
      showToast('Please login to post a project', 'info');
      setTimeout(() => { window.location.href = 'login.html'; }, 700);
      return;
    }
    window.location.href = 'post-a-job.html';
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

