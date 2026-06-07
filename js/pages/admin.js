/**
 * FLOWVA — admin.js  (js/pages/admin.js)
 * Requires ADMIN role (enforced in HTML before this loads)
 */

import api   from '../core/api.js';

// ════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function money(n) { return Number(n ?? 0).toFixed(2); }

function el(id) { return document.getElementById(id); }

// ════════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════════

const Toast = {
  show(msg, type = 'info', duration = 3500) {
    const root = el('toast-root');
    if (!root) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span class="toast-dot"></span>${esc(msg)}`;
    root.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      t.addEventListener('animationend', () => t.remove(), { once: true });
    }, duration);
  },
};

// ════════════════════════════════════════════════════════════
//  DIALOGS  (replaces all native confirm / prompt / alert)
// ════════════════════════════════════════════════════════════

function showConfirm({ title, body, icon = '⚠️', confirmLabel = 'Confirm', confirmClass = 'btn-danger', cancelLabel = 'Cancel' }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">${esc(icon)}</div>
        <div class="confirm-title">${esc(title)}</div>
        <div class="confirm-body">${esc(body)}</div>
        <div class="confirm-actions">
          <button class="btn btn-ghost" id="dlg-cancel">${esc(cancelLabel)}</button>
          <button class="btn ${confirmClass}" id="dlg-ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#dlg-ok').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#dlg-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

function showPrompt({ title, subtitle = '', placeholder = 'Enter reason…', confirmLabel = 'Submit', minLength = 5 }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'prompt-overlay';
    overlay.innerHTML = `
      <div class="prompt-dialog">
        <div class="prompt-title">${esc(title)}</div>
        ${subtitle ? `<div class="prompt-sub">${esc(subtitle)}</div>` : ''}
        <textarea class="prompt-textarea" placeholder="${esc(placeholder)}" id="dlg-textarea" rows="3"></textarea>
        <div id="dlg-err" style="font-size:11.5px;color:var(--red);margin-bottom:10px;display:none">
          Minimum ${minLength} characters required.
        </div>
        <div class="prompt-actions">
          <button class="btn btn-ghost" id="dlg-cancel">Cancel</button>
          <button class="btn btn-primary" id="dlg-ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const ta  = overlay.querySelector('#dlg-textarea');
    const err = overlay.querySelector('#dlg-err');
    ta.focus();
    overlay.querySelector('#dlg-ok').onclick = () => {
      const v = ta.value.trim();
      if (v.length < minLength) { err.style.display = 'block'; return; }
      overlay.remove(); resolve(v);
    };
    overlay.querySelector('#dlg-cancel').onclick = () => { overlay.remove(); resolve(null); };
    overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(null); } };
  });
}

// ════════════════════════════════════════════════════════════
//  MEDIA PREVIEW MODAL
// ════════════════════════════════════════════════════════════

