/**
 * Server Entry Point
 */

const app = require('./app');
const config = require('../../config');
const logger = require('../shared/utils/logger');
const db = require('../infrastructure/database/db');

const server = app.listen(config.port, () => {
  logger.info(`Portfolio Application & Management Portal running on port ${config.port}`);
  logger.info(`Public Portfolio: http://localhost:${config.port}/`);
  logger.info(`Private Admin Portal: http://localhost:${config.port}/admin`);
  logger.info(`Environment: ${config.env}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Closing HTTP server cleanly.');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

module.exports = server;
