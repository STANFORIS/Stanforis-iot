
// www/js/pages/dashboard.js

import { apiCall } from './../firebase.js';
import { IoT } from './api/Final-cloud-iot-api.js';
import { bindKPI } from './api/kpiBinder.js';
import { getTenantContext } from './api/iotCore.js';

(() => {

  // --------------------------
  // DOM & KPI elements
  // --------------------------
  const quickButtons = {
    devices: document.getElementById("kpiDevices"),
    alerts: document.getElementById("kpiAlerts"),
    automation: document.getElementById("kpiAutomation"),
    contacts: document.getElementById("kpiContacts"),
    emergency: document.getElementById("kpiEmergency"),
    familiars: document.getElementById("kpiFamiliars"),
    logs: document.getElementById("kpiLogs"),
    notifications: document.getElementById("kpiNotifications"),
    registration: document.getElementById("kpiRegistration"),
    settings: document.getElementById("kpiSettings"),
    support: document.getElementById("kpiSupport"),
    about: document.getElementById("kpiAbout")
  };

  // --------------------------
  // Constants & Config
  // --------------------------
  const SESSION_KEY = "firebaseUser";
  const DEFAULT_SECTOR = "other";
  const RECONNECT_DELAY_MS = 2000;

  const selectors = {
    username: "#username",
    streamToggle: "#streamToggle",
    streamStatusBadge: "#streamStatusBadge",
    streamPlaceholder: "#streamPlaceholder",
    streamVideo: "#streamVideo",
    systemStatus: "#systemStatus",
    analogClock: "#analogClock",
  };

  const state = {
    user: null,
    sector: null,
    profile: null,
    deviceSubs: new Map(),   // RTDB subscriptions
    iot: null,               // IoT API instance
    tenant: null,            // resolved tenant
    uid: null,               // resolved uid
  };

  // --------------------------
  // Logger / Toast helpers
  // --------------------------
  const log = (...args) => console.debug("[dashboard]", ...args);
  const warn = (...args) => console.warn("[dashboard]", ...args);
  const err = (...args) => console.error("[dashboard]", ...args);

  const showToast = (msg, type = "info") => {
    if (window.showToast) return window.showToast(msg, type);
    console.log("[toast]", type, msg);
  };

  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const safeQuery = sel => { try { return document.querySelector(sel); } catch { return null; } };

  // --------------------------
  // Load session user
  // --------------------------
  function loadSessionUser() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      warn("Failed to parse session user:", e);
      return null;
    }
  }

  // --------------------------
  // Profile & Tenant
  // --------------------------
  function resolveSector(profile) {
    return profile?.registrationType || profile?.sector || DEFAULT_SECTOR;
  }

  async function loadProfileAndInit() {
    try {
      state.user = loadSessionUser();
      if (!state.user) {
        warn("No active session user. Redirecting to login.");
        if (window.App) window.App.navigateTo('login');
        return;
      }

      // Resolve UID
      state.uid = state.user.uid || state.user.localId || state.user.email || null;

      if (!state.uid) {
        warn("Cannot resolve UID; using email fallback.");
      }

      // Resolve tenant/sector
      const trySectors = [state.user.sector, 'residential', 'company', 'ngo', 'agriculture', 'school', 'other'].filter(Boolean);
      let profile = null;
      let usedSector = null;

      for (const s of trySectors) {
        try {
          profile = await apiCall.get(`/api/${s}/${state.uid}/profile`);
          if (profile) { usedSector = s; break; }
        } catch (e) { log("Profile read failed for sector", s, e); }
      }

      if (!profile) {
        profile = { email: state.user.email || '', firstName: '', secondName: '', registrationType: 'other' };
        usedSector = profile.registrationType;
        log("No profile found; using fallback", profile);
      }

      state.profile = profile;
      state.sector = resolveSector(profile) || usedSector || DEFAULT_SECTOR;
      state.tenant = state.sector;

      // Initialize IoT API
      state.iot = new IoT(window.firebaseApp);

      // Bind KPIs
      bindKPI();

      // Render profile
      renderProfileToUI();

      // Subscribe to devices via RTDB (legacy for logs)
      subscribeToDevicesRealtime();

      // Wire UI
      bindUIHandlers();
      bindAvatarUpload();

      log("Dashboard initialized", { user: state.user, sector: state.sector });
    } catch (e) {
      err("Dashboard initialization failed:", e);
      showToast("Dashboard failed to load", "error");
    }
  }

  async function renderProfileToUI() {
    const el = safeQuery(selectors.username);
    if (el) {
      const name = [state.profile?.firstName, state.profile?.secondName].filter(Boolean).join(" ") || state.user?.email || "Operator";
      el.textContent = name;
    }

    const avatarImg = document.querySelector('#profileAvatar');
    if (!avatarImg) return;

    const rtdbPath = `users/${state.uid}/profile/avatar`;
    try {
      const savedBase64 = await apiCall.get(`/rtdb/${rtdbPath}`);
      if (savedBase64) avatarImg.src = savedBase64;
    } catch (e) {
      warn("Failed to load avatar from RTDB.", e);
    }
  }

  function bindAvatarUpload() {
    const avatarImg = document.querySelector('#profileAvatar');
    const fileInput = document.querySelector('#avatarUploadInput');
    if (!avatarImg || !fileInput) return;

    avatarImg.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert("Max 2MB."); return; }
      const base64 = await fileToBase64(file);
      try {
        await apiCall.put(`/rtdb/users/${state.uid}/profile/avatar`, base64);
        avatarImg.src = base64;
        showToast("Profile picture updated", "success");
      } catch (e) { err("Avatar update failed", e); showToast("Failed", "error"); }
      finally { fileInput.value = ""; }
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // --------------------------
  // Devices via IoT API (CRUD)
  // --------------------------
  async function addDevice(meta) {
    return await state.iot.registerDevice(state.tenant, state.uid, meta.deviceId, meta);
  }

  async function updateDevice(deviceId, patch) {
    return await state.iot.registerDevice(state.tenant, state.uid, deviceId, patch);
  }

  async function deleteDevice(deviceId) {
    // IoT API does not have native delete; could set a 'deleted' flag
    return await state.iot.registerDevice(state.tenant, state.uid, deviceId, { deleted: true });
  }

  async function loadDevicesSummary() {
    const devices = await state.iot.listDevices(state.tenant, state.uid);
    return devices || {};
  }

  // --------------------------
  // Realtime RTDB subscriptions (legacy)
  // --------------------------
  function subscribeToDevicesRealtime() {
    if (!apiCall.subscribe) return;
    const rtdbPath = `devices/${state.sector}/${state.uid}`;
    const unsub = apiCall.subscribe(`/rtdb/${rtdbPath}`, (value) => {
      log("Realtime devices update:", value);
    });
    state.deviceSubs.set(rtdbPath, unsub);
  }

  function unsubscribeAll() {
    for (const unsub of state.deviceSubs.values()) {
      if (typeof unsub === "function") unsub();
    }
    state.deviceSubs.clear();
  }

  // --------------------------
  // UI Handlers
  // --------------------------
  function bindUIHandlers() {
    const toggle = safeQuery(selectors.streamToggle);
    if (toggle) toggle.addEventListener('change', ev => updateStreamUI(ev.target.checked));
  }

  function updateStreamUI(on) {
    const badge = safeQuery(selectors.streamStatusBadge);
    const sys = safeQuery(selectors.systemStatus);
    const ph = safeQuery(selectors.streamPlaceholder);
    const vid = safeQuery(selectors.streamVideo);
    if (!badge || !sys) return;
    if (on) {
      badge.textContent = 'Stream online';
      badge.className = 'ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 border border-emerald-800';
      sys.textContent = 'Streaming';
      if (ph) ph.classList.add('hidden');
      if (vid) vid.classList.remove('hidden');
    } else {
      badge.textContent = 'Stream offline';
      badge.className = 'ml-auto text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-800';
      sys.textContent = 'Idle';
      if (vid) vid.classList.add('hidden');
      if (ph) ph.classList.remove('hidden');
    }
  }

  // --------------------------
  // Public API
  // --------------------------
  window.DashboardAPI = {
    addDevice,
    updateDevice,
    deleteDevice,
    loadDevicesSummary,
    subscribeToDevicesRealtime,
    unsubscribeAll,
    getState: () => state
  };

  // --------------------------
  // Clean shutdown
  // --------------------------
  window.addEventListener('beforeunload', unsubscribeAll);

  // --------------------------
  // Init
  // --------------------------
  document.addEventListener('DOMContentLoaded', () => {
    (async () => {
      await sleep(50);
      await loadProfileAndInit();
    })();
  });

})();



















































