/**
 * History & Rollback Service
 * Provides access to audit records and rollback snapshots.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../../../config');
const db = require('../../../infrastructure/database/db');
const logger = require('../../../shared/utils/logger');

class HistoryService {
  getAuditLog(limit = 50) {
    const history = db.get('history') || [];
    return history.slice(0, limit);
  }

  /**
   * Returns list of candidate directories where snapshots can be stored.
   */
  getHistoryDirs() {
    const dirs = [];
    if (db.historyDir && !dirs.includes(db.historyDir)) {
      dirs.push(db.historyDir);
    }
    if (config.paths.historyDir && !dirs.includes(config.paths.historyDir)) {
      dirs.push(config.paths.historyDir);
    }
    return dirs;
  }

  /**
   * Retrieves all available backup snapshots across disk and database state.
   */
  getSnapshots() {
    try {
      const deleted = new Set(db.get('deletedSnapshots') || []);
      const snapshotMap = new Map();

      // 1. Scan filesystem directories (db.historyDir and config.paths.historyDir)
      for (const dir of this.getHistoryDirs()) {
        try {
          if (!fs.existsSync(dir)) continue;
          const files = fs.readdirSync(dir);
          for (const f of files) {
            if (!f.startsWith('snapshot_') || !f.endsWith('.json') || deleted.has(f)) {
              continue;
            }
            if (snapshotMap.has(f)) continue;

            const fullPath = path.join(dir, f);
            let stats = null;
            try {
              stats = fs.statSync(fullPath);
            } catch (_) {}

            // Extract millisecond timestamp from filename (snapshot_1792583849917.json) for 100% accurate time
            const match = f.match(/snapshot_(\d+)\.json/);
            const fileTs = match ? parseInt(match[1], 10) : null;
            const createdAt = (fileTs && !isNaN(fileTs))
              ? new Date(fileTs).toISOString()
              : ((stats && (stats.birthtime || stats.mtime)) ? new Date(stats.birthtime || stats.mtime).toISOString() : new Date().toISOString());

            snapshotMap.set(f, {
              filename: f,
              createdAt: createdAt,
              sizeBytes: stats ? stats.size : 0
            });
          }
        } catch (dirErr) {
          logger.warn(`Could not read snapshot directory ${dir}: ${dirErr.message}`);
        }
      }

      // 2. Also merge snapshots registered in database collection (for serverless persistence)
      const dbSnapshots = db.get('snapshots') || [];
      for (const item of dbSnapshots) {
        if (!item || !item.filename || deleted.has(item.filename)) continue;
        if (!snapshotMap.has(item.filename)) {
          const match = item.filename.match(/snapshot_(\d+)\.json/);
          const fileTs = match ? parseInt(match[1], 10) : null;
          const createdAt = item.createdAt || (fileTs ? new Date(fileTs).toISOString() : new Date().toISOString());
          snapshotMap.set(item.filename, {
            filename: item.filename,
            createdAt: createdAt,
            sizeBytes: item.sizeBytes || 0
          });
        }
      }

      // 3. Convert to array and sort descending by creation time (latest first)
      const snapshots = Array.from(snapshotMap.values()).sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return snapshots;
    } catch (err) {
      logger.error('Error reading snapshots directory', err);
      return [];
    }
  }

  /**
   * Retrieves content of a snapshot from disk or database collection.
   */
  getSnapshotContent(filename) {
    try {
      const safeName = path.basename(filename);
      if (!safeName.startsWith('snapshot_') || !safeName.endsWith('.json')) {
        throw new Error('Invalid snapshot filename');
      }
      const deleted = new Set(db.get('deletedSnapshots') || []);
      if (deleted.has(safeName)) {
        return null;
      }

      // 1. Try reading from filesystem directories
      for (const dir of this.getHistoryDirs()) {
        const fullPath = path.join(dir, safeName);
        if (fs.existsSync(fullPath)) {
          try {
            const raw = fs.readFileSync(fullPath, 'utf8');
            return JSON.parse(raw);
          } catch (readErr) {
            logger.warn(`Failed reading snapshot file at ${fullPath}: ${readErr.message}`);
          }
        }
      }

      // 2. Try reading from database snapshots collection
      const dbSnapshots = db.get('snapshots') || [];
      const found = dbSnapshots.find(s => s.filename === safeName);
      if (found && found.data) {
        return found.data;
      }

      return null;
    } catch (err) {
      logger.error('Error reading snapshot content', err);
      throw err;
    }
  }

  /**
   * Deletes a snapshot from disk and database records.
   */
  deleteSnapshot(filename) {
    try {
      const safeName = path.basename(filename);
      if (!safeName.startsWith('snapshot_') || !safeName.endsWith('.json')) {
        throw new Error('Invalid snapshot filename');
      }

      // 1. Track in deletedSnapshots database collection
      const deletedList = db.get('deletedSnapshots') || [];
      if (!deletedList.includes(safeName)) {
        deletedList.push(safeName);
        db.set('deletedSnapshots', deletedList);
      }

      // 2. Remove from database snapshots collection if present
      const dbSnapshots = db.get('snapshots') || [];
      const filteredSnapshots = dbSnapshots.filter(s => s.filename !== safeName);
      if (filteredSnapshots.length !== dbSnapshots.length) {
        db.set('snapshots', filteredSnapshots);
      }
      db.save();

      // 3. Try physical unlink on all candidate history directories
      for (const dir of this.getHistoryDirs()) {
        try {
          const fullPath = path.join(dir, safeName);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (unlinkErr) {
          logger.warn(`Could not unlink snapshot file on disk (${unlinkErr.message}). Recorded in deletedSnapshots.`);
        }
      }

      return true;
    } catch (err) {
      logger.error('Error deleting snapshot file', err);
      throw err;
    }
  }

  deleteSnapshots(filenames) {
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return { success: true, count: 0 };
    }
    let count = 0;
    const errors = [];
    for (const filename of filenames) {
      try {
        if (this.deleteSnapshot(filename)) {
          count++;
        }
      } catch (err) {
        errors.push({ filename, error: err.message });
      }
    }
    return { success: true, count, errors };
  }
}

module.exports = new HistoryService();
