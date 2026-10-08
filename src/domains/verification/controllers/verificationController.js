/**
 * Verification REST API Controller
 * Endpoints for AI Certificate & Internship Verification,
 * Duplicate Prevention, Public Credential Checks, and Canonical Persistence.
 */

const certVerificationService = require('../services/certificateVerificationService');
const internshipVerificationService = require('../services/internshipVerificationService');
const db = require('../../../infrastructure/database/db');
const responseHelper = require('../../../shared/utils/responseHelper');
const logger = require('../../../shared/utils/logger');

const verificationController = {
  /**
   * 1. Verify Certificate PDF & Public URL
   */
  verifyCertificate: async (req, res) => {
    try {
      const file = req.file || (req.files && req.files['certificate'] ? req.files['certificate'][0] : (req.files && req.files[0]));
      if (!file) {
        return responseHelper.badRequest(res, 'Certificate PDF file is required');
      }

      const credentialUrl = req.body.credentialUrl || '';
      const adminUser = req.user ? req.user.username : 'admin';

      const result = await certVerificationService.runFullVerification({
        file,
        credentialUrl,
        adminUser
      });

      if (!result.success) {
        return res.status(409).json({
          success: false,
          status: result.status,
          verdict: result.verdict,
          message: result.message,
          duplicateInfo: result.duplicateInfo,
          fileHash: result.fileHash
        });
      }

      return responseHelper.success(res, result, 'Certificate analyzed and verified successfully');
    } catch (err) {
      logger.error('Error in verifyCertificate controller', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  /**
   * 2. Save & Approve Verified Certificate
   */
  saveVerifiedCertificate: async (req, res) => {
    try {
      const file = req.file || (req.files && req.files['certificate'] ? req.files['certificate'][0] : (req.files && req.files[0]));
      const formFields = typeof req.body.formFields === 'string'
        ? JSON.parse(req.body.formFields)
        : (req.body.formFields || req.body);
      const verificationReport = typeof req.body.verificationReport === 'string'
        ? JSON.parse(req.body.verificationReport)
        : req.body.verificationReport;

      const adminUser = req.user ? req.user.username : 'admin';

      const result = await certVerificationService.approveAndSaveCertificate({
        file,
        formFields,
        verificationReport,
        adminUser
      });

      return responseHelper.success(res, result, 'Verified certificate saved to draft portfolio');
    } catch (err) {
      logger.error('Error in saveVerifiedCertificate controller', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  /**
   * 3. Verify Internship Documents (Candidate ID + Offer Letter + Completion + Report)
   */
  verifyInternship: async (req, res) => {
    try {
      const candidateId = req.body.candidateId;
      if (!candidateId || !candidateId.trim()) {
        return responseHelper.badRequest(res, 'Candidate ID is required for internship verification');
      }

      const status = req.body.status || 'Completed';

      // Multer fields: offerLetter, completionCert, internshipReport
      const offerFile = (req.files && req.files['offerLetter']) ? req.files['offerLetter'][0] : null;
      const completionFile = (req.files && req.files['completionCert']) ? req.files['completionCert'][0] : null;
      const reportFile = (req.files && req.files['internshipReport']) ? req.files['internshipReport'][0] : null;

      if (!offerFile) {
        return responseHelper.badRequest(res, 'Internship Offer Letter PDF is required');
      }

      if (status === 'Completed' && (!completionFile || !reportFile)) {
        return responseHelper.badRequest(res, 'Both Internship Completion Certificate PDF and Internship Report PDF are required for Completed internships');
      }

      const adminUser = req.user ? req.user.username : 'admin';
      const currentEntityId = req.body.currentEntityId || req.body.id || null;

      const result = await internshipVerificationService.runFullVerification({
        candidateId,
        status,
        offerFile,
        completionFile,
        reportFile,
        adminUser,
        currentEntityId
      });

      if (!result.success) {
        return res.status(409).json({
          success: false,
          status: result.status,
          verdict: result.verdict,
          message: result.message,
          duplicateInfo: result.duplicateInfo
        });
      }

      return responseHelper.success(res, result, 'Internship documents verified and cross-checked');
    } catch (err) {
      logger.error('Error in verifyInternship controller', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  /**
   * 4. Save & Approve Verified Internship
   */
  saveVerifiedInternship: async (req, res) => {
    try {
      const formFields = typeof req.body.formFields === 'string'
        ? JSON.parse(req.body.formFields)
        : (req.body.formFields || req.body);
      const verificationReport = typeof req.body.verificationReport === 'string'
        ? JSON.parse(req.body.verificationReport)
        : req.body.verificationReport;

      const files = {
        offerLetter: (req.files && req.files['offerLetter']) ? req.files['offerLetter'][0] : null,
        completionCert: (req.files && req.files['completionCert']) ? req.files['completionCert'][0] : null,
        internshipReport: (req.files && req.files['internshipReport']) ? req.files['internshipReport'][0] : null
      };

      const adminUser = req.user ? req.user.username : 'admin';

      const result = await internshipVerificationService.approveAndSaveInternship({
        formFields,
        files,
        verificationReport,
        adminUser
      });

      return responseHelper.success(res, result, 'Verified internship saved to draft portfolio');
    } catch (err) {
      logger.error('Error in saveVerifiedInternship controller', err);
      return responseHelper.badRequest(res, err.message);
    }
  },

  /**
   * 5. List All Canonical Verified Records
   */
  listVerifiedRecords: (req, res) => {
    try {
      const records = db.getVerifiedRecords();
      return responseHelper.success(res, records, 'Verified records retrieved');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /**
   * 6. Retrieve Verification Audit Trail
   */
  getAuditLog: (req, res) => {
    try {
      const logs = db.getVerificationAuditLogs();
      return responseHelper.success(res, logs, 'Verification audit trail retrieved');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  },

  /**
   * 7. Auto-Extract Candidate ID from Uploaded Offer Letter
   */
  extractCandidateId: async (req, res) => {
    try {
      const file = req.file || (req.files && (req.files['offerLetter']?.[0] || req.files[0]));
      if (!file) {
        return responseHelper.badRequest(res, 'Offer letter file is required');
      }
      const data = await internshipVerificationService.extractOfferLetterData(file.buffer, file.originalname);
      const getVal = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v) || '';
      return responseHelper.success(res, {
        candidateId: getVal(data.candidateId),
        candidateName: getVal(data.candidateName),
        organization: getVal(data.organization),
        role: getVal(data.role)
      }, 'Candidate ID extracted successfully');
    } catch (err) {
      logger.error('Error in extractCandidateId controller', err);
      return responseHelper.badRequest(res, err.message);
    }
  }
};

module.exports = verificationController;
