/**
 * api.js — FLOWVA
 * Central HTTP client. Handles:
 *  - JWT access token injection + silent refresh on 401
 *  - Rate limit (429) toast with countdown
 *  - File uploads via XHR with progress callback
 *  - Session restore on page load
 */

import AppState from './state.js';

const BASE_URL = window.FLOWVA_API_URL || 'http://127.0.0.1:5000/api';

let _refreshPromise = null;

// ─────────────────────────────────────────────────────────────────────────────
// Token Refresh
// ─────────────────────────────────────────────────────────────────────────────

async function _refresh() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method:      'POST',
        credentials: 'include',
        signal:      controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('refresh_failed');
      const data = await res.json();
      AppState.setAuth(data.accessToken, data.user ?? AppState.getUser());
      return true;
    } catch {
      AppState.clearAuth();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Restore
// ─────────────────────────────────────────────────────────────────────────────

async function restoreSession() {
  if (AppState.getToken()) return true;
  if (!AppState.hasSession()) return false;
  try {
    return await _refresh();
  } catch {
    AppState.clearAuth();
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limit Toast
// ─────────────────────────────────────────────────────────────────────────────

function _showRateLimitToast(retryAfter) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast--warning';
  toast.style.cssText = 'min-width:280px';
  container.appendChild(toast);
  let remaining = retryAfter;
  toast.textContent = `Too many requests. Please wait ${remaining}s before trying again.`;
  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(interval);
      toast.textContent = 'You can try again now.';
      setTimeout(() => toast.remove(), 2000);
    } else {
      toast.textContent = `Too many requests. Please wait ${remaining}s before trying again.`;
    }
  }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Base Request
// ─────────────────────────────────────────────────────────────────────────────

async function request(method, path, body = null, retry = true) {
  const headers = { 'Content-Type': 'application/json' };
  const token = AppState.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const opts = { method, headers, credentials: 'include' };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${path}`, opts);
    const isAuthRoute = path.startsWith('/auth/');

    if (res.status === 401 && retry && !isAuthRoute) {
      const refreshed = await _refresh();
      if (refreshed) return request(method, path, body, false);
      AppState.clearAuth();
      return { ok: false, status: 401, error: 'Session expired' };
    }

    if (res.status === 429) {
      let retryAfter = 60;
      const headerVal = res.headers.get('Retry-After');
      if (headerVal) retryAfter = parseInt(headerVal, 10);
      try {
        const b = await res.clone().json();
        if (b.retryAfter && !isNaN(b.retryAfter)) retryAfter = b.retryAfter;
      } catch {}
      _showRateLimitToast(retryAfter);
      return { ok: false, status: 429, error: `Too many requests. Please wait ${retryAfter} seconds.`, retryAfter };
    }

    const data = await res.json().catch(() => ({}));
    return {
      ok:    res.ok,
      status: res.status,
      data,
      error: res.ok ? null : (data.message || data.error || 'Something went wrong'),
    };
  } catch (err) {
    console.error('[FLOWVA API]', err);
    return { ok: false, error: 'Network error. Check your connection.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File Upload (XHR — supports progress callback)
// ─────────────────────────────────────────────────────────────────────────────

async function upload(path, formData, onProgress = null) {
  let token = AppState.getToken();
  if (!token) {
    try {
      const raw = sessionStorage.getItem('fv_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        token = parsed.accessToken || null;
        if (token && parsed.user) AppState.setAuth(token, parsed.user);
      }
    } catch {}
  }

  if (!token) {
    return { ok: false, status: 401, error: 'No token found. Please log in again.' };
  }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.withCredentials = true;

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        resolve({ ok: xhr.status < 400, status: xhr.status, data, error: data.message || null });
      } catch {
        resolve({ ok: false, error: 'Upload response parse error' });
      }
    };

    xhr.onerror = () => resolve({ ok: false, error: 'Upload failed. Check your connection.' });
    xhr.send(formData);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

const api = {

  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
  upload,
  restoreSession,

  // ── Auth ──────────────────────────────────────────────────────────────────
  // signup payload differs by role:
  //   BUYER:   { name, email, password, role: 'BUYER', country }
  //   CREATOR: { name, email, password, role: 'CREATOR', country, solanaAddress }
  //
  // solanaAddress: creator's Solana USDC deposit address from their exchange
  //   Ghana/Kenya/Uganda → Binance USDC deposit address
  //   Nigeria            → Monica USDC deposit address
  //   US/UK/Europe       → Coinbase or Kraken USDC deposit address
  // Helio will split 70% of every sale directly to this address on-chain.
  auth: {
    signup:             (payload)          => request('POST', '/auth/signup', payload),
    login:              (payload)          => request('POST', '/auth/login', payload),
    logout:             ()                 => request('POST', '/auth/logout'),
    refresh:            ()                 => _refresh(),
    verifyEmail:        (token)            => request('GET',  `/auth/verify-email/${token}`),
    forgotPassword:     (email)            => request('POST', '/auth/forgot-password', { email }),
    resetPassword:      (token, password)  => request('POST', '/auth/reset-password', { token, password }),
    resendVerification: (email)            => request('POST', '/auth/resend-verification', { email }),
    me:                 ()                 => request('GET',  '/auth/me'),
  },

  // ── Users / Profile ───────────────────────────────────────────────────────
  users: {
    updateProfile:   (payload)   => request('PUT',    '/users/profile', payload),
    uploadAvatar:    (formData)  => upload('/users/avatar', formData),
    changePassword:  (payload)   => request('POST',   '/users/change-password', payload),
    getOrders:       ()          => request('GET',    '/users/orders'),
    deleteAccount:   (password)  => request('DELETE', '/users/account', { password }),

    // Public — no auth required
    getCreators: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/users/creators${qs ? `?${qs}` : ''}`);
    },
    getCreatorById:    (id)      => request('GET',  `/users/creators/${id}`),
    getCreatorRatings: (id)      => request('GET',  `/users/creators/${id}/ratings`),

    // Follow
    toggleFollow: (id)           => request('POST', `/users/creators/${id}/follow`),
    getFollowing: ()             => request('GET',  '/users/following'),

    // Ratings
    rateCreator:    (payload)    => request('POST',  '/users/rate', payload),
    replyToRating:  (id, reply)  => request('PATCH', `/users/ratings/${id}/reply`, { reply }),

    // Preferences
    getPreferences:  ()          => request('GET', '/users/preferences'),
    savePreferences: (payload)   => request('PUT', '/users/preferences', payload),

    // Favourites
    getFavourites:   ()          => request('GET',    '/users/favourites'),
    addFavourite:    (templateId)=> request('POST',   '/users/favourites', { templateId }),
    removeFavourite: (id)        => request('DELETE', `/users/favourites/${id}`),
  },

  // ── Payments / Checkout ───────────────────────────────────────────────────
  // Helio only. No Paystack, no Flutterwave.
  // initialize returns { authorizationUrl, reference, orderId }
  // redirect buyer to authorizationUrl (hel.io/pay/...) then poll verify
  payments: {
    initialize: (payload) => request('POST', '/payments/initialize', payload),
    verify:     (reference) => request('GET', `/payments/verify/${reference}`),
    // webhook/helio is called by Helio directly — not called from frontend
  },

  // ── Payouts ───────────────────────────────────────────────────────────────
  // CreatorWallet is display-only. Creators withdraw to local currency
  // themselves via their exchange app (Binance/Monica/Coinbase).
  // FLOWVA does not handle withdrawals — there is no /payouts/withdraw endpoint.
  payouts: {
    getWallet:      ()        => request('GET', '/payouts/wallet'),
    getSettings:    ()        => request('GET', '/payouts/settings'),
    // Update creator's Solana USDC wallet address from dashboard
    // payload: { solanaAddress: string }
    updateSettings: (payload) => request('PUT', '/payouts/settings', payload),
    getHistory:     ()        => request('GET', '/payouts/history'),
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  templates: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/templates${qs ? `?${qs}` : ''}`);
    },
    get:              (id)               => request('GET',   `/templates/${id}`),
    upload:           (formData, onProg) => upload('/templates', formData, onProg),
    update:           (id, payload)      => request('PUT',   `/templates/${id}`, payload),
    delete:           (id)               => request('DELETE',`/templates/${id}`),
    purchase: (id) => request('POST', `/templates/${id}/purchase`, {
      callbackUrl: `${window.location.origin}/payment-callback.html`,
    }),
    getDownloadToken: (id)               => request('GET',   `/templates/${id}/download-token`),
    // Admin actions
    approve:          (id)               => request('PATCH', `/templates/${id}/approve`),
    reject:           (id, reason)       => request('PATCH', `/templates/${id}/reject`, { reason }),
    unpublish:        (id, reason)       => request('PATCH', `/templates/${id}/unpublish`, { reason }),
    permanentDelete:  (id)               => request('DELETE',`/templates/${id}/permanent`),
  },

  // ── Projects / Bidding ────────────────────────────────────────────────────
  projects: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/projects${qs ? `?${qs}` : ''}`);
    },
    get:              (id)               => request('GET',    `/projects/${id}`),
    create:           (payload)          => request('POST',   '/projects', payload),
    update:           (id, payload)      => request('PUT',    `/projects/${id}`, payload),
    submitBid:        (projectId, payload) => request('POST', `/projects/${projectId}/bids`, payload),
    getBids:          (projectId)        => request('GET',    `/projects/${projectId}/bids`),
    acceptBid:        (projectId, bidId) => request('POST',   `/projects/${projectId}/bids/${bidId}/accept`),
    rejectBid:        (projectId, bidId) => request('POST',   `/projects/${projectId}/bids/${bidId}/reject`),
    withdrawBid:      (projectId, bidId) => request('DELETE', `/projects/${projectId}/bids/${bidId}`),
    deliver:          (projectId, payload) => request('POST', `/projects/${projectId}/deliver`, payload),
    approveDelivery:  (projectId)        => request('POST',   `/projects/${projectId}/approve-delivery`),
    approve:          (projectId)        => request('POST',   `/projects/${projectId}/approve`),
    requestRevision:  (projectId, note)  => request('POST',   `/projects/${projectId}/revision`, { note }),
    openDispute:      (projectId, reason)=> request('POST',   `/projects/${projectId}/dispute`, { reason }),
    uploadAttachment: (formData, onProg) => upload('/projects/upload-attachment', formData, onProg),
  },

  // ── Messages ──────────────────────────────────────────────────────────────
  messages: {
    getConversations:  ()                       => request('GET',   '/messages/conversations'),
    getMessages:       (conversationId)         => request('GET',   `/messages/${conversationId}`),
    send:              (conversationId, payload)=> request('POST',  `/messages/${conversationId}`, payload),
    startConversation: (recipientId, payload)   => request('POST',  '/messages/start', { recipientId, ...payload }),
    edit:              (messageId, payload)     => request('PATCH', `/messages/${messageId}`, payload),
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: {
    list:        () => request('GET',   '/users/notifications'),
    markAllRead: () => request('PATCH', '/users/notifications/read'),
  },

  // ── Tutorials ─────────────────────────────────────────────────────────────
  tutorials: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/tutorials${qs ? `?${qs}` : ''}`);
    },
    get:             (id)          => request('GET',    `/tutorials/${id}`),
    upload:          (formData, onProg) => upload('/tutorials', formData, onProg),
    // Admin actions
    listByStatus:    (status)      => request('GET',    `/tutorials/admin/by-status?status=${status}`),
    approve:         (id)          => request('PATCH',  `/tutorials/${id}/approve`),
    reject:          (id, reason)  => request('PATCH',  `/tutorials/${id}/reject`, { reason }),
    unpublish:       (id, reason)  => request('PATCH',  `/tutorials/${id}/unpublish`, { reason }),
    permanentDelete: (id)          => request('DELETE', `/tutorials/${id}/permanent`),
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: {
    // Dashboard
    getStats:            ()           => request('GET',   '/admin/stats'),

    // Users
    getUsers: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request('GET', `/admin/users${qs ? `?${qs}` : ''}`);
    },
    suspendUser:         (id)         => request('PATCH', `/admin/users/${id}/suspend`),
    unsuspendUser:       (id)         => request('PATCH', `/admin/users/${id}/unsuspend`),

    // Commissions (all auto-disbursed on-chain by Helio)
    getCommissions:      (disbursed)  => {
      const qs = disbursed !== undefined ? `?disbursed=${disbursed}` : '';
      return request('GET', `/admin/commissions${qs}`);
    },
    disburseCommission:  (id)         => request('POST',  `/admin/commissions/${id}/disburse`),

    // Templates
    getPendingTemplates: ()           => request('GET',   '/admin/templates/pending'),
    getTemplatesByStatus:(status)     => request('GET',   `/admin/templates?status=${status}`),
    rejectTemplate:      (id, reason) => request('POST',  `/admin/templates/${id}/reject`, { reason }),

    // Tutorials
    getPendingTutorials: ()           => request('GET',   '/admin/tutorials/pending'),
    approveTutorial:     (id)         => request('POST',  `/admin/tutorials/${id}/approve`),
    rejectTutorial:      (id, reason) => request('POST',  `/admin/tutorials/${id}/reject`, { reason }),

    // Projects
    getPendingProjects:  ()           => request('GET',   '/admin/projects/pending'),
    approveProject:      (id)         => request('PATCH', `/admin/projects/${id}/approve`),
    rejectProject:       (id)         => request('PATCH', `/admin/projects/${id}/reject`),
    deleteProject:       (id)         => request('DELETE',`/admin/projects/${id}`),

    // Orders
    getStuckOrders:      ()           => request('GET',   '/admin/stuck-orders'),
    cancelOrder:         (id)         => request('POST',  `/admin/orders/${id}/cancel`),
    forceCompleteOrder:  (id)         => request('POST',  `/admin/orders/${id}/complete`),

    // Disputes
    getDisputes:         ()           => request('GET',   '/admin/disputes'),
    resolveDispute:      (orderId, decision) => request('POST', `/admin/disputes/${orderId}/resolve`, { decision }),

    // Maintenance
    repairWallets:       ()           => request('POST',  '/admin/repair-wallets'),
    repairSalesCounts:   ()           => request('POST',  '/admin/repair-sales-counts'),
  },

  // ── Health ────────────────────────────────────────────────────────────────
  health: () => request('GET', '/health'),
};

export default api;