/**
 * Multi-Platform Synchronization Service (Provider-Adapter Architecture)
 * Coordinates synchronization across all connected platforms using registered provider adapters.
 * Implements difference detection (Added, Changed, Removed, Unchanged), audit logging,
 * and preview capability for admin approval.
 */

const githubSyncService = require('./githubSyncService');
const linkVerifierService = require('./linkVerifierService');
const providerRegistry = require('./providers/providerRegistry');
const db = require('../../../infrastructure/database/db');
const logger = require('../../../shared/utils/logger');

class MultiPlatformSyncService {
  _resolvePlatform(id) {
    const published = db.get('published') || {};
    const links = published.socialLinks || {};
    const customPlatforms = published.customPlatforms || [];
    const config = require('../../../../config');

    const corePlatforms = {
      github: { name: 'GitHub', url: links.github || `https://github.com/${config.social.githubUsername}` },
      linkedin: { name: 'LinkedIn', url: links.linkedin || config.social.linkedinUrl || '' },
      credly: { name: 'Credly', url: links.credly || config.social.credlyUrl || 'https://www.credly.com/users/harsha10003/badges' },
      unstop: { name: 'Unstop', url: links.unstop || config.social.unstopUrl || '' },
      leetcode: { name: 'LeetCode', url: links.leetcode || '' },
      hackerrank: { name: 'HackerRank', url: links.hackerrank || '' },
      codeforces: { name: 'Codeforces', url: links.codeforces || '' },
      codechef: { name: 'CodeChef', url: links.codechef || '' },
      kaggle: { name: 'Kaggle', url: links.kaggle || '' }
    };

    if (corePlatforms[id]) return corePlatforms[id];

    const custom = customPlatforms.find(p => p.id === id);
    if (custom) return { name: custom.platform || custom.name, url: custom.url || links[id] || '' };

    return null;
  }

  /**
   * Compare previous platform state vs newly retrieved state to detect diffs
   */
  computeDiff(platformId, previousData, newData) {
    if (newData === undefined) {
      newData = previousData;
      previousData = platformId;
      platformId = 'platform';
    }

    const diff = {
      platformId,
      hasChanges: false,
      added: [],
      changed: [],
      removed: [],
      unchanged: []
    };

    if (!newData || typeof newData !== 'object') {
      return diff;
    }

    const prev = previousData || {};

    // Compare each key in new data
    for (const [key, newVal] of Object.entries(newData)) {
      if (newVal === null || newVal === undefined || newVal === '') continue;
      const oldVal = prev[key];

      if (oldVal === undefined || oldVal === null) {
        diff.added.push({
          field: key,
          label: this._formatFieldLabel(key),
          value: newVal
        });
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff.changed.push({
          field: key,
          label: this._formatFieldLabel(key),
          oldValue: oldVal,
          newValue: newVal
        });
      } else {
        diff.unchanged.push({
          field: key,
          label: this._formatFieldLabel(key),
          value: newVal
        });
      }
    }

    // Check for removed fields
    for (const [key, oldVal] of Object.entries(prev)) {
      if (oldVal !== null && oldVal !== undefined && (newData[key] === undefined || newData[key] === null)) {
        diff.removed.push({
          field: key,
          label: this._formatFieldLabel(key),
          oldValue: oldVal
        });
      }
    }

    diff.hasChanges = diff.added.length > 0 || diff.changed.length > 0 || diff.removed.length > 0;
    return diff;
  }