function openPreview(title, fileUrl, previewUrl, fileType) {
  const existing = el('preview-modal');
  if (existing) existing.remove();

  const isVideo = fileType === 'video'
    || /\/video\//.test(fileUrl ?? '')
    || /\.(mp4|webm|mov)(\?|$)/i.test(fileUrl ?? '');

  const media = isVideo && fileUrl
    ? `<video controls autoplay muted loop playsinline
         style="width:100%;max-height:480px;display:block;background:#000">
         <source src="${esc(fileUrl)}" type="video/mp4">
       </video>`
    : (previewUrl || fileUrl)
      ? `<img src="${esc(previewUrl || fileUrl)}" alt="${esc(title)}"
           style="width:100%;max-height:80vh;object-fit:contain;display:block;
                  background:var(--bg-hover);cursor:zoom-in;"
           onclick="this.style.maxHeight=this.style.maxHeight==='none'?'80vh':'none';
                    this.style.cursor=this.style.cursor==='zoom-out'?'zoom-in':'zoom-out'">`
      : `<div style="padding:40px;text-align:center;color:var(--text-3)">No preview available</div>`;

  const overlay = document.createElement('div');
  overlay.id = 'preview-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${esc(title)}</span>
        <button class="modal-close" id="preview-close">✕</button>
      </div>
      ${media}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#preview-close').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

// ════════════════════════════════════════════════════════════
//  TAB ROUTER
// ════════════════════════════════════════════════════════════

const _loaded = new Set();

function activateTab(tab) {
  document.querySelectorAll('.nav-item[data-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-panel[id^="panel-"]').forEach(p =>
    p.classList.toggle('active', p.id === `panel-${tab}`)
  );
  if (_loaded.has(tab)) return;
  _loaded.add(tab);
  const loaders = {
    overview:    loadStats,
    templates:   () => loadTemplates('PENDING'),
    tutorials:   () => loadTutorials('PENDING'),
    projects:    () => loadProjects('pending'),
    commissions: loadCommissions,
    disputes:    loadDisputes,
    users:       loadUsers,
    tools:       loadTools,
  };
  loaders[tab]?.();
}

// ════════════════════════════════════════════════════════════
//  STATS  (Overview)
// ════════════════════════════════════════════════════════════

async function loadStats() {
  const res = await api.admin.getStats();
  if (!res.ok) { Toast.show('Could not load stats', 'error'); return; }
  const s = res.data.stats;

  // Stat cards
  el('st-users').textContent     = s.users      ?? '—';
  el('st-creators').textContent  = s.creators   ?? '—';
  el('st-orders').textContent    = s.completedOrders ?? '—';
  el('st-revenue').textContent   = money(s.totalRevenue);
  el('st-pending').textContent   = s.pendingTemplates ?? '—';
  el('st-commission').textContent = money(s.totalCommission);

  // Topbar
  el('topbar-users').textContent  = s.users ?? '—';
  el('topbar-revenue').textContent = money(s.totalRevenue);

  // Date
  el('overview-date').textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Sidebar badges
  setBadge('badge-templates', s.pendingTemplates);
  setBadge('badge-tutorials', s.pendingTutorials);
  setBadge('badge-projects',  s.pendingProjects);
}

function setBadge(id, n) {
  const b = el(id);
  if (!b) return;
  if (n > 0) { b.textContent = n; b.classList.add('visible'); }
  else b.classList.remove('visible');
}

// ════════════════════════════════════════════════════════════
//  TEMPLATES
// ════════════════════════════════════════════════════════════

async function loadTemplates(status) {
  const container = el('tmpl-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading templates…</div>';

  let templates = [];
  if (status === 'PENDING') {
    const res = await api.admin.getPendingTemplates();
    if (!res.ok) { container.innerHTML = errorHtml('Failed to load templates'); return; }
    templates = res.data.templates ?? [];
    // Update pending count chip
    const chip = el('tmpl-pending-count');
    if (chip) chip.textContent = templates.length || '';
    setBadge('badge-templates', templates.length);
  } else {
    const res = await api.get(`/admin/templates?status=${status}&limit=50`);
    if (!res.ok) { container.innerHTML = errorHtml('Failed to load templates'); return; }
    templates = res.data.templates ?? [];
  }

  if (!templates.length) {
    container.innerHTML = emptyHtml('📭', 'No templates', `No ${status.toLowerCase()} templates found`);
    return;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'review-list';

  for (const t of templates) {
    const card = buildReviewCard({
      id:       t._id ?? t.id,
      title:    t.title,
      desc:     t.description,
      thumb:    t.previewUrl,
      fileUrl:  t.fileUrl,
      fileType: t.fileType,
      status:   t.status,
      rejectionReason: t.rejectionReason,
      chips: [
        { label: t.category },
        { label: `$${money(t.price)}` },
        t.fileSizeBytes ? { label: `${(t.fileSizeBytes / 1048576).toFixed(1)} MB` } : null,
        { label: fmt(t.createdAt) },
        t.software?.length ? { label: t.software.join(', ') } : null,
      ].filter(Boolean),
    });

    // Footer actions
    const footer = card.querySelector('.review-footer');
    if (status === 'PENDING') {
      footer.innerHTML = `
        <button class="btn btn-approve" data-action="approve" data-id="${esc(t._id ?? t.id)}">✓ Approve</button>
        <input class="reject-reason-input" id="reason-${esc(t._id ?? t.id)}" placeholder="Rejection reason (required, min 5 chars)…">
        <button class="btn btn-reject"  data-action="reject"  data-id="${esc(t._id ?? t.id)}">✕ Reject</button>
        ${(t.fileUrl || t.previewUrl) ? previewBtn(t) : ''}`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.textContent = 'Approving…';
        const r = await api.templates.approve(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '✓ Approve'; return; }
        Toast.show('Template approved — now live ✓', 'success');
        card.remove();
        refreshBadge('badge-templates', 'tmpl-pending-count', container);
      };

      footer.querySelector('[data-action="reject"]').onclick = async btn => {
        const b   = btn.currentTarget;
        const reason = el(`reason-${b.dataset.id}`)?.value.trim();
        if (!reason || reason.length < 5) { Toast.show('Enter a rejection reason (min 5 chars)', 'warning'); return; }
        b.disabled = true; b.textContent = 'Rejecting…';
        const r = await api.templates.reject(b.dataset.id, reason);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '✕ Reject'; return; }
        Toast.show('Template rejected', 'info');
        card.remove();
      };

    } else if (status === 'APPROVED') {
      footer.innerHTML = `
        ${(t.fileUrl || t.previewUrl) ? previewBtn(t) : ''}
        <button class="btn btn-warning" data-action="unpublish" data-id="${esc(t._id ?? t.id)}">⬇ Unpublish</button>`;

      footer.querySelector('[data-action="unpublish"]').onclick = async btn => {
        const b = btn.currentTarget;
        const reason = await showPrompt({ title: 'Unpublish Template', subtitle: 'Provide a reason — it will return to Pending review.', confirmLabel: 'Unpublish', minLength: 5 });
        if (!reason) return;
        b.disabled = true;
        const r = await api.templates.unpublish(b.dataset.id, reason);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; return; }
        Toast.show('Template unpublished → back in Pending', 'info');
        card.remove();
      };

    } else if (status === 'REJECTED') {
      footer.innerHTML = `
        ${(t.fileUrl || t.previewUrl) ? previewBtn(t) : ''}
        <button class="btn btn-approve" data-action="approve" data-id="${esc(t._id ?? t.id)}">↑ Re-approve</button>
        <button class="btn btn-danger"  data-action="delete"  data-id="${esc(t._id ?? t.id)}">🗑 Delete Forever</button>`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.textContent = 'Approving…';
        const r = await api.templates.approve(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '↑ Re-approve'; return; }
        Toast.show('Template re-approved ✓', 'success'); card.remove();
      };

      footer.querySelector('[data-action="delete"]').onclick = async btn => {
        const b = btn.currentTarget;
        const ok = await showConfirm({
          icon: '🗑', title: 'Delete Template Permanently',
          body: 'This removes the MongoDB document and all Cloudinary assets. This action cannot be undone.',
          confirmLabel: 'Delete Forever',
        });
        if (!ok) return;
        b.disabled = true; b.textContent = 'Deleting…';
        const r = await api.templates.permanentDelete(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Delete failed', 'error'); b.disabled = false; b.textContent = '🗑 Delete Forever'; return; }
        Toast.show('Template permanently deleted', 'success'); card.remove();
      };
    }

    bindPreviewBtn(footer);
    list.appendChild(card);
  }

  container.appendChild(list);
}

