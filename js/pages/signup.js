/**
 * signup.js — FLOWVA
 * Wired to the redesigned signup.html.
 * Uses api.auth.signup() from api.js.
 * All page behavior lives here — signup.html has no inline logic
 * except the pre-paint theme bootstrap and the theme-toggle button.
 */

import api      from '../core/api.js';
import AppState from '../core/state.js';
import { normalizeCountry } from '../core/countries.js';

// ── Auto-detect country by IP (fast, silently falls back on failure) ────────
(async () => {
  const select = document.getElementById('f-country');
  if (!select) return;
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    const slug = normalizeCountry(data.country_code);
    if (slug && [...select.options].some(o => o.value === slug)) {
      select.value = slug;
      const hint = document.getElementById('country-detect-hint');
      if (hint) hint.textContent = `Detected: ${data.country_name || slug} — change if incorrect`;
    }
  } catch { /* silent — keeps default selection, never blocks signup */ }
})();

// ── Redirect if already logged in ────────────────────────────────────────────
if (AppState.getToken()) {
  window.location.href = '/dashboard.html';
}

// ── DOM refs ─────────────────────────────────────────────────────────────────
const form        = document.getElementById('signup-form');
const btn         = document.getElementById('btn-submit');
const btnText     = document.getElementById('btn-text');
const passInput   = document.getElementById('f-pass');
const passToggle  = document.getElementById('pass-toggle');
const sFill       = document.getElementById('s-fill');
const sLabel      = document.getElementById('s-label');
const roleInputs  = document.querySelectorAll('input[name="role"]');
const creatorBanner = document.getElementById('creator-banner');
const phoneLabel  = document.querySelector('label[for="f-phone"] span');
const phoneInput  = document.getElementById('f-phone');

const CREATOR_SECTIONS = [creatorBanner];

// ── Auto-select role from URL param (?role=creator) ──────────────────────────
(() => {
  const urlRole = new URLSearchParams(window.location.search).get('role');
  if (urlRole === 'creator') {
    const creatorRadio = document.querySelector('input[name="role"][value="creator"]');
    const buyerRadio   = document.querySelector('input[name="role"][value="buyer"]');
    if (creatorRadio) creatorRadio.checked = true;
    if (buyerRadio)   buyerRadio.checked   = false;
  }
})();

// ── Role UI ───────────────────────────────────────────────────────────────────
function getRole() {
  return [...roleInputs].find(r => r.checked)?.value?.toUpperCase() || 'BUYER';
}

function syncRoleUI() {
  const isCreator = getRole() === 'CREATOR';
  CREATOR_SECTIONS.forEach(el => {
    if (!el) return;
    if (isCreator) {
      el.style.display   = 'flex';
      el.style.animation = 'none';
      void el.offsetWidth;          // force reflow to restart CSS animation
      el.style.animation = '';
    } else {
      el.style.display = 'none';
    }
  });

  if (phoneLabel) phoneLabel.textContent = isCreator ? '(required)' : '(optional)';
  if (phoneInput) phoneInput.required = isCreator;
}

roleInputs.forEach(r => r.addEventListener('change', syncRoleUI));
syncRoleUI();

