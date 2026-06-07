/**
 * FLOWVA — AppState
 * Central state store
 * Production-safe session handling
 */

const SESSION_KEY = 'fv_session';

const AppState = (() => {

  // ─────────────────────────────────────────
  // Private State
  // ─────────────────────────────────────────

  let _accessToken = null;
  let _user = null;
  let _notifications = [];

  // ─────────────────────────────────────────
  // Session Restore
  // ─────────────────────────────────────────

  function _loadSession() {

    try {

      const raw =
        sessionStorage.getItem(
          SESSION_KEY
        );

      if (!raw) return;

      const parsed = JSON.parse(raw);

      _user =
        parsed.user || null;

      _accessToken =
        parsed.accessToken || null;

    } catch (err) {

      console.error(
        'Session restore failed',
        err
      );
    }
  }

  // ─────────────────────────────────────────
  // Session Save
  // ─────────────────────────────────────────

  function _saveSession() {

    try {

      if (_user) {

        sessionStorage.setItem(
          SESSION_KEY,

          JSON.stringify({
            user: _user,
            accessToken: _accessToken,
          })
        );

      } else {

        sessionStorage.removeItem(
          SESSION_KEY
        );
      }

    } catch (err) {

      console.error(
        'Session save failed',
        err
      );
    }
  }

  // ─────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────

  return {

    // ─── Init ─────────────────────────────

    init() {
      _loadSession();
    },

    // ─── Auth ─────────────────────────────

    setAuth(token, user) {

      _accessToken = token || null;

      _user = user || null;

      _saveSession();
    },

    clearAuth() {

      _accessToken = null;

      _user = null;

      sessionStorage.removeItem(
        SESSION_KEY
      );
    },

    getToken() {
      return _accessToken;
    },

    getUser() {
      return _user;
    },

    isLoggedIn() {
      return !!_user;
    },

    // IMPORTANT FIX
    hasSession() {
      return !!_user || !!_accessToken;
    },

    // ─── Notifications ───────────────────

    setNotifications(list) {

      _notifications =
        Array.isArray(list)
          ? list
          : [];
    },

    getNotifications() {
      return _notifications;
    },

    addNotification(notif) {

      _notifications.unshift({
        ...notif,
        id: Date.now(),
        read: false,
      });
    },

    markAllRead() {

      _notifications =
        _notifications.map(n => ({
          ...n,
          read: true,
        }));
    },

    unreadCount() {

      return _notifications.filter(
        n => !n.read
      ).length;
    },
  };

})();

// ─────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────

AppState.init();

export default AppState;