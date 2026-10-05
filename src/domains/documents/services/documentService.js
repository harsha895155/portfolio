/**
 * Document Management Service
 */

const fileStorage = require('../../../infrastructure/storage/fileStorage');
const documentExtractor = require('../processors/documentExtractor');
const diffEngine = require('../processors/diffEngine');
const db = require('../../../infrastructure/database/db');
const logger = require('../../../shared/utils/logger');

class DocumentService {
  async processUpload(file, manualCategory = 'Auto-Detect') {
    // 1. Save file securely to private storage
    const stored = fileStorage.saveUploadedFile(file);

    // 2. Extract information
    const extractionResult = await documentExtractor.extract(stored.absolutePath, stored.ext);

    // Override doc type if manually provided
    if (manualCategory && manualCategory !== 'Auto-Detect') {
      extractionResult.docType = manualCategory;
    }

    // 3. Save document record in DB
    const docRecord = {
      id: stored.id,
      diskFilename: stored.diskFilename,
      originalName: stored.originalName,
      ext: stored.ext,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      docType: extractionResult.docType,
      status: extractionResult.success ? 'Processed' : 'Error',
      snippet: extractionResult.textSnippet || '',
      extractedData: extractionResult.extracted || {},
      uploadedAt: new Date().toISOString()
    };

    db.addDocument(docRecord);

    // 4. Compare with current published profile to detect changes
    const currentProfile = db.get('published') || {};
    const detectedChanges = diffEngine.compareDocumentToProfile(extractionResult, currentProfile, docRecord);

    // 5. Store pending changes for admin review
    const savedChanges = [];
    for (const change of detectedChanges) {
      const saved = db.addPendingChange(change);
      savedChanges.push(saved);
    }

    logger.info(`Document processed: ${stored.originalName}. ${savedChanges.length} changes queued for review.`);

    return {
      document: docRecord,
      extraction: extractionResult,
      detectedChanges: savedChanges
    };
  }

  getAllDocuments() {
    return db.get('documents') || [];
  }

  getDocument(id) {
    return db.getDocument(id);
  }

  deleteDocument(id) {
    const doc = db.getDocument(id);
    if (!doc) return false;

    // Delete disk file
    fileStorage.deleteFile(doc.diskFilename);

    // Remove from DB
    db.removeDocument(id);
    logger.info(`Removed document: ${doc.originalName} (${id})`);
    return true;
  }
}

module.exports = new DocumentService();
