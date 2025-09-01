
// www\js\pages\api\Final-cloud-iot-api.js

/**
 * IoT API v2 (Multi-Tenant)
 * ---------------------------------------
 * Supports tenants: residential, company, ngo, agriculture, school
 * 
 * Features:
 * - Device Registry
 * - Action Channel + Audit Logs
 * - KPI Tracking
 * - Rate Limiting + Retry
 * - Strong Validation
 * - Multi-Tenant Path Model
 * - Forward-compatible Action Dispatcher
 */

import { getDatabase, ref, set, update, get, onValue, push, serverTimestamp } from './exporter.js';

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

const nowIso = () => new Date().toISOString();

const traceId = (prefix = "tr") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function withRetry(fn, retries = 3, baseDelay = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await delay(baseDelay * Math.pow(2, i));
    }
  }
}

// ------------------------------------------------------------------
// Validation
// ------------------------------------------------------------------

function assertUid(uid) {
  if (!uid || typeof uid !== "string") throw new Error("IoTApi: invalid uid");
}

function assertTenant(tenant) {
  const allowed = ["residential", "company", "ngo", "agriculture", "school"];
  if (!allowed.includes(tenant)) {
    throw new Error(`IoTApi: invalid tenantType '${tenant}'`);
  }
}

function assertDeviceId(id) {
  if (!id || typeof id !== "string") throw new Error("IoTApi: invalid deviceId");
}

// Clamp number within range
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// ------------------------------------------------------------------
// Path Helpers (multi-tenant aware)
// ------------------------------------------------------------------

const basePath = (tenant, uid) => `/${tenant}/${uid}/iot`;

const pathDevices = (tenant, uid) => `${basePath(tenant, uid)}/devices`;
const pathDevice = (tenant, uid, deviceId) => `${pathDevices(tenant, uid)}/${deviceId}`;
const pathActions = (tenant, uid) => `${basePath(tenant, uid)}/actions`;
const pathAction = (tenant, uid, actionId) => `${pathActions(tenant, uid)}/${actionId}`;
const pathAudit = (tenant, uid) => `${basePath(tenant, uid)}/audit_logs`;
const pathStatus = (tenant, uid, deviceId) => `${basePath(tenant, uid)}/status/${deviceId}`;
const pathKpis = (tenant, uid) => `${basePath(tenant, uid)}/kpis`;

// ------------------------------------------------------------------
// Known Actions
// ------------------------------------------------------------------

const KNOWN_ACTIONS = [
  "power_Saving", "camera_Toggle", "sensor_Trigger", "home_Automation",
  "environment_Monitor", "service_Deploy", "security_Alert", "maintenance",
  "emergency", "lighting", "hvac", "access_Control", "energy_Monitor",
  "water_Monitor", "waste_Management", "transport_Control",
  "resource_Optimization", "fire_Alarm", "intrusion_Detection", "door_Lock",
  "window_Control", "appliance_Control", "vehicle_Tracking",
  "health_Monitor", "attendance", "production_Control",
  "irrigation_Control", "soil_Monitor", "crop_Monitor",
  "weather_Station", "education_Tool", "lab_Equipment",
  "library_System", "cafeteria_Management", "custom"
];

function warnUnknownAction(actionId) {
  if (!KNOWN_ACTIONS.includes(actionId)) {
    console.warn(`IoTApi: Unknown action '${actionId}' (forwarded anyway)`);
  }
}

// ------------------------------------------------------------------
// Rate Limiting
// ------------------------------------------------------------------

const actionRateMap = new Map();

function canSend(uid, deviceId, actionId, interval = 1000) {
  const key = `${uid}:${deviceId}:${actionId}`;
  const now = Date.now();
  const last = actionRateMap.get(key) || 0;
  if (now - last < interval) return false;
  actionRateMap.set(key, now);
  return true;
}

// ------------------------------------------------------------------
// IoT API Class
// ------------------------------------------------------------------

export class IoT {
  constructor(app) {
    this.db = getDatabase(app);
  }

  // ---------------- Devices ----------------

  async registerDevice(tenant, uid, deviceId, meta) {
    assertTenant(tenant); assertUid(uid); assertDeviceId(deviceId);
    const data = {
      name: "",
      type: "",
      location: "",
      ...meta,
      updatedAt: serverTimestamp(),
    };
    await withRetry(() => update(ref(this.db, pathDevice(tenant, uid, deviceId)), data));
    return { ok: true };
  }

