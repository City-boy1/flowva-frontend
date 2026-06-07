const Toast = (() => {
  let _container = null;

  function _getContainer() {
    if (_container) return _container;
    _container = document.getElementById('toast-container');
    if (!_container) {
      _container = document.createElement('div');
      _container.id = 'toast-container';
      document.body.appendChild(_container);
    }
    return _container;
  }

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
    warning: '⚠',
  };

  const SAFE_FALLBACKS = {
    500: 'Something went wrong. Please try again.',
    503: 'Service temporarily unavailable. Please try again.',
    401: 'Please log in to continue.',
    403: 'You don\'t have permission to do that.',
    404: 'The requested item was not found.',
    409: 'This already exists.',
    422: 'Please check your input and try again.',
    429: 'Too many requests. Please slow down.',
  };

  function _safeMessage(message, status) {
    if (!message) return SAFE_FALLBACKS[status] || 'Something went wrong. Please try again.';

    // Block any message that looks like a stack trace or internal path
    const blocked = [
      'prisma', 'database', 'sql', 'postgres', 'mongo',
      'connection pool', 'stack', 'node_modules', 'at Object',
      'ECONNRESET', 'ETIMEDOUT', 'P2024', 'P2002',
    ];
    const lower = message.toLowerCase();
    if (blocked.some((b) => lower.includes(b.toLowerCase()))) {
      return SAFE_FALLBACKS[status] || 'Something went wrong. Please try again.';
    }

    return message;
  }

  function show(message, type = 'info', duration = 4000, status = null) {
    const container = _getContainer();
    const safeMsg = _safeMessage(message, status);

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] ?? icons.info}</span>
      <span class="toast-msg">${_escape(safeMsg)}</span>
      <button class="toast-close" aria-label="Dismiss">✕</button>
    `;

    container.appendChild(el);
    el.querySelector('.toast-close').addEventListener('click', () => dismiss(el));

    const timer = setTimeout(() => dismiss(el), duration);
    el._timer = timer;
    return el;
  }

  function dismiss(el) {
    if (!el.isConnected) return;
    clearTimeout(el._timer);
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.isConnected && el.remove(), 500);
  }

  function _escape(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { show, dismiss };
})();

export default Toast;