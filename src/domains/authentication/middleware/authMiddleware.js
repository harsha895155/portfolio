/**
 * Authentication Middleware
 * Validates JWT tokens from Authorization header or httpOnly cookie.
 */

const authService = require('../services/authService');
const responseHelper = require('../../../shared/utils/responseHelper');

const requireAuth = (req, res, next) => {
  let token = null;

  // 1. Check Bearer Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Check Cookie
  if (!token && req.cookies && req.cookies.admin_token) {
    token = req.cookies.admin_token;
  }

  // 3. Check Query parameter (e.g. for opening/viewing documents in new tab or iframe)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return responseHelper.unauthorized(res, 'Authentication token required');
  }

  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return responseHelper.unauthorized(res, 'Invalid or expired session. Please log in again.');
  }

  req.user = decoded;
  next();
};

module.exports = {
  requireAuth
};
