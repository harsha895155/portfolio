/**
 * Profile Management Service
 * Manages published vs draft state, publishing, and snapshots.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../../../config');
const db = require('../../../infrastructure/database/db');
const syncProfileService = require('./syncProfileService');
const logger = require('../../../shared/utils/logger');

class ProfileService {
  getPublished() {
    return db.get('published');
  }

  getDraft() {
    return db.get('draft');
  }

  updateDraft(updates) {
    const currentDraft = db.get('draft') || {};
    const updatedDraft = { ...currentDraft, ...updates };
    db.set('draft', updatedDraft);
    logger.info('Draft profile updated');
    return updatedDraft;
  }

  publishDraft(approvedBy = 'admin') {
    const draft = db.get('draft');
    if (!draft) {
      throw new Error('No draft data available to publish');
    }

    // 1. Create a rollback snapshot before overwriting
    const snapshotName = db.createBackupSnapshot();

    // 2. Overwrite published profile
    const cloned = JSON.parse(JSON.stringify(draft));
    db.set('published', cloned);

    // 3. Update settings
    const settings = db.get('settings') || {};
    settings.lastPublishedAt = new Date().toISOString();
    db.set('settings', settings);

    // 4. Synchronize profile.js and index.html
    syncProfileService.syncToFiles(cloned);

    // 5. Record audit trail
    db.addHistory({
      field: 'full_profile',
      oldValue: `Snapshot: ${snapshotName}`,
      newValue: 'Published Draft to Live Portfolio',
      source: 'Admin Publish Action',
      status: 'Published',
      approvedBy
    });

    logger.info(`Published draft profile live (Backup snapshot: ${snapshotName})`);
    return {
      published: cloned,
      snapshotName,
      publishedAt: settings.lastPublishedAt
    };
  }

  rollback(snapshotName, approvedBy = 'admin') {
    const snapshotPath = path.join(config.paths.historyDir, path.basename(snapshotName));
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(`Snapshot file ${snapshotName} does not exist`);
    }

    const raw = fs.readFileSync(snapshotPath, 'utf-8');
    const restoredProfile = JSON.parse(raw);

    // Save previous state as well
    const priorSnapshot = db.createBackupSnapshot();

    db.set('published', JSON.parse(JSON.stringify(restoredProfile)));
    db.set('draft', JSON.parse(JSON.stringify(restoredProfile)));

    syncProfileService.syncToFiles(restoredProfile);

    db.addHistory({
      field: 'full_profile_rollback',
      oldValue: `Prior snapshot: ${priorSnapshot}`,
      newValue: `Restored to snapshot: ${snapshotName}`,
      source: 'Admin Rollback Action',
      status: 'Restored',
      approvedBy
    });

    logger.info(`Rolled back portfolio to snapshot: ${snapshotName}`);
    return restoredProfile;
  }
}

module.exports = new ProfileService();
