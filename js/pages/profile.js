// /js/profile.js
// Shared profile utilities for Stanforis apps

import { apiCall } from '/js/firebase.js';

const SESSION_KEY = "firebaseUser";
const DEFAULT_SECTOR = "other";

// --- Session ---
export function loadSessionUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

// --- Firestore path helper ---
function profilePathForUser(uid, sector) {
  return `/api/${sector}/${uid}/profile`;
}

// --- Profile loader (from Firestore, with fallback) ---
export async function loadUserProfile(user) {
  const uid = user.uid || user.localId || user.email;
  const trySectors = [
    user.sector,
    "residential",
    "company",
    "agriculture",
    "school",
    "other",
  ].filter(Boolean);

  for (const s of trySectors) {
    try {
      const profile = await apiCall.get(profilePathForUser(uid, s));
      if (profile) return profile;
    } catch {
      // keep trying
    }
  }

  // fallback if not found
  return {
    email: user.email || "",
    firstName: "",
    secondName: "",
    registrationType: DEFAULT_SECTOR,
  };
}

// --- Render helpers ---
export async function renderUserToUI(user, profile) {
  // Username
  const el = document.querySelector("#username");
  if (el) {
    const name = [profile.firstName, profile.secondName].filter(Boolean).join(" ");
    el.textContent = name || user.email || "Operator";
  }

  // Avatar
  const avatarEl = document.querySelector("#profileAvatar");
  if (avatarEl) {
    try {
      const uid = user.uid || user.localId || user.email;
      const savedBase64 = await apiCall.get(`/rtdb/users/${uid}/profile/avatar`);
      if (savedBase64) avatarEl.src = savedBase64;
    } catch {
      // fallback → default avatar already set in HTML
    }
  }
}