  _formatFieldLabel(key) {
    const labels = {
      totalSolved: 'Total Problems Solved',
      easySolved: 'Easy Problems Solved',
      mediumSolved: 'Medium Problems Solved',
      hardSolved: 'Hard Problems Solved',
      ranking: 'Global Ranking',
      acceptanceRate: 'Acceptance Rate',
      rating: 'Contest Rating',
      maxRating: 'Max Rating',
      rank: 'Global Rank',
      maxRank: 'Max Rank',
      followers: 'Followers',
      publicRepos: 'Public Repositories',
      badges: 'Badges & Stars',
      contribution: 'Contribution Points'
    };
    return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  /**
   * Synchronize an individual platform by ID
   */
  async syncPlatform(platformId) {
    const id = (platformId || '').toLowerCase().trim();
    const resolved = this._resolvePlatform(id);

    if (!resolved) throw new Error(`Platform with ID "${id}" was not found in your connected platforms.`);

    const { name: targetPlatform, url: targetUrl } = resolved;
    const startTime = Date.now();

    const settings = db.get('settings') || {};
    settings.platformOverrides = settings.platformOverrides || {};
    const priorOverride = settings.platformOverrides[id] || {};
    const previousProfileData = priorOverride.profileData || null;

    let syncResult = {
      id,
      platform: targetPlatform,
      url: targetUrl,
      success: false,
      timestamp: new Date().toISOString(),
      diff: { added: [], changed: [], removed: [], unchanged: [] }
    };

    try {
      if (id === 'github') {
        const ghResult = await githubSyncService.syncAndDetectNewRepositories();
        const latencyMs = Date.now() - startTime;

        const newProfileData = {
          publicRepos: ghResult.repositories ? ghResult.repositories.length : 0,
          newRepositoriesCount: ghResult.newDetectedProjects ? ghResult.newDetectedProjects.length : 0,
          repositories: (ghResult.repositories || []).slice(0, 10).map(r => ({
            name: r.name,
            stars: r.stargazers_count,
            forks: r.forks_count,
            language: r.language
          }))
        };

        const diff = this.computeDiff(id, previousProfileData, newProfileData);

        syncResult = {
          ...syncResult,
          success: ghResult.success,
          latencyMs,
          diff,
          message: ghResult.success
            ? `GitHub sync complete! Found ${ghResult.repositories.length} public repos (${ghResult.newDetectedProjects.length} new queued).`
            : ghResult.error || 'GitHub synchronization failed',
          profileData: newProfileData,
          data: ghResult
        };
      } else {
        const provider = providerRegistry.getProvider(id);

        if (provider && provider.supportsAutoSync && targetUrl) {
          const username = provider.extractUsername(targetUrl) || targetUrl;
          const fetchResult = await provider.fetchProfile(username);
          const latencyMs = Date.now() - startTime;

          const diff = this.computeDiff(id, previousProfileData, fetchResult.data);

          syncResult = {
            ...syncResult,
            success: fetchResult.success,
            latencyMs,
            supportsAutoSync: true,
            diff,
            message: fetchResult.success ? fetchResult.message : fetchResult.reason || `${targetPlatform} sync failed`,
            profileData: fetchResult.data || null,
            dataFields: provider.dataFields,
            data: fetchResult
          };
        } else if (provider && !provider.supportsAutoSync) {
          if (!targetUrl) {
            syncResult = {
              ...syncResult,
              success: false,
              latencyMs: 0,
              supportsAutoSync: false,
              message: `${targetPlatform} requires a URL to be configured. No public API is available for automated sync.`,
              note: provider._unavailable().reason
            };
          } else {
            const check = await linkVerifierService.verify(targetUrl, targetPlatform);
            const latencyMs = Date.now() - startTime;
            syncResult = {
              ...syncResult,
              success: check.verified,
              latencyMs,
              supportsAutoSync: false,
              message: check.verified
                ? `${targetPlatform} profile URL verified active (${latencyMs}ms). Note: ${provider._unavailable().reason}`
                : check.reason,
              note: provider._unavailable().reason,
              data: check
            };
          }
        } else {
          if (!targetUrl) {
            syncResult = {
              ...syncResult,
              success: false,
              latencyMs: 0,
              message: `${targetPlatform} has no URL configured yet.`
            };
          } else {
            const check = await linkVerifierService.verify(targetUrl, targetPlatform);
            const latencyMs = Date.now() - startTime;
            syncResult = {
              ...syncResult,
              success: check.verified,
              latencyMs,
              message: check.verified
                ? `${targetPlatform} verified active & reachable (${latencyMs}ms, HTTP ${check.httpStatus || 200}).`
                : check.reason,
              data: check
            };
          }
        }
      }

      // Persist platform override and latest data
      settings.platformOverrides[id] = {
        ...(settings.platformOverrides[id] || {}),
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: syncResult.success ? 'Active' : 'Error',
        lastSyncMessage: syncResult.message,
        latencyMs: syncResult.latencyMs || 0,
        profileData: syncResult.profileData || priorOverride.profileData || null,
        lastDiff: syncResult.diff || null
      };
      db.set('settings', settings);

      // Record audit history
      db.addHistory({
        field: `sync_${id}`,
        oldValue: priorOverride.lastSyncMessage || 'Prior sync',
        newValue: syncResult.message,
        source: 'Platform Sync Engine',
        status: syncResult.success ? 'Synchronized' : 'Sync Warning',
        approvedBy: 'admin'
      });

      logger.info(`Platform sync completed for ${id}: ${syncResult.message}`);
      return syncResult;

    } catch (err) {
      const latencyMs = Date.now() - startTime;
      logger.error(`Error syncing platform ${id}`, err);
      return {
        ...syncResult,
        success: false,
        latencyMs,
        message: `Sync error: ${err.message}`
      };
    }
  }

  /**
   * Synchronize all connected developer and coding platforms
   */
  async syncAllPlatforms() {
    const published = db.get('published') || {};
    const links = published.socialLinks || {};
    const customPlatforms = published.customPlatforms || [];
    const settings = db.get('settings') || {};
    const deletedPlatforms = (settings.deletedPlatforms || []).map(s => s.toLowerCase());

    const platformIds = [];
    const corePlatformKeys = ['github', 'credly', 'linkedin', 'unstop', 'leetcode', 'hackerrank', 'codeforces', 'codechef', 'kaggle'];
    for (const key of corePlatformKeys) {
      if (deletedPlatforms.includes(key)) continue;
      if (key === 'github' || links[key]) platformIds.push(key);
    }
    for (const cp of customPlatforms) {
      const cpId = cp.id.toLowerCase();
      if (!deletedPlatforms.includes(cpId) && !platformIds.includes(cpId)) platformIds.push(cp.id);
    }

    const results = await Promise.allSettled(platformIds.map(id => this.syncPlatform(id)));
    const mappedResults = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        id: platformIds[i],
        platform: platformIds[i],
        success: false,
        message: r.reason ? r.reason.message : 'Unknown sync failure',
        diff: { added: [], changed: [], removed: [], unchanged: [] }
      };
    });

    const successCount = mappedResults.filter(r => r.success).length;
    settings.lastSyncCheckAt = new Date().toISOString();
    db.set('settings', settings);

    logger.info(`Universal sync completed: ${successCount}/${mappedResults.length} platforms synchronized.`);
    return {
      success: true,
      totalCount: mappedResults.length,
      successCount,
      timestamp: settings.lastSyncCheckAt,
      platforms: mappedResults
    };
  }

  getProviderCapabilities() {
    return providerRegistry.listAll();
  }
}

module.exports = new MultiPlatformSyncService();
