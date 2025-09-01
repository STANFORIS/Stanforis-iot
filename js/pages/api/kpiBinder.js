
import { IoT } from "./Final-cloud-iot-api.js";
import { getTenantContext, iotCoreReady } from "./iotCore.js";

const kpiMap = {
  kpiDevices: "devices",
  kpiAlerts: "alerts",
  kpiAutomation: "automation",
  kpiContacts: "contacts",
  kpiEmergency: "emergency",
  kpiFamiliars: "familiars",
  kpiLogs: "logs",
  kpiNotifications: "notifications",
  kpiRegistration: "registration",
  kpiSettings: "settings",
  kpiSupport: "support",
  kpiAbout: "about"
};

function initKPIBinding() {
  const { tenant, uid } = getTenantContext();
  if (!tenant || !uid) {
    console.error("[KPI Binder] Tenant or UID not found.");
    return;
  }

  const iot = new IoT();

  iot.onKpis(tenant, uid, (allKpis) => {
    Object.entries(kpiMap).forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      const entry = allKpis?.[key];
      el.textContent = entry?.value ?? 0;
    });
  });
}

// ✅ Wait for Firebase auth to be ready
iotCoreReady.addEventListener("ready", initKPIBinding);

// Optional: export for manual calls
export const bindKPI = initKPIBinding;




// // www/js/pages/api/kpiBinder.js

// import { IoT } from "./Final-cloud-iot-api.js"; // IoT API v2
// import { getTenantContext, iotCoreReady } from "./iotCore.js"; // Returns { tenant, uid }

// // ----------------------------
// // KPI → Key Mapping
// // ----------------------------
// const kpiMap = {
//   kpiDevices: "devices",
//   kpiAlerts: "alerts",
//   kpiAutomation: "automation",
//   kpiContacts: "contacts",
//   kpiEmergency: "emergency",
//   kpiFamiliars: "familiars",
//   kpiLogs: "logs",
//   kpiNotifications: "notifications",
//   kpiRegistration: "registration",
//   kpiSettings: "settings",
//   kpiSupport: "support",
//   kpiAbout: "about"
// };

// // ----------------------------
// // KPI Binding
// // ----------------------------
// function initKPIBinding() {
//   const { tenant, uid } = getTenantContext();
//   if (!tenant || !uid) {
//     console.error("[KPI Binder] Tenant or UID not found.");
//     return;
//   }

//   const iot = new IoT();

//   // Subscribe to full KPI set
//   iot.onKpis(tenant, uid, (allKpis) => {
//     Object.entries(kpiMap).forEach(([elId, key]) => {
//       const el = document.getElementById(elId);
//       if (!el) return;
//       const entry = allKpis?.[key];
//       el.textContent = entry?.value ?? 0;
//     });
//   });
// }

// // ----------------------------
// // Auto-init after IoT Core ready
// // ----------------------------
// document.addEventListener("DOMContentLoaded", () => {
//   // Wait for iotCoreReady event (user auth ready)
//   iotCoreReady.addEventListener("ready", initKPIBinding);
// });
// // ----------------------------
// // Export
// // ----------------------------
// export const bindKPI = initKPIBinding;









// // kpiBinder.js
// import { db, auth } from './firebase.js';
// import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// // KPI element IDs
// const kpiElements = {
//   devices: document.getElementById('kpiDevices'),
//   alerts: document.getElementById('kpiAlerts'),
//   automation: document.getElementById('kpiAutomation'),
//   contacts: document.getElementById('kpiContacts'),
//   emergency: document.getElementById('kpiEmergency'),
//   familiars: document.getElementById('kpiFamiliars'),
//   logs: document.getElementById('kpiLogs'),
//   notifications: document.getElementById('kpiNotifications'),
//   registration: document.getElementById('kpiRegistration'),
//   settings: document.getElementById('kpiSettings'),
//   support: document.getElementById('kpiSupport'),
//   about: document.getElementById('kpiAbout')
// };

// // Listen for Auth state
// auth.onAuthStateChanged(user => {
//   if (!user) return; // Not logged in
//   const uid = user.uid;
//   const userKPIRef = ref(db, `users/${uid}/kpis`);

//   // Listen for changes in KPIs
//   onValue(userKPIRef, snapshot => {
//     const data = snapshot.val();
//     if (!data) return;

//     for (let key in kpiElements) {
//       if (data[key] !== undefined) {
//         kpiElements[key].textContent = data[key];
//       }
//     }
//   });
// });






// // import {  onValue, ref, apiCall } from "../../firebase.js"; //db,

// import { apiCall } from "./firebase.js";
// apiCall.db;
// apiCall.onValue;

// // Map card IDs to RTDB paths
// const kpiMap = {
//   kpiDevices: "devices/count",
//   kpiAlerts: "alerts/count",
//   kpiAutomation: "automation/count",
//   kpiContacts: "contacts/count",
//   kpiEmergency: "emergency/count",
//   kpiFamiliars: "familiars/count",
//   kpiLogs: "logs/count",
//   kpiNotifications: "notifications/count",
//   kpiRegistration: "registration/count",
//   kpiSettings: "settings/count",
//   kpiSupport: "support/count",
//   kpiAbout: "about/count"
// };

// export function bindKPI() {
//   Object.entries(kpiMap).forEach(([id, path]) => {
//     const el = document.getElementById(id);
//     if (!el) return;
//     onValue(ref(db, path), snap => {
//       el.textContent = snap.exists() ? snap.val() : 0;
//     });
//   });
// }
