import api from '../core/api.js';

const token = new URLSearchParams(window.location.search).get('token');
const icon = document.getElementById('verify-icon');
const heading = document.getElementById('verify-heading');
const msg = document.getElementById('verify-msg');
const action = document.getElementById('verify-action');
const errorAction = document.getElementById('verify-error-action');
const countdown = document.getElementById('verify-countdown');

function showSuccess() {
  icon.textContent = '✅';
  heading.textContent = 'Email verified!';
  msg.textContent = 'Your account is now active. You can log in and start using FLOWVA.';
  action.style.display = 'block';

  let count = 5;
  const interval = setInterval(() => {
    count -= 1;
    if (countdown) countdown.textContent = count;
    if (count <= 0) {
      clearInterval(interval);
      window.location.href = 'login.html?verified=1';
    }
  }, 1000);
}

function showError(message) {
  icon.textContent = '❌';
  heading.textContent = 'Verification failed';
  msg.textContent = message || 'This link is invalid or has expired. Please sign up again or request a new link.';
  errorAction.style.display = 'block';
}

if (!token) {
  showError('No verification token found in this link.');
} else {
  api.auth.verifyEmail(token).then((res) => {
    if (res.ok) {
      showSuccess();
    } else {
      showError(res.error);
    }
  }).catch(() => {
    showError('Network error. Please check your connection and try again.');
  });
}