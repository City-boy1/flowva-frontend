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

  passToggle?.addEventListener('click', () => {
    const isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
    passToggle.textContent = isPass ? '🙈' : '👁';
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
    submitBtn.textContent = 'Resetting…';

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
      submitBtn.textContent = 'Reset Password';
    }
  });
});