// ==================================================================
// www/js/pages/api/iotCore.js
// Multi-Tenant IoT Core API for Dashboard Integration
// ==================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getDatabase, ref, push, set, update, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ------------------------------
// Firebase Init
// ------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyB1Z1rd67bYtsBrpEUkcOzYO9HzHrDmtnY",
  authDomain: "stanforis-iot.firebaseapp.com",
  databaseURL: "https://stanforis-iot-default-rtdb.firebaseio.com",
  projectId: "stanforis-iot",
  storageBucket: "stanforis-iot.appspot.com",
  messagingSenderId: "529674223964",
  appId: "1:529674223964:web:2068cf5eb34e6372864199",
  measurementId: "G-MBMF6KCJDF"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ------------------------------
// Session
// ------------------------------
let currentUID = null;
let currentTenant = "residential";   // default tenant, can be changed in UI
let lastActionTimestamps = {};       // { actionId: timestamp }

export const iotCoreReady = new EventTarget();

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
    console.log("IoT Core bound to:", currentUID, "Tenant:", currentTenant);
    iotCoreReady.dispatchEvent(new Event("ready"));
  } else {
    console.warn("No user signed in.");
    currentUID = null;
  }
});

// ------------------------------
// Config
// ------------------------------
const RATE_LIMIT_MS = 500;  // prevent spamming same action
const MAX_RETRIES   = 3;

// ------------------------------
// Path Helpers (multi-tenant)
// ------------------------------
const basePath   = (tenant, uid) => `/${tenant}/${uid}/iot`;
const pathDevices= (tenant, uid) => `${basePath(tenant, uid)}/devices`;
const pathDevice = (tenant, uid, deviceId) => `${pathDevices(tenant, uid)}/${deviceId}`;
const pathActions= (tenant, uid) => `${basePath(tenant, uid)}/actions`;
const pathAction = (tenant, uid, actionId) => `${pathActions(tenant, uid)}/${actionId}`;
const pathAudit  = (tenant, uid) => `${basePath(tenant, uid)}/audit_logs`;
const pathStatus = (tenant, uid, deviceId) => `${basePath(tenant, uid)}/status/${deviceId}`;

// ------------------------------
// Helpers
// ------------------------------
async function withRetry(fn) {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      console.warn(`Retry ${attempt}/${MAX_RETRIES}`, err);
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
  throw new Error(`Operation failed after ${MAX_RETRIES} retries`);
}

// ------------------------------
// Public API
// ------------------------------

/**
 * Set active tenant type (residential, company, ngo, agriculture, school)
 */
export function setTenant(tenantType) {
  currentTenant = tenantType;
  console.log("Tenant switched to:", tenantType);
}

/**
 * Register/Update a device
 */
export async function registerDevice(deviceId, meta = {}) {
  if (!currentUID) throw new Error("User not authenticated.");
  if (!deviceId) throw new Error("deviceId required");

  const data = {
    name: meta.name || "Unnamed Device",
    type: meta.type || "generic",
    location: meta.location || "",
    updatedAt: serverTimestamp()
  };

  await withRetry(() => update(ref(db, pathDevice(currentTenant, currentUID, deviceId)), data));
  return { ok: true, deviceId };
}

/**
 * Dispatch action to IoT system
 */
export async function dispatchAction(deviceId, actionId, payload = {}, opts = {}) {
  if (!currentUID) {
    console.error("dispatchAction failed: user not authenticated.");
    return { ok: false };
  }
  if (!actionId) throw new Error("actionId required");

  // --- Rate limit ---
  const now = Date.now();
  if (lastActionTimestamps[actionId] && now - lastActionTimestamps[actionId] < RATE_LIMIT_MS) {
    console.warn(`Rate limited: ${actionId}`);
    return { ok: false, skipped: true, reason: "rate_limited" };
  }
  lastActionTimestamps[actionId] = now;

  // --- Build action payload ---
  const trace = opts.traceId || `act_${Math.random().toString(36).slice(2)}`;
  const actionBody = {
    deviceId,
    actionId,
    payload,
    meta: opts.meta || {},
    ts: serverTimestamp(),
    tsClient: new Date().toISOString(),
    trace
  };

  // --- Write action ---
  await withRetry(() => set(ref(db, pathAction(currentTenant, currentUID, actionId)), actionBody));

  // --- Append audit log ---
  await withRetry(() => push(ref(db, pathAudit(currentTenant, currentUID)), {
    device: deviceId,
    action: actionId,
    payload,
    trace,
    message: opts.meta?.message || "",
    ts: serverTimestamp(),
    tsClient: new Date().toISOString()
  }));

  console.log("Action dispatched:", actionId, payload);
  return { ok: true, actionId, deviceId, trace };
}

/**
 * Subscribe to live device status
 */
