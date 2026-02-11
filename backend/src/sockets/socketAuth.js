const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }
    socket.user = user;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    return next(new Error('Not authorized: invalid token'));
  }
}

module.exports = { socketAuthMiddleware };
