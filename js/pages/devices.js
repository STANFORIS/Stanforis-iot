// /js/pages/devices.js
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


const auth = getAuth();
let currentUser = null;
let deviceCache = [];
let filteredDevices = [];
let currentInspectorId = null;

// --- DOM Elements ---
const table = document.getElementById("deviceBody");
const tplRow = document.getElementById("tpl-row");
const addModal = document.getElementById("addModal");
const modalBackdrop = document.getElementById("modalBackdrop");

// --- Filters ---
const filters = { query:"", type:"", status:"", sort:"name" };
// --- PATHS ---
function devicePath(uid, id="") { return `/api/users/${uid}/devices${id?"/"+id:""}`; }
function rtdbPath(uid, id="") { return `/rtdb/users/${uid}/devices${id?"/"+id:""}`; }

// --- SAFE DOM UTILS ---
function setText(el, value){ if(el) el.textContent = value; }
function setValue(el, value){ if(el) el.value = value; }
function setChecked(el, value){ if(el) el.checked = value; }

// --- RENDER DEVICES ---
function renderDevices(devices){
  if(!table) return;
  table.innerHTML = "";

  if(!devices.length){
    table.innerHTML = `<tr><td colspan="9" class="p-4 text-neutral-500 text-center">No devices found</td></tr>`;
    return;
  }

  devices.forEach(d=>{
    if(tplRow){
      const row = tplRow.content.cloneNode(true);
      const rId = row.querySelector("[data-id]");
      if(rId) rId.dataset.id = d.id;

      setText(row.querySelector("[data-name]"), d.name);
      setText(row.querySelector("[data-type]"), d.type);
      setText(row.querySelector("[data-ip]"), d.ip || "-");
      setText(row.querySelector("[data-mac]"), d.mac || "-");
      setText(row.querySelector("[data-status]"), d.status || "offline");
      table.appendChild(row);
    }
  });
}

// --- FILTER & SORT ---
function applyFilters(){
  filteredDevices = deviceCache.filter(d=>{
    let matches = true;
    if(filters.type) matches = matches && d.type===filters.type;
    if(filters.status) matches = matches && d.status===filters.status;
    if(filters.query){
      const q = filters.query.toLowerCase();
      matches = matches && (
        (d.name?.toLowerCase().includes(q)) ||
        (d.ip?.includes(q)) ||
        (d.mac?.toLowerCase().includes(q))
      );
    }
    return matches;
  });

  filteredDevices.sort((a,b)=>{
    if(filters.sort==="lastSeen") return (b.lastSeen||0)-(a.lastSeen||0);
    return (a[filters.sort]||"").toString().localeCompare((b[filters.sort]||"").toString());
  });

  renderDevices(filteredDevices);
}

// --- CRUD + RTDB INTEGRATION ---
async function listDevices(){
  if(!currentUser) return;
  const fsDevices = await apiCall.get(devicePath(currentUser.uid));
  deviceCache = fsDevices.map(d=>({...d}));
  applyFilters();

  apiCall.subscribe(rtdbPath(currentUser.uid), snapshot=>{
    if(snapshot){
      Object.entries(snapshot).forEach(([id, rtData])=>{
        const idx = deviceCache.findIndex(d=>d.id===id);
        if(idx>=0) deviceCache[idx] = {...deviceCache[idx], ...rtData};
      });
      applyFilters();
    }
  });
}

async function addDevice(data){
  if(!currentUser) return;
  const ref = await apiCall.post(devicePath(currentUser.uid), data);
  const id = ref.id;
  await apiCall.put(rtdbPath(currentUser.uid, id), {status:"offline", lastSeen:Date.now(), sensors:{}});
  await listDevices();
}

async function updateDevice(id, data){
  if(!currentUser) return;
  await apiCall.put(devicePath(currentUser.uid, id), data);
  await apiCall.put(rtdbPath(currentUser.uid, id), data);
  await listDevices();
}

async function deleteDevice(id){
  if(!currentUser) return;
  await apiCall.delete(devicePath(currentUser.uid, id));
  await apiCall.delete(rtdbPath(currentUser.uid, id));
  await listDevices();
}

// --- EVENTS ---
function bindEvents(){
  if(!document.body) return;

  // Open Add Modal
  const openAdd = document.querySelector("[data-action='open-add']");
  if(openAdd) openAdd.onclick = ()=>{ addModal.classList.remove("hidden"); modalBackdrop.classList.remove("hidden"); };
  // Close modal
  document.querySelectorAll("[data-modal='close'],[data-modal='cancel']").forEach(btn=>{
    btn.onclick = ()=>{ addModal.classList.add("hidden"); modalBackdrop.classList.add("hidden"); };
  });

  // Submit Add
  const submitAdd = document.querySelector("[data-modal='submit-add']");
  if(submitAdd) submitAdd.onclick = async ()=>{
    const name = document.querySelector("[data-add='name']")?.value.trim();
    const type = document.querySelector("[data-add='type']")?.value;
    const ip = document.querySelector("[data-add='ip']")?.value.trim();
    const mac = document.querySelector("[data-add='mac']")?.value.trim();
    const status = document.querySelector("[data-add='status']")?.value || "offline";
    if(!name) return alert("Device name required");
    await addDevice({name,type,ip,mac});
    addModal.classList.add("hidden"); modalBackdrop.classList.add("hidden");
  };

  // Refresh
  const refresh = document.querySelector("[data-action='refresh']");
  if(refresh) refresh.onclick = listDevices;

  // Filters
  const qFilter = document.querySelector("[data-filter='query']");
  if(qFilter) qFilter.oninput = e=>{ filters.query = e.target.value; applyFilters(); };
  const typeFilter = document.querySelector("[data-filter='type']");
  if(typeFilter) typeFilter.onchange = e=>{ filters.type = e.target.value; applyFilters(); };
  const statusFilter = document.querySelector("[data-filter='status']");
  if(statusFilter) statusFilter.onchange = e=>{ filters.status = e.target.value; applyFilters(); };
  const sortSelect = document.querySelector("[data-sort]");
  if(sortSelect) sortSelect.onchange = e=>{ filters.sort = e.target.value; applyFilters(); };

  // Table actions
  if(table){
    table.addEventListener("click", async e=>{
      const btn = e.target.closest("[data-action]");
      if(!btn) return;
      const row = btn.closest("[data-id]");
      if(!row) return;
      const id = row.dataset.id;

      if(btn.dataset.action==="remove") if(confirm("Remove this device?")) await deleteDevice(id);
      if(btn.dataset.action==="toggle") { 
        const dev=deviceCache.find(d=>d.id===id); 
        if(dev) await updateDevice(id,{status:dev.status==="online"?"offline":"online",lastSeen:Date.now()}); 
      }
      if(btn.dataset.action==="edit") alert("TODO: open edit modal with fields prefilled.");
    });
  }
}

// --- AUTH GUARD ---
onAuthStateChanged(auth, user=>{
  if(user){ currentUser=user; listDevices(); bindEvents(); }
  else window.location.href="login.html";
});
