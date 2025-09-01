// =============================
// app.js — Stanforis Multi-Page Manager
// Cordova + Browser Safe
// Handles routing, session, signup/login, auto-logout, device token
// =============================

import { apiCall } from './firebase.js';

// -------------------------- Service Worker & Background Sync --------------------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        console.log('✅ Service Worker registered:', reg);

        if ('SyncManager' in window) {
          navigator.serviceWorker.ready.then(registration => {
            document.addEventListener('submit', event => {
              if (event.target.matches('form')) {
                event.preventDefault();
                const formData = new FormData(event.target);

                fetch(event.target.action, {
                  method: 'POST',
                  body: formData
                }).catch(() => {
                  registration.sync.register('sync-forms');
                  console.log('Form submission queued for background sync');
                });
              }
            });
          });
        }
      })
      .catch(err => console.error('⚠️ SW registration failed:', err));
  });
}

// ------------------ Background Sync Status ------------------
// Only run if SW & SyncManager are supported
// ------------------ Background Sync Status ------------------
// if ('serviceWorker' in navigator && 'SyncManager' in window) {
//   navigator.serviceWorker.ready.then(registration => {
//     // Open database using the same function as SW
//     async function checkPendingRequests() {
//       try {
//         const db = await openDatabase();
//         const tx = db.transaction('post-requests', 'readonly');
//         const store = tx.objectStore('post-requests');
//         const allRequests = await store.getAll();
//         updateStatus(navigator.onLine, allRequests.length > 0);
//       } catch (err) {
//         console.error('Failed to check pending requests', err);
//         updateStatus(navigator.onLine); // fallback: just show online/offline
//       }
//     }

//     // Check every 3s
//     setInterval(checkPendingRequests, 3000);

//     // Also check when coming online
//     window.addEventListener('online', checkPendingRequests);
//   });
// }

// // ------------------ Reuse this helper ------------------
// function openDatabase() {
//   return new Promise((resolve, reject) => {
//     const request = indexedDB.open('stanforis-sync-db', 1);
//     request.onupgradeneeded = event => {
//       const db = event.target.result;
//       if (!db.objectStoreNames.contains('post-requests')) {
//         db.createObjectStore('post-requests', { keyPath: 'timestamp' });
//       }
//     };
//     request.onsuccess = event => resolve(event.target.result);
//     request.onerror = event => reject(event.target.error);
//   });
// }





// -------------------------- Online/Offline Status --------------------------
const statusBox = document.getElementById('sync-status');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

function updateStatus(online, pending = false) {
  if (!statusDot || !statusText) return; // avoid null errors

  if (online) {
    if (pending) {
      statusDot.style.backgroundColor = '#fbbf24'; // yellow
      statusText.textContent = '⏳ Pending sync...';
    } else {
      statusDot.style.backgroundColor = '#10b981'; // green
      statusText.textContent = '🟢 Online';
    }
  } else {
    statusDot.style.backgroundColor = '#ef4444'; // red
    statusText.textContent = '🔴 Offline - will sync later';
  }
}

window.addEventListener('online', () => updateStatus(true));
window.addEventListener('offline', () => updateStatus(false));
updateStatus(navigator.onLine);

// Optional: mobile tap toggle
let expanded = false;
if (statusBox) {
  statusBox.addEventListener('click', () => {
    if (window.innerWidth < 768) { // only on mobile
      expanded = !expanded;
      statusBox.style.width = expanded ? '12rem' : '2rem';
      if (statusText) statusText.style.opacity = expanded ? '1' : '0';
    }
  });
}

// -------------------------- Constants --------------------------
const SESSION_KEY = "firebaseUser";
const OFFLINE_KEY = "offlineUser";
const DEVICE_TOKEN_KEY = "deviceToken";
const AUTO_LOGOUT_MINUTES = 10;

// -------------------------- App Object --------------------------
const App = {
  events: {},
  on(event, fn) { (this.events[event] = this.events[event] || []).push(fn); },
  emit(event, payload) { (this.events[event] || []).forEach(fn => fn(payload)); },

  /**
   * Navigate to a page.
   * Uses PAGES mapping or fallback relative path with getBasePath().
   */
  navigateTo(page) {
    const target = PAGES[page] || getBasePath() + `pages/${page}.html`;
    if (!window.location.pathname.endsWith(target.split("/").pop())) {
      window.location.href = target;
    }
  }
};

// -------------------------- Base Path Helper --------------------------
function getBasePath() {
  return window.cordova ? "./" : "/";
}

// -------------------------- PAGES --------------------------
let PAGES = {};

// -------------------------- Routing Logic --------------------------
async function handleRouting() {
  const user = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  const currentPage = window.location.pathname.split("/").pop();

  if (!user) {
    if (currentPage !== "login.html" && currentPage !== "signup.html") {
      App.navigateTo("login");
    }
  } else {
    if (currentPage === "login.html" || currentPage === "signup.html") {
      startSplash("dashboard");
    }
  }
}

// -------------------------- Splash Screen --------------------------
async function startSplash(nextPage) {
  const splash = document.getElementById("heartbeat-screen");
  const splashTap = document.getElementById("splash-tap");

  if (!splash || !splashTap) {
    if (nextPage) App.navigateTo(nextPage);
    else await handleRouting();
    return;
  }

  splash.classList.remove("fade-out");
  splash.style.display = "flex";

  splashTap.onclick = async () => {
    showToast(`Loading ${nextPage || "app"}...`);

    splash.classList.add("fade-out");
    await new Promise(r => setTimeout(r, 1000));

    splash.style.display = "none";

    if (nextPage) App.navigateTo(nextPage);
    else await handleRouting();
  };
}

// -------------------------- Auto Logout --------------------------
let inactivityTimer;
function resetInactivity() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    alert("Inactive. Logging out.");
    localStorage.removeItem(SESSION_KEY);
    startSplash("login");
  }, AUTO_LOGOUT_MINUTES * 60 * 1000);
}
["mousemove", "keypress", "click", "touchstart"].forEach(ev =>
  window.addEventListener(ev, resetInactivity)
);
resetInactivity();

// -------------------------- Device Token --------------------------
function ensureDeviceToken() {
  if (!localStorage.getItem(DEVICE_TOKEN_KEY)) {
    const token = "dev-" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
    console.log("📱 Device token generated:", token);
  }
}

// -------------------------- Offline Credentials --------------------------
function saveOfflineCredentials(email, password) {
  localStorage.setItem(OFFLINE_KEY, JSON.stringify({ email, password }));
}
function clearOfflineCredentials() {
  localStorage.removeItem(OFFLINE_KEY);
}

// -------------------------- Signup & Login --------------------------
async function handleSignup(email, password, profileData) {
  try {
    const userCredential = await apiCall.register(email, password);
    const user = userCredential.user;
    const sector = profileData.registrationType || "other";
    await apiCall.put(`/api/${sector}/${user.uid}/profile`, profileData);
    console.log("✅ Signup successful:", user.email);
    saveOfflineCredentials(email, password);
    localStorage.setItem("ownerSignedUp", "true");
    startSplash("login");
  } catch (err) {
    console.error("⚠️ handleSignup error:", err);
    throw err;
  }
}

async function handleLogin(email, password) {
  try {
    const userCredential = await apiCall.login(email, password);
    const user = userCredential.user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    ensureDeviceToken();
    console.log("✅ Login successful:", user.email);
    startSplash("dashboard");
  } catch (err) {
    console.error("⚠️ handleLogin error:", err);
    throw err;
  }
}

// -------------------------- Initialization --------------------------
function initApp() {
  PAGES = {
    login: getBasePath() + "pages/auth/login.html",
    signup: getBasePath() + "pages/auth/signup.html",
    dashboard: getBasePath() + "pages/dashboard.html",
    index: getBasePath() + "index.html"
  };

  startSplash();
  ensureDeviceToken();
  App.emit("app:init");
}

// -------------------------- Start App --------------------------
if (window.cordova) {
  document.addEventListener("deviceready", initApp, false);
} else {
  document.addEventListener("DOMContentLoaded", initApp);
}

// -------------------------- Expose Global API --------------------------
window.App = App;
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
window.saveOfflineCredentials = saveOfflineCredentials;
window.clearOfflineCredentials = clearOfflineCredentials;






















// // =============================
// // app.js — Stanforis Multi-Page Manager
// // Cordova + Browser Safe
// // Handles routing, session, signup/login, auto-logout, device token
// // =============================

// import { apiCall } from './firebase.js';

// // -------------------------- Constants --------------------------
// const SESSION_KEY = "firebaseUser";
// const OFFLINE_KEY = "offlineUser";
// const DEVICE_TOKEN_KEY = "deviceToken";
// const AUTO_LOGOUT_MINUTES = 10;

// // -------------------------- App Object --------------------------
// const App = {
//   events: {},
//   on(event, fn) { (this.events[event] = this.events[event] || []).push(fn); },
//   emit(event, payload) { (this.events[event] || []).forEach(fn => fn(payload)); },

//   /**
//    * Navigate to a page.
//    * Uses PAGES mapping or fallback relative path with getBasePath().
//    */
//   navigateTo(page) {
//     const target = PAGES[page] || getBasePath() + `pages/${page}.html`;
//     if (!window.location.pathname.endsWith(target.split("/").pop())) {
//       window.location.href = target;
//     }
//   }
// };

// // -------------------------- Base Path Helper --------------------------
// /**
//  * Returns relative base path depending on environment.
//  * Cordova: "./" (file://)
//  * Browser: "/" (web server root)
//  */
// function getBasePath() {
//   return window.cordova ? "./" : "/";
// }

// // -------------------------- PAGES --------------------------
// // Will be initialized after deviceready to ensure Cordova detection is correct
// let PAGES = {};

// // -------------------------- Routing Logic --------------------------
// /**
//  * Decide which page to show based on session state.
//  * Logged-in users cannot go to login/signup.
//  * Not logged-in users are redirected to login.
//  */
// async function handleRouting() {
//   const user = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
//   const currentPage = window.location.pathname.split("/").pop();

//   if (!user) {
//     // Allow access only to login/signup pages
//     if (currentPage !== "login.html" && currentPage !== "signup.html") {
//       App.navigateTo("login");
//     }
//   } else {
//     // Logged-in users should not see login/signup
//     if (currentPage === "login.html" || currentPage === "signup.html") {
//       startSplash("dashboard");
//     }
//   }
// }

// // -------------------------- Splash Screen --------------------------
// /**
//  * Show splash screen before navigating.
//  * nextPage: the page to go after tap.
//  */
// async function startSplash(nextPage) {
//   const splash = document.getElementById("heartbeat-screen");
//   const splashTap = document.getElementById("splash-tap");

//   if (!splash || !splashTap) {
//     // If splash not available, just navigate
//     if (nextPage) App.navigateTo(nextPage);
//     else await handleRouting();
//     return;
//   }

//   // Reset splash state
//   splash.classList.remove("fade-out");
//   splash.style.display = "flex";

//   // Setup tap handler
//   splashTap.onclick = async () => {
//     showToast(`Loading ${nextPage || "app"}...`);

//     splash.classList.add("fade-out");
//     await new Promise(r => setTimeout(r, 1000));

//     splash.style.display = "none";

//     if (nextPage) App.navigateTo(nextPage);
//     else await handleRouting();
//   };
// }

// // -------------------------- Auto Logout --------------------------
// let inactivityTimer;
// function resetInactivity() {
//   clearTimeout(inactivityTimer);
//   inactivityTimer = setTimeout(() => {
//     alert("Inactive. Logging out.");
//     localStorage.removeItem(SESSION_KEY);
//     startSplash("login");
//   }, AUTO_LOGOUT_MINUTES * 60 * 1000);
// }
// ["mousemove", "keypress", "click", "touchstart"].forEach(ev =>
//   window.addEventListener(ev, resetInactivity)
// );
// resetInactivity();

// // -------------------------- Device Token --------------------------
// function ensureDeviceToken() {
//   if (!localStorage.getItem(DEVICE_TOKEN_KEY)) {
//     const token = "dev-" + Math.random().toString(36).substring(2, 12);
//     localStorage.setItem(DEVICE_TOKEN_KEY, token);
//     console.log("📱 Device token generated:", token);
//   }
// }

// // -------------------------- Offline Credentials --------------------------
// function saveOfflineCredentials(email, password) {
//   localStorage.setItem(OFFLINE_KEY, JSON.stringify({ email, password }));
// }
// function clearOfflineCredentials() {
//   localStorage.removeItem(OFFLINE_KEY);
// }

// // -------------------------- Signup & Login --------------------------
// async function handleSignup(email, password, profileData) {
//   try {
//     const userCredential = await apiCall.register(email, password);
//     const user = userCredential.user;
//     const sector = profileData.registrationType || "other";
//     await apiCall.put(`/api/${sector}/${user.uid}/profile`, profileData);
//     console.log("✅ Signup successful:", user.email);
//     saveOfflineCredentials(email, password);
//     localStorage.setItem("ownerSignedUp", "true");
//     startSplash("login");
//   } catch (err) {
//     console.error("⚠️ handleSignup error:", err);
//     throw err;
//   }
// }

// async function handleLogin(email, password) {
//   try {
//     const userCredential = await apiCall.login(email, password);
//     const user = userCredential.user;
//     localStorage.setItem(SESSION_KEY, JSON.stringify(user));
//     ensureDeviceToken();
//     console.log("✅ Login successful:", user.email);
//     startSplash("dashboard");
//   } catch (err) {
//     console.error("⚠️ handleLogin error:", err);
//     throw err;
//   }
// }

// // -------------------------- Initialization --------------------------
// function initApp() {
//   // Initialize PAGES after deviceready to ensure Cordova detection
//   PAGES = {
//     login: getBasePath() + "pages/auth/login.html",
//     signup: getBasePath() + "pages/auth/signup.html",
//     dashboard: getBasePath() + "pages/dashboard.html",
//     index: getBasePath() + "index.html"
//   };

//   startSplash();
//   ensureDeviceToken();
//   App.emit("app:init");
// }

// // -------------------------- Start App --------------------------
// // Cordova: wait for deviceready
// // Browser: use DOMContentLoaded
// if (window.cordova) {
//   document.addEventListener("deviceready", initApp, false);
// } else {
//   document.addEventListener("DOMContentLoaded", initApp);
// }

// // -------------------------- Expose Global API --------------------------
// window.App = App;
// window.handleSignup = handleSignup;
// window.handleLogin = handleLogin;
// window.saveOfflineCredentials = saveOfflineCredentials;
// window.clearOfflineCredentials = clearOfflineCredentials;
