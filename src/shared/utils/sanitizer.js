/**
 * Sanitizer & Security Utilities
 */

const sanitizer = {
  escapeHtml: (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  sanitizeFilename: (filename) => {
    if (!filename) return 'unnamed_file';
    // Remove directory traversal characters and special symbols
    return filename
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\.\.+/g, '.')
      .trim();
  },

  cleanString: (str) => {
    if (!str) return '';
    return String(str).trim();
  }
};

module.exports = sanitizer;
