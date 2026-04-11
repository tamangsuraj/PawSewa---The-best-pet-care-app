const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { normalizeRole } = require('../middleware/authMiddleware');

/**
 * Socket.io authentication middleware.
 * Expects JWT in handshake.auth.token or handshake.headers.authorization (Bearer <token>).
 * Attaches user to socket and denies connection if invalid.
 */
async function socketAuthMiddleware(socket, next) {
  let token = null;

  if (socket.handshake.auth && typeof socket.handshake.auth.token === 'string') {
    token = socket.handshake.auth.token;
  }
  if (!token && socket.handshake.headers && socket.handshake.headers.authorization) {
    const auth = socket.handshake.headers.authorization;
    if (auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    }
  }

  if (!token || token === 'undefined' || token === 'null') {
    return next(new Error('Not authorized: no token'));
  }

  // Fast-fail if DB is unavailable to avoid misleading "invalid token" errors.
  if (mongoose.connection.readyState !== 1) {
    return next(new Error('Service unavailable: database reconnecting, please retry shortly'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }
    socket.user = user;
    if (socket.user.role) {
      socket.user.role = normalizeRole(socket.user.role);
    }
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    // Distinguish a driver/network error from a genuine bad token.
    const msg = err.message || '';
    if (
      msg.includes('ECONNREFUSED') ||
      msg.includes('topology') ||
      msg.includes('buffering') ||
      msg.includes('timed out') ||
      msg.includes('connect')
    ) {
      return next(new Error('Service unavailable: database error'));
    }
    return next(new Error('Not authorized: invalid token'));
  }
}

module.exports = { socketAuthMiddleware };