  async listDevices(tenant, uid) {
    assertTenant(tenant); assertUid(uid);
    const snap = await withRetry(() => get(ref(this.db, pathDevices(tenant, uid))));
    return snap.exists() ? snap.val() : {};
  }

  onDevices(tenant, uid, cb) {
    assertTenant(tenant); assertUid(uid);
    const r = ref(this.db, pathDevices(tenant, uid));
    return onValue(r, (snap) => cb(snap.val() || {}));
  }

  // ---------------- Actions ----------------

  async sendAction(tenant, uid, deviceId, actionId, payload = {}, opts = {}) {
    assertTenant(tenant); assertUid(uid); assertDeviceId(deviceId);
    if (!actionId) throw new Error("IoTApi: actionId is required");
    warnUnknownAction(actionId);

    const trace = opts.traceId || traceId("act");
    if (!opts.force && !canSend(uid, deviceId, actionId)) {
      return { ok: false, skipped: true, reason: "rate_limited", actionId, deviceId, trace };
    }

    const actionBody = {
      deviceId,
      actionId,
      payload,
      meta: { ...opts.meta },
      ts: serverTimestamp(),
      tsClient: nowIso(),
      trace,
    };

    // Write action channel (last state)
    await withRetry(() => set(ref(this.db, pathAction(tenant, uid, actionId)), actionBody));

    // Append audit log
    await withRetry(() => push(ref(this.db, pathAudit(tenant, uid)), {
      device: deviceId,
      action: actionId,
      payload,
      trace,
      message: opts.meta?.message || "",
      ts: serverTimestamp(),
      tsClient: nowIso(),
    }));

    return { ok: true, actionId, deviceId, trace };
  }

  async batchSend(tenant, uid, deviceId, actions, opts = {}) {
    const results = [];
    for (const a of actions) {
      results.push(await this.sendAction(tenant, uid, deviceId, a.actionId, a.payload, opts));
    }
    return results;
  }

  onAction(tenant, uid, actionId, cb) {
    assertTenant(tenant); assertUid(uid);
    const r = ref(this.db, pathAction(tenant, uid, actionId));
    return onValue(r, (snap) => cb(snap.val() || null));
  }

  // ---------------- Status ----------------

  async updateStatus(tenant, uid, deviceId, status) {
    assertTenant(tenant); assertUid(uid); assertDeviceId(deviceId);
    const data = { ...status, ts: serverTimestamp(), tsClient: nowIso() };
    await withRetry(() => set(ref(this.db, pathStatus(tenant, uid, deviceId)), data));
    return { ok: true };
  }

  onStatus(tenant, uid, deviceId, cb) {
    assertTenant(tenant); assertUid(uid); assertDeviceId(deviceId);
    const r = ref(this.db, pathStatus(tenant, uid, deviceId));
    return onValue(r, (snap) => cb(snap.val() || {}));
  }

  // ---------------- Audit Logs ----------------

  async listAuditLogs(tenant, uid, limit = 50) {
    assertTenant(tenant); assertUid(uid);
    const snap = await withRetry(() => get(ref(this.db, pathAudit(tenant, uid))));
    if (!snap.exists()) return [];
    const logs = Object.values(snap.val());
    return logs
      .map((x) => ({ ...x }))
      .sort((a, b) => (a.tsNum || 0) - (b.tsNum || 0))
      .slice(-limit);
  }

  // ---------------- KPIs ----------------

  async setKpi(tenant, uid, key, value) {
    assertTenant(tenant); assertUid(uid);
    await withRetry(() => set(ref(this.db, `${pathKpis(tenant, uid)}/${key}`), {
      value,
      ts: serverTimestamp(),
    }));
    return { ok: true };
  }

  onKpis(tenant, uid, cb) {
    assertTenant(tenant); assertUid(uid);
    return onValue(ref(this.db, pathKpis(tenant, uid)), (snap) => cb(snap.val() || {}));
  }
}




// Improvements in this version:

// Fully multi-tenant aware (tenant, uid, deviceId everywhere).

// Centralized path helpers → no risk of duplication.

// Stronger validation for tenant, uid, and deviceId.

// Audit logs forward-compatible (trace, tsClient, serverTimestamp).

// Rate-limiting + retry system baked in.

// Batch actions supported.

// KPI tracking included.