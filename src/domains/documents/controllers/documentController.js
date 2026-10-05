/**
 * Document Controller
 */

const fs = require('fs');
const path = require('path');
const config = require('../../../../config');
const documentService = require('../services/documentService');
const fileStorage = require('../../../infrastructure/storage/fileStorage');
const responseHelper = require('../../../shared/utils/responseHelper');
const logger = require('../../../shared/utils/logger');

function getMimeTypeFromExt(ext) {
  const e = (ext || '').toLowerCase();
  switch (e) {
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.txt': return 'text/plain';
    case '.doc': return 'application/msword';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: return 'application/octet-stream';
  }
}

function resolveFile(id) {
  if (!id) return null;
  const cleanId = String(id).trim();

  // 1. Check Document Service / DB record
  const doc = documentService.getDocument(cleanId);
  if (doc && doc.diskFilename) {
    const filePath = fileStorage.getFilePath(doc.diskFilename);
    if (filePath && fs.existsSync(filePath)) {
      return {
        filePath,
        originalName: doc.originalName || doc.diskFilename,
        mimeType: doc.mimeType || getMimeTypeFromExt(doc.ext || path.extname(doc.diskFilename))
      };
    }
  }

  // 2. Direct search in private storage directory
  const safeBase = path.basename(cleanId);
  const candidatePrivate = path.join(config.paths.storageDir, safeBase);
  if (fs.existsSync(candidatePrivate) && fs.statSync(candidatePrivate).isFile()) {
    const ext = path.extname(safeBase);
    return {
      filePath: candidatePrivate,
      originalName: safeBase,
      mimeType: getMimeTypeFromExt(ext)
    };
  }

  // 3. Search in media storage
  const mediaDir = path.resolve(config.paths.root, 'storage/media');
  const candidateMedia = path.join(mediaDir, safeBase);
  if (fs.existsSync(candidateMedia) && fs.statSync(candidateMedia).isFile()) {
    const ext = path.extname(safeBase);
    return {
      filePath: candidateMedia,
      originalName: safeBase,
      mimeType: getMimeTypeFromExt(ext)
    };
  }

  // 4. Search in project root (for certificates and resumes stored at root)
  const candidateRoot = path.join(config.paths.root, safeBase);
  if (fs.existsSync(candidateRoot) && fs.statSync(candidateRoot).isFile()) {
    const ext = path.extname(safeBase);
    return {
      filePath: candidateRoot,
      originalName: safeBase,
      mimeType: getMimeTypeFromExt(ext)
    };
  }

  // 5. Case-insensitive search in storageDir
  try {
    const files = fs.readdirSync(config.paths.storageDir);
    const match = files.find(f => f.toLowerCase() === safeBase.toLowerCase() || (doc && f === doc.diskFilename));
    if (match) {
      const matchPath = path.join(config.paths.storageDir, match);
      if (fs.statSync(matchPath).isFile()) {
        const ext = path.extname(match);
        return {
          filePath: matchPath,
          originalName: doc?.originalName || match,
          mimeType: doc?.mimeType || getMimeTypeFromExt(ext)
        };
      }
    }
  } catch (e) {}

  return null;
}

const documentController = {
  upload: async (req, res) => {
    try {
      if (!req.file) {
        return responseHelper.badRequest(res, 'No file was uploaded');
      }

      const category = req.body.category || 'Auto-Detect';
      const result = await documentService.processUpload(req.file, category);

      return responseHelper.success(res, result, 'Document uploaded and analyzed successfully', 201);
    } catch (err) {
      logger.error('Document upload failure', err);
      return responseHelper.error(res, err.message || 'File upload error');
    }
  },

  list: (req, res) => {
    try {
      const docs = documentService.getAllDocuments();
      return responseHelper.success(res, docs, 'Documents retrieved');
    } catch (err) {
      logger.error('Failed to list documents', err);
      return responseHelper.error(res, 'Could not retrieve documents');
    }
  },

  getById: (req, res) => {
    const doc = documentService.getDocument(req.params.id);
    if (!doc) {
      return responseHelper.notFound(res, 'Document not found');
    }
    return responseHelper.success(res, doc, 'Document found');
  },

  view: (req, res) => {
    const resolved = resolveFile(req.params.id);
    if (!resolved) {
      return responseHelper.notFound(res, 'Document file not found on disk');
    }

    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resolved.originalName)}"`);
    res.setHeader('Content-Type', resolved.mimeType);
    return res.sendFile(resolved.filePath);
  },

  download: (req, res) => {
    const resolved = resolveFile(req.params.id);
    if (!resolved) {
      return responseHelper.notFound(res, 'Document file not found on disk');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resolved.originalName)}"`);
    res.setHeader('Content-Type', resolved.mimeType);
    return res.sendFile(resolved.filePath);
  },

  delete: (req, res) => {
    const success = documentService.deleteDocument(req.params.id);
    if (!success) {
      return responseHelper.notFound(res, 'Document not found or could not be removed');
    }
    return responseHelper.success(res, null, 'Document removed successfully');
  }
};

module.exports = documentController;
