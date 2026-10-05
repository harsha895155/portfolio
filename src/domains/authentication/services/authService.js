/**
 * Authentication Service
 * Implements bcrypt password hashing and JWT token management.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../../../config');
const db = require('../../../infrastructure/database/db');
const logger = require('../../../shared/utils/logger');

class AuthService {
  async verifyCredentials(username, password) {
    const admin = db.get('admin');
    if (!admin || admin.username !== username) {
      return null;
    }

    const matches = await bcrypt.compare(password, admin.passwordHash);
    if (!matches) {
      return null;
    }

    return {
      username: admin.username,
      role: 'admin'
    };
  }

  generateToken(user) {
    return jwt.sign(
      { username: user.username, role: user.role },
      config.auth.secret,
      { expiresIn: config.auth.sessionExpiry }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.auth.secret);
    } catch (err) {
      return null;
    }
  }

  async changePassword(oldPassword, newPassword) {
    const admin = db.get('admin');
    const matches = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!matches) {
      throw new Error('Current password is incorrect');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    const salt = await bcrypt.genSalt(config.auth.saltRounds);
    const newHash = await bcrypt.hash(newPassword, salt);

    admin.passwordHash = newHash;
    admin.updatedAt = new Date().toISOString();
    db.set('admin', admin);

    db.addHistory({
      field: 'admin_password',
      oldValue: '***',
      newValue: '***',
      source: 'Admin Settings',
      status: 'Updated',
      approvedBy: admin.username
    });

    logger.info('Admin password updated successfully');
    return true;
  }
}

module.exports = new AuthService();
