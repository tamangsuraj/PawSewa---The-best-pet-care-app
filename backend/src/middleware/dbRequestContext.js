const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Surfaces active MongoDB database on every HTTP response (header).
 * Optional verbose line logging when LOG_DB_EVERY_REQUEST=true.
 */
function dbRequestContext(req, res, next) {
  const db =
    mongoose.connection?.db?.databaseName ||
    mongoose.connection?.name ||
    '';
  if (db) {
    res.setHeader('X-PawSewa-Database', db);
  }
  if (process.env.LOG_DB_EVERY_REQUEST === 'true') {
    logger.debug('DB request:', req.method, req.originalUrl, 'db=', db || '(no connection)');
  }
  next();
}

module.exports = dbRequestContext;
