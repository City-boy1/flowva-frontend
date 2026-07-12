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
//  ICONS  (inline SVG — replaces emoji/symbol glyphs everywhere)
// ════════════════════════════════════════════════════════════

const ICONS = {
  check:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  close:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  arrowUp:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  arrowDown:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
  arrowRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  undo:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  refresh:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  dollar:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  eye:        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  file:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  paperclip:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  clock:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  gear:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  play:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  grid:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  list:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  users:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  plus:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  diamond:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 7-7 13-7-13z"/></svg>',
  inbox:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  alert:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

function icon(name) { return ICONS[name] ?? ''; }

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

function showConfirm({ title, body, icon: iconName = 'alert', confirmLabel = 'Confirm', confirmClass = 'btn-danger', cancelLabel = 'Cancel' }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">${icon(iconName)}</div>
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
        <button class="modal-close" id="preview-close">${icon('close')}</button>
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
    overview:         loadStats,
    templates:        () => loadTemplates('PENDING'),
    tutorials:        () => loadTutorials('PENDING'),
    projects:         () => loadProjects('pending'),
    payouts:          loadPayouts,
    'payout-requests': () => loadPayoutRequests('PENDING'),
    commissions:      loadCommissions,
    disputes:         loadDisputes,
    users:            loadUsers,
    requests:         () => loadRoleRequests('PENDING'),
    tools:            loadTools,
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
  setBadge('badge-requests', s.pendingRoleRequests);
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
    container.innerHTML = emptyHtml(icon('file'), 'No templates', `No ${status.toLowerCase()} templates found`);
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
        <button class="btn btn-approve" data-action="approve" data-id="${esc(t._id ?? t.id)}">${icon('check')} Approve</button>
        <input class="reject-reason-input" id="reason-${esc(t._id ?? t.id)}" placeholder="Rejection reason (required, min 5 chars)…">
        <button class="btn btn-reject"  data-action="reject"  data-id="${esc(t._id ?? t.id)}">${icon('close')} Reject</button>
        ${(t.fileUrl || t.previewUrl) ? previewBtn(t) : ''}`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.innerHTML = 'Approving…';
        const r = await api.templates.approve(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('check')} Approve`; return; }
        Toast.show('Template approved — now live ✓', 'success');
        card.remove();
        refreshBadge('badge-templates', 'tmpl-pending-count', container);
      };

      footer.querySelector('[data-action="reject"]').onclick = async btn => {
        const b   = btn.currentTarget;
        const reason = el(`reason-${b.dataset.id}`)?.value.trim();
        if (!reason || reason.length < 5) { Toast.show('Enter a rejection reason (min 5 chars)', 'warning'); return; }
        b.disabled = true; b.innerHTML = 'Rejecting…';
        const r = await api.templates.reject(b.dataset.id, reason);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Reject`; return; }
        Toast.show('Template rejected', 'info');
        card.remove();
      };

    } else if (status === 'APPROVED') {
      footer.innerHTML = `
        ${(t.fileUrl || t.previewUrl) ? previewBtn(t) : ''}
        <button class="btn btn-warning" data-action="unpublish" data-id="${esc(t._id ?? t.id)}">${icon('arrowDown')} Unpublish</button>`;

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
        <button class="btn btn-approve" data-action="approve" data-id="${esc(t._id ?? t.id)}">${icon('arrowUp')} Re-approve</button>
        <button class="btn btn-danger"  data-action="delete"  data-id="${esc(t._id ?? t.id)}">${icon('close')} Delete Forever</button>`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.innerHTML = 'Approving…';
        const r = await api.templates.approve(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('arrowUp')} Re-approve`; return; }
        Toast.show('Template re-approved ✓', 'success'); card.remove();
      };

      footer.querySelector('[data-action="delete"]').onclick = async btn => {
        const b = btn.currentTarget;
        const ok = await showConfirm({
          icon: 'close', title: 'Delete Template Permanently',
          body: 'This removes the MongoDB document and all Cloudinary assets. This action cannot be undone.',
          confirmLabel: 'Delete Forever',
        });
        if (!ok) return;
        b.disabled = true; b.innerHTML = 'Deleting…';
        const r = await api.templates.permanentDelete(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Delete failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Delete Forever`; return; }
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
    container.innerHTML = emptyHtml(icon('grid'), 'No tutorials', `No ${status.toLowerCase()} tutorials found`);
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
        <button class="btn btn-approve" data-action="approve" data-id="${esc(t._id ?? t.id)}">${icon('check')} Approve</button>
        <input class="reject-reason-input" id="tut-reason-${esc(t._id ?? t.id)}" placeholder="Rejection reason (required, min 5 chars)…">
        <button class="btn btn-reject"  data-action="reject"  data-id="${esc(t._id ?? t.id)}">${icon('close')} Reject</button>
        ${t.videoUrl ? `<button class="btn btn-ghost preview-video-btn" data-url="${esc(t.videoUrl)}" data-title="${esc(t.title)}">${icon('play')} Watch</button>` : ''}`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.innerHTML = 'Approving…';
        const r = await api.tutorials.approve(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('check')} Approve`; return; }
        Toast.show('Tutorial approved ✓', 'success'); card.remove();
        refreshBadge('badge-tutorials', 'tut-pending-count', container);
      };

      footer.querySelector('[data-action="reject"]').onclick = async btn => {
        const b = btn.currentTarget;
        const reason = el(`tut-reason-${b.dataset.id}`)?.value.trim();
        if (!reason || reason.length < 5) { Toast.show('Enter a rejection reason (min 5 chars)', 'warning'); return; }
        b.disabled = true; b.innerHTML = 'Rejecting…';
        const r = await api.tutorials.reject(b.dataset.id, reason);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Reject`; return; }
        Toast.show('Tutorial rejected', 'info'); card.remove();
      };

    } else if (status === 'APPROVED') {
      footer.innerHTML = `
        ${t.videoUrl ? `<button class="btn btn-ghost preview-video-btn" data-url="${esc(t.videoUrl)}" data-title="${esc(t.title)}">${icon('play')} Watch</button>` : ''}
        <button class="btn btn-warning" data-action="unpublish" data-id="${esc(t._id ?? t.id)}">${icon('arrowDown')} Unpublish</button>`;

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
        ${t.videoUrl ? `<button class="btn btn-ghost preview-video-btn" data-url="${esc(t.videoUrl)}" data-title="${esc(t.title)}">${icon('play')} Watch</button>` : ''}
        <button class="btn btn-approve" data-action="approve" data-id="${esc(t._id ?? t.id)}">${icon('arrowUp')} Re-approve</button>
        <button class="btn btn-danger"  data-action="delete"  data-id="${esc(t._id ?? t.id)}">${icon('close')} Delete Forever</button>`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.innerHTML = 'Approving…';
        const r = await api.tutorials.approve(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('arrowUp')} Re-approve`; return; }
        Toast.show('Tutorial re-approved ✓', 'success'); card.remove();
      };

      footer.querySelector('[data-action="delete"]').onclick = async btn => {
        const b = btn.currentTarget;
        const ok = await showConfirm({
          icon: 'close', title: 'Delete Tutorial Permanently',
          body: 'This removes the video from Cloudinary and the database. Cannot be undone.',
          confirmLabel: 'Delete Forever',
        });
        if (!ok) return;
        b.disabled = true; b.innerHTML = 'Deleting…';
        const r = await api.tutorials.permanentDelete(b.dataset.id);
        if (!r.ok) { Toast.show(r.error ?? 'Delete failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Delete Forever`; return; }
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
    container.innerHTML = emptyHtml(icon('inbox'), 'No projects', `No ${status} projects found`);
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
      `<a href="${esc(url)}" target="_blank" rel="noopener" class="attachment-link">${icon('paperclip')} File ${i + 1}</a>`
    ).join('');

    card.innerHTML = `
      <div class="review-card-body">
        <div class="review-info">
          <div class="review-title">${esc(c.title ?? 'Untitled Project')}</div>
          <div class="review-meta">
            <span class="meta-chip">$${money(p.budget)}</span>
            <span class="meta-chip">${esc(p.clientName ?? '—')}</span>
            <span class="meta-chip">${bidCount} bid${bidCount !== 1 ? 's' : ''}</span>
            <span class="meta-chip">${fmt(p.createdAt)}</span>
            ${c.category ? `<span class="meta-chip">${esc(c.category)}</span>` : ''}
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
        <button class="btn btn-approve" data-action="approve" data-id="${esc(p.id)}">${icon('check')} Approve</button>
        <input class="reject-reason-input" id="proj-reason-${esc(p.id)}" placeholder="Rejection reason…">
        <button class="btn btn-reject"  data-action="reject"  data-id="${esc(p.id)}">${icon('close')} Reject</button>
        <button class="btn btn-danger"  data-action="delete"  data-id="${esc(p.id)}" data-title="${esc(c.title ?? 'project')}">${icon('close')} Delete</button>`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget; b.disabled = true; b.innerHTML = 'Approving…';
        const r = await api.patch(`/admin/projects/${b.dataset.id}/approve`, {});
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('check')} Approve`; return; }
        Toast.show('Project approved — now live ✓', 'success'); card.remove();
        refreshBadge('badge-projects', 'proj-pending-count', container);
      };

      footer.querySelector('[data-action="reject"]').onclick = async btn => {
        const b = btn.currentTarget;
        const reason = el(`proj-reason-${b.dataset.id}`)?.value.trim();
        if (!reason || reason.length < 5) { Toast.show('Enter a rejection reason', 'warning'); return; }
        b.disabled = true; b.innerHTML = 'Rejecting…';
        const r = await api.patch(`/admin/projects/${b.dataset.id}/reject`, { reason });
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Reject`; return; }
        Toast.show('Project rejected', 'info'); card.remove();
      };

    } else {
      footer.innerHTML = `
        <button class="btn btn-danger" data-action="delete" data-id="${esc(p.id)}" data-title="${esc(c.title ?? 'project')}">${icon('close')} Delete Forever</button>`;
    }

    footer.querySelector('[data-action="delete"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({
        icon: 'close', title: `Delete "${b.dataset.title}"?`,
        body: 'This removes the project and all bids from the database, and notifies the client. Cannot be undone.',
        confirmLabel: 'Delete Forever',
      });
      if (!ok) return;
      b.disabled = true; b.innerHTML = 'Deleting…';
      const r = await api.delete(`/admin/projects/${b.dataset.id}`);
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Delete Forever`; return; }
      Toast.show('Project deleted. Client notified.', 'success'); card.remove();
    });

    list.appendChild(card);
  }

  container.appendChild(list);
}

// ════════════════════════════════════════════════════════════
//  PAYOUTS
// ════════════════════════════════════════════════════════════

async function loadPayouts() {
  const container = el('payouts-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading payouts…</div>';

  const res = await api.admin.getPendingPayouts();
  if (!res.ok) { container.innerHTML = errorHtml('Failed to load payouts'); return; }

  const payouts = res.data.payouts ?? [];
  setBadge('badge-payouts', payouts.length);

  if (!payouts.length) {
    container.innerHTML = emptyHtml(icon('check'), 'All caught up', 'No creators currently owed a payout');
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Creator</th><th>Pending</th><th>Method</th><th>Frequency</th><th>Action</th></tr></thead>
          <tbody id="payouts-tbody"></tbody>
        </table>
      </div>
    </div>`;

  const tbody = el('payouts-tbody');
  for (const p of payouts) {
    const methodLabelText = p.payoutMethod === 'PAYSTACK_SUBACCOUNT' ? 'Paystack'
      : p.payoutMethod === 'SKRILL' ? 'Skrill'
      : p.payoutMethod === 'GREY' ? 'Grey'
      : 'Not set up';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="user-name">${esc(p.creator?.name ?? '—')}</div>
        <div class="user-email">${esc(p.creator?.email ?? '—')}</div>
      </td>
      <td><span class="amount-creator">$${money(p.pending)}</span></td>
      <td><span class="badge ${p.payoutMethod ? 'badge-approved' : 'badge-pending'}">${esc(methodLabelText)}</span></td>
      <td style="color:var(--text-2)">${esc(p.payoutFrequency ?? 'MONTHLY')}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px"></td>`;

    const actionsTd = tr.querySelector('td:last-child');

    if (p.canAutoPay) {
      const payBtn = document.createElement('button');
      payBtn.className = 'btn btn-approve btn-sm';
      payBtn.innerHTML = `${icon('dollar')} Pay via Paystack`;
      payBtn.onclick = async () => {
        const ok = await showConfirm({
          icon: 'dollar', title: 'Send Paystack Transfer',
          body: `Send $${money(p.pending)} to ${p.creator?.name ?? 'this creator'} via Paystack now?`,
          confirmLabel: 'Send Payment', confirmClass: 'btn-approve',
        });
        if (!ok) return;
        payBtn.disabled = true; payBtn.innerHTML = 'Sending…';
        const r = await api.admin.payViaPaystack(p.creatorId);
        if (!r.ok) { Toast.show(r.error ?? 'Transfer failed', 'error'); payBtn.disabled = false; payBtn.innerHTML = `${icon('dollar')} Pay via Paystack`; return; }
        Toast.show('Payout sent ✓', 'success');
        tr.remove();
      };
      actionsTd.appendChild(payBtn);
    } else if (p.payoutMethod === 'SKRILL' || p.payoutMethod === 'GREY') {
      const markBtn = document.createElement('button');
      markBtn.className = 'btn btn-primary btn-sm';
      markBtn.innerHTML = `${icon('check')} Mark as Paid`;
      markBtn.onclick = async () => {
        const reference = await showPrompt({
          title: `Mark ${p.creator?.name ?? 'creator'}'s payout as paid`,
          subtitle: `Confirm you've sent $${money(p.pending)} via ${methodLabelText} outside FLOWVA.`,
          placeholder: 'Transaction reference (optional)…',
          confirmLabel: 'Mark as Paid',
          minLength: 0,
        });
        if (reference === null) return;
        markBtn.disabled = true; markBtn.innerHTML = 'Saving…';
        const r = await api.admin.markPayoutPaid(p.creatorId, p.payoutMethod, reference || undefined);
        if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); markBtn.disabled = false; markBtn.innerHTML = `${icon('check')} Mark as Paid`; return; }
        Toast.show('Payout recorded ✓', 'success');
        tr.remove();
      };
      actionsTd.appendChild(markBtn);
    } else {
      actionsTd.innerHTML = '<span style="color:var(--text-3)">Creator hasn\'t set up a payout method</span>';
    }

    tbody.appendChild(tr);
  }
}

