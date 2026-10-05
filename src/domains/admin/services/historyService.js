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

      const files = fs.readdirSync(config.paths.historyDir);
      const snapshots = files
        .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
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
      if (!fs.existsSync(fullPath)) {
        return false;
      }
      fs.unlinkSync(fullPath);
      return true;
    } catch (err) {
      logger.error('Error deleting snapshot file', err);
      throw err;
    }
  }
}

module.exports = new HistoryService();
