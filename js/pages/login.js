/**
 * login.js — FULL WORKING VERSION
 */

import api from '../core/api.js';
import AppState from '../core/state.js';

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────

function showToast(message, type = 'success') {

  const container = document.getElementById('toast-container');

  if (!container) return;

  const toast = document.createElement('div');

  toast.className = `toast toast--${type}`;

  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  console.log('LOGIN PAGE LOADED');

  const params = new URLSearchParams(window.location.search);
if (params.get('verified') === '1') {
  showToast('Email verified! Please log in to continue.', 'success');
  // Clean URL
  history.replaceState(null, '', 'login.html');
}
  // ─────────────────────────────────────────
  // Elements
  // ─────────────────────────────────────────

  const form = document.getElementById('login-form');

  const emailInput = document.getElementById('login-email');

  const passInput = document.getElementById('login-password');

  const submitBtn = document.getElementById('login-submit');

  const passToggle = document.getElementById('pass-toggle');

  const emailErr = document.getElementById('email-error');

  const passErr = document.getElementById('pass-error');

  // Forgot Password Elements

  const overlay = document.getElementById('forgot-overlay');

  const forgotLink = document.getElementById('forgot-link');

  const forgotSubmit = document.getElementById('forgot-submit');

  const forgotCancel = document.getElementById('forgot-cancel');

  const forgotEmail = document.getElementById('forgot-email');

  const forgotError = document.getElementById('forgot-error');

  // ─────────────────────────────────────────
  // Safety Checks
  // ─────────────────────────────────────────

  if (!form) {
    console.error('login-form not found');
    return;
  }

  if (!emailInput) {
    console.error('login-email not found');
    return;
  }

  if (!passInput) {
    console.error('login-password not found');
    return;
  }

  // ─────────────────────────────────────────
  // Optional Auto Redirect
  // ─────────────────────────────────────────

  try {

    const token = AppState.getToken?.();

    if (token) {

      console.log('User already logged in');

      // Uncomment later if needed
      // window.location.href = 'dashboard.html';
    }

  } catch (err) {

    console.error('AppState error:', err);
  }

  // ─────────────────────────────────────────
  // Password Toggle
  // ─────────────────────────────────────────

  passToggle?.addEventListener('click', () => {

    const isPassword = passInput.type === 'password';

    passInput.type = isPassword ? 'text' : 'password';

    passToggle.textContent = isPassword ? '🙈' : '👁';
  });

  // ─────────────────────────────────────────
  // Clear Errors
  // ─────────────────────────────────────────

  emailInput.addEventListener('input', () => {

    emailInput.classList.remove('error');

    if (emailErr) {
      emailErr.textContent = '';
    }
  });

  passInput.addEventListener('input', () => {

    passInput.classList.remove('error');

    if (passErr) {
      passErr.textContent = '';
    }
  });

  // ─────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────

  function validate() {

    let valid = true;

    const email = emailInput.value.trim();

    const password = passInput.value;

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {

      valid = false;

      emailInput.classList.add('error');

      if (emailErr) {
        emailErr.textContent =
          'Enter a valid email address';
      }
    }

    if (!password) {

      valid = false;

      passInput.classList.add('error');

      if (passErr) {
        passErr.textContent =
          'Password is required';
      }
    }

    return valid;
  }

  // ─────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────

  form.addEventListener('submit', async (e) => {

    e.preventDefault();

    console.log('FORM SUBMITTED');

    const isValid = validate();

    if (!isValid) {
      console.log('VALIDATION FAILED');
      return;
    }

    submitBtn.disabled = true;

    submitBtn.textContent = 'Logging in…';

    try {

      const payload = {
        email: emailInput.value.trim().toLowerCase(),
        password: passInput.value,
      };

      console.log('LOGIN PAYLOAD:', payload);

      const res = await api.auth.login(payload);

      console.log('LOGIN RESPONSE:', res);

      // ─────────────────────────────────────
      // Failed
      // ─────────────────────────────────────

      if (!res.ok) {

        const message =
          res.error ||
          res.data?.message ||
          'Login failed';

        console.log('LOGIN FAILED:', message);

        const lower = message.toLowerCase();

        if (
          lower.includes('password') ||
          lower.includes('invalid')
        ) {

          passInput.classList.add('error');

          if (passErr) {
            passErr.textContent = message;
          }

        } else if (
          lower.includes('verify')
        ) {

          showToast(message, 'warning');

        } else {

          showToast(message, 'error');
        }

        return;
      }

      // ─────────────────────────────────────
      // Success
      // ─────────────────────────────────────

      const data = res.data || {};

      const accessToken = data.accessToken;

      const user = data.user;

      console.log('ACCESS TOKEN:', accessToken);

      console.log('USER:', user);

      if (!accessToken) {

        showToast(
          'Access token missing from server',
          'error'
        );

        return;
      }

      if (!user) {

        showToast(
          'User data missing from server',
          'error'
        );

        return;
      }

      // SAVE AUTH

      try {

        AppState.setAuth(accessToken, user);

        console.log('AUTH SAVED');

      } catch (err) {

        console.error('SET AUTH FAILED:', err);

        showToast(
          'Could not save login session',
          'error'
        );

        return;
      }

      // SUCCESS TOAST

      showToast(
        `Welcome back, ${user.name || 'Creator'}! 🎉`,
        'success'
      );

      console.log('REDIRECTING TO DASHBOARD');

      // IMPORTANT FIX
      // Use replace so browser doesn't loop

      setTimeout(() => {

        window.location.replace('dashboard.html');

      }, 1000);

    } catch (err) {

      console.error('LOGIN ERROR:', err);

      showToast(
        'Network error. Please check your connection.',
        'error'
      );

    } finally {

      submitBtn.disabled = false;

      submitBtn.textContent = 'Login';
    }
  });

  // ─────────────────────────────────────────
  // Forgot Password Modal
  // ─────────────────────────────────────────

  function openForgotModal() {

    if (!overlay) return;

    overlay.style.display = 'flex';

    overlay.style.alignItems = 'center';

    overlay.style.justifyContent = 'center';

    if (forgotEmail) {
      forgotEmail.value =
        emailInput.value.trim();
    }

    if (forgotError) {
      forgotError.textContent = '';
    }

    forgotEmail?.focus();
  }

  function closeForgotModal() {

    if (!overlay) return;

    overlay.style.display = 'none';

    if (forgotEmail) {
      forgotEmail.value = '';
    }

    if (forgotError) {
      forgotError.textContent = '';
    }
  }

  forgotLink?.addEventListener('click', (e) => {

    e.preventDefault();

    e.stopPropagation();

    console.log('FORGOT PASSWORD CLICKED');

    openForgotModal();
  });

  forgotCancel?.addEventListener('click', (e) => {

    e.preventDefault();

    closeForgotModal();
  });

  overlay?.addEventListener('click', (e) => {

    if (e.target === overlay) {
      closeForgotModal();
    }
  });

  // ─────────────────────────────────────────
  // Forgot Password Submit
  // ─────────────────────────────────────────

  forgotSubmit?.addEventListener('click', async (e) => {

    e.preventDefault();

    const email =
      forgotEmail?.value.trim();

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {

      if (forgotError) {
        forgotError.textContent =
          'Enter a valid email address';
      }

      return;
    }

    forgotSubmit.disabled = true;

    forgotSubmit.textContent = 'Sending…';

    try {

      console.log('FORGOT PASSWORD EMAIL:', email);

      const res =
        await api.auth.forgotPassword(email);

      console.log('FORGOT RESPONSE:', res);

      closeForgotModal();

      if (res.ok) {

        showToast(
          'Reset link sent! Check inbox/spam.',
          'success'
        );

      } else {

        showToast(
          res.error ||
          'Could not send reset email.',
          'error'
        );
      }

    } catch (err) {

      console.error(err);

      showToast(
        'Network error. Please try again.',
        'error'
      );

    } finally {

      forgotSubmit.disabled = false;

      forgotSubmit.textContent =
        'Send Reset Link';
    }
  });

});