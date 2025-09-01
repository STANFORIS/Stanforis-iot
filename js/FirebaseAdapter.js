// www/js/FirebaseAdapter.js
// Maps SQLite tables to Firebase RealtimeDB + Firestore collections

window.FirebaseAdapter = {
  /** === 🔌 TABLE ↔ FIREBASE MAPPINGS === */
  mappings: {
    familiars: {
      type: "rtdb", // stored in RealtimeDB
      path: "familiars"
    },
    logs: {
      type: "firestore",
      collection: "logs"
    },
    configs: {
      type: "firestore",
      collection: "configs"
    },
    emergency_contacts: {
      type: "firestore",
      collection: "emergency_contacts"
    },
    device_status: {
      type: "rtdb",
      path: "device_status"
    }
  },

  /** === 🔄 PUSH LOCAL → REMOTE === */
  async push(table, record) {
    const map = this.mappings[table];
    if (!map) throw new Error(`No Firebase mapping for table: ${table}`);

    try {
      if (map.type === "rtdb") {
        const refPath = `${map.path}/${record.id || record.device_id}`;
        await window.apiCall.setRTDB(refPath, record);
      } else if (map.type === "firestore") {
        const col = map.collection;
        if (record.id) {
          await window.apiCall.updateDoc(col, record.id, record);
        } else {
          const newId = await window.apiCall.addDoc(col, record);
          record.id = newId; // backfill local id
        }
      }
      console.log(`[FirebaseAdapter] Pushed to ${table}:`, record);
      return true;
    } catch (err) {
      console.error(`[FirebaseAdapter] Failed to push ${table}`, err);
      throw err;
    }
  },

  /** === ⬇️ PULL REMOTE → LOCAL === */
  async pull(table) {
    const map = this.mappings[table];
    if (!map) throw new Error(`No Firebase mapping for table: ${table}`);

    try {
      let records = [];
      if (map.type === "rtdb") {
        const data = await window.apiCall.getRTDB(map.path);
        records = Object.keys(data || {}).map(id => ({ id, ...data[id] }));
      } else if (map.type === "firestore") {
        records = await window.apiCall.getCollection(map.collection);
      }
      console.log(`[FirebaseAdapter] Pulled ${records.length} records from ${table}`);
      return records;
    } catch (err) {
      console.error(`[FirebaseAdapter] Failed to pull ${table}`, err);
      throw err;
    }
  },

  /** === 🪄 SYNC LOGIC === */
  async syncTable(table) {
    const remoteRecords = await this.pull(table);

    for (const rec of remoteRecords) {
      await window.SyncManager.resolveConflict(table, rec);
    }
  }
};
