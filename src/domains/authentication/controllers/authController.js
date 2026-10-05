/**
 * Authentication Controller
 */

const authService = require('../services/authService');
const responseHelper = require('../../../shared/utils/responseHelper');
const logger = require('../../../shared/utils/logger');

const authController = {
  login: async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return responseHelper.badRequest(res, 'Username and password are required');
      }

      const user = await authService.verifyCredentials(username, password);
      if (!user) {
        logger.warn(`Failed login attempt for user: ${username}`);
        return responseHelper.unauthorized(res, 'Invalid username or password');
      }

      const token = authService.generateToken(user);

      // Set secure cookie
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      logger.info(`Admin user logged in: ${username}`);
      return responseHelper.success(res, {
        token,
        user: { username: user.username, role: user.role }
      }, 'Login successful');
    } catch (err) {
      logger.error('Error during login', err);
      return responseHelper.error(res, 'Login processing error');
    }
  },

  logout: (req, res) => {
    res.clearCookie('admin_token');
    return responseHelper.success(res, null, 'Logged out successfully');
  },

  me: (req, res) => {
    return responseHelper.success(res, { user: req.user }, 'Session active');
  },

  changePassword: async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return responseHelper.badRequest(res, 'Both current and new passwords are required');
      }

      await authService.changePassword(oldPassword, newPassword);
      return responseHelper.success(res, null, 'Password changed successfully');
    } catch (err) {
      return responseHelper.badRequest(res, err.message);
    }
  }
};

module.exports = authController;
