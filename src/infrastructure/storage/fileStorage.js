/**
 * Private File Storage Infrastructure
 * Manages securely storing uploaded documents outside public static access.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const sanitizer = require('../../shared/utils/sanitizer');
const logger = require('../../shared/utils/logger');

class FileStorage {
  constructor() {
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.storageDir = isServerless ? '/tmp/storage/private_documents' : config.paths.storageDir;
    this.ensureDirectory();
  }

  ensureDirectory() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (e) {
      logger.warn('Could not create storage directory:', e.message);
    }
  }

  saveUploadedFile(file) {
    this.ensureDirectory();
    const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const cleanOriginalName = sanitizer.sanitizeFilename(file.originalname);
    const ext = path.extname(cleanOriginalName).toLowerCase();
    const diskFilename = `${id}${ext}`;
    const targetPath = path.join(this.storageDir, diskFilename);

    // If file was uploaded to temp disk path or memory buffer
    if (file.buffer) {
      fs.writeFileSync(targetPath, file.buffer);
    } else if (file.path && fs.existsSync(file.path)) {
      fs.copyFileSync(file.path, targetPath);
      try { fs.unlinkSync(file.path); } catch (e) {}
    } else {
      throw new Error('No valid file content provided');
    }

    const stats = fs.statSync(targetPath);

    logger.info(`Saved document securely: ${diskFilename} (${stats.size} bytes)`);

    return {
      id,
      diskFilename,
      originalName: cleanOriginalName,
      ext,
      mimeType: file.mimetype,
      sizeBytes: stats.size,
      absolutePath: targetPath,
      createdAt: new Date().toISOString()
    };
  }

  getFilePath(diskFilename) {
    const safeName = path.basename(diskFilename);
    const fullPath = path.join(this.storageDir, safeName);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fullPath;
  }

  deleteFile(diskFilename) {
    const fullPath = this.getFilePath(diskFilename);
    if (fullPath && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info(`Deleted document file: ${diskFilename}`);
      return true;
    }
    return false;
  }
}

const fileStorage = new FileStorage();
module.exports = fileStorage;
