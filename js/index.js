// ===============================
// Stanforis IoT Cordova Bootstrap
// ===============================

import { apiCall } from './firebase.js';

// -------------------------------
// Cordova deviceready bootstrap
// -------------------------------
document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
  console.log("📱 Cordova ready: " + cordova.platformId + "@" + cordova.version);

  // Mark UI ready (optional if you keep #deviceready element)
  const devicereadyEl = document.getElementById("deviceready");
  if (devicereadyEl) devicereadyEl.classList.add("ready");

  // Now start Stanforis app init
  startStanforis();
}

// -------------------------------
// Browser fallback (for dev mode)
// -------------------------------
if (!window.cordova) {
  console.log("🌐 Running in browser (no Cordova).");
  document.addEventListener("DOMContentLoaded", startStanforis);
}

// -------------------------------
// Stanforis startup logic
// -------------------------------
async function startStanforis() {
  console.log("🚀 Stanforis IoT starting...");

  toggleSplash(true);

  try {
    const userJson = localStorage.getItem("firebaseUser");
    const offlineUser = JSON.parse(localStorage.getItem("offlineUser") || "null");

    let user = null;
    // TODO: Add your auth/session restore logic here
    console.log("👤 User session:", userJson || offlineUser);

  } catch (err) {
    console.error("❌ Session check failed:", err);
  } finally {
    toggleSplash(false);
  }

  initStreamControls();
}

// --------------------------
// Splash screen toggle
// --------------------------
function toggleSplash(show) {
  const splash = document.getElementById("splash-screen");
  if (splash) splash.classList.toggle("hidden", !show);
}

// --------------------------
// ESP32-CAM stream toggle
// --------------------------
function initStreamControls() {
  const toggleBtn = document.getElementById("toggleStream");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const overlay = document.getElementById("streamOverlay");
    const img = document.getElementById("liveStream");
    if (!img || !overlay) return;

    if (!img.src) {
      img.src = "http://esp32-cam.local/stream";
      overlay.innerText = "Streaming...";
    } else {
      img.src = "";
      overlay.innerText = "Stream Offline";
    }
  });
}


























// // /js/index.js → Stanforis IoT startup for multi-page SPA
// import { apiCall } from './firebase.js';

// document.addEventListener("DOMContentLoaded", async () => {
//   console.log("🚀 Stanforis IoT starting...");

//   toggleSplash(true);

//   try {
//     const userJson = localStorage.getItem("firebaseUser");
//     const offlineUser = JSON.parse(localStorage.getItem("offlineUser") || "null");

//     let user = null;

//   } catch (err) {
//     console.error("❌ Session check failed:", err);
//   } finally {
//     toggleSplash(false);
//   }
// });

// // --------------------------
// // Splash screen toggle
// // --------------------------
// function toggleSplash(show) {
//   const splash = document.getElementById("splash-screen");
//   if (splash) splash.classList.toggle("hidden", !show);
// }

// // --------------------------
// // Optional ESP32-CAM stream toggle
// // --------------------------
// const toggleBtn = document.getElementById("toggleStream");
// if (toggleBtn) {
//   toggleBtn.addEventListener("click", () => {
//     const overlay = document.getElementById("streamOverlay");
//     const img = document.getElementById("liveStream");
//     if (!img || !overlay) return;

//     if (!img.src) {
//       img.src = "http://esp32-cam.local/stream";
//       overlay.innerText = "Streaming...";
//     } else {
//       img.src = "";
//       overlay.innerText = "Stream Offline";
//     }
//   });
// }
