/**
 * signup.js — FLOWVA
 * Wired to the redesigned signup.html.
 * Uses api.auth.signup() from api.js.
 *
 * New HTML IDs (redesigned page):
 *   f-name, f-email, f-country, f-wallet, f-pass, f-confirm
 *   err-name, err-email, err-wallet, err-pass, err-confirm
 *   creator-banner, wallet-group  (creator-only sections)
 *   s-fill, s-label               (strength meter)
 *   pass-toggle, eye-icon
 *   btn-submit, btn-text
 *   card                           (replaced on success)
 *   toast-container
 */

import api      from '../core/api.js';
import AppState from '../core/state.js';

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

const CREATOR_SECTIONS = [
  document.getElementById('creator-banner'),
  document.getElementById('wallet-group'),
];

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
}

roleInputs.forEach(r => r.addEventListener('change', syncRoleUI));
syncRoleUI();

// ── Password strength ─────────────────────────────────────────────────────────
const STRENGTH_CONFIG = [
  { w: '0%',   c: '',        l: ''       },
  { w: '25%',  c: '#FF5757', l: 'Weak'   },
  { w: '50%',  c: '#FB923C', l: 'Fair'   },
  { w: '75%',  c: '#FACC15', l: 'Good'   },
  { w: '100%', c: '#34D399', l: 'Strong' },
];

function calcStrength(pwd) {
  let s = 0;
  if (pwd.length >= 6)                              s++;
  if (pwd.length >= 10)                             s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd))      s++;
  if (/[0-9]/.test(pwd))                            s++;
  if (/[^A-Za-z0-9]/.test(pwd))                     s++;
  return Math.min(4, s);
}

passInput?.addEventListener('input', () => {
  const cfg = STRENGTH_CONFIG[calcStrength(passInput.value)];
  if (sFill)  { sFill.style.width = cfg.w; sFill.style.background = cfg.c; }
  if (sLabel) { sLabel.textContent = cfg.l; sLabel.style.color = cfg.c; }
});

// ── Error helpers ─────────────────────────────────────────────────────────────
function showErr(errId, msg) {
  const el = document.getElementById(errId);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('visible', !!msg);
}

function clearErrors() {
  ['err-name', 'err-email', 'err-pass', 'err-confirm', 'err-wallet']
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

// ── Solana address validation ─────────────────────────────────────────────────
function isValidSolana(addr) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
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

  return valid;
}

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
        🎉 <strong>Your wallet is connected.</strong><br>
        Flowva's escrow will release <strong>80%</strong> of each sale to your Skrill or Grey wallet, paid weekly or monthly. Add your payout details in Dashboard → Settings → Payout.
        Convert to local currency anytime through your exchange.
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
    name:          fd.get('name')?.toString().trim() || '',
    email:         fd.get('email')?.toString().trim().toLowerCase() || '',
    password:      fd.get('password')?.toString() || '',
    confirm:       fd.get('confirm')?.toString() || '',
    role,
    country:       fd.get('country')?.toString() || 'ghana',
    solanaAddress: fd.get('wallet')?.toString().trim() || '',
  };

  if (!validateForm(data)) return;

  setLoading(true);

  try {
    // Build payload — matches Zod discriminatedUnion schema exactly:
    //   BUYER:   { name, email, password, role: 'BUYER',   country }
    //   CREATOR: { name, email, password, role: 'CREATOR', country, solanaAddress }
    const payload = {
      name:     data.name,
      email:    data.email,
      password: data.password,
      role:     data.role,
      country:  data.country,
    };

    const res = await api.auth.signup(payload);

    if (!res.ok) {
      const msg = res.error || 'Signup failed. Please try again.';
      const lower = msg.toLowerCase();

      if (lower.includes('email')) {
        markErr('f-email', 'err-email', msg);
      } else if (lower.includes('password')) {
        markErr('f-pass', 'err-pass', msg);
      } else if (lower.includes('wallet') || lower.includes('solana')) {
        markErr('f-wallet', 'err-wallet', msg);
      } else if (lower.includes('name')) {
        markErr('f-name', 'err-name', msg);
      } else {
        showToast(msg, 'error');
      }
      return;
    }

    showSuccess(data.email, data.role);

  } catch {
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    setLoading(false);
  }
});