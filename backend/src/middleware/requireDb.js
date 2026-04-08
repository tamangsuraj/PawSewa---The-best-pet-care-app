const mongoose = require('mongoose');

/**
 * Fast-fail middleware for routes that require MongoDB.
 * Prevents clients from waiting on Mongoose buffering when Atlas is unreachable.
 *
 * Allows health/test/ping endpoints to remain available for diagnostics.
 */
function requireDb(req, res, next) {
  const p = req.path || '';
  if (
    p === '/health' ||
    p === '/ping' ||
    p === '/test' ||
    p === '/status' ||
    p === '/test-db'
  ) {
    return next();
  }
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  return res.status(503).json({
    success: false,
    message:
      'Database is temporarily unavailable. Please try again in a moment.',
  });
}

module.exports = requireDb;

