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

  getSnapshots() {
    try {
      if (!fs.existsSync(config.paths.historyDir)) {
        return [];
      }

      const deleted = new Set(db.get('deletedSnapshots') || []);
      const files = fs.readdirSync(config.paths.historyDir);
      const snapshots = files
        .filter(f => f.startsWith('snapshot_') && f.endsWith('.json') && !deleted.has(f))
        .map(f => {
          const fullPath = path.join(config.paths.historyDir, f);
          const stats = fs.statSync(fullPath);
          return {
            filename: f,
            createdAt: stats.birthtime || stats.mtime,
            sizeBytes: stats.size
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return snapshots;
    } catch (err) {
      logger.error('Error reading snapshots directory', err);
      return [];
    }
  }

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
      const fullPath = path.join(config.paths.historyDir, safeName);
      if (!fs.existsSync(fullPath)) {
        return null;
      }
      const raw = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      logger.error('Error reading snapshot content', err);
      throw err;
    }
  }

  deleteSnapshot(filename) {
    try {
      const safeName = path.basename(filename);
      if (!safeName.startsWith('snapshot_') || !safeName.endsWith('.json')) {
        throw new Error('Invalid snapshot filename');
      }
      const fullPath = path.join(config.paths.historyDir, safeName);
      
      // Always track in deletedSnapshots database collection
      const deletedList = db.get('deletedSnapshots') || [];
      if (!deletedList.includes(safeName)) {
        deletedList.push(safeName);
        db.set('deletedSnapshots', deletedList);
        db.save();
      }

      // Try physical unlink on disk if supported (local/container environments)
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (unlinkErr) {
        logger.warn(`Could not unlink snapshot file on disk (${unlinkErr.message}). Recorded in deletedSnapshots.`);
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
