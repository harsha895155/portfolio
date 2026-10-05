/**
 * AI Portfolio Agent REST API Controller
 * Exposes endpoints for chat, multi-modal analysis, audit, search, description generation,
 * and ChangeSet approval lifecycle.
 */

const aiAgentService = require('../services/aiAgentService');
const aiToolService = require('../services/aiToolService');
const aiAuditService = require('../services/aiAuditService');
const aiSearchService = require('../services/aiSearchService');
const aiDescriptionService = require('../services/aiDescriptionService');
const db = require('../../../infrastructure/database/db');
const responseHelper = require('../../../shared/utils/responseHelper');
const logger = require('../../../shared/utils/logger');

const aiController = {
  // 1. Chat & Multi-Modal Processing
  chat: async (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const message = req.body.message || '';
      const files = req.files || (req.file ? [req.file] : []);

      const result = await aiAgentService.processUserMessage({ message, files, user });
      return responseHelper.success(res, result, 'Message processed by AI Agent');
    } catch (err) {
      logger.error('Error in aiController.chat', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  // 2. Conversation History
  getConversations: (req, res) => {
    try {
      const history = db.getAiConversations();
      return responseHelper.success(res, history, 'Conversation history retrieved');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  clearConversations: (req, res) => {
    try {
      const cleared = db.clearAiConversations();
      return responseHelper.success(res, cleared, 'Conversation history cleared');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  // 3. ChangeSets
  getChangeSets: (req, res) => {
    try {
      const changeSets = db.getAiChangeSets();
      return responseHelper.success(res, changeSets, 'ChangeSets retrieved');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  getChangeSetById: (req, res) => {
    try {
      const cs = db.getAiChangeSet(req.params.id);
      if (!cs) return responseHelper.notFound(res, 'ChangeSet not found');
      return responseHelper.success(res, cs, 'ChangeSet retrieved');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  approveChangeSet: async (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const { selectedChangeIds } = req.body;
      const result = await aiToolService.approveChangeSet(req.params.id, selectedChangeIds, user);
      return responseHelper.success(res, result, 'ChangeSet approved and applied to draft');
    } catch (err) {
      logger.error('Error in approveChangeSet', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  rejectChangeSet: (req, res) => {
    try {
      const user = req.user ? req.user.username : 'admin';
      const { reason } = req.body;
      const result = aiToolService.rejectChangeSet(req.params.id, reason, user);
      return responseHelper.success(res, result, 'ChangeSet rejected');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  // 4. Portfolio Health Audit
  runAudit: (req, res) => {
    try {
      const audit = aiAuditService.runAudit();
      return responseHelper.success(res, audit, 'Portfolio audit completed');
    } catch (err) {
      logger.error('Error in runAudit', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  getLatestAudit: (req, res) => {
    try {
      const audit = db.getLatestAiAudit() || aiAuditService.runAudit();
      return responseHelper.success(res, audit, 'Latest audit retrieved');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  // 5. Natural Language Search
  search: async (req, res) => {
    try {
      const { query } = req.body;
      const result = await aiSearchService.search(query);
      return responseHelper.success(res, result, 'Search query executed');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  // 6. Description Generator / Enhancer
  generateDescription: async (req, res) => {
    try {
      const { text, type, style, context } = req.body;
      const result = await aiDescriptionService.generate({ text, type, style, context });
      return responseHelper.success(res, result, 'Description generated');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  // 7. Duplicate Detection
  findDuplicates: (req, res) => {
    try {
      const duplicates = aiToolService.findDuplicates();
      return responseHelper.success(res, duplicates, 'Duplicate check completed');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  // 8. Content Versions & History
  getContentVersions: (req, res) => {
    try {
      const versions = db.getContentVersions(req.query.entity || null);
      return responseHelper.success(res, versions, 'Content versions retrieved');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  }
};

module.exports = aiController;