// ════════════════════════════════════════════════════════════
//  PAYOUT METHOD CHANGE REQUESTS
// ════════════════════════════════════════════════════════════

function formatPayoutDetails(method, details) {
  if (!details) return '—';
  if (method === 'PAYSTACK_SUBACCOUNT') {
    const acct = details.accountNumber ?? '';
    const masked = acct.length > 4 ? `•••• ${acct.slice(-4)}` : acct;
    return `Bank ${esc(details.bankCode ?? '—')} · ${esc(masked)}`;
  }
  if (method === 'SKRILL') {
    return esc(details.email ?? '—');
  }
  if (method === 'GREY') {
    return `${esc(details.accountName ?? '—')} · ${esc(details.accountNumber ?? '—')}`;
  }
  return '—';
}

function methodLabel(method) {
  return method === 'PAYSTACK_SUBACCOUNT' ? 'Paystack'
    : method === 'SKRILL' ? 'Skrill'
    : method === 'GREY' ? 'Grey'
    : method ?? '—';
}

async function loadPayoutRequests(status = 'PENDING') {
  const container = el('payoutreq-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading requests…</div>';

  const res = status === 'PENDING'
    ? await api.admin.getPendingPayoutChangeRequests()
    : await api.get(`/admin/payout-requests?status=${status}`);

  if (!res.ok) { container.innerHTML = errorHtml('Failed to load payout requests'); return; }

  const requests = res.data.requests ?? [];

  if (status === 'PENDING') {
    setBadge('badge-payout-requests', requests.length);
    const chip = el('payoutreq-pending-count');
    if (chip) chip.textContent = requests.length || '';
  }

  if (!requests.length) {
    const labels = {
      PENDING:  'No pending payout method changes',
      APPROVED: 'No approved changes yet',
      REJECTED: 'No rejected changes',
    };
    container.innerHTML = emptyHtml(icon('check'), labels[status] ?? 'No requests', '');
    return;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'review-list';

  for (const r of requests) {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.dataset.id = r.id;

    const statusBadge =
      r.status === 'PENDING'  ? '<span class="badge badge-pending">Pending</span>'  :
      r.status === 'APPROVED' ? '<span class="badge badge-approved">Approved</span>' :
                                 '<span class="badge badge-rejected">Rejected</span>';

    card.innerHTML = `
      <div class="review-card-body">
        <div class="review-info">
          <div class="review-title">${esc(r.creator?.name ?? '—')}</div>
          <div class="review-meta">
            <span class="meta-chip">${esc(r.creator?.email ?? '—')}</span>
            <span class="meta-chip">Requesting: ${esc(methodLabel(r.requestedMethod))}</span>
            <span class="meta-chip">${fmt(r.createdAt)}</span>
            ${statusBadge}
          </div>
          <div class="role-request-field" style="margin-top:8px">
            <div class="role-request-field-label">New payout details</div>
            <div class="role-request-field-value">${formatPayoutDetails(r.requestedMethod, r.requestedDetails)}</div>
          </div>
          <div class="role-request-field">
            <div class="role-request-field-label">Creator's reason for changing</div>
            <div class="role-request-field-value">${esc(r.reason ?? '—')}</div>
          </div>
          ${r.adminNote ? `
          <div class="role-request-field">
            <div class="role-request-field-label">Admin note</div>
            <div class="role-request-field-value">${esc(r.adminNote)}</div>
          </div>` : ''}
        </div>
      </div>
      <div class="review-footer"></div>`;

    const footer = card.querySelector('.review-footer');

    if (status === 'PENDING') {
      footer.innerHTML = `
        <button class="btn btn-approve" data-action="approve" data-id="${esc(r.id)}">${icon('check')} Approve Change</button>
        <button class="btn btn-reject"  data-action="reject"  data-id="${esc(r.id)}">${icon('close')} Reject</button>`;

      footer.querySelector('[data-action="approve"]').onclick = async btn => {
        const b = btn.currentTarget;
        const ok = await showConfirm({
          icon: 'check', title: 'Approve Payout Method Change',
          body: `This will switch ${r.creator?.name ?? 'this creator'}'s active payout wallet to ${methodLabel(r.requestedMethod)}. Their previous method's details will be cleared.`,
          confirmLabel: 'Approve', confirmClass: 'btn-approve',
        });
        if (!ok) return;
        b.disabled = true; b.innerHTML = 'Approving…';
        const result = await api.admin.approvePayoutChangeRequest(b.dataset.id);
        if (!result.ok) { Toast.show(result.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('check')} Approve Change`; return; }
        Toast.show('Payout method updated ✓', 'success');
        card.remove();
        refreshBadge('badge-payout-requests', 'payoutreq-pending-count', container);
      };

      footer.querySelector('[data-action="reject"]').onclick = async btn => {
        const b = btn.currentTarget;
        const note = await showPrompt({
          title: 'Reject Payout Method Change',
          subtitle: 'Explain why — the creator will see this note.',
          confirmLabel: 'Reject', minLength: 5,
        });
        if (!note) return;
        b.disabled = true; b.innerHTML = 'Rejecting…';
        const result = await api.admin.rejectPayoutChangeRequest(b.dataset.id, note);
        if (!result.ok) { Toast.show(result.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Reject`; return; }
        Toast.show('Change request rejected', 'info');
        card.remove();
        refreshBadge('badge-payout-requests', 'payoutreq-pending-count', container);
      };
    }

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
    container.innerHTML = emptyHtml(icon('dollar'), 'No commissions', 'No commission records yet');
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
              <th>Platform Commission</th>
              <th>Creator Earnings</th>
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
    container.innerHTML = emptyHtml(icon('check'), 'No disputes', 'All disputes resolved — nothing to action');
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
            <span class="meta-chip">$${money(o.amount)}</span>
            <span class="meta-chip">Buyer: ${esc(o.buyer?.name ?? '—')}</span>
            <span class="meta-chip">Creator: ${esc(o.creator?.name ?? '—')}</span>
            <span class="meta-chip">${fmt(o.createdAt)}</span>
          </div>
          ${o.deliveryNote ? (() => {
            const [note, fileUrl] = o.deliveryNote.split('||');
            return `<p class="review-desc">Delivery note: ${esc(note ?? '')}</p>${fileUrl ? `<a href="${esc(fileUrl)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-top:8px">${icon('file')} View Delivered File</a>` : ''}`;
          })() : ''}
        </div>
      </div>
      <div class="review-footer">
        <button class="btn btn-approve" data-action="release" data-id="${esc(o.id)}">${icon('check')} Release to Creator</button>
        <button class="btn btn-reject"  data-action="refund"  data-id="${esc(o.id)}">${icon('undo')} Refund Buyer</button>
      </div>`;

    card.querySelector('[data-action="release"]').onclick = async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({
        icon: 'check', title: 'Release Escrow to Creator',
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
        icon: 'undo', title: 'Refund Buyer',
        body: 'This marks the order as REFUNDED. The creator will not be paid. The actual refund to the buyer must be processed manually via Paystack or Skrill, depending on how they originally paid.',
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
          ? `<select class="role-select" data-action="change-role" data-id="${esc(u.id)}" data-current="${esc(u.role)}">
               <option value="BUYER"   ${u.role === 'BUYER'   ? 'selected' : ''}>Buyer</option>
               <option value="CREATOR" ${u.role === 'CREATOR' ? 'selected' : ''}>Creator</option>
             </select>`
          : '<span class="text-muted">—</span>'}
      </td>
      <td>
        ${u.role !== 'ADMIN'
          ? u.status === 'SUSPENDED'
            ? `<button class="btn btn-approve btn-sm" data-action="unsuspend" data-id="${esc(u.id)}">${icon('arrowUp')} Unsuspend</button>`
            : `<button class="btn btn-danger  btn-sm" data-action="suspend"   data-id="${esc(u.id)}">${icon('close')} Suspend</button>`
          : '<span class="text-muted">—</span>'}
      </td>`;

    tr.querySelector('[data-action="suspend"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({ icon: 'close', title: 'Suspend User', body: `Suspend ${u.name ?? u.email}? They will lose access immediately.`, confirmLabel: 'Suspend', confirmClass: 'btn-danger' });
      if (!ok) return;
      b.disabled = true;
      const r = await api.admin.suspendUser(b.dataset.id);
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; return; }
      Toast.show('User suspended', 'info');
      loadUsers(el('filter-role').value, el('filter-status').value);
    });

    tr.querySelector('[data-action="unsuspend"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({ icon: 'arrowUp', title: 'Unsuspend User', body: `Restore access for ${u.name ?? u.email}?`, confirmLabel: 'Unsuspend', confirmClass: 'btn-approve' });
      if (!ok) return;
      b.disabled = true;
      const r = await api.admin.unsuspendUser(b.dataset.id);
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; return; }
      Toast.show('User unsuspended ✓', 'success');
      loadUsers(el('filter-role').value, el('filter-status').value);
    });

    tr.querySelector('[data-action="change-role"]')?.addEventListener('change', async evt => {
      const sel = evt.currentTarget;
      const newRole = sel.value;
      const oldRole = sel.dataset.current;
      if (newRole === oldRole) return;
      const ok = await showConfirm({
        icon: 'refresh',
        title: 'Change User Role',
        body: `Change ${u.name ?? u.email} from ${oldRole} to ${newRole}? They will be notified by email.`,
        confirmLabel: 'Change Role',
        confirmClass: 'btn-primary',
      });
      if (!ok) { sel.value = oldRole; return; }
      sel.disabled = true;
      const r = await api.admin.changeUserRole(sel.dataset.id, newRole);
      sel.disabled = false;
      if (!r.ok) {
        Toast.show(r.error ?? 'Failed to change role', 'error');
        sel.value = oldRole;
        return;
      }
      sel.dataset.current = newRole;
      Toast.show(`Role changed to ${newRole} ✓`, 'success');
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
    container.innerHTML = emptyHtml(icon('check'), 'All clear', 'No orders stuck in PENDING for over 30 minutes');
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
        <button class="btn btn-approve btn-sm" data-action="complete" data-id="${esc(o.id)}">${icon('check')} Force Complete</button>
        <button class="btn btn-reject  btn-sm" data-action="cancel"   data-id="${esc(o.id)}">${icon('close')} Cancel</button>
      </td>`;

    tr.querySelector('[data-action="complete"]').onclick = async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({ icon: 'check', title: 'Force-Complete Order', body: 'This marks the order COMPLETED and credits the creator wallet. Only use if you have independently confirmed the payment succeeded with Paystack or Skrill.', confirmLabel: 'Force Complete', confirmClass: 'btn-approve' });
      if (!ok) return;
      b.disabled = true; b.innerHTML = '…';
      const r = await api.post(`/admin/orders/${b.dataset.id}/complete`, {});
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('check')} Force Complete`; return; }
      Toast.show('Order completed — creator credited ✓', 'success'); tr.remove();
    };

    tr.querySelector('[data-action="cancel"]').onclick = async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({ icon: 'close', title: 'Cancel Order', body: 'Cancel this stuck order? The buyer will be able to repurchase.', confirmLabel: 'Cancel Order' });
      if (!ok) return;
      b.disabled = true; b.innerHTML = '…';
      const r = await api.post(`/admin/orders/${b.dataset.id}/cancel`, {});
      if (!r.ok) { Toast.show(r.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Cancel`; return; }
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
    ? `<img src="${esc(thumb)}" alt="${esc(title)}">${isVideo ? `<div class="review-thumb-play">${icon('play')}</div>` : ''}`
    : `<span style="opacity:0.3">${icon('play')}</span>`;

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
    return `<a class="btn btn-ghost" href="${esc(t.fileUrl)}" target="_blank" rel="noopener noreferrer">${icon('file')} View PDF</a>`;
  }
  if (!t.fileUrl && !t.previewUrl) return '';
  return `<button class="btn btn-ghost preview-media-btn"
    data-url="${esc(t.fileUrl ?? '')}"
    data-preview="${esc(t.previewUrl ?? '')}"
    data-type="${esc(t.fileType ?? '')}"
    data-title="${esc(t.title)}">${icon('eye')} Preview</button>`;
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
  return `<div class="empty-state"><div class="empty-icon" style="opacity:1">${icon('close')}</div><div class="empty-title">${esc(msg)}</div></div>`;
}

function emptyHtml(iconHtml, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${iconHtml}</div><div class="empty-title">${esc(title)}</div><div class="empty-sub">${esc(sub)}</div></div>`;
}

// ════════════════════════════════════════════════════════════════════════════
//  ROLE REQUESTS
// ════════════════════════════════════════════════════════════════════════════

async function loadRoleRequests(status = 'PENDING') {
  const container = el('requests-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-row"><div class="spinner"></div>Loading requests…</div>';

  const res = await api.admin.getRoleRequests(status);
  if (!res.ok) { container.innerHTML = errorHtml('Failed to load role requests'); return; }

  const requests = res.data.requests ?? [];

  if (status === 'PENDING') {
    setBadge('badge-requests', requests.length);
    const chip = el('req-pending-count');
    if (chip) chip.textContent = requests.length || '';
  }

  if (!requests.length) {
    const labels = { PENDING: 'No pending applications', APPROVED: 'No approved applications', REJECTED: 'No rejected applications' };
    container.innerHTML = emptyHtml(icon('check'), labels[status] ?? 'No requests', '');
    return;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'role-request-list';

  for (const r of requests) {
    const card = document.createElement('div');
    card.className = 'role-request-card';
    card.dataset.id = r.id;

    // Portfolio URL — server already stripped non-https, but double-check client side too
    let portfolioHtml = '';
    if (r.portfolio) {
      let isSafe = false;
      try {
  const u = new URL(r.portfolio);
  const host = u.hostname;
  isSafe = u.protocol === 'https:'
    && host.includes('.')
    && host !== 'localhost'
    && !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(host)
    && (host.split('.').pop()?.length ?? 0) >= 2;
} catch { isSafe = false; }

      portfolioHtml = isSafe
        ? `<div class="role-request-url-row">
             <span class="role-request-url-text">${esc(r.portfolio)}</span>
             <button class="btn btn-ghost btn-sm open-portfolio-btn"
               data-url="${esc(r.portfolio)}"
               title="Opens in a new tab. Verify the link before clicking.">
               ${icon('arrowRight')} Open Link
             </button>
           </div>`
        : `<span class="role-request-url-text invalid">${icon('alert')} URL removed — not a valid https:// link</span>`;
    } else {
      portfolioHtml = `<span class="role-request-url-text invalid">No URL provided</span>`;
    }

    // Action footer — differs by status
    let footerHtml = '';
    if (status === 'PENDING') {
      footerHtml = `
        <button class="btn btn-approve" data-action="approve" data-id="${esc(r.id)}">${icon('check')} Approve</button>
        <input class="role-request-reject-input" id="req-reason-${esc(r.id)}"
          placeholder="Rejection reason (min 5 chars) — required to reject…">
        <button class="btn btn-reject" data-action="reject" data-id="${esc(r.id)}">${icon('close')} Reject</button>`;
    } else if (status === 'REJECTED') {
      footerHtml = `
        <button class="btn btn-approve" data-action="approve" data-id="${esc(r.id)}">${icon('arrowUp')} Approve Instead</button>
        <button class="btn btn-danger"  data-action="delete"  data-id="${esc(r.id)}">${icon('close')} Delete Record</button>`;
    } else {
      footerHtml = `<span style="color:var(--text-3);font-size:12px">Approved — no further action needed</span>`;
    }

    const statusBadge =
      r.status === 'PENDING'  ? '<span class="badge badge-pending">Pending</span>'  :
      r.status === 'APPROVED' ? '<span class="badge badge-approved">Approved</span>' :
                                '<span class="badge badge-rejected">Rejected</span>';

    card.innerHTML = `
      <div class="review-title">${esc(r.user?.name ?? '—')}</div>
      <div class="role-request-meta">
        <span class="meta-chip">${esc(r.user?.email ?? '—')}</span>
        <span class="meta-chip">Applied ${fmt(r.createdAt)}</span>
        <span class="meta-chip">Member since ${fmt(r.user?.createdAt)}</span>
        ${statusBadge}
      </div>
      <div class="role-request-fields">
        <div class="role-request-field">
          <div class="role-request-field-label">Portfolio / Social</div>
          <div class="role-request-field-value">${portfolioHtml}</div>
        </div>
        <div class="role-request-field">
          <div class="role-request-field-label">Software</div>
          <div class="role-request-field-value">${esc(r.software ?? '—')}</div>
        </div>
        <div class="role-request-field">
          <div class="role-request-field-label">Why FLOWVA</div>
          <div class="role-request-field-value">${esc(r.bio ?? '—')}</div>
        </div>
        ${r.rejectionReason ? `
        <div class="role-request-field" style="border-color:rgba(239,68,68,0.25);background:var(--red-dim)">
          <div class="role-request-field-label" style="color:var(--red)">Rejection Reason</div>
          <div class="role-request-field-value" style="color:#fca5a5">${esc(r.rejectionReason)}</div>
        </div>` : ''}
      </div>
      <div class="role-request-actions">${footerHtml}</div>`;

    // Open portfolio — deliberate step, noopener + noreferrer
    card.querySelectorAll('.open-portfolio-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.dataset.url;
        // Final client-side guard before opening
       try {
  const u = new URL(url);
  const host = u.hostname;
  if (u.protocol !== 'https:') { Toast.show('Blocked — not https://', 'error'); return; }
  if (!host.includes('.') || host === 'localhost') { Toast.show('Blocked — not a real domain', 'error'); return; }
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/.test(host)) { Toast.show('Blocked — internal IP not allowed', 'error'); return; }
} catch { Toast.show('Blocked — invalid URL', 'error'); return; }
        const ok = await showConfirm({
          icon: 'arrowRight',
          title: 'Open External Link',
          body: `You are about to visit:\n\n${url}\n\nThis is a user-submitted link. Only proceed if you trust it.`,
          confirmLabel: 'Open Link',
          confirmClass: 'btn-primary',
          cancelLabel: 'Cancel',
        });
        if (!ok) return;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      });
    });

    // Approve
    card.querySelector('[data-action="approve"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({
        icon: 'check',
        title: `Approve ${r.user?.name ?? 'this user'} as Creator?`,
        body: 'Their role will be changed to CREATOR and they will be notified by email.',
        confirmLabel: 'Approve', confirmClass: 'btn-approve',
      });
      if (!ok) return;
      b.disabled = true; b.innerHTML = 'Approving…';
      const result = await api.admin.approveRoleRequest(b.dataset.id);
      if (!result.ok) { Toast.show(result.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('check')} Approve`; return; }
      Toast.show(`${r.user?.name ?? 'User'} is now a Creator ✓`, 'success');
      card.remove();
      refreshBadge('badge-requests', 'req-pending-count', container);
    });

    // Reject
    card.querySelector('[data-action="reject"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const reason = el(`req-reason-${b.dataset.id}`)?.value.trim();
      if (!reason || reason.length < 5) { Toast.show('Enter a rejection reason (min 5 chars)', 'warning'); return; }
      const ok = await showConfirm({
        icon: 'close',
        title: `Reject ${r.user?.name ?? 'this user'}'s application?`,
        body: 'They will be notified by email with your reason.',
        confirmLabel: 'Reject', confirmClass: 'btn-reject',
      });
      if (!ok) return;
      b.disabled = true; b.innerHTML = 'Rejecting…';
      const result = await api.admin.rejectRoleRequest(b.dataset.id, reason);
      if (!result.ok) { Toast.show(result.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Reject`; return; }
      Toast.show('Application rejected. User notified.', 'info');
      card.remove();
      refreshBadge('badge-requests', 'req-pending-count', container);
    });

    // Delete record (rejected only)
    card.querySelector('[data-action="delete"]')?.addEventListener('click', async btn => {
      const b = btn.currentTarget;
      const ok = await showConfirm({
        icon: 'close',
        title: 'Delete this application record?',
        body: `Removes all application data for ${r.user?.name ?? 'this user'}. They remain a Buyer and can reapply. Cannot be undone.`,
        confirmLabel: 'Delete Record', confirmClass: 'btn-danger',
      });
      if (!ok) return;
      b.disabled = true; b.innerHTML = 'Deleting…';
      const result = await api.admin.deleteRoleRequest(b.dataset.id);
      if (!result.ok) { Toast.show(result.error ?? 'Failed', 'error'); b.disabled = false; b.innerHTML = `${icon('close')} Delete Record`; return; }
      Toast.show('Application record deleted ✓', 'success');
      card.remove();
    });

    list.appendChild(card);
  }

  container.appendChild(list);
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

  // ── Requests sub-tabs
  document.querySelectorAll('[data-req-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-req-tab]').forEach(b => b.classList.toggle('active', b === btn));
      _loaded.delete('requests');
      loadRoleRequests(btn.dataset.reqTab);
    });
  });

  // ── Payout request sub-tabs
  document.querySelectorAll('[data-payoutreq-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-payoutreq-tab]').forEach(b => b.classList.toggle('active', b === btn));
      _loaded.delete('payout-requests');
      loadPayoutRequests(btn.dataset.payoutreqTab);
    });
  });

  // ── User filter
  el('btn-filter-users')?.addEventListener('click', () => {
    loadUsers(el('filter-role').value, el('filter-status').value);
  });

  // ── Repair sales counts
  el('btn-repair-sales')?.addEventListener('click', async function () {
    const ok = await showConfirm({ icon: 'gear', title: 'Repair Sales Counts', body: 'Recalculate salesCount on all templates from completed orders?', confirmLabel: 'Run Repair', confirmClass: 'btn-primary' });
    if (!ok) return;
    this.disabled = true; this.innerHTML = 'Running…';
    const res = await api.post('/admin/repair-sales-counts', {});
    this.disabled = false; this.innerHTML = `${icon('gear')} Run Repair`;
    if (!res.ok) { Toast.show(res.error ?? 'Failed', 'error'); return; }
    Toast.show(`Fixed ${res.data.templatesUpdated} templates ✓`, 'success');
  });

  // ── Repair wallets
  el('btn-repair-wallets')?.addEventListener('click', async function () {
    const ok = await showConfirm({ icon: 'arrowUp', title: 'Repair Creator Wallets', body: 'Ensure every creator has a wallet record?', confirmLabel: 'Run Repair', confirmClass: 'btn-primary' });
    if (!ok) return;
    this.disabled = true; this.innerHTML = 'Running…';
    const res = await api.post('/admin/repair-wallets', {});
    this.disabled = false; this.innerHTML = `${icon('gear')} Run Repair`;
    if (!res.ok) { Toast.show(res.error ?? 'Failed', 'error'); return; }
    Toast.show(`Ensured wallets for ${res.data.walletsEnsured} creators ✓`, 'success');
  });

  // ── Logout
  el('nav-logout')?.addEventListener('click', async () => {
    const ok = await showConfirm({ icon: 'arrowRight', title: 'Log Out', body: 'End your admin session?', confirmLabel: 'Log Out', confirmClass: 'btn-danger' });
    if (!ok) return;
    await api.auth.logout();
    window.location.replace('index.html');
  });

  // ── Floating theme toggle
  const ICON_MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const ICON_SUN  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  const themeFab = el('theme-fab');
  if (themeFab) {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    themeFab.innerHTML = current === 'light' ? ICON_MOON : ICON_SUN;

    themeFab.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('flowva-theme', next);
      themeFab.innerHTML = next === 'light' ? ICON_MOON : ICON_SUN;
    });
  }

  // ── Boot
  activateTab('overview');

  // ── Boot
  activateTab('overview');
});