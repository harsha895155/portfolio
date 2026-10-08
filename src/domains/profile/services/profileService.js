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
    const cloned = JSON.parse(JSON.stringify(updatedDraft));
    db.set('published', cloned);
    try {
      syncProfileService.syncToFiles(cloned);
    } catch (e) {
      logger.warn(`Could not sync to profile.js/index.html: ${e.message}`);
    }
    logger.info('Draft profile updated and synchronized live to published profile');
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

    // 6. Background Git Sync if running with local git repo (updates GitHub Pages automatically)
    try {
      const { exec } = require('child_process');
      const gitCmd = 'git add profile.js data/db.json index.html && git commit -m "chore(publish): sync published portfolio" && git push origin main';
      exec(gitCmd, { cwd: config.paths.root }, (err, stdout, stderr) => {
        if (!err) {
          logger.info('[Git Auto-Sync] Successfully pushed published profile to GitHub');
        }
      });
    } catch (e) {}

    logger.info(`Published draft profile live (Backup snapshot: ${snapshotName})`);
    return {
      published: cloned,
      snapshotName,
      publishedAt: settings.lastPublishedAt
    };
  }

  rollback(snapshotName, approvedBy = 'admin') {
    const safeName = path.basename(snapshotName);
    const snapshotPath = path.join(config.paths.historyDir, safeName);
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(`Snapshot file ${snapshotName} does not exist`);
    }

    const raw = fs.readFileSync(snapshotPath, 'utf-8');
    const restoredProfile = JSON.parse(raw);

    // Save previous state as well
    let priorSnapshot = 'snapshot_pre_rollback';
    try {
      priorSnapshot = db.createBackupSnapshot();
    } catch (e) {
      logger.warn('Could not create backup snapshot prior to rollback:', e.message);
    }

    db.set('published', JSON.parse(JSON.stringify(restoredProfile)));
    db.set('draft', JSON.parse(JSON.stringify(restoredProfile)));

    try {
      syncProfileService.syncToFiles(restoredProfile);
    } catch (err) {
      logger.warn('Sync profile to files warning:', err.message);
    }

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
