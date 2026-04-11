const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Hostel = require('../models/Hostel');

/**
 * Protect routes - Verify JWT token from Authorization header
 * Adds user object to req.user for use in protected routes
 */
const protect = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer')) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  const token = auth.split(' ')[1]?.trim();
  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token format' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtError) {
    if (jwtError.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Not authorized, token expired' });
    }
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }

  if (user.role) {
    user.role = normalizeRole(user.role);
  }
  req.user = user;
  next();
});

/**
 * Admin middleware - Check if user has admin role
 * Must be used after protect middleware
 *
 * Prefer using the more flexible authorize(...) helper for new routes,
 * but keep this for backward compatibility.
 */
const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'ADMIN')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Not authorized as admin' });
};

/**
 * Admin or Shop Owner middleware - allows both 'admin' and 'shop_owner' roles.
 * Useful for shared management features like product catalogue.
 */
const adminOrShopOwner = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'shop_owner')) {
    return next();
  }
  return res
    .status(403)
    .json({ success: false, message: 'Not authorized (admin or shop owner required)' });
};

/**
 * Normalize role for authorization — must stay aligned with [User] model normalizeRole
 * so DB values like CARE_SERVICE / Service_Provider match authorize('care_service', …).
 */
function normalizeRole(role) {
  if (role == null) return role;
  const r = String(role).trim();
  if (!r) return r;
  const upper = r.toUpperCase();
  if (upper === 'CUSTOMER' || r === 'customer') return 'pet_owner';
  if (upper === 'VET' || r === 'vet') return 'veterinarian';
  if (upper === 'ADMIN') return 'admin';
  if (upper === 'RIDER' || r === 'staff') return 'rider';
  return r.toLowerCase();
}

/**
 * Generic role-based authorization helper.
 * Supports both lowercase (veterinarian, admin) and production (VET, ADMIN) roles.
 * Usage: router.get('/admin', protect, authorize('admin'), handler)
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized, user not found on request' });
  }

  const normalized = normalizeRole(req.user.role);
  if (!roles.includes(normalized)) {
    return res.status(403).json({ success: false, message: 'Not authorized for this action' });
  }

  next();
};

/**
 * Like [authorize] but also allows users who own at least one care centre listing,
 * so partner accounts with legacy/odd role strings still pass (incoming bookings, etc.).
 */
const authorizeCarePartnerOrListingOwner = (allowedRoles) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found on request' });
    }
    const normalized = normalizeRole(req.user.role);
    if (allowedRoles.includes(normalized)) {
      return next();
    }
    const hasListing = await Hostel.exists({ ownerId: req.user._id });
    if (hasListing) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Not authorized for this action' });
  });

const PROVIDER_ROLES = ['hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner'];

/**
 * Block provider actions if their subscription is expired.
 * Use after protect + authorize(provider roles). Ensures only providers with
 * active subscription can list/manage services (User App only shows active listings).
 */
const verifyProviderSubscription = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
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
    return res.status(403).json({
      success: false,
      message: 'Active subscription required. Please subscribe to list your service.',
    });
  }
  next();
});

/**
 * Attach req.user when a valid Bearer token is present; otherwise continue (no 401).
 * Use for optional personalization on public catalogue routes.
 */
const optionalAuth = async (req, res, next) => {
  req.user = null;
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return next();
    const token = auth.split(' ')[1];
    if (!token || token === 'undefined' || token === 'null') return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const u = await User.findById(decoded.id).select('-password');
    if (u) {
      req.user = u;
      if (req.user.role) req.user.role = normalizeRole(req.user.role);
    }
  } catch (_) {
    /* invalid/expired token — treat as anonymous */
  }
  next();
};

module.exports = {
  protect,
  optionalAuth,
  admin,
  adminOrShopOwner,
  authorize,
  authorizeCarePartnerOrListingOwner,
  verifyProviderSubscription,
  normalizeRole,
};