// ════════════════════════════════════════════════════════════
//  TUTORIALS
// ════════════════════════════════════════════════════════════

async function loadTutorials(status) {
  const container = el('tut-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading tutorials…</div>';

  let tutorials = [];
  if (status === 'PENDING') {
    const res = await api.get('/admin/tutorials/pending');
    if (!res.ok) { container.innerHTML = errorHtml('Failed to load tutorials'); return; }
    tutorials = res.data.tutorials ?? [];
    const chip = el('tut-pending-count');
    if (chip) chip.textContent = tutorials.length || '';
    setBadge('badge-tutorials', tutorials.length);
  } else {
    const res = await api.tutorials.listByStatus(status);
    if (!res.ok) { container.innerHTML = errorHtml('Failed to load tutorials'); return; }
    tutorials = res.data.tutorials ?? [];
  }

  if (!tutorials.length) {
    container.innerHTML = emptyHtml('🎓', 'No tutorials', `No ${status.toLowerCase()} tutorials found`);
    return;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'review-list';

  for (const t of tutorials) {
    const card = buildReviewCard({
      id:    t._id ?? t.id,
      title: t.title,
      desc:  t.description,
      thumb: t.thumbnailUrl,
      status: t.status,
      rejectionReason: t.rejectionReason,
      chips: [
        { label: t.category ?? '—' },
        { label: fmt(t.createdAt) },
      ],
    });

    const footer = card.querySelector('.review-footer');

    if (status === 'PENDING') {
      footer.innerHTML = `
        <button class="btn btn-approve" data-action="approve" data-id="${esc(t._id ?? t.id)}">✓ Approve</button>
        <input class="reject-reason-input" id="tut-reason-${esc(t._id ?? t.id)}" placeholder="Rejection reason (required, min 5 chars)…">
        <button class="btn btn-reject"  data-action="reject"  data-id="${esc(t._id ?? t.id)}">✕ Reject</button>
        ${t.videoUrl ? `<button class="btn btn-ghost preview-video-btn" data-url="${esc(t.videoUrl)}" data-title="${esc(t.title)}">▶ Watch</button>` : ''}`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.textContent = 'Approving…';
        const r = await api.tutorials.approve(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '✓ Approve'; return; }
        Toast.show('Tutorial approved ✓', 'success'); card.remove();
        refreshBadge('badge-tutorials', 'tut-pending-count', container);
      };

      footer.querySelector('[data-action="reject"]').onclick = async btn => {
        const b = btn.currentTarget;
        const reason = el(`tut-reason-${b.dataset.id}`)?.value.trim();
        if (!reason || reason.length < 5) { Toast.show('Enter a rejection reason (min 5 chars)', 'warning'); return; }
        b.disabled = true; b.textContent = 'Rejecting…';
        const r = await api.tutorials.reject(b.dataset.id, reason);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '✕ Reject'; return; }
        Toast.show('Tutorial rejected', 'info'); card.remove();
      };

    } else if (status === 'APPROVED') {
      footer.innerHTML = `
        ${t.videoUrl ? `<button class="btn btn-ghost preview-video-btn" data-url="${esc(t.videoUrl)}" data-title="${esc(t.title)}">▶ Watch</button>` : ''}
        <button class="btn btn-warning" data-action="unpublish" data-id="${esc(t._id ?? t.id)}">⬇ Unpublish</button>`;

      footer.querySelector('[data-action="unpublish"]').onclick = async btn => {
        const b = btn.currentTarget;
        const reason = await showPrompt({ title: 'Unpublish Tutorial', subtitle: 'Provide a reason — it will return to Pending review.', confirmLabel: 'Unpublish', minLength: 5 });
        if (!reason) return;
        b.disabled = true;
        const r = await api.tutorials.unpublish(b.dataset.id, reason);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; return; }
        Toast.show('Tutorial unpublished → back in Pending', 'info'); card.remove();
      };

    } else if (status === 'REJECTED') {
      footer.innerHTML = `
        ${t.videoUrl ? `<button class="btn btn-ghost preview-video-btn" data-url="${esc(t.videoUrl)}" data-title="${esc(t.title)}">▶ Watch</button>` : ''}
        <button class="btn btn-approve" data-action="approve" data-id="${esc(t._id ?? t.id)}">↑ Re-approve</button>
        <button class="btn btn-danger"  data-action="delete"  data-id="${esc(t._id ?? t.id)}">🗑 Delete Forever</button>`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.textContent = 'Approving…';
        const r = await api.tutorials.approve(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '↑ Re-approve'; return; }
        Toast.show('Tutorial re-approved ✓', 'success'); card.remove();
      };

      footer.querySelector('[data-action="delete"]').onclick = async btn => {
        const b = btn.currentTarget;
        const ok = await showConfirm({
          icon: '🗑', title: 'Delete Tutorial Permanently',
          body: 'This removes the video from Cloudinary and the database. Cannot be undone.',
          confirmLabel: 'Delete Forever',
        });
        if (!ok) return;
        b.disabled = true; b.textContent = 'Deleting…';
        const r = await api.tutorials.permanentDelete(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Delete failed', 'error'); b.disabled = false; b.textContent = '🗑 Delete Forever'; return; }
        Toast.show('Tutorial permanently deleted', 'success'); card.remove();
      };
    }

    // Video preview
    footer.querySelectorAll('.preview-video-btn').forEach(btn => {
      btn.onclick = () => openPreview(btn.dataset.title, btn.dataset.url, null, 'video');
    });

    list.appendChild(card);
  }

  container.appendChild(list);
}

