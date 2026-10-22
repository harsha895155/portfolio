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

  async deleteDocument(id) {
    const doc = db.getDocument(id);
    const targetId = doc ? doc.id : id;

    // Delete disk file if present
    if (doc && doc.diskFilename) {
      try {
        fileStorage.deleteFile(doc.diskFilename);
      } catch (e) {
        logger.warn(`Could not remove file on disk: ${doc.diskFilename}`);
      }
    }

    // Remove from DB with guaranteed Supabase push
    const removed = await db.removeDocumentAsync(targetId);
    if (removed) {
      logger.info(`Removed document: ${removed.originalName || targetId} (${targetId})`);
      return true;
    }
    return false;
  }

  async batchDeleteDocuments(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return { count: 0 };
    for (const id of ids) {
      const doc = db.getDocument(id);
      if (doc && doc.diskFilename) {
        try {
          fileStorage.deleteFile(doc.diskFilename);
        } catch (_) {}
      }
    }

    const removed = await db.removeDocumentsBatchAsync(ids);
    logger.info(`Batch removed ${removed.length} documents from storage & Supabase`);
    return { count: removed.length, removed };
  }
}

module.exports = new DocumentService();
