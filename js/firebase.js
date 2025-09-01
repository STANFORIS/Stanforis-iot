// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore, doc, collection,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getDatabase, ref, get, set, push,
  update, remove, onValue
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// --- Firebase Config ---
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
const fs = getFirestore(app);
const auth = getAuth(app);

//
// 🔹 Unified API-like wrapper
// --- Firebase Config setup above ---
// (same as your code)

export const apiCall = {

   db,         // include db as a property
  onValue,
  // --- Firestore helpers ---
  _fsPath: (path) => {
    const parts = path.split("/").filter(Boolean);

    // 🔹 Normalize resource roots (profile, settings, logs) → always a document
    const resourceRoots = ["profile", "settings", "logs"];
    if (resourceRoots.includes(parts[parts.length - 1])) {
      parts.push("main");
    }

    // 🔹 Devices/staff/etc: collection vs document
    return parts.length % 2 === 0
      ? doc(fs, ...parts)        // even segments → document
      : collection(fs, ...parts); // odd segments → collection
  },

  async _fsGet(path) {
    try {
      const base = this._fsPath(path);
      if (base.type === "document") {
        const snap = await getDoc(base);
        return snap.exists() ? snap.data() : null;
      } else {
        const snaps = await getDocs(base);
        return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.error("Firestore GET error:", err);
      throw err;
    }
  },

  async _fsPut(path, data) {
    try {
      await setDoc(this._fsPath(path), data, { merge: true });
      return { ok: true };
    } catch (err) {
      console.error("Firestore PUT error:", err);
      throw err;
    }
  },

  async _fsPost(path, data) {
    try {
      return await addDoc(this._fsPath(path), data);
    } catch (err) {
      console.error("Firestore POST error:", err);
      throw err;
    }
  },

  async _fsDelete(path) {
    try {
      await deleteDoc(this._fsPath(path));
      return { ok: true };
    } catch (err) {
      console.error("Firestore DELETE error:", err);
      throw err;
    }
  },

  // --- RTDB helpers ---
  async _rtdbGet(path) {
    try {
      const snap = await get(ref(db, path));
      return snap.exists() ? snap.val() : null;
    } catch (err) {
      console.error("RTDB GET error:", err);
      throw err;
    }
  },

  async _rtdbPut(path, data) {
    try {
      await set(ref(db, path), data);
      return { ok: true };
    } catch (err) {
      console.error("RTDB PUT error:", err);
      throw err;
    }
  },

  async _rtdbPost(path, data) {
    try {
      return await push(ref(db, path), data); // ✅ auto-id append
    } catch (err) {
      console.error("RTDB POST error:", err);
      throw err;
    }
  },

  async _rtdbDelete(path) {
    try {
      await remove(ref(db, path));
      return { ok: true };
    } catch (err) {
      console.error("RTDB DELETE error:", err);
      throw err;
    }
  },

  // --- Public API (REST-like) ---
  async get(path) {
    if (path.startsWith("/rtdb")) {
      return this._rtdbGet(path.replace("/rtdb/", ""));
    }
    return this._fsGet(path.replace("/api/", ""));
  },

  async put(path, data) {
    if (path.startsWith("/rtdb")) {
      return this._rtdbPut(path.replace("/rtdb/", ""), data);
    }
    return this._fsPut(path.replace("/api/", ""), data);
  },

  async post(path, data) {
    if (path.startsWith("/rtdb")) {
      return this._rtdbPost(path.replace("/rtdb/", ""), data);
    }
    return this._fsPost(path.replace("/api/", ""), data);
  },

  async delete(path) {
    if (path.startsWith("/rtdb")) {
      return this._rtdbDelete(path.replace("/rtdb/", ""));
    }
    return this._fsDelete(path.replace("/api/", ""));
  },

  // ✅ RTDB live subscription
  subscribe(path, cb) {
    if (!path.startsWith("/rtdb")) {
      throw new Error("Subscriptions only supported in RTDB");
    }
    return onValue(ref(db, path.replace("/rtdb/", "")), snap => cb(snap.val()));
  },

  // --- Auth ---
  async register(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  },
  async login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  async logout() {
    return signOut(auth);
  },





  

  //   // Example: get status of the 'power_Saving' button
  // const buttonState = await apiCall.get("/rtdb/dashboard_controls/leftrail-btns/power_Saving");
  // console.log(buttonState);
  // // { label: "🔋 Power Saving", status: "off", last_activated: null }

  // // Turn on the power saving button
  // await apiCall.put("/rtdb/dashboard_controls/leftrail-btns/power_Saving", {
  //   status: "on",
  //   last_activated: new Date().toISOString()
  // });

  // // Update UI automatically when a button changes
  // apiCall.subscribe("/rtdb/dashboard_controls/leftrail-btns/power_Saving", (data) => {
  //   console.log("Button updated:", data);
  //   // Update frontend tooltip/status accordingly
  // });

  // function toggleButton(side, action, newStatus) {
  //   const path = `/rtdb/dashboard_controls/${side}/${action}`;
  //   return apiCall.put(path, { status: newStatus, last_activated: new Date().toISOString() });
  // }

  // function getButtonState(side, action) {
  //   return apiCall.get(`/rtdb/dashboard_controls/${side}/${action}`);
  // }

};



// What this gives you

// /companies/{uid}/profile → auto rewrites → /companies/{uid}/profile/main ✅ document

// /companies/{uid}/settings → auto rewrites → /companies/{uid}/settings/main ✅ document

// /companies/{uid}/logs → auto rewrites → /companies/{uid}/logs/main ✅ document

// /companies/{uid}/devices → collection ✅

// /companies/{uid}/devices/{deviceId} → document ✅











// // ==========================
// // 🔥 Firebase SDK Imports
// // ==========================
// import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
// import { 
//   getDatabase, ref, get, set, update, remove, onValue 
// } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
// import { 
//   getFirestore, collection, getDocs, addDoc, doc, setDoc, deleteDoc, getDoc 
// } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
// import { 
//   getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
// } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// // ==========================
// // 🔧 Firebase Config
// // ==========================
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

// // ==========================
// // 🚀 Init Firebase Services
// // ==========================
// const app = initializeApp(firebaseConfig);
// const db = getDatabase(app);
// const fs = getFirestore(app);
// const auth = getAuth(app);

// // ==========================
// // 🌐 API Wrapper
// // ==========================
// window.apiCall = {

//   // --------------------------
//   // 🔐 AUTH
//   // --------------------------
//   login: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
//   logout: () => signOut(auth),
//   onAuth: (cb) => onAuthStateChanged(auth, cb),
//   createUser: async (email, pass) => { 
//     const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js"); 
//     return createUserWithEmailAndPassword(auth, email, pass); 
//   },

//   // --------------------------
//   // 📂 GENERIC FIRESTORE HELPERS
//   // --------------------------
//   _fsGet: async (pathArr) => {
//     const [sector, uid, resource, id] = pathArr;
//     let base = doc(fs, sector, uid);
//     if (resource) base = id ? doc(fs, sector, uid, resource, id) : collection(fs, sector, uid, resource);
//     const snap = (base.type === "document") ? await getDoc(base) : await getDocs(base);
//     return snap.docs ? snap.docs.map(d=>({id:d.id,...d.data()})) : (snap.exists() ? snap.data() : null);
//   },
//   _fsSet: (pathArr, data) => {
//     const [sector, uid, resource, id] = pathArr;
//     return setDoc(doc(fs, sector, uid, resource, id), data, { merge: true });
//   },
//   _fsAdd: (pathArr, data) => {
//     const [sector, uid, resource] = pathArr;
//     return addDoc(collection(fs, sector, uid, resource), data);
//   },
//   _fsDel: (pathArr) => {
//     const [sector, uid, resource, id] = pathArr;
//     return deleteDoc(doc(fs, sector, uid, resource, id));
//   },

//   // --------------------------
//   // ⚡ GENERIC RTDB HELPERS
//   // --------------------------
//   _rtdbGet: async (path) => (await get(ref(db, path))).val(),
//   _rtdbSet: (path, data) => set(ref(db, path), data),
//   _rtdbUpdate: (path, data) => update(ref(db, path), data),
//   _rtdbRemove: (path) => remove(ref(db, path)),
//   _rtdbSub: (path, cb) => onValue(ref(db, path), snap => cb(snap.val())),

//   // --------------------------
//   // 🌐 REST-LIKE ROUTER
//   // --------------------------
//   async get(path) {
//     if(path.startsWith("/rtdb/")) {
//       const p = path.replace("/rtdb/", "");
//       return this._rtdbGet(p);
//     } else {
//       return this._fsGet(path.split("/").filter(Boolean));
//     }
//   },

//   async post(path, data) {
//     if(path.startsWith("/rtdb/")) {
//       const p = path.replace("/rtdb/", "");
//       return this._rtdbSet(p, data);
//     } else {
//       return this._fsAdd(path.split("/").filter(Boolean), data);
//     }
//   },

//   async put(path, data) {
//     if(path.startsWith("/rtdb/")) {
//       const p = path.replace("/rtdb/", "");
//       return this._rtdbUpdate(p, data);
//     } else {
//       return this._fsSet(path.split("/").filter(Boolean), data);
//     }
//   },

//   async delete(path) {
//     if(path.startsWith("/rtdb/")) {
//       const p = path.replace("/rtdb/", "");
//       return this._rtdbRemove(p);
//     } else {
//       return this._fsDel(path.split("/").filter(Boolean));
//     }
//   },

//   subscribe(path, cb) {
//     if(path.startsWith("/rtdb/")) {
//       const p = path.replace("/rtdb/", "");
//       return this._rtdbSub(p, cb);
//     } else {
//       throw new Error("Firestore subscriptions not implemented");
//     }
//   }
// };

// console.log("🔥 Firebase REST-like API ready → use apiCall.get/post/put/delete()");
