/**
 * Admin Controller
 */

const approvalService = require('../services/approvalService');
const historyService = require('../services/historyService');
const db = require('../../../infrastructure/database/db');
const responseHelper = require('../../../shared/utils/responseHelper');
const logger = require('../../../shared/utils/logger');

const adminController = {
  getDashboardStats: (req, res) => {
    try {
      const published = db.get('published') || {};
      const pending = db.getPendingChanges() || [];
      const documents = db.get('documents') || [];
      const settings = db.get('settings') || {};

      const stats = {
        candidateName: published.name || 'Harshavardhan Reddy',
        projectsCount: (published.projects || []).length,
        certificationsCount: (published.certifications || []).length,
        experienceCount: (published.experience || []).length,
        documentsCount: documents.length,
        pendingChangesCount: pending.length,
        lastPublishedAt: settings.lastPublishedAt || null,
        publicUrl: (published.seo && published.seo.canonicalUrl) || 'https://harsha895155.github.io/portfolio/',
        status: pending.length > 0 ? 'Pending Updates' : 'Up to Date'
      };

      return responseHelper.success(res, stats, 'Dashboard statistics loaded');
    } catch (err) {
      logger.error('Error getting dashboard stats', err);
      return responseHelper.error(res, 'Failed to load dashboard metrics');
    }
  },

  getPendingChanges: (req, res) => {
    try {
      const pending = db.getPendingChanges();
      return responseHelper.success(res, pending, 'Pending changes retrieved');
    } catch (err) {
      logger.error('Error fetching pending changes', err);
      return responseHelper.error(res, 'Failed to fetch pending changes');
    }
  },

  approveChange: (req, res) => {
    try {
      const { id } = req.params;
      const { editOverrides } = req.body;
      const user = req.user ? req.user.username : 'admin';
      const result = approvalService.approveChange(id, editOverrides, user);
      return responseHelper.success(res, result, 'Change approved and merged to draft');
    } catch (err) {
      logger.error('Error approving change', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  rejectChange: (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = req.user ? req.user.username : 'admin';
      const result = approvalService.rejectChange(id, reason, user);
      return responseHelper.success(res, result, 'Change rejected');
    } catch (err) {
      logger.error('Error rejecting change', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  ignoreChange: (req, res) => {
    try {
      const { id } = req.params;
      const result = approvalService.ignoreChange(id);
      return responseHelper.success(res, result, 'Change marked as ignored');
    } catch (err) {
      logger.error('Error ignoring change', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  approveAll: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const results = approvalService.approveAll(user);
      return responseHelper.success(res, results, 'All pending changes approved');
    } catch (err) {
      logger.error('Error in approveAll', err);
      return responseHelper.error(res, 'Failed to approve all changes');
    }
  },

  rejectAll: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const results = approvalService.rejectAll(user);
      return responseHelper.success(res, results, 'All pending changes rejected');
    } catch (err) {
      logger.error('Error in rejectAll', err);
      return responseHelper.error(res, 'Failed to reject all changes');
    }
  },

  getAuditHistory: (req, res) => {
    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const history = historyService.getAuditLog(limit);
      const snapshots = historyService.getSnapshots();
      return responseHelper.success(res, { history, snapshots }, 'Audit history and snapshots');
    } catch (err) {
      logger.error('Error fetching history', err);
      return responseHelper.error(res, 'Failed to fetch audit history');
    }
  },

  getSnapshot: (req, res) => {
    try {
      const { filename } = req.params;
      const data = historyService.getSnapshotContent(filename);
      if (!data) {
        return responseHelper.notFound(res, 'Snapshot file not found');
      }
      return responseHelper.success(res, data, 'Snapshot retrieved successfully');
    } catch (err) {
      logger.error('Error retrieving snapshot content', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  createSnapshot: (req, res) => {
    try {
      const snapshotName = db.createBackupSnapshot();
      db.addHistory({
        field: 'manual_snapshot',
        oldValue: '—',
        newValue: snapshotName,
        source: 'Admin Instant Snapshot',
        status: 'Created',
        approvedBy: req.user ? req.user.username : 'admin'
      });
      return responseHelper.success(res, { filename: snapshotName }, `Snapshot ${snapshotName} created successfully`, 201);
    } catch (err) {
      logger.error('Error creating manual snapshot', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  deleteSnapshot: (req, res) => {
    try {
      const { filename } = req.params;
      const deleted = historyService.deleteSnapshot(filename);
      if (!deleted) {
        return responseHelper.notFound(res, 'Snapshot not found');
      }
      return responseHelper.success(res, { filename }, 'Snapshot deleted successfully');
    } catch (err) {
      logger.error('Error deleting snapshot', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  batchDeleteSnapshots: (req, res) => {
    try {
      const { filenames } = req.body;
      if (!Array.isArray(filenames) || filenames.length === 0) {
        return responseHelper.badRequest(res, 'Array of filenames is required');
      }
      const result = historyService.deleteSnapshots(filenames);
      return responseHelper.success(res, result, `Successfully deleted ${result.count} snapshots`);
    } catch (err) {
      logger.error('Error batch deleting snapshots', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  globalSearch: (req, res) => {
    try {
      const q = req.query.q || '';
      const adminSearchService = require('../services/adminSearchService');
      const results = adminSearchService.search(q);
      return responseHelper.success(res, results, 'Global search executed successfully');
    } catch (err) {
      logger.error('Error executing admin global search', err);
      return responseHelper.error(res, 'Global search failed: ' + err.message);
    }
  }
};

module.exports = adminController;
