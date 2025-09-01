// =============================
// bootstrap.js — UI helpers & global initialization
// =============================

(() => {
  // --------------------------
  // DOM Helpers
  // --------------------------
  window.$ = (selector) => document.querySelector(selector);
  window.$$ = (selector) => Array.from(document.querySelectorAll(selector));

  // --------------------------
  // Toast / Alerts
  // --------------------------
  window.showToast = (message, type = 'info', duration = 3000) => {
    let toast = document.createElement('div');
    toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded shadow-lg text-white z-50 ${
      type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-green-600' : 'bg-gray-700'
    }`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, duration);
  };

  // --------------------------
  // Safe Navigation Helper
  // --------------------------
  window.safeNavigate = (page) => {
    try {
      if (window.App && typeof window.App.navigateTo === 'function') {
        window.App.navigateTo(page);
      } else {
        console.warn('App.navigateTo not ready, fallback reload.');
        window.location.href = page;
      }
    } catch (err) {
      console.error('Navigation error:', err);
    }
  };

  // --------------------------
  // Input Autogrow for textareas
  // --------------------------
  const autoGrowTextareas = () => {
    $$('textarea').forEach(el => {
      el.addEventListener('input', () => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      });
    });
  };

  // --------------------------
  // Initialize global events
  // --------------------------
  const initGlobalUI = () => {
    // Auto-grow textareas
    autoGrowTextareas();

    // Optional: Add other UI init here
    console.log('[bootstrap.js] UI helpers initialized');
  };

  // --------------------------
  // Run on DOMContentLoaded
  // --------------------------
  document.addEventListener('DOMContentLoaded', initGlobalUI);
})();
