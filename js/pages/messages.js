/**
 * FLOWVA — Messages Page
 */

import AppState from '../core/state.js';
import api from '../core/api.js';

document.addEventListener('DOMContentLoaded', () => {
  if (!AppState.isLoggedIn()) {
    window.location.replace('login.html');
    return;
  }

  const currentUserId = AppState.getUser()?.id;
  let activeConvId      = null;
  let activeRecipientId = null;
  let activePartnerSnapshot = null; 
  let conversations     = [];
  let messageCache      = {};
  let pollTimer         = null;
  let convPollTimer     = null;
  let isLoadingMore     = false;
  let pageByConv        = {};
  let hasMoreByConv     = {};
  let lastActivity = Date.now();
['click','keydown','pointermove'].forEach(e =>
  document.addEventListener(e, () => { lastActivity = Date.now(); }, { passive: true })
);
function isIdle() { return Date.now() - lastActivity > 60000; }

  if (!document.getElementById('msg-ctx-styles')) {
    const s = document.createElement('style');
    s.id = 'msg-ctx-styles';
    s.textContent = `
      .msg-ctx-menu {
        position: fixed;
        background: var(--bg-raised);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        z-index: var(--z-modal);
        min-width: 160px;
        overflow: hidden;
        animation: scale-in 0.15s ease;
      }
      .msg-ctx-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        font-size: 0.875rem;
        color: var(--text-secondary);
        cursor: pointer;
        transition: var(--transition-base);
        font-family: var(--font-body);
        width: 100%;
        background: none;
        border: none;
        text-align: left;
      }
      .msg-ctx-item:hover { background: var(--accent-soft); color: var(--text-primary); }
      .msg-ctx-item--danger { color: var(--danger); }
      .msg-ctx-item--danger:hover { background: rgba(239,68,68,0.1); color: var(--danger); }
      .message { user-select: none; }
      .message.selected .msg-bubble {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(s);
  }

  const chatList    = document.getElementById('chat-list');
  const chatMain    = document.getElementById('chat-main');
  const chatEmpty   = document.getElementById('chat-empty');
  const searchInput = document.getElementById('msg-search');
  const sidebar     = document.getElementById('msg-sidebar');
  const isMobile    = () => window.innerWidth <= 768;

  // ── Utils ──────────────────────────────────────────────────────────────────
  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
  }

  function _initials(name = '') {
    return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  function _color(id = '') {
    const palette = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16'];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  }

  function _ago(d) {
    if (!d) return '';
    const m = Math.floor((Date.now() - new Date(d)) / 60000);
    if (m < 1)  return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function _time(d) {
    if (!d) return '';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function _dateLabel(d) {
    if (!d) return '';
    const date = new Date(d);
    const now  = new Date();
    const yes  = new Date(now); yes.setDate(yes.getDate() - 1);
    if (date.toDateString() === now.toDateString())  return 'Today';
    if (date.toDateString() === yes.toDateString())  return 'Yesterday';
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function _isOnline(conv) {
    if (!conv?.lastMessage?.createdAt) return false;
    return Date.now() - new Date(conv.lastMessage.createdAt) < 5 * 60 * 1000;
  }

  function toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function avatar(partner) {
    const c = _color(partner?.id ?? '');
    return partner?.avatarUrl
      ? `<img src="${_esc(partner.avatarUrl)}" alt="${_esc(partner.name)}"
           style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      : `<div class="avatar avatar--md avatar--placeholder"
           style="background:${c};font-size:0.82rem;font-weight:700;flex-shrink:0">
           ${_esc(_initials(partner?.name ?? ''))}
         </div>`;
  }

  // ── Mobile panel transitions ───────────────────────────────────────────────
  function showChat() {
    if (isMobile()) {
      sidebar?.classList.add('slide-out');
      chatMain?.classList.add('slide-in');
    }
    chatEmpty?.style.setProperty('display', 'none');
    chatMain.style.removeProperty('display');
  }

  function showSidebar() {
    if (isMobile()) {
      sidebar?.classList.remove('slide-out');
      chatMain?.classList.remove('slide-in');
    } else {
      chatEmpty?.style.removeProperty('display');
    }
  }

  // ── Load conversations ─────────────────────────────────────────────────────
  async function loadConversations(silent = false) {
    if (!silent) {
      chatList.innerHTML = `
        <div style="padding:6px 0">
          <div class="msg-skeleton msg-skeleton--conv"></div>
          <div class="msg-skeleton msg-skeleton--conv"></div>
          <div class="msg-skeleton msg-skeleton--conv"></div>
        </div>`;
    }

    const res = await api.messages.getConversations();
    if (!res.ok) {
      if (!silent) chatList.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <p style="color:var(--danger);font-size:0.85rem">Failed to load</p>
          <button class="btn btn--ghost btn--sm" style="margin-top:12px" id="retry-btn">Retry</button>
        </div>`;
      document.getElementById('retry-btn')?.addEventListener('click', () => loadConversations());
      return;
    }

    const prevCache = conversations.map(c => c.conversationId);
    conversations = res.data?.conversations ?? [];

    renderList(searchInput?.value ?? '');
  }

  // ── Render list ────────────────────────────────────────────────────────────
  function renderList(filter = '') {
    const q = filter.toLowerCase().trim();
    const list = conversations.filter(c =>
      !q ||
      (c.partner?.name ?? '').toLowerCase().includes(q) ||
      (c.lastMessage?.content ?? '').toLowerCase().includes(q)
    );

    if (!list.length) {
      chatList.innerHTML = `
        <div style="text-align:center;padding:40px 20px">
          <div style="font-size:2rem;opacity:0.3;margin-bottom:8px">${q ? '🔍' : '💬'}</div>
          <p style="color:var(--text-muted);font-size:0.84rem">
            ${q ? 'No results' : 'No conversations yet'}
          </p>
        </div>`;
      return;
    }

    chatList.innerHTML = list.map(c => {
      const p       = c.partner ?? {};
      const isMe    = c.lastMessage?.senderId === currentUserId;
      const preview = (isMe ? 'You: ' : '') + (c.lastMessage?.content ?? '');
      const online  = _isOnline(c);
      return `
        <div class="chat-item ${c.conversationId === activeConvId ? 'active' : ''}"
          data-conv="${_esc(c.conversationId)}" data-rid="${_esc(p.id ?? '')}"
          role="button" tabindex="0">
          <div class="chat-avatar-wrap">
            ${avatar(p)}
            ${online ? '<span class="online-dot"></span>' : ''}
          </div>
          <div class="chat-info">
            <div class="chat-info-top">
              <span class="chat-name">${_esc(p.name ?? 'Unknown')}</span>
              <span class="chat-time">${_ago(c.lastMessage?.createdAt)}</span>
            </div>
            <div class="chat-preview ${c.unreadCount > 0 ? 'chat-preview--unread' : ''}">
              ${_esc(preview.slice(0, 55))}${preview.length > 55 ? '…' : ''}
            </div>
          </div>
          ${c.unreadCount > 0
            ? `<span class="chat-unread">${c.unreadCount > 99 ? '99+' : c.unreadCount}</span>`
            : ''}
        </div>`;
    }).join('');

    chatList.querySelectorAll('.chat-item').forEach(el => {
      const go = () => openConversation(el.dataset.conv, el.dataset.rid);
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  }

  // ── Open conversation ──────────────────────────────────────────────────────
  async function openConversation(convId, recipientId) {
  activeConvId      = convId;
  activeRecipientId = recipientId;
  const conv = conversations.find(c => c.conversationId === convId);
  activePartnerSnapshot = conv ? { ...conv, partner: { ...conv.partner } } : null; // snapshot
  if (conv) conv.unreadCount = 0;
  renderList(searchInput?.value ?? '');
  renderShell(activePartnerSnapshot ?? conv);
  showChat();
  await loadMessages(convId, true);
  startMsgPoll(convId);
}

  // ── Load messages ──────────────────────────────────────────────────────────
  async function loadMessages(convId, loader = false) {
    const body = document.getElementById('chat-body');
    if (!body) return;
    if (loader) body.innerHTML = `
      <div style="padding:8px 0">
        <div class="msg-skeleton msg-skeleton--them"></div>
        <div class="msg-skeleton msg-skeleton--me"></div>
        <div class="msg-skeleton msg-skeleton--them"></div>
      </div>`;

    const res = await api.messages.getMessages(convId);
    if (!res.ok) {
      body.innerHTML = `
        <div class="chat-error">⚠️ Failed to load.
          <button class="btn btn--ghost btn--sm" id="retry-msgs">Retry</button>
        </div>`;
      document.getElementById('retry-msgs')?.addEventListener('click', () => loadMessages(convId, true));
      return;
    }
    messageCache[convId]  = res.data?.messages ?? [];
    pageByConv[convId]    = 1;
    hasMoreByConv[convId] = messageCache[convId].length === 50;
    renderMessages(convId, false);
  }

  // ── Poll ───────────────────────────────────────────────────────────────────
  async function pollMsgs(convId) {
  if (convId !== activeConvId || document.hidden) return;
  const res = await api.messages.getMessages(convId);
  if (!res.ok) return;
  const msgs = res.data?.messages ?? [];
  const cached = messageCache[convId] ?? [];
  const lastNew = msgs.at(-1)?._id;
  const lastCached = cached.at(-1)?._id;

  if (lastNew && lastNew !== lastCached) {
    const cachedMap = new Map((messageCache[convId] ?? []).map(m => [m._id, m]));
    const serverIds = new Set(msgs.map(m => m._id));
    for (const id of cachedMap.keys()) {
      if (!id.startsWith('temp_') && !serverIds.has(id)) cachedMap.delete(id);
    }
    msgs.forEach(m => { if (!cachedMap.has(m._id)) cachedMap.set(m._id, m); });
    messageCache[convId] = Array.from(cachedMap.values())
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    renderMessages(convId, true);
    const c = conversations.find(x => x.conversationId === convId);
    const last = msgs.at(-1);
    if (c && last) {
      c.lastMessage = last;
      c.unreadCount = 0;
      renderList(searchInput?.value ?? '');
    }
  }

  // Typing — always check when conv is open
const tr = await api.get(`/messages/${convId}/typing`);
const typingEl = document.getElementById('typing-indicator');
if (typingEl) typingEl.style.display = tr.data?.typing ? 'flex' : 'none';
}

  function startMsgPoll(convId) {
  clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (!isIdle()) pollMsgs(convId);
  }, 6000);
}

  function startConvPoll() {
  clearInterval(convPollTimer);
  convPollTimer = setInterval(() => {
    if (!isIdle()) loadConversations(true);
  }, 15000);
}

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(pollTimer); clearInterval(convPollTimer); }
    else { if (activeConvId) startMsgPoll(activeConvId); startConvPoll(); }
  });

  // ── Render chat shell ──────────────────────────────────────────────────────
  function renderShell(conv) {
    const p      = conv?.partner ?? {};
    const online = _isOnline(conv);

    chatMain.innerHTML = `
      <div class="chat-header">
        <button class="chat-back-btn" id="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <div class="chat-header-user">
          ${avatar(p)}
          <div class="chat-header-info">
            <h3>${_esc(p.name ?? 'Conversation')}</h3>
            <span class="${online ? 'chat-status--online' : 'chat-status--offline'}">
              ${online ? 'Online' : (p.role ?? 'Offline')}
            </span>
          </div>
        </div>
      </div>

      <div class="chat-body" id="chat-body"></div>
      <div id="typing-indicator" style="display:none;align-items:center;gap:8px;
  padding:4px 20px 8px;font-size:0.78rem;color:var(--text-muted);flex-shrink:0">
  <span style="display:flex;gap:3px;align-items:center">
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  </span>
  typing…
</div>

      <div class="chat-input-area">
        <div class="chat-input-wrap">
          <textarea id="msg-input" rows="1"
            placeholder="Type a message…"
            maxlength="5000"
            aria-label="Type a message"></textarea>
        </div>
        <button class="chat-send-btn" id="send-btn" aria-label="Send message" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>`;

      document.getElementById('back-btn')?.addEventListener('click', () => {
  clearInterval(pollTimer);
  activeConvId = null;
  activeRecipientId = null;
  activePartnerSnapshot = null; // add this
  showSidebar();
  renderList(searchInput?.value ?? '');
});

    setupInput(conv);
    setTimeout(() => setupContextMenu(activeConvId), 0);
  }

  // ── Render messages ────────────────────────────────────────────────────────
  function renderMessages(convId, preserve = false) {
    const body = document.getElementById('chat-body');
    if (!body) return;
    const msgs = messageCache[convId] ?? [];
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;

    if (!msgs.length) {
      body.innerHTML = `
        <div class="chat-empty-msgs">
          <div style="font-size:2rem;margin-bottom:8px">👋</div>
          <p>No messages yet. Say hello!</p>
        </div>`;
      return;
    }

    let html = '';
    let lastLabel = null;

    if (hasMoreByConv[convId]) {
      html += `<div class="load-more-wrap">
        <button class="btn btn--ghost btn--sm" id="load-more-btn">Load older</button>
      </div>`;
    }

    msgs.forEach(msg => {
      const label = _dateLabel(msg.createdAt);
      if (label !== lastLabel) {
        lastLabel = label;
        html += `<div class="chat-date-sep"><span>${_esc(label)}</span></div>`;
      }
      const me = msg.senderId === currentUserId;
      html += `
        <div class="message ${me ? 'sent' : 'received'}${msg._pending ? ' message--pending' : ''}"
          data-msg-id="${_esc(msg._id)}">
          <div class="msg-bubble-wrap">
            <div class="msg-bubble">${_esc(msg.content)}${msg.edited
  ? '<span style="font-size:0.62rem;opacity:0.55;margin-left:6px;font-style:italic">edited</span>'
  : ''}</div>
            <div class="msg-meta">
              <span class="msg-time">${msg._pending ? '…' : _time(msg.createdAt)}</span>
              ${me && !msg._pending
                ? `<span class="msg-read-tick">${msg.read ? '✓✓' : '✓'}</span>`
                : ''}
            </div>
          </div>
        </div>`;
    });

    body.innerHTML = html;
    if (!preserve || atBottom) body.scrollTop = body.scrollHeight;
    document.getElementById('load-more-btn')?.addEventListener('click', () => loadOlder(convId));
  }

  // ── Load older ─────────────────────────────────────────────────────────────
  async function loadOlder(convId) {
    if (isLoadingMore) return;
    isLoadingMore = true;
    const btn = document.getElementById('load-more-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

    const nextPage = (pageByConv[convId] ?? 1) + 1;
    const res = await api.messages.getMessages(`${convId}?page=${nextPage}`);
    isLoadingMore = false;

    if (!res.ok || !res.data?.messages?.length) {
      hasMoreByConv[convId] = false;
      renderMessages(convId, true);
      return;
    }

    const older = res.data.messages;
    messageCache[convId] = [...older, ...(messageCache[convId] ?? [])];
    pageByConv[convId]   = nextPage;
    hasMoreByConv[convId] = older.length === 50;

    const body = document.getElementById('chat-body');
    const prev = body?.scrollHeight ?? 0;
    renderMessages(convId, true);
    if (body) body.scrollTop = body.scrollHeight - prev;
  }

  // ── Input + Send ───────────────────────────────────────────────────────────
function setupContextMenu(convId) {
    let longPressTimer = null;
    let menuEl = null;

    function removeMenu() {
      menuEl?.remove();
      menuEl = null;
      document.querySelectorAll('.message.selected')
        .forEach(m => m.classList.remove('selected'));
    }

    function showMenu(x, y, msgId) {
      removeMenu();
      const msgs = messageCache[convId] ?? [];
      const msg  = msgs.find(m => m._id === msgId);
      if (!msg || msg.senderId !== currentUserId || msg._pending) return;

      menuEl = document.createElement('div');
      menuEl.className = 'msg-ctx-menu';
      const menuW = 160, menuH = 56;
      const left  = Math.min(x, window.innerWidth  - menuW - 8);
      const top   = Math.min(y, window.innerHeight - menuH - 8);
      menuEl.style.cssText = `left:${left}px;top:${top}px`;
      menuEl.innerHTML = `
       <button class="msg-ctx-item" id="ctx-edit">✏️ Edit message</button>
        <button class="msg-ctx-item msg-ctx-item--danger" id="ctx-delete">
          🗑️ Delete message
        </button>`;
      document.body.appendChild(menuEl);

      document.getElementById('ctx-edit')?.addEventListener('click', () => {
  removeMenu();
  const bubble = document.querySelector(`.message[data-msg-id="${msgId}"] .msg-bubble`);
  if (!bubble) return;

  const original = msg.content;
  bubble.innerHTML = `
    <textarea class="msg-edit-input" maxlength="5000"
      style="width:100%;background:none;border:none;outline:none;color:inherit;
             font:inherit;resize:none;min-height:40px;line-height:1.5"
    >${_esc(original)}</textarea>
    <div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end">
      <button class="btn btn--ghost btn--sm" id="edit-cancel">Cancel</button>
      <button class="btn btn--sm" id="edit-save">Save</button>
    </div>`;

  const ta = bubble.querySelector('.msg-edit-input');
  ta.style.height = ta.scrollHeight + 'px';
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  document.getElementById('edit-cancel').addEventListener('click', () => {
    renderMessages(convId, true);
  });

  document.getElementById('edit-save').addEventListener('click', async () => {
    const newText = ta.value.trim();
    if (!newText || newText === original) { renderMessages(convId, true); return; }
    const res = await api.patch(`/messages/${msgId}`, { content: newText });
    if (!res.ok) { toast(res.error ?? 'Failed to edit', 'error'); renderMessages(convId, true); return; }
    // Update cache in-place — no duplicate
    const idx = (messageCache[convId] ?? []).findIndex(m => m._id === msgId);
    if (idx !== -1) {
      messageCache[convId][idx].content = newText;
      messageCache[convId][idx].edited = true;
    }
    renderMessages(convId, true);
    toast('Message updated', 'success');
  });
});

      document.getElementById('ctx-delete')?.addEventListener('click', async () => {
        removeMenu();
        const res = await api.delete(`/messages/${msgId}`);
        if (!res.ok) { toast(res.error ?? 'Failed to delete', 'error'); return; }
        messageCache[convId] = (messageCache[convId] ?? [])
          .filter(m => m._id !== msgId);
        renderMessages(convId, true);
        toast('Message deleted', 'info');
      });

      setTimeout(() =>
        document.addEventListener('click', removeMenu, { once: true }), 0);
    }

    const body = document.getElementById('chat-body');
    if (!body) return;

    // Right-click desktop
    body.addEventListener('contextmenu', e => {
      const el = e.target.closest('.message');
      if (!el) return;
      e.preventDefault();
      el.classList.add('selected');
      showMenu(e.clientX, e.clientY, el.dataset.msgId);
    });

    // Long press mobile
    body.addEventListener('pointerdown', e => {
      const el = e.target.closest('.message');
      if (!el) return;
      longPressTimer = setTimeout(() => {
        el.classList.add('selected');
        const rect = el.getBoundingClientRect();
        showMenu(rect.left, rect.bottom + 4, el.dataset.msgId);
      }, 500);
    });

    body.addEventListener('pointerup',     () => clearTimeout(longPressTimer));
    body.addEventListener('pointermove',   () => clearTimeout(longPressTimer));
    body.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
  }

  function setupInput(conv) {
    const input   = document.getElementById('msg-input');
    const sendBtn = document.getElementById('send-btn');
    if (!input || !sendBtn) return;

   let typingTimeout = null;
let lastTypingSent = 0;
input.addEventListener('input', () => {
  // Auto-resize
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  // Typing indicator
  const now = Date.now();
  if (now - lastTypingSent > 2000 && activeConvId) {
    lastTypingSent = now;
    api.post(`/messages/${activeConvId}/typing`, {});
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => { lastTypingSent = 0; }, 3000);
});

    async function send() {
      const text = input.value.trim();
      if (!text || sendBtn.disabled) return;

      const convId      = activeConvId;
      const recipientId = conv?.partner?.id ?? activeRecipientId;
      if (!convId || !recipientId) { toast('Missing conversation info', 'error'); return; }

      const tempId = `temp_${Date.now()}`;
      messageCache[convId] = [...(messageCache[convId] ?? []), {
        _id: tempId, conversationId: convId,
        senderId: currentUserId, recipientId,
        content: text, read: false,
        createdAt: new Date().toISOString(),
        _pending: true,
      }];
      renderMessages(convId, false);
      input.value = '';
      input.style.height = 'auto';
      sendBtn.disabled = true;

      const res = await api.messages.send(convId, { content: text, recipientId });
      sendBtn.disabled = false;

      if (!res.ok) {
        messageCache[convId] = messageCache[convId].filter(m => m._id !== tempId);
        renderMessages(convId, true);
        input.value = text;
        toast(res.error || 'Failed to send', 'error');
        return;
      }

      const real = res.data?.message;
      if (real) {
        messageCache[convId] = messageCache[convId].filter(m => m._id !== tempId);
        messageCache[convId].push(real);
        renderMessages(convId, false);
      }

      const c = conversations.find(x => x.conversationId === convId);
      if (c) {
        c.lastMessage = {
          content: text,
          senderId: currentUserId,
          createdAt: new Date().toISOString(),
          read: false,
        };
        renderList(searchInput?.value ?? '');
      }
    }

    // Send button click
    sendBtn.addEventListener('click', send);

    // Enter to send, Shift+Enter for new line
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    input.focus();
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  searchInput?.addEventListener('input', () => renderList(searchInput.value));

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    chatMain.style.display = 'none';

    await loadConversations();
    startConvPoll();

    const pending = sessionStorage.getItem('fv_open_conv');
    if (pending) {
      sessionStorage.removeItem('fv_open_conv');
      const target = conversations.find(c => c.conversationId === pending);
      if (target) {
        await openConversation(target.conversationId, target.partner?.id);
        return;
      }
    }

    if (!isMobile() && conversations.length > 0) {
      await openConversation(conversations[0].conversationId, conversations[0].partner?.id);
    }
  }

  init();
});