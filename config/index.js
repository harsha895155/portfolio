/**
 * Application Configuration
 * Loads environment variables with safe defaults.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env if present
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  port: parseInt(process.env.PORT || '5000', 10),

  // Security
  auth: {
    secret: process.env.AUTH_SECRET || 'dev_secret_key_change_in_production_9988776655',
    sessionExpiry: process.env.SESSION_EXPIRY || '24h',
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'AdminSecure2026!',
    saltRounds: 10
  },

  // Paths
  paths: {
    root: path.resolve(__dirname, '..'),
    data: path.resolve(__dirname, '../data'),
    dbFile: path.resolve(__dirname, '../data/db.json'),
    historyDir: path.resolve(__dirname, '../data/history'),
    storageDir: path.resolve(__dirname, '../storage/private_documents'),
    publicDir: path.resolve(__dirname, '..'),
    profileJs: path.resolve(__dirname, '../profile.js'),
    indexHtml: path.resolve(__dirname, '../index.html')
  },

  // Upload limits
  uploads: {
    maxSizeBytes: (parseInt(process.env.MAX_FILE_SIZE_MB || '15', 10)) * 1024 * 1024,
    allowedExtensions: ['.pdf', '.txt', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp'],
    allowedMimeTypes: [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]
  },

  // Social Profile Sync
  social: {
    githubUsername: process.env.GITHUB_USERNAME || 'harsha895155',
    githubToken: process.env.GITHUB_TOKEN || '',
    linkedinUrl: process.env.LINKEDIN_URL || 'https://www.linkedin.com/in/harshavardhanreddy-280392298/',
    unstopUrl: process.env.UNSTOP_URL || '',
    credlyUrl: process.env.CREDLY_URL || 'https://www.credly.com/users/harsha10003/badges/credly'
  },

  // AI Portfolio Agent Configuration
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.AI_MODEL || 'gemini-1.5-flash',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.2')
  }
};

module.exports = config;
