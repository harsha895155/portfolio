/**
 * Multer File Upload Configuration
 */

const multer = require('multer');
const path = require('path');
const config = require('../../../config');

// Use memory storage so we can safely sanitize, inspect, and save via fileStorage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (config.uploads.allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not supported. Allowed formats: ${config.uploads.allowedExtensions.join(', ')}`));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: config.uploads.maxSizeBytes
  },
  fileFilter
});

module.exports = upload;