// // dashboard.js
// // Module: Dashboard controller for Stanforis IoT dashboard
// // Responsibilities:
// // - Load user profile & counts
// // - Provide CRUD helpers for devices/alerts/tasks (Firestore + RTDB)
// // - Subscribe to realtime device updates (RTDB)
// // - Safe UI bindings and graceful error handling
// // - Structured into clearly labeled sections for scalability
// //
// // NOTE: expects /js/firebase.js to export `apiCall` and window.App to exist.

// import { apiCall } from '/js/firebase.js';

// (() => {


//   // Grab all KPI elements dynamically
//   const quickButtons = {
//     devices: document.getElementById("kpiDevices"),
//     alerts: document.getElementById("kpiAlerts"),
//     automation: document.getElementById("kpiAutomation"),
//     contacts: document.getElementById("kpiContacts"),
//     emergency: document.getElementById("kpiEmergency"),
//     familiars: document.getElementById("kpiFamiliars"),
//     logs: document.getElementById("kpiLogs"),
//     notifications: document.getElementById("kpiNotifications"),
//     registration: document.getElementById("kpiRegistration"),
//     settings: document.getElementById("kpiSettings"),
//     support: document.getElementById("kpiSupport"),
//     about: document.getElementById("kpiAbout")
//   };

//   // --------------------------
//   // Constants & Config
//   // --------------------------
//   const SESSION_KEY = "firebaseUser";
//   const DEFAULT_SECTOR = "other"; // fallback if user.profile missing
//   const RECONNECT_DELAY_MS = 2000;