// ── Password show/hide toggle ─────────────────────────────────────────────────
passToggle?.addEventListener('click', () => {
  const show = passInput.type === 'password';
  passInput.type = show ? 'text' : 'password';
  passToggle.innerHTML = show
    ? `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
    : `<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`;
});

// ── Password strength (single source of truth — do not duplicate elsewhere) ──
const STRENGTH_CONFIG = [
  { w: '0%',   c: 'transparent', l: ''       },
  { w: '25%',  c: '#ef4444',     l: 'Weak'   },
  { w: '50%',  c: '#f59e0b',     l: 'Fair'   },
  { w: '75%',  c: '#3b82f6',     l: 'Good'   },
  { w: '100%', c: '#10b981',     l: 'Strong' },
];

function calcStrength(pwd) {
  let s = 0;
  if (pwd.length >= 8)                          s++;
  if (/[A-Z]/.test(pwd))                        s++;
  if (/[0-9]/.test(pwd))                        s++;
  if (/[^A-Za-z0-9]/.test(pwd))                 s++;
  return Math.min(4, s);
}

passInput?.addEventListener('input', () => {
  const v   = passInput.value;
  const cfg = STRENGTH_CONFIG[v.length ? calcStrength(v) : 0];
  if (sFill)  { sFill.style.width = v.length ? cfg.w : '0%'; sFill.style.background = cfg.c; }
  if (sLabel) { sLabel.textContent = v.length ? cfg.l : ''; sLabel.style.color = cfg.c; }
});

// ── Ripple effect on submit button ────────────────────────────────────────────
btn?.addEventListener('click', function (e) {
  const rect   = this.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size   = Math.max(rect.width, rect.height);
  ripple.classList.add('ripple');
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  this.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// ── Animated stat counters (left panel "80%" etc.) ────────────────────────────
function animateCount(el, target) {
  let start = 0;
  const step = () => {
    start += Math.ceil(target / 30);
    if (start >= target) { el.textContent = target + '%'; return; }
    el.textContent = start + '%';
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const statObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      animateCount(el, parseInt(el.dataset.count, 10));
      statObserver.unobserve(el);
    }
  });
});
document.querySelectorAll('[data-count]').forEach(el => statObserver.observe(el));

// ── Error helpers ─────────────────────────────────────────────────────────────
function showErr(errId, msg) {
  const el = document.getElementById(errId);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('visible', !!msg);
}

function clearErrors() {
  ['err-name', 'err-email', 'err-pass', 'err-confirm', 'err-phone']
    .forEach(id => showErr(id, ''));
  document.querySelectorAll('.field__input.error')
    .forEach(el => el.classList.remove('error'));
}

function markErr(inputId, errId, msg) {
  showErr(errId, msg);
  const input = document.getElementById(inputId);
  if (!input) return;
  input.classList.add('error');
  input.addEventListener('input', () => {
    input.classList.remove('error');
    showErr(errId, '');
  }, { once: true });
  // Only auto-focus the first error
  if (!form.querySelector('.field__input.error:not(#' + inputId + ')')) {
    input.focus();
  }
}

// ── Form validation ───────────────────────────────────────────────────────────
function validateForm(d) {
  let valid = true;

  if (!d.name || d.name.trim().length < 2) {
    markErr('f-name', 'err-name', 'Name must be at least 2 characters');
    valid = false;
  }

  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    markErr('f-email', 'err-email', 'Enter a valid email address');
    valid = false;
  }

  if (!d.password || d.password.length < 6) {
    markErr('f-pass', 'err-pass', 'Password must be at least 6 characters');
    valid = false;
  }

  if (d.password !== d.confirm) {
    markErr('f-confirm', 'err-confirm', 'Passwords do not match');
    valid = false;
  }

  if (d.role === 'CREATOR') {
    if (!d.phone || !/^[+0-9\s-]{7,20}$/.test(d.phone)) {
      markErr('f-phone', 'err-phone', 'A valid phone number is required for creator accounts');
      valid = false;
    }
  }

  return valid;
}

// ── Persist last signup error across navigation ──────────────────────────────
const ERR_KEY = 'flowva_signup_last_error';

function persistError(fieldErrId, msg) {
  try {
    sessionStorage.setItem(ERR_KEY, JSON.stringify({ fieldErrId, msg, ts: Date.now() }));
  } catch { /* sessionStorage unavailable — non-fatal */ }
}

function clearPersistedError() {
  try { sessionStorage.removeItem(ERR_KEY); } catch { /* no-op */ }
}

function restorePersistedError() {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(ERR_KEY) || 'null'); } catch { return; }
  if (!saved) return;
  // Only restore if recent (avoid showing a week-old stale error)
  if (Date.now() - saved.ts > 10 * 60 * 1000) { clearPersistedError(); return; }
  if (saved.fieldErrId) {
    showErr(saved.fieldErrId, saved.msg);
  } else {
    showToast(saved.msg, 'error');
  }
}

// Restore on load — covers bfcache restores (back button) and fresh reloads
window.addEventListener('pageshow', restorePersistedError);

// ── Loading state ─────────────────────────────────────────────────────────────
function setLoading(loading) {
  btn.disabled     = loading;
  btnText.textContent = loading ? 'Creating account…' : 'Create Account';
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast       = document.createElement('div');
  toast.className   = `toast toast--${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Success screen ────────────────────────────────────────────────────────────
function showSuccess(email, role) {
  const card = document.getElementById('card');
  card.innerHTML = `
    <div class="success-state">
      <div class="success-state__icon">
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
            stroke="currentColor" stroke-width="1.8"/>
          <polyline points="22,6 12,13 2,6" stroke="currentColor" stroke-width="1.8"/>
        </svg>
      </div>
      <h3 class="success-state__title">Check Your Email</h3>
      <p class="success-state__body">
        We sent a verification link to<br>
        <span class="success-state__email">${email}</span><br><br>
        Click it to activate your account.
      </p>
      ${role === 'CREATOR' ? `
      <div class="success-state__wallet-note">
        🎉 <strong>You're in as a creator.</strong><br>
        Once verified, head to Dashboard → Settings → Payout to set up Paystack, Skrill, or Grey — that's where you'll receive your 80% share of every sale, paid weekly or monthly.
      </div>` : ''}
      <a href="/login.html" class="btn-login">
        Sign In Now
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
          <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </a>
    </div>
  `;
}

// ── Submit ────────────────────────────────────────────────────────────────────
form?.addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();

  const fd   = new FormData(form);
  const role = getRole(); // 'BUYER' | 'CREATOR'

  const data = {
    name:     fd.get('name')?.toString().trim() || '',
    email:    fd.get('email')?.toString().trim().toLowerCase() || '',
    password: fd.get('password')?.toString() || '',
    confirm:  fd.get('confirm')?.toString() || '',
    role,
    country:  fd.get('country')?.toString() || 'ghana',
    phone:    fd.get('phone')?.toString().trim() || '',
  };

  if (!validateForm(data)) return;

  setLoading(true);

  try {
    const payload = {
      name:     data.name,
      email:    data.email,
      password: data.password,
      role:     data.role,
      country:  data.country,
      ...(data.phone ? { phone: data.phone } : {}),
    };

    const res = await api.auth.signup(payload);

    if (!res.ok) {
      const msg = res.error || 'Signup failed. Please try again.';
      const lower = msg.toLowerCase();

      if (lower.includes('email')) {
        markErr('f-email', 'err-email', msg);
        persistError('err-email', msg);
      } else if (lower.includes('password')) {
        markErr('f-pass', 'err-pass', msg);
        persistError('err-pass', msg);
      } else if (lower.includes('phone')) {
        markErr('f-phone', 'err-phone', msg);
        persistError('err-phone', msg);
      } else if (lower.includes('name')) {
        markErr('f-name', 'err-name', msg);
        persistError('err-name', msg);
      } else {
        showToast(msg, 'error');
        persistError(null, msg);
      }
      return;
    }

    clearPersistedError();
    showSuccess(data.email, data.role);

  } catch {
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    setLoading(false);
  }
});