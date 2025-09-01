// www/js/SyncManager.js

window.SyncManager = {
  _queue: {},
  _syncInterval: null,

  /**
   * Add record to in-memory queue
   */
  addToQueue(table, record) {
    if (!this._queue[table]) this._queue[table] = [];
    this._queue[table].push(record);
    console.log(`[SyncManager] Added to queue for ${table}:`, record);
  },

  /**
   * Enqueue record and trigger sync attempt
   */
  async enqueueAndSync(table, record) {
    this.addToQueue(table, record);
    try {
      await this.processQueue(); // try flush
    } catch (err) {
      console.warn("[SyncManager] enqueueAndSync failed, keeping in queue:", err);
    }
  },

  /**
   * Process all queued records (batching optional)
   */
  async processQueue(batchSize = 25) {
    for (const table in this._queue) {
      const batch = this._queue[table].splice(0, batchSize);

      if (batch.length) {
        console.log(`[SyncManager] Processing ${batch.length} records for table: ${table}`);

        for (const record of batch) {
          try {
            await FirebaseAdapter.push(table, record);
            await this.markAsSynced(table, record.id || record.log_id || record.device_id);
          } catch (err) {
            console.error(`[SyncManager] Failed to push ${table} record`, err);
            this.addToQueue(table, record); // retry later
          }
        }
      }
    }
    return true;
  },

  /**
   * Mark a record as synced in DB
   */
  markAsSynced(table, id) {
    return new Promise((resolve, reject) => {
      if (!id) return resolve(true); // nothing to mark

      DB.update(table, { synced: 1 }, { id }, (err) => {
        if (err) return reject(err);
        console.log(`[SyncManager] Marked ${table} id=${id} as synced`);
        resolve(true);
      });
    });
  },

  /**
   * Conflict resolution
   */
  async resolveConflict(table, record) {
    return new Promise((resolve, reject) => {
      DB.fetch(table, { id: record.id }, (err, rows) => {
        if (err) return reject(err);

        if (!rows.length) {
          // No local record → safe insert
          DB.insert(table, record, () => resolve(record));
        } else {
          const local = rows[0];
          const localTime = new Date(local.last_modified || 0);
          const remoteTime = new Date(record.last_modified || 0);

          if (remoteTime > localTime) {
            DB.update(table, record, { id: record.id }, () => {
              console.log(`Conflict resolved: ${table} id=${record.id} overwritten by remote`);
              resolve(record);
            });
          } else if (remoteTime < localTime) {
            this.addToQueue(table, local);
            console.log(`Conflict resolved: ${table} id=${record.id} kept local`);
            resolve(local);
          } else {
            resolve(local); // same timestamp → no action
          }
        }
      });
    });
  },

  /**
   * 🔄 Full Table Sync (remote → local)
   */
  async syncAllTables() {
    for (const table in FirebaseAdapter.mappings) {
      try {
        await FirebaseAdapter.syncTable(table);
      } catch (err) {
        console.warn(`[SyncManager] Sync failed for ${table}`, err);
      }
    }
  },

  /**
   * ⏳ Background sync loop
   */
  startBackgroundSync(intervalMs = 30000) {
    if (this._syncInterval) clearInterval(this._syncInterval);

    this._syncInterval = setInterval(async () => {
      try {
        console.log("[SyncManager] Background sync triggered");
        await this.processQueue();
        await this.syncAllTables();
      } catch (err) {
        console.error("[SyncManager] Background sync error", err);
      }
    }, intervalMs);

    console.log(`[SyncManager] Background sync started (every ${intervalMs / 1000}s)`);
  },

  stopBackgroundSync() {
    if (this._syncInterval) clearInterval(this._syncInterval);
    this._syncInterval = null;
    console.log("[SyncManager] Background sync stopped");
  }
};
