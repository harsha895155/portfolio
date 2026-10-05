/**
 * Social Profiles Controller
 */

const githubSyncService = require('../services/githubSyncService');
const socialProfileService = require('../services/socialProfileService');
const multiPlatformSyncService = require('../services/multiPlatformSyncService');
const db = require('../../../infrastructure/database/db');
const responseHelper = require('../../../shared/utils/responseHelper');
const logger = require('../../../shared/utils/logger');

const socialController = {
  getStatus: (req, res) => {
    try {
      const status = socialProfileService.getPlatformsStatus();
      return responseHelper.success(res, status, 'Social profile integrations status');
    } catch (err) {
      logger.error('Error fetching social status', err);
      return responseHelper.error(res, 'Failed to fetch social integrations');
    }
  },

  getProviderCapabilities: (req, res) => {
    try {
      const capabilities = multiPlatformSyncService.getProviderCapabilities();
      return responseHelper.success(res, capabilities, 'Provider capabilities fetched');
    } catch (err) {
      logger.error('Error fetching provider capabilities', err);
      return responseHelper.error(res, 'Failed to fetch provider capabilities');
    }
  },

  syncGitHub: async (req, res) => {
    try {
      const result = await githubSyncService.syncAndDetectNewRepositories();
      if (!result.success) {
        return responseHelper.error(res, result.error || 'Failed to sync with GitHub API', 502);
      }
      return responseHelper.success(res, result, 'GitHub repositories checked successfully');
    } catch (err) {
      logger.error('Error during GitHub sync', err);
      return responseHelper.error(res, 'GitHub synchronization failed');
    }
  },

  importGitHubRepo: (req, res) => {
    try {
      const { repoName, description, technologies, githubUrl, liveDemo } = req.body;
      if (!repoName) {
        return responseHelper.badRequest(res, 'Repository name is required');
      }

      const draft = db.get('draft') || {};
      draft.projects = draft.projects || [];

      // Check if project exists
      const existingIdx = draft.projects.findIndex(p =>
        (p.github && p.github.toLowerCase() === (githubUrl || '').toLowerCase()) ||
        p.id === repoName.toLowerCase()
      );

      const projectData = {
        id: repoName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        title: repoName,
        tag: 'GitHub Project · Open Source',
        description: description || 'Open source software project hosted on GitHub.',
        technologies: Array.isArray(technologies) ? technologies : (technologies ? [technologies] : ['JavaScript']),
        bgClass: 'bg-pattern-2',
        featured: false,
        github: githubUrl || `https://github.com/harsha895155/${repoName}`,
        liveDemo: liveDemo || ''
      };

      if (existingIdx !== -1) {
        draft.projects[existingIdx] = { ...draft.projects[existingIdx], ...projectData };
      } else {
        draft.projects.push(projectData);
      }

      db.set('draft', draft);

      db.addHistory({
        field: 'projects',
        oldValue: 'None',
        newValue: `Added project: ${repoName}`,
        source: 'GitHub Import',
        status: 'Draft Updated',
        approvedBy: req.user ? req.user.username : 'admin'
      });

      logger.info(`Imported GitHub repository into draft projects: ${repoName}`);
      return responseHelper.success(res, projectData, `Project ${repoName} added to draft portfolio`);
    } catch (err) {
      logger.error('Error importing GitHub repo', err);
      return responseHelper.error(res, 'Could not import repository');
    }
  },

  updateLinks: (req, res) => {
    try {
      const links = req.body;
      if (!links || typeof links !== 'object') {
        return responseHelper.badRequest(res, 'Invalid links payload');
      }
      const user = req.user ? req.user.username : 'admin';
      const updated = socialProfileService.updateSocialLinks(links, user);
      return responseHelper.success(res, updated, 'Social links updated');
    } catch (err) {
      logger.error('Error updating social links', err);
      return responseHelper.error(res, 'Failed to update social links');
    }
  },

  verifyPlatformUrl: async (req, res) => {
    try {
      const { url, platform } = req.body;
      if (!url || !url.trim()) {
        return responseHelper.badRequest(res, 'URL is required for verification');
      }
      const result = await socialProfileService.verifyUrl(url.trim(), platform || '');
      return responseHelper.success(res, result, result.reason);
    } catch (err) {
      logger.error('Error verifying platform link', err);
      return responseHelper.error(res, 'Verification failed: ' + err.message);
    }
  },

  updatePlatform: async (req, res) => {
    try {
      const { id } = req.params;
      const { platform, url, syncMethod, status, icon, description } = req.body;
      if (!id) {
        return responseHelper.badRequest(res, 'Platform ID is required');
      }
      const user = req.user ? req.user.username : 'admin';
      const updated = await socialProfileService.updatePlatform(id, { platform, url, syncMethod, status, icon, description }, user);
      return responseHelper.success(res, updated, `Platform ${id} updated and verified successfully`);
    } catch (err) {
      logger.error('Error updating platform', err);
      return responseHelper.badRequest(res, err.message || 'Failed to update platform');
    }
  },

  addPlatform: async (req, res) => {
    try {
      const { name, url, syncMethod, icon, description } = req.body;
      if (!name || !name.trim()) {
        return responseHelper.badRequest(res, 'Platform or website name is required');
      }
      const user = req.user ? req.user.username : 'admin';
      const newPlatform = await socialProfileService.addPlatform({ name, url, syncMethod, icon, description }, user);
      return responseHelper.success(res, newPlatform, `Platform ${name} verified and linked successfully!`, 201);
    } catch (err) {
      logger.error('Error adding platform', err);
      return responseHelper.badRequest(res, err.message || 'Failed to add platform');
    }
  },

  removePlatform: (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return responseHelper.badRequest(res, 'Platform ID is required');
      }
      const user = req.user ? req.user.username : 'admin';
      const remaining = socialProfileService.removePlatform(id, user);
      return responseHelper.success(res, remaining, `Platform removed successfully`);
    } catch (err) {
      logger.error('Error removing platform', err);
      return responseHelper.error(res, err.message || 'Failed to remove platform');
    }
  },

  syncPlatform: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return responseHelper.badRequest(res, 'Platform ID is required');
      }
      const result = await multiPlatformSyncService.syncPlatform(id);
      return responseHelper.success(res, result, result.message);
    } catch (err) {
      logger.error('Error syncing platform', err);
      return responseHelper.error(res, 'Sync failed: ' + err.message);
    }
  },

  syncAllPlatforms: async (req, res) => {
    try {
      const result = await multiPlatformSyncService.syncAllPlatforms();
      return responseHelper.success(res, result, `Synchronized ${result.successCount} of ${result.totalCount} connected platforms.`);
    } catch (err) {
      logger.error('Error during universal platform sync', err);
      return responseHelper.error(res, 'Universal sync failed: ' + err.message);
    }
  }
};

module.exports = socialController;