// ════════════════════════════════════════════════════════════
//  PROJECTS
// ════════════════════════════════════════════════════════════

async function loadProjects(status) {
  const container = el('proj-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading projects…</div>';

  const endpoint = status === 'pending'
    ? '/admin/projects/pending'
    : `/projects?status=${status.toUpperCase()}&limit=50`;

  const res = await api.get(endpoint);
  if (!res.ok) { container.innerHTML = errorHtml('Failed to load projects'); return; }

  const projects = res.data.projects ?? [];

  if (status === 'pending') {
    const chip = el('proj-pending-count');
    if (chip) chip.textContent = projects.length || '';
    setBadge('badge-projects', projects.length);
  }

  if (!projects.length) {
    container.innerHTML = emptyHtml('📭', 'No projects', `No ${status} projects found`);
    return;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'review-list';

  for (const p of projects) {
    const c = p.content ?? {};
    const bidCount = p._count?.bids ?? 0;
    const card = document.createElement('div');
    card.className = 'review-card';
    card.dataset.id = p.id;

    const attachments = (c.attachments ?? []).map((url, i) =>
      `<a href="${esc(url)}" target="_blank" rel="noopener" class="attachment-link">📎 File ${i + 1}</a>`
    ).join('');

    card.innerHTML = `
      <div class="review-card-body">
        <div class="review-info">
          <div class="review-title">${esc(c.title ?? 'Untitled Project')}</div>
          <div class="review-meta">
            <span class="meta-chip">💵 $${money(p.budget)}</span>
            <span class="meta-chip">👤 ${esc(p.clientName ?? '—')}</span>
            <span class="meta-chip">📋 ${bidCount} bid${bidCount !== 1 ? 's' : ''}</span>
            <span class="meta-chip">📅 ${fmt(p.createdAt)}</span>
            ${c.category ? `<span class="meta-chip">🏷 ${esc(c.category)}</span>` : ''}
            <span class="badge badge-pending">${esc(p.status)}</span>
          </div>
          <p class="review-desc">${esc(c.description ?? '')}</p>
          ${attachments ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${attachments}</div>` : ''}
        </div>
      </div>
      <div class="review-footer"></div>`;

    const footer = card.querySelector('.review-footer');

    if (status === 'pending') {
      footer.innerHTML = `
        <button class="btn btn-approve" data-action="approve" data-id="${esc(p.id)}">✓ Approve</button>
        <input class="reject-reason-input" id="proj-reason-${esc(p.id)}" placeholder="Rejection reason…">
        <button class="btn btn-reject"  data-action="reject"  data-id="${esc(p.id)}">✕ Reject</button>
        <button class="btn btn-danger"  data-action="delete"  data-id="${esc(p.id)}" data-title="${esc(c.title ?? 'project')}">🗑 Delete</button>`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.textContent = 'Approving…';
        const r = await api.patch(`/admin/projects/${b.dataset.id}/approve`, {});
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '✓ Approve'; return; }
        Toast.show('Project approved — now live ✓', 'success'); card.remove();
        refreshBadge('badge-projects', 'proj-pending-count', container);
      };

      footer.querySelector('[data-action="reject"]').onclick = async btn => {
        const b = btn.currentTarget;
        const reason = el(`proj-reason-${b.dataset.id}`)?.value.trim();
        if (!reason || reason.length < 5) { Toast.show('Enter a rejection reason', 'warning'); return; }
        b.disabled = true; b.textContent = 'Rejecting…';
        const r = await api.patch(`/admin/projects/${b.dataset.id}/reject`, { reason });
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '✕ Reject'; return; }
        Toast.show('Project rejected', 'info'); card.remove();
      };

    } else {
      footer.innerHTML = `
        <button class="btn btn-danger" data-action="delete" data-id="${esc(p.id)}" data-title="${esc(c.title ?? 'project')}">🗑 Delete Forever</button>`;
    }

    footer.querySelector('[data-action="delete"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({
        icon: '🗑', title: `Delete "${b.dataset.title}"?`,
        body: 'This removes the project and all bids from the database, and notifies the client. Cannot be undone.',
        confirmLabel: 'Delete Forever',
      });
      if (!ok) return;
      b.disabled = true; b.textContent = 'Deleting…';
      const r = await api.delete(`/admin/projects/${b.dataset.id}`);
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '🗑 Delete Forever'; return; }
      Toast.show('Project deleted. Client notified.', 'success'); card.remove();
    });

    list.appendChild(card);
  }

  container.appendChild(list);
}

// ════════════════════════════════════════════════════════════
//  COMMISSIONS
// ════════════════════════════════════════════════════════════

async function loadCommissions() {
  const container = el('comm-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading…</div>';

  const res = await api.admin.getCommissions();
  if (!res.ok) { container.innerHTML = errorHtml('Failed to load commissions'); return; }

  const list = res.data.commissions ?? [];
  if (!list.length) {
    container.innerHTML = emptyHtml('💰', 'No commissions', 'No commission records yet');
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Gross</th>
              <th>Commission (30%)</th>
              <th>Creator (70%)</th>
              <th>Disbursed</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="comm-tbody"></tbody>
        </table>
      </div>
    </div>`;

  const tbody = el('comm-tbody');
  for (const c of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="order-id">…${esc(String(c.id ?? '').slice(-8))}</span></td>
      <td><span class="amount-gross">$${money(c.grossAmount)}</span></td>
      <td><span class="amount-comm">$${money(c.commissionAmount)}</span></td>
      <td><span class="amount-creator">$${money(Number(c.grossAmount ?? 0) - Number(c.commissionAmount ?? 0))}</span></td>
      <td>${c.disbursedToAdmin
        ? '<span class="badge badge-approved">Yes</span>'
        : '<span class="badge badge-pending">No</span>'}</td>
      <td style="color:var(--text-2)">${fmt(c.createdAt)}</td>
      <td>${!c.disbursedToAdmin
        ? `<button class="btn btn-primary btn-sm" data-action="disburse" data-id="${esc(c.id)}">Disburse</button>`
        : '<span style="color:var(--text-3)">—</span>'}</td>`;

    tr.querySelector('[data-action="disburse"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget; b.disabled = true; b.textContent = '…';
      const r = await api.admin.disburseCommission(b.dataset.id);
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = 'Disburse'; return; }
      Toast.show('Commission disbursed ✓', 'success');
      tr.querySelector('td:nth-child(5)').innerHTML = '<span class="badge badge-approved">Yes</span>';
      b.closest('td').innerHTML = '<span style="color:var(--text-3)">—</span>';
    });

    tbody.appendChild(tr);
  }
}

// ════════════════════════════════════════════════════════════
//  DISPUTES
// ════════════════════════════════════════════════════════════

async function loadDisputes() {
  const container = el('disputes-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading…</div>';

  const res = await api.get('/admin/disputes');
  if (!res.ok) { container.innerHTML = errorHtml('Failed to load disputes'); return; }

  const orders = res.data.orders ?? [];
  if (!orders.length) {
    container.innerHTML = emptyHtml('✅', 'No disputes', 'All disputes resolved — nothing to action');
    return;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'review-list';

  for (const o of orders) {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="review-card-body">
        <div class="review-info">
          <div class="review-title">Order <span class="order-id">…${esc(o.id.slice(-8))}</span></div>
          <div class="review-meta">
            <span class="meta-chip">💵 $${money(o.amount)}</span>
            <span class="meta-chip">👤 Buyer: ${esc(o.buyer?.name ?? '—')}</span>
            <span class="meta-chip">🎨 Creator: ${esc(o.creator?.name ?? '—')}</span>
            <span class="meta-chip">📅 ${fmt(o.createdAt)}</span>
          </div>
          ${o.deliveryNote ? `<p class="review-desc">Delivery note: ${esc(o.deliveryNote)}</p>` : ''}
        </div>
      </div>
      <div class="review-footer">
        <button class="btn btn-approve" data-action="release" data-id="${esc(o.id)}">✓ Release to Creator</button>
        <button class="btn btn-reject"  data-action="refund"  data-id="${esc(o.id)}">↩ Refund Buyer</button>
      </div>`;

    card.querySelector('[data-action="release"]').onclick = async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({
        icon: '✓', title: 'Release Escrow to Creator',
        body: 'This marks the order as COMPLETED and credits the creator wallet. The buyer will not be refunded.',
        confirmLabel: 'Release Funds', confirmClass: 'btn-approve',
      });
      if (!ok) return;
      b.disabled = true;
      const r = await api.post(`/admin/disputes/${b.dataset.id}/resolve`, { decision: 'RELEASE' });
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; return; }
      Toast.show('Funds released to creator ✓', 'success'); card.remove();
    };

    card.querySelector('[data-action="refund"]').onclick = async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({
        icon: '↩', title: 'Refund Buyer',
        body: 'This marks the order as REFUNDED. The creator will not be paid. The actual on-chain refund must be processed manually via Helio/Phantom.',
        confirmLabel: 'Confirm Refund',
      });
      if (!ok) return;
      b.disabled = true;
      const r = await api.post(`/admin/disputes/${b.dataset.id}/resolve`, { decision: 'REFUND' });
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; return; }
      Toast.show('Buyer refund processed ✓', 'info'); card.remove();
    };

    list.appendChild(card);
  }

  container.appendChild(list);
}

