import api from '../core/api.js';


function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    showToast('Invalid or missing reset link.', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    return;
  }

  const form        = document.getElementById('reset-form');
  const passInput   = document.getElementById('reset-password');
  const confirmInput = document.getElementById('reset-confirm');
  const submitBtn   = document.getElementById('reset-submit');
  const passToggle  = document.getElementById('pass-toggle');
  const passErr     = document.getElementById('pass-error');
  const confirmErr  = document.getElementById('confirm-error');

  const EYE_OPEN = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`;
const EYE_CLOSED = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

// Set initial icon
passToggle.innerHTML = EYE_OPEN;

passToggle?.addEventListener('click', () => {
  const isPass = passInput.type === 'password';
  passInput.type = isPass ? 'text' : 'password';
  passToggle.innerHTML = isPass ? EYE_CLOSED : EYE_OPEN;
});

  passInput?.addEventListener('input', () => {
    if (passErr) passErr.textContent = '';
    passInput.classList.remove('error');
  });

  confirmInput?.addEventListener('input', () => {
    if (confirmErr) confirmErr.textContent = '';
    confirmInput.classList.remove('error');
  });

  function validate() {
    let valid = true;
    if (!passInput.value || passInput.value.length < 6) {
      if (passErr) passErr.textContent = 'Password must be at least 6 characters';
      passInput.classList.add('error');
      valid = false;
    }
    if (passInput.value !== confirmInput.value) {
      if (confirmErr) confirmErr.textContent = 'Passwords do not match';
      confirmInput.classList.add('error');
      valid = false;
    }
    return valid;
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    submitBtn.disabled = true;
submitBtn.querySelector('.btn-text-content').textContent = 'Resetting…';

    try {
      const res = await api.auth.resetPassword(token, passInput.value);

      if (!res.ok) {
        showToast(res.error || 'Reset failed. The link may have expired.', 'error');
        return;
      }

      showToast('Password reset! Redirecting to login…', 'success');
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
submitBtn.querySelector('.btn-text-content').textContent = 'Reset Password';;
    }
  });
});