export function subscribeDeviceStatus(deviceId, callback) {
  if (!currentUID) return;
  const statusRef = ref(db, pathStatus(currentTenant, currentUID, deviceId));
  onValue(statusRef, (snap) => callback(snap.val()));
}

/**
 * Subscribe to KPI values (multi-tenant aware)
 */
export function subscribeKPI(tenant, deviceId, kpiPath, callback) {
  if (!currentUID) return;

  // KPIs are stored under /{tenant}/{uid}/kpi/{deviceId}/{kpiPath}
  const kpiRef = ref(db, `/${tenant}/${currentUID}/iot/kpi/${deviceId}/${kpiPath}`);
  onValue(kpiRef, (snap) => {
    callback(snap.exists() ? snap.val() : 0);
  });
}



/**
 * Subscribe to action logs
 */
export function subscribeActionLog(callback) {
  if (!currentUID) return;
  const logRef = ref(db, pathActions(currentTenant, currentUID));
  onValue(logRef, (snap) => callback(snap.val()));
}



// Return the current tenant and UID
export function getTenantContext() {
  return {
    uid: currentUID,
    tenant: currentTenant
  };
}













// import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
// import {
//   getDatabase, ref, push, set, onValue, serverTimestamp
// } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
// import {
//   getAuth, onAuthStateChanged
// } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// // ------------------------------
// // Firebase Init
// // ------------------------------
// // --- Firebase Config ---
// const firebaseConfig = {
//   apiKey: "AIzaSyB1Z1rd67bYtsBrpEUkcOzYO9HzHrDmtnY",
//   authDomain: "stanforis-iot.firebaseapp.com",
//   databaseURL: "https://stanforis-iot-default-rtdb.firebaseio.com",
//   projectId: "stanforis-iot",
//   storageBucket: "stanforis-iot.appspot.com",
//   messagingSenderId: "529674223964",
//   appId: "1:529674223964:web:2068cf5eb34e6372864199",
//   measurementId: "G-MBMF6KCJDF"
// };

// const app = initializeApp(firebaseConfig);
// const db = getDatabase(app);
// const auth = getAuth(app);

// // ------------------------------
// // Session
// // ------------------------------
// let currentUID = null;
// onAuthStateChanged(auth, (user) => {
//   if (user) {
//     currentUID = user.uid;
//     console.log("IoT Core bound to:", currentUID);
//   } else {
//     console.warn("No user signed in.");
//   }
// });

// // ------------------------------
// // Rate Limit & Retry
// // ------------------------------
// const RATE_LIMIT_MS = 500;  // prevent spamming same action too fast
// const MAX_RETRIES = 3;

// let lastActionTimestamps = {}; // { actionType: timestamp }

// // ------------------------------
// // Dispatcher
// // ------------------------------
// export async function dispatchAction(actionType, payload = {}) {
//   if (!currentUID) {
//     console.error("dispatchAction failed: user not authenticated.");
//     return;
//   }

//   // --- Rate limit check ---
//   const now = Date.now();
//   if (lastActionTimestamps[actionType] && now - lastActionTimestamps[actionType] < RATE_LIMIT_MS) {
//     console.warn(`Rate limited: ${actionType}`);
//     return;
//   }
//   lastActionTimestamps[actionType] = now;

//   // --- Build action payload ---
//   const actionRef = push(ref(db, `users/${currentUID}/iot/actions`));
//   const action = {
//     type: actionType,
//     payload,
//     timestamp: now,
//     serverTime: serverTimestamp(),
//     status: "pending"
//   };

//   // --- Retry loop ---
//   let attempt = 0;
//   while (attempt < MAX_RETRIES) {
//     try {
//       await set(actionRef, action);
//       console.log(`Action dispatched: ${actionType}`, payload);
//       return true;
//     } catch (err) {
//       attempt++;
//       console.warn(`Retry ${attempt}/${MAX_RETRIES} for ${actionType}`, err);
//       await new Promise(r => setTimeout(r, 200 * attempt)); // exponential backoff
//     }
//   }

//   console.error(`dispatchAction failed after ${MAX_RETRIES} retries: ${actionType}`);
//   return false;
// }

// // ------------------------------
// // Status Subscription
// // ------------------------------
// export function subscribeDeviceStatus(deviceId, callback) {
//   if (!currentUID) return;
//   const statusRef = ref(db, `users/${currentUID}/iot/devices/${deviceId}/status`);
//   onValue(statusRef, (snap) => {
//     callback(snap.val());
//   });
// }

// // ------------------------------
// // Action Log Subscription
// // ------------------------------
// export function subscribeActionLog(callback) {
//   if (!currentUID) return;
//   const logRef = ref(db, `users/${currentUID}/iot/actions`);
//   onValue(logRef, (snap) => {
//     callback(snap.val());
//   });
// }
