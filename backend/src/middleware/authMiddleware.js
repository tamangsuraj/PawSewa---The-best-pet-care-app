const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

/**
 * Protect routes - Verify JWT token from Authorization header
 * Adds user object to req.user for use in protected routes
 */
const protect = async (req, res, next) => {
  let token;

  // Check if Authorization header exists and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token from "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // Check if token exists after split
      if (!token || token === 'undefined' || token === 'null') {
        res.status(401);
        throw new Error('Not authorized, invalid token format');
      }

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtError) {
        // Handle JWT-specific errors without logging JSON parse errors
        if (jwtError.name === 'JsonWebTokenError') {
          res.status(401);
          throw new Error('Not authorized, invalid token');
        } else if (jwtError.name === 'TokenExpiredError') {
          res.status(401);
          throw new Error('Not authorized, token expired');
        } else {
          res.status(401);
          throw new Error('Not authorized, token failed');
        }
      }

      // Get user from token (exclude password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401);
        throw new Error('User not found');
      }

      next();
    } catch (error) {
      // Only log if it's not a JWT error (already handled above)
      if (!error.message.includes('Not authorized')) {
        console.error('Token verification failed:', error.message);
      }
      res.status(401);
      
      // Re-throw the error for error handler
      throw error;
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
};

/**
 * Admin middleware - Check if user has admin role
 * Must be used after protect middleware
 *
 * Prefer using the more flexible authorize(...) helper for new routes,
 * but keep this for backward compatibility.
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as admin');
  }
};

/**
 * Admin or Shop Owner middleware - allows both 'admin' and 'shop_owner' roles.
 * Useful for shared management features like product catalogue.
 */
const adminOrShopOwner = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'shop_owner')) {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized (admin or shop owner required)');
  }
};

/**
 * Generic role-based authorization helper.
 * Usage: router.get('/admin', protect, authorize('admin'), handler)
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, user not found on request');
  }

  if (!roles.includes(req.user.role)) {
    res.status(403);
    throw new Error('Not authorized for this action');
  }

  next();
};

const PROVIDER_ROLES = ['hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner'];

/**
 * Block provider actions if their subscription is expired.
 * Use after protect + authorize(provider roles). Ensures only providers with
 * active subscription can list/manage services (User App only shows active listings).
 */
const verifyProviderSubscription = async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized');
  }
  if (!PROVIDER_ROLES.includes(req.user.role)) {
    return next();
  }
  if (req.user.role === 'admin') {
    return next();
  }
  const sub = await Subscription.findOne({
    providerId: req.user._id,
    status: 'active',
    validUntil: { $gt: new Date() },
  });
  if (!sub) {
    res.status(403);
    throw new Error('Active subscription required. Please subscribe to list your service.');
  }
  next();
};

module.exports = { protect, admin, adminOrShopOwner, authorize, verifyProviderSubscription };
