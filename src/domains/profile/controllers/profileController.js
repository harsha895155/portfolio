/**
 * Profile Controller
 */

const profileService = require('../services/profileService');
const responseHelper = require('../../../shared/utils/responseHelper');
const logger = require('../../../shared/utils/logger');

const profileController = {
  // Public endpoint
  getPublished: (req, res) => {
    try {
      const data = profileService.getPublished();
      return responseHelper.success(res, data, 'Published profile fetched');
    } catch (err) {
      logger.error('Error fetching published profile', err);
      return responseHelper.error(res, 'Error fetching profile');
    }
  },

  // Private / Admin endpoints
  getDraft: (req, res) => {
    try {
      const data = profileService.getDraft();
      return responseHelper.success(res, data, 'Draft profile fetched');
    } catch (err) {
      logger.error('Error fetching draft profile', err);
      return responseHelper.error(res, 'Error fetching draft profile');
    }
  },

  updateDraft: (req, res) => {
    try {
      const updates = req.body;
      if (!updates || typeof updates !== 'object') {
        return responseHelper.badRequest(res, 'Invalid profile updates payload');
      }

      const updated = profileService.updateDraft(updates);
      return responseHelper.success(res, updated, 'Draft updated successfully');
    } catch (err) {
      logger.error('Error updating draft profile', err);
      return responseHelper.error(res, 'Error updating draft profile');
    }
  },

  publish: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const result = profileService.publishDraft(user);
      return responseHelper.success(res, result, 'Portfolio profile published successfully!');
    } catch (err) {
      logger.error('Error publishing profile', err);
      return responseHelper.error(res, err.message);
    }
  },

  rollback: (req, res) => {
    try {
      const { snapshotName } = req.body;
      if (!snapshotName) {
        return responseHelper.badRequest(res, 'Snapshot name required for rollback');
      }
      const user = req.user ? req.user.username : 'admin';
      const restored = profileService.rollback(snapshotName, user);
      return responseHelper.success(res, restored, `Successfully rolled back to ${snapshotName}`);
    } catch (err) {
      logger.error('Error during rollback', err);
      return responseHelper.badRequest(res, err.message);
    }
  }
};

module.exports = profileController;
