// automation.js - skeleton logic for automation.html
// Handles: fetching, rendering, filtering, sorting, inspector, modal

import { apiCall } from "../firebase.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

(() => {
  const SESSION_KEY = "firebaseUser";
  const DEFAULT_SECTOR = "other";

  const loadSessionUser = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  };

  const profilePathForUser = (uid, sector) => `/api/${sector}/${uid}/profile`;

  async function loadUserProfile(user) {
    const uid = user.uid || user.localId || user.email;
    const trySectors = [user.sector, 'residential', 'company', 'agriculture', 'school', 'other'].filter(Boolean);

    for (const s of trySectors) {
      try {
        const profile = await apiCall.get(profilePathForUser(uid, s));
        if (profile) return profile;
      } catch { /* keep trying */ }
    }
    return { email: user.email, firstName: "", secondName: "", registrationType: DEFAULT_SECTOR };
  }

  async function renderProfile() {
    const user = loadSessionUser();
    if (!user) return;

    // Fetch Firestore profile
    const profile = await loadUserProfile(user);

    // Username
    const el = document.querySelector("#username");
    if (el) {
      const name = [profile.firstName, profile.secondName].filter(Boolean).join(" ");
      el.textContent = name || user.email || "Operator";
    }

    // Avatar
    const avatarEl = document.querySelector("#profileAvatar");
    if (!avatarEl) return;
    try {
      const uid = user.uid || user.localId || user.email;
      const savedBase64 = await apiCall.get(`/rtdb/users/${uid}/profile/avatar`);
      if (savedBase64) avatarEl.src = savedBase64;
    } catch { /* fallback: default */ }
  }

  document.addEventListener("DOMContentLoaded", renderProfile);
})();