// ════════════════════════════════════════════════════════════
//  USERS
// ════════════════════════════════════════════════════════════

async function loadUsers(role = '', status = '') {
  const tbody = el('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6"><div class="loading-row"><div class="spinner"></div>Loading…</div></td></tr>';

  const res = await api.admin.getUsers({ role, status, limit: 50 });
  if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6" style="padding:20px;color:var(--red)">Failed to load users</td></tr>'; return; }

  const users = res.data.users ?? [];
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:20px;color:var(--text-3)">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  for (const u of users) {
    const roleBadge =
      u.role === 'ADMIN'   ? 'badge-admin'   :
      u.role === 'CREATOR' ? 'badge-creator' : 'badge-buyer';
    const statusBadge = u.status === 'ACTIVE' ? 'badge-active' : 'badge-suspended';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="user-name">${esc(u.name ?? '—')}</div>
        <div class="user-email">${esc(u.email ?? '—')}</div>
      </td>
      <td><span class="badge ${roleBadge}">${esc(u.role)}</span></td>
      <td><span class="badge ${statusBadge}">${esc(u.status)}</span></td>
      <td style="color:var(--text-2)">${esc(u.country ?? '—')}</td>
      <td style="color:var(--text-2)">${fmt(u.createdAt)}</td>
      <td>
        ${u.role !== 'ADMIN'
          ? u.status === 'SUSPENDED'
            ? `<button class="btn btn-approve btn-sm" data-action="unsuspend" data-id="${esc(u.id)}">↑ Unsuspend</button>`
            : `<button class="btn btn-danger  btn-sm" data-action="suspend"   data-id="${esc(u.id)}">⊘ Suspend</button>`
          : '<span style="color:var(--text-3)">—</span>'}
      </td>`;

    tr.querySelector('[data-action="suspend"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({ icon: '⊘', title: 'Suspend User', body: `Suspend ${u.name ?? u.email}? They will lose access immediately.`, confirmLabel: 'Suspend', confirmClass: 'btn-danger' });
      if (!ok) return;
      b.disabled = true;
      const r = await api.admin.suspendUser(b.dataset.id);
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; return; }
      Toast.show('User suspended', 'info');
      loadUsers(el('filter-role').value, el('filter-status').value);
    });

    tr.querySelector('[data-action="unsuspend"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({ icon: '↑', title: 'Unsuspend User', body: `Restore access for ${u.name ?? u.email}?`, confirmLabel: 'Unsuspend', confirmClass: 'btn-approve' });
      if (!ok) return;
      b.disabled = true;
      const r = await api.admin.unsuspendUser(b.dataset.id);
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; return; }
      Toast.show('User unsuspended ✓', 'success');
      loadUsers(el('filter-role').value, el('filter-status').value);
    });

    tbody.appendChild(tr);
  }
}

// ════════════════════════════════════════════════════════════
//  TOOLS
// ════════════════════════════════════════════════════════════

function loadTools() {
  loadStuckOrders();
}

async function loadStuckOrders() {
  const container = el('stuck-orders-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading stuck orders…</div>';

  const res = await api.get('/admin/stuck-orders');
  if (!res.ok) { container.innerHTML = errorHtml('Failed to load stuck orders'); return; }

  const orders = res.data.orders ?? [];
  if (!orders.length) {
    container.innerHTML = emptyHtml('✅', 'All clear', 'No orders stuck in PENDING for over 30 minutes');
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Buyer</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="stuck-tbody"></tbody>
        </table>
      </div>
    </div>`;

  const tbody = el('stuck-tbody');
  for (const o of orders) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="order-id">…${esc(o.id.slice(-8))}</span></td>
      <td>
        <div style="font-weight:600">${esc(o.buyer?.name ?? '—')}</div>
        <div class="user-email">${esc(o.buyer?.email ?? '')}</div>
      </td>
      <td><span class="amount-gross">$${money(o.amount)}</span></td>
      <td style="color:var(--text-2)">${esc(o.type ?? '—')}</td>
      <td style="color:var(--text-2)">${fmt(o.createdAt)}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px">
        <button class="btn btn-approve btn-sm" data-action="complete" data-id="${esc(o.id)}">✓ Force Complete</button>
        <button class="btn btn-reject  btn-sm" data-action="cancel"   data-id="${esc(o.id)}">✕ Cancel</button>
      </td>`;

    tr.querySelector('[data-action="complete"]').onclick = async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({ icon: '✓', title: 'Force-Complete Order', body: 'This marks the order COMPLETED and credits the creator wallet. Only use if payment was confirmed via Helio.', confirmLabel: 'Force Complete', confirmClass: 'btn-approve' });
      if (!ok) return;
      b.disabled = true; b.textContent = '…';
      const r = await api.post(`/admin/orders/${b.dataset.id}/complete`, {});
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '✓ Force Complete'; return; }
      Toast.show('Order completed — creator credited ✓', 'success'); tr.remove();
    };

    tr.querySelector('[data-action="cancel"]').onclick = async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({ icon: '✕', title: 'Cancel Order', body: 'Cancel this stuck order? The buyer will be able to repurchase.', confirmLabel: 'Cancel Order' });
      if (!ok) return;
      b.disabled = true; b.textContent = '…';
      const r = await api.post(`/admin/orders/${b.dataset.id}/cancel`, {});
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.textContent = '✕ Cancel'; return; }
      Toast.show('Order cancelled', 'info'); tr.remove();
    };

    tbody.appendChild(tr);
  }
}

// ════════════════════════════════════════════════════════════
//  COMPONENT HELPERS
// ════════════════════════════════════════════════════════════

function buildReviewCard({ id, title, desc, thumb, fileUrl, fileType, status, rejectionReason, chips }) {
  const card = document.createElement('div');
  card.className = 'review-card';
  card.dataset.id = id;

  const isVideo = fileType === 'video' || /\/video\//.test(thumb ?? '') || /\/video\//.test(fileUrl ?? '');

  const thumbHtml = thumb
    ? `<img src="${esc(thumb)}" alt="${esc(title)}">${isVideo ? '<div class="review-thumb-play">▶</div>' : ''}`
    : `<span style="font-size:2rem">🎬</span>`;

  const statusBadge =
    status === 'PENDING'  ? '<span class="badge badge-pending">Pending</span>'  :
    status === 'APPROVED' ? '<span class="badge badge-approved">Approved</span>' :
    status === 'REJECTED' ? '<span class="badge badge-rejected">Rejected</span>' : '';

  const chipsHtml = chips.map(c => `<span class="meta-chip">${esc(c.label)}</span>`).join('');

  card.innerHTML = `
    <div class="review-card-body">
      <div class="review-thumb">${thumbHtml}</div>
      <div class="review-info">
        <div class="review-title">${esc(title)}</div>
        <div class="review-meta">${chipsHtml} ${statusBadge}</div>
        <p class="review-desc">${esc(desc ?? '')}</p>
        ${rejectionReason ? `<div class="review-rejection-note">Rejection reason: ${esc(rejectionReason)}</div>` : ''}
      </div>
    </div>
    <div class="review-footer"></div>`;

  return card;
}

function previewBtn(t) {
  if (t.fileType === 'pdf') {
    if (!t.fileUrl) return '';
    const isSafeUrl = /^https:\/\/res\.cloudinary\.com\//i.test(t.fileUrl);
    if (!isSafeUrl) return '';
    return `<a class="btn btn-ghost" href="${esc(t.fileUrl)}" target="_blank" rel="noopener noreferrer">📄 View PDF</a>`;
  }
  if (!t.fileUrl && !t.previewUrl) return '';
  return `<button class="btn btn-ghost preview-media-btn"
    data-url="${esc(t.fileUrl ?? '')}"
    data-preview="${esc(t.previewUrl ?? '')}"
    data-type="${esc(t.fileType ?? '')}"
    data-title="${esc(t.title)}">👁 Preview</button>`;
}

function bindPreviewBtn(parent) {
  parent.querySelectorAll('.preview-media-btn').forEach(btn => {
    btn.onclick = () => openPreview(btn.dataset.title, btn.dataset.url, btn.dataset.preview, btn.dataset.type);
  });
}

function refreshBadge(badgeId, countId, container) {
  const remaining = container?.querySelectorAll?.('.review-card').length ?? 0;
  const b = el(badgeId); if (b) { b.textContent = remaining; b.classList.toggle('visible', remaining > 0); }
  const c = el(countId); if (c) c.textContent = remaining || '';
}

function errorHtml(msg) {
  return `<div class="empty-state"><div class="empty-icon" style="opacity:1">⛔</div><div class="empty-title">${esc(msg)}</div></div>`;
}

function emptyHtml(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${esc(title)}</div><div class="empty-sub">${esc(sub)}</div></div>`;
}

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // ── Main nav
  document.querySelectorAll('.nav-item[data-tab], .quick-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) activateTab(tab);
    });
  });

  // ── Template sub-tabs
  document.querySelectorAll('[data-tmpl-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tmpl-tab]').forEach(b => b.classList.toggle('active', b === btn));
      _loaded.delete('templates'); // force reload on tab switch
      loadTemplates(btn.dataset.tmplTab);
    });
  });

  // ── Tutorial sub-tabs
  document.querySelectorAll('[data-tut-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tut-tab]').forEach(b => b.classList.toggle('active', b === btn));
      _loaded.delete('tutorials');
      loadTutorials(btn.dataset.tutTab);
    });
  });

  // ── Project sub-tabs
  document.querySelectorAll('[data-proj-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-proj-tab]').forEach(b => b.classList.toggle('active', b === btn));
      _loaded.delete('projects');
      loadProjects(btn.dataset.projTab);
    });
  });

  // ── User filter
  el('btn-filter-users')?.addEventListener('click', () => {
    loadUsers(el('filter-role').value, el('filter-status').value);
  });

  // ── Repair sales counts
  el('btn-repair-sales')?.addEventListener('click', async function () {
    const ok = await showConfirm({ icon: '🔧', title: 'Repair Sales Counts', body: 'Recalculate salesCount on all templates from completed orders?', confirmLabel: 'Run Repair', confirmClass: 'btn-primary' });
    if (!ok) return;
    this.disabled = true; this.textContent = 'Running…';
    const res = await api.post('/admin/repair-sales-counts', {});
    this.disabled = false; this.textContent = '⚙ Run Repair';
    if (!res.ok) { Toast.show(res.error ?? 'Failed', 'error'); return; }
    Toast.show(`Fixed ${res.data.templatesUpdated} templates ✓`, 'success');
  });

  // ── Repair wallets
  el('btn-repair-wallets')?.addEventListener('click', async function () {
    const ok = await showConfirm({ icon: '💼', title: 'Repair Creator Wallets', body: 'Ensure every creator has a wallet record?', confirmLabel: 'Run Repair', confirmClass: 'btn-primary' });
    if (!ok) return;
    this.disabled = true; this.textContent = 'Running…';
    const res = await api.post('/admin/repair-wallets', {});
    this.disabled = false; this.textContent = '⚙ Run Repair';
    if (!res.ok) { Toast.show(res.error ?? 'Failed', 'error'); return; }
    Toast.show(`Ensured wallets for ${res.data.walletsEnsured} creators ✓`, 'success');
  });

  // ── Logout
  el('nav-logout')?.addEventListener('click', async () => {
    const ok = await showConfirm({ icon: '→', title: 'Log Out', body: 'End your admin session?', confirmLabel: 'Log Out', confirmClass: 'btn-danger' });
    if (!ok) return;
    await api.auth.logout();
    window.location.replace('index.html');
  });

  // ── Boot
  activateTab('overview');
});