//   // DOM selectors
//   const selectors = {
//     username: "#username",
//     streamToggle: "#streamToggle",
//     streamStatusBadge: "#streamStatusBadge",
//     streamPlaceholder: "#streamPlaceholder",
//     streamVideo: "#streamVideo",
//     systemStatus: "#systemStatus",
//     quickButtonsContainer: null, // optional if you render more
//     analogClock: "#analogClock",
//   };

//   // Runtime state
//   const state = {
//     user: null,           // { uid, email, ... }
//     sector: null,         // registrationType or derived sector
//     profile: null,        // owner's profile doc
//     deviceSubs: new Map() // map deviceId -> unsubscribe function
//   };

//   // --------------------------
//   // Utility helpers
//   // --------------------------
//   function log(...args) { console.debug("[dashboard]", ...args); }
//   function warn(...args) { console.warn("[dashboard]", ...args); }
//   function err(...args) { console.error("[dashboard]", ...args); }

//   function showToast(msg, type = "info") {
//     if (window.showToast) return window.showToast(msg, type);
//     // fallback
//     console.log("[toast]", type, msg);
//   }

//   function safeQuery(sel) {
//     try { return document.querySelector(sel); } catch (e) { return null; }
//   }

//   // Sleep helper
//   const sleep = ms => new Promise(res => setTimeout(res, ms));

//   // Read current user from localStorage (as used by app.js)
//   function loadSessionUser() {
//     try {
//       const raw = localStorage.getItem(SESSION_KEY);
//       if (!raw) return null;
//       return JSON.parse(raw);
//     } catch (e) {
//       warn("Failed parse session user:", e);
//       return null;
//     }
//   }

//   // Resolve sector name for DB paths
//   function resolveSector(profile) {
//     if (!profile) return DEFAULT_SECTOR;
//     return profile.registrationType || profile.sector || DEFAULT_SECTOR;
//   }

//   // --------------------------
//   // Firestore/RTDB path helpers
//   // --------------------------
//   // We use apiCall's public API:
//   // - apiCall.get('/api/...') for Firestore
//   // - apiCall.get('/rtdb/...') for RTDB
//   function profilePathForUser(uid, sector) {
//     return `/api/${sector}/${uid}/profile`;
//   }

//   function settingsPathForUser(uid, sector) {
//     return `/api/${sector}/${uid}/settings`;
//   }

//   function devicesCollectionPath(uid, sector) {
//     // Firestore fallback path (collection)
//     return `/api/${sector}/${uid}/devices`;
//   }

//   function devicesRtdbPath(sector, uid) {
//     // Real-time devices node pattern (common pattern)
//     return `/rtdb/devices/${sector}/${uid}`;
//   }

//   // --------------------------
//   // Core: load profile & initial data
//   // --------------------------
//   async function loadProfileAndInit() {
//     try {
//       state.user = loadSessionUser();
//       if (!state.user) {
//         warn("No active session user. Aborting dashboard init.");
//         // Optionally redirect to login via App if available
//         if (window.App) window.App.navigateTo('login');
//         return;
//       }

//       // Determine sector & profile doc
//       // First try to read profile from Firestore (apiCall.get('/api/...'))
//       // If not present, fallback to local profile stored on user object (if any)
//       const uid = state.user.uid || state.user.uid || state.user.localId || state.user.userId || state.user.id || state.user.email;
//       // best-effort uid
//       const effectiveUid = state.user.uid || state.user.localId || state.user.userId || (state.user && state.user.id) || null;

//       if (!effectiveUid) {
//         warn("Cannot determine user ID from session; using email fallback");
//       }

//       // Try to read a profile from common path patterns
//       // We'll try a couple of likely sectors: 'other' as fallback
//       // Best practice: signup stored profile already at /api/{sector}/{uid}/profile
//       // So we first attempt to read from '/api/*/{uid}/profile' for any sector stored locally (if available)
//       if (state.user?.sector) {
//         state.sector = state.user.sector;
//       }

//       // If signup stored ownerSignedUp and profile exists, read it
//       // Attempt to fetch from common /api/{sector}/{uid}/profile using DEFAULT_SECTOR as fallback
//       const trySectors = [state.user?.sector, 'residential', 'company', 'agriculture', 'school', 'other'].filter(Boolean);
//       let profile = null;
//       let usedSector = null;

//       for (const s of trySectors) {
//         const path = profilePathForUser(effectiveUid || state.user.email, s);
//         try {
//           profile = await apiCall.get(path);
//           if (profile) { usedSector = s; break; }
//         } catch (e) {
//           // ignore individual read errors (keep trying)
//           log("profile read error for", path, e);
//         }
//       }

//       // If none found, set fallback
//       if (!profile) {
//         profile = { email: state.user.email || '', firstName: '', secondName: '', registrationType: 'other' };
//         usedSector = profile.registrationType || DEFAULT_SECTOR;
//         log("No profile found in DB; using fallback profile", profile);
//       }

//       state.profile = profile;
//       state.sector = resolveSector(profile) || usedSector || DEFAULT_SECTOR;

//       // Render basic profile to UI
//       renderProfileToUI();

//       // Load quick counts and device list
//       async function loadQuickCounts() {
//         try {
//           // Example: fetch counts from API
//           const counts = await apiCall.get("/rtdb/kpiCounts"); // your path
//           Object.entries(counts).forEach(([key, value]) => {
//             if (quickButtons[key]) quickButtons[key].textContent = value;
//           });
//         } catch (err) {
//           console.error("[dashboard] loadQuickCounts error:", err);
//         }
//       }


//       // Optionally subscribe to live device updates (RTDB)
//       subscribeToDevicesRealtime();

//       // Wire other UI handlers (stream toggle, etc.)
//       bindUIHandlers();

//       log("Dashboard initialized", { user: state.user, sector: state.sector });
//     } catch (e) {
//       err("Failed to initialize dashboard:", e);
//       showToast("Dashboard initialization failed", "error");
//     }
//   }

//   // --------------------------
//   // Render helpers
//   // --------------------------
  
//   function bindAvatarUpload() {
//   const avatarImg = document.querySelector('#profileAvatar');
//   const fileInput = document.querySelector('#avatarUploadInput');

//   if (!avatarImg || !fileInput) return;

//   // Click avatar → open file picker
//   avatarImg.addEventListener('click', () => fileInput.click());

//   // File selected
//   fileInput.addEventListener('change', async (event) => {
//     const file = event.target.files[0];
//     if (!file) return;

//     try {
//       // Validate file size (optional)
//       if (file.size > 2 * 1024 * 1024) { // 2MB limit
//         alert("File too large. Max 2MB allowed.");
//         return;
//       }

//       // Read file as Base64
//       const base64 = await fileToBase64(file);

//       // Save in RTDB under /users/{uid}/profile/avatar
//       const uid = state.user?.uid || state.user?.localId || state.user?.email;
//       const rtdbPath = `users/${uid}/profile/avatar`;

//       await apiCall.put(`/rtdb/${rtdbPath}`, base64);

//       // Update UI immediately
//       avatarImg.src = base64;

//       showToast("Profile picture updated successfully", "success");
//     } catch (err) {
//       console.error("Avatar upload error:", err);
//       showToast("Failed to update profile picture", "error");
//     } finally {
//       // Reset input to allow re-upload same file if needed
//       fileInput.value = "";
//     }
//   });}

//     // Helper: convert File to Base64
//   function fileToBase64(file) {
//       return new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.onload = () => resolve(reader.result);
//         reader.onerror = reject;
//         reader.readAsDataURL(file); // returns base64 string with data:image/... prefix
//       });
//   }


//   async function renderProfileToUI() {
//   const el = safeQuery(selectors.username) || safeQuery("#username");
//   if (el) {
//     const name = [state.profile?.firstName, state.profile?.secondName]
//                   .filter(Boolean)
//                   .join(" ") || (state.user?.email || "Operator");
//     el.textContent = name;
//   }

//   // Load avatar from RTDB
//   const avatarImg = document.querySelector('#profileAvatar');
//   if (!avatarImg) return;

//   const uid = state.user?.uid || state.user?.localId || state.user?.email;
//   const rtdbPath = `users/${uid}/profile/avatar`;

//   try {
//     const savedBase64 = await apiCall.get(`/rtdb/${rtdbPath}`);
//     if (savedBase64) avatarImg.src = savedBase64;
//   } catch (e) {
//     console.warn("Failed to load saved avatar, using default.", e);
//   }
//  }

//   // --------------------------
//   // Quick counts (devices, alerts, tasks)
//   // - Try RTDB counts first, then Firestore collections.
//   // --------------------------
//   async function loadQuickCounts() {
//     try {
//       // Devices count
//       const uid = state.user?.uid || state.user?.localId || state.user?.email;
//       // First, try RTDB devices node
//       const rtdbPath = devicesRtdbPath(state.sector, uid);
//       let devicesData = null;
//       try {
//         devicesData = await apiCall.get(`/rtdb${rtdbPath}`);
//         // apiCall.get('/rtdb/whatever') expects path without leading slash in wrapper; wrapper handles it.
//       } catch (e) {
//         log("RTDB devices read failed:", e);
//       }

//       let deviceCount = 0;
//       if (devicesData && typeof devicesData === "object") {
//         deviceCount = Object.keys(devicesData).length;
//       } else {
//         // fallback to Firestore collection count
//         try {
//           const docs = await apiCall.get(devicesCollectionPath(uid, state.sector));
//           deviceCount = Array.isArray(docs) ? docs.length : 0;
//         } catch (e) {
//           log("Firestore devices read failed:", e);
//         }
//       }

//       // Populate button count in DOM if present
//       // The first quick button contains the device count in your HTML
//       panelContent.querySelectorAll('input[type="checkbox"]').forEach(chk => {
//         const label = document.getElementById(chk.id + '_label');
//         label.style.transition = 'color 0.2s';
//         chk.addEventListener('change', () => {
//           label.style.color = chk.checked ? '#22d3ee' : '#ccc';
//         });
//       });


//       // Alerts & tasks (simple Firestore collection length fallback)
//       const alertsPath = `/api/${state.sector}/${uid}/alerts`;
//       const tasksPath = `/api/${state.sector}/${uid}/tasks`;
//       let alertsCount = 0, tasksCount = 0;
//       try {
//         const alerts = await apiCall.get(alertsPath);
//         if (Array.isArray(alerts)) alertsCount = alerts.length;
//       } catch (e) { /* ignore */ }
//       try {
//         const tasks = await apiCall.get(tasksPath);
//         if (Array.isArray(tasks)) tasksCount = tasks.length;
//       } catch (e) { /* ignore */ }

//       // Write to button placeholders (assuming second and third quick cards)
//       if (quickButtons.length > 1) {
//         const alertBtn = quickButtons[1];
//         const countEl = alertBtn.querySelector('.text-lg') || null;
//         if (countEl) countEl.textContent = String(alertsCount);
//       }
//       if (quickButtons.length > 2) {
//         const taskBtn = quickButtons[2];
//         const countEl = taskBtn.querySelector('.text-lg') || null;
//         if (countEl) countEl.textContent = String(tasksCount);
//       }
//     } catch (e) {
//       err("loadQuickCounts error:", e);
//     }
//   }

//   // --------------------------
//   // Devices: Load summary and CRUD operations
//   // --------------------------
//   async function loadDevicesSummary() {
//     try {
//       const uid = state.user?.uid || state.user?.localId || state.user?.email;
//       // Prefer Firestore devices collection (if present)
//       try {
//         const docs = await apiCall.get(devicesCollectionPath(uid, state.sector));
//         if (Array.isArray(docs)) {
//           // Store some in-memory if needed
//           log("Loaded devices from Firestore:", docs.length);
//           // Optionally render devices somewhere
//           return docs;
//         }
//       } catch (e) {
//         log("No Firestore devices or read failed", e);
//       }

//       // Fallback to RTDB devices node
//       try {
//         const rtdbPath = devicesRtdbPath(state.sector, uid);
//         const devices = await apiCall.get(`/rtdb${rtdbPath}`);
//         if (devices) {
//           log("Loaded devices from RTDB:", Object.keys(devices).length);
//           return devices;
//         }
//       } catch (e) {
//         log("RTDB devices read failed", e);
//       }

//       return [];
//     } catch (e) {
//       err("loadDevicesSummary error:", e);
//       return [];
//     }
//   }

//   // CRUD: Add device (uses Firestore post or RTDB push)
//   async function addDevice(deviceObj) {
//     const uid = state.user?.uid || state.user?.localId || state.user?.email;
//     // Add server timestamp
//     deviceObj.createdAt = new Date().toISOString();
//     try {
//       // Prefer Firestore collection
//       const collectionPath = devicesCollectionPath(uid, state.sector);
//       const res = await apiCall.post(collectionPath, deviceObj);
//       showToast("Device added", "success");
//       return res;
//     } catch (e) {
//       // Fallback to RTDB push
//       try {
//         const rtdbPath = devicesRtdbPath(state.sector, uid);
//         const res = await apiCall.post(`/rtdb${rtdbPath}`, deviceObj);
//         showToast("Device added (RTDB)", "success");
//         return res;
//       } catch (errAdd) {
//         err("addDevice failed:", errAdd);
//         showToast("Failed to add device", "error");
//         throw errAdd;
//       }
//     }
//   }

//   // CRUD: Update device
//   async function updateDevice(deviceId, patch) {
//     const uid = state.user?.uid || state.user?.localId || state.user?.email;
//     try {
//       // Firestore doc path: /api/{sector}/{uid}/devices/{deviceId}
//       const docPath = `/api/${state.sector}/${uid}/devices/${deviceId}`;
//       await apiCall.put(docPath, patch);
//       showToast("Device updated", "success");
//     } catch (e) {
//       // RTDB path: /rtdb/devices/{sector}/{uid}/{deviceId}
//       try {
//         const rtdbPath = `${devicesRtdbPath(state.sector, uid)}/${deviceId}`;
//         await apiCall.put(`/rtdb${rtdbPath}`, patch);
//         showToast("Device updated (RTDB)", "success");
//       } catch (err2) {
//         err("updateDevice failed:", err2);
//         showToast("Failed to update device", "error");
//         throw err2;
//       }
//     }
//   }

//   // CRUD: Delete device
//   async function deleteDevice(deviceId) {
//     const uid = state.user?.uid || state.user?.localId || state.user?.email;
//     try {
//       const docPath = `/api/${state.sector}/${uid}/devices/${deviceId}`;
//       await apiCall.delete(docPath);
//       showToast("Device removed", "success");
//     } catch (e) {
//       try {
//         const rtdbPath = `${devicesRtdbPath(state.sector, uid)}/${deviceId}`;
//         await apiCall.delete(`/rtdb${rtdbPath}`);
//         showToast("Device removed (RTDB)", "success");
//       } catch (err2) {
//         err("deleteDevice failed:", err2);
//         showToast("Failed to remove device", "error");
//         throw err2;
//       }
//     }
//   }

//   // --------------------------
//   // Realtime subscriptions (RTDB)
//   // - Uses apiCall.subscribe('/rtdb/...', cb)
//   // - Keeps track of unsubscribe functions in state.deviceSubs
//   // --------------------------
//   function subscribeToDevicesRealtime() {
//     try {
//       const uid = state.user?.uid || state.user?.localId || state.user?.email;
//       const rtdbPath = devicesRtdbPath(state.sector, uid);
//       // If no RTDB support in apiCall, skip
//       if (!apiCall.subscribe) {
//         log("apiCall.subscribe not available; skipping RTDB subscriptions");
//         return;
//       }

//       // Subscribe to the whole node
//       const unsub = apiCall.subscribe(`/rtdb${rtdbPath}`, (value) => {
//         log("Realtime devices update:", value);
//         // value is the whole devices object; update quick counts and maybe heartbeat
//         try {
//           const count = value ? Object.keys(value).length : 0;
//           // update UI quick card
//           const quickButtons = Array.from(document.querySelectorAll('main section button'));
//           if (quickButtons && quickButtons.length > 0) {
//             const firstBtn = quickButtons[0];
//             const countEl = firstBtn.querySelector('.text-lg') || firstBtn.querySelector('.font-semibold') || null;
//             if (countEl) countEl.textContent = String(count);
//           }
//         } catch (uiErr) {
//           warn("Realtime UI update failed:", uiErr);
//         }
//       });

//       // store unsub if provided (apiCall.subscribe should return a function or object)
//       state.deviceSubs.set(rtdbPath, unsub);
//       log("Subscribed to RTDB path:", rtdbPath);
//     } catch (e) {
//       err("subscribeToDevicesRealtime error:", e);
//     }
//   }

//   // Unsubscribe helper
//   function unsubscribeAll() {
//     for (const [path, unsub] of state.deviceSubs.entries()) {
//       try {
//         if (typeof unsub === "function") unsub();
//         // else if unsubscribe is an object with off: unsub.off() etc — not implemented here
//       } catch (e) {
//         log("unsubscribe error for", path, e);
//       }
//     }
//     state.deviceSubs.clear();
//   }

//   // --------------------------
//   // UI Bindings
//   // --------------------------
//   function bindUIHandlers() {
//     // Stream toggle checkbox (exists in HTML)
//     const streamToggle = safeQuery('#streamToggle') || safeQuery('#streamToggle');
//     if (streamToggle) {
//       streamToggle.addEventListener('change', (ev) => {
//         try {
//           // Delegate to existing function toggleStream if present
//           if (typeof window.toggleStream === 'function') {
//             window.toggleStream(ev.target.checked);
//             return;
//           }
//           // Otherwise do local simple update
//           updateStreamUI(ev.target.checked);
//         } catch (e) {
//           warn("stream toggle handler error:", e);
//         }
//       });
//     }

//     // Example: wire dashboard quick nav buttons to App (if present)
//     document.querySelectorAll('footer nav button, main section button').forEach(btn => {
//       btn.addEventListener('click', (ev) => {
//         const page = btn.getAttribute('data-page') || btn.getAttribute('data-nav') || null;
//         if (page && window.App) window.App.navigateTo(page);
//       });
//     });
//   }

//   function updateStreamUI(on) {
//     const badge = safeQuery('#streamStatusBadge');
//     const sys = safeQuery('#systemStatus');
//     const ph = safeQuery('#streamPlaceholder');
//     const vid = safeQuery('#streamVideo');
//     if (!badge || !sys) return;
//     if (on) {
//       badge.textContent = 'Stream online';
//       badge.className = 'ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 border border-emerald-800';
//       sys.textContent = 'Streaming';
//       if (ph) ph.classList.add('hidden');
//       if (vid) vid.classList.remove('hidden');
//     } else {
//       badge.textContent = 'Stream offline';
//       badge.className = 'ml-auto text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-800';
//       sys.textContent = 'Idle';
//       if (vid) vid.classList.add('hidden');
//       if (ph) ph.classList.remove('hidden');
//     }
//   }

//   // --------------------------
//   // Clean shutdown: unsubscribe when navigating away
//   // --------------------------
//   window.addEventListener('beforeunload', () => {
//     unsubscribeAll();
//   });

//   // --------------------------
//   // Public surface for console debugging (optional)
//   // --------------------------
//   window.DashboardAPI = {
//     addDevice,
//     updateDevice,
//     deleteDevice,
//     loadQuickCounts,
//     loadDevicesSummary,
//     subscribeToDevicesRealtime,
//     unsubscribeAll,
//     getState: () => state
//   };

//   // --------------------------
//   // Init on DOM loaded (guarded)
//   // --------------------------
//   document.addEventListener('DOMContentLoaded', () => {
//     // Defer async work, but don't block UI
//     (async () => {
//       await sleep(50); // small yield to let other modules attach
//       await loadProfileAndInit();
//       // Bind avatar upload
//       bindAvatarUpload();
//     })();
//   });






   







// })();
