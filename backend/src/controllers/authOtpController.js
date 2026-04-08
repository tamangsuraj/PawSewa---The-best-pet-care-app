const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { generateOTP, sendOTPEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PARTNER_ROLES = new Set([
  'veterinarian',
  'vet',
  'shop_owner',
  'care_service',
  'rider',
  'hostel_owner',
  'groomer',
  'trainer',
  'facility_owner',
  'service_provider',
]);

const CUSTOMER_ROLES = new Set(['pet_owner', 'customer']);

function normalizeRoleForResponse(r) {
  if (!r) return r;
  const s = String(r).trim();
  const u = s.toUpperCase();
  if (u === 'VET' || s === 'vet' || s === 'veterinarian') return 'veterinarian';
  if (['RIDER', 'rider', 'staff'].includes(s)) return 'rider';
  if (['ADMIN', 'admin'].includes(s)) return 'admin';
  if (u === 'CUSTOMER' || s === 'customer' || s === 'pet_owner') return 'pet_owner';
  return s;
}

function assertContextForExistingUser(user, appContext) {
  const role = String(user.role || '').toLowerCase();
  if (appContext === 'admin') {
    if (role !== 'admin') {
      const err = new Error('Access Denied: Admin only. This email is not an administrator.');
      err.statusCode = 403;
      throw err;
    }
    return;
  }
  if (appContext === 'partner') {
    if (!PARTNER_ROLES.has(role)) {
      const err = new Error(
        'This account is not a PawSewa Partner profile. Use the Customer app or Admin Panel.'
      );
      err.statusCode = 403;
      throw err;
    }
    return;
  }
  if (!CUSTOMER_ROLES.has(role)) {
    const err = new Error(
      'This is the customer sign-in. Use the PawSewa Partner app or Admin Panel for your account type.'
    );
    err.statusCode = 403;
    throw err;
  }
  if (!user.isVerified) {
    const err = new Error(
      'Please complete registration verification first (check your email), or use password login if you already verified.'
    );
    err.statusCode = 403;
    throw err;
  }
}

function loginPayload(user) {
  const token = generateToken(user._id);
  return {
    _id: user._id,
    name: user.name || user.full_name || user.email,
    email: user.email,
    role: normalizeRoleForResponse(user.role) || user.role,
    phone: user.phone,
    profilePicture: user.profilePicture || null,
    location: user.location,
    isVerified: user.isVerified,
    token,
  };
}

/**
 * POST /api/v1/auth/send-otp
 * Body: { email, appContext?: 'customer' | 'partner' | 'admin' }
 */
const sendLoginOtp = asyncHandler(async (req, res) => {
  const { email, appContext: rawCtx } = req.body || {};
  const appContext = ['customer', 'partner', 'admin'].includes(rawCtx) ? rawCtx : 'customer';

  // Fail fast when Mongo is unreachable; otherwise Mongoose can buffer and hang requests,
  // which looks like "loading forever" in mobile clients.
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message:
        'Server database is temporarily unavailable. Please try again in a moment.',
    });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  const emailNorm = email.toLowerCase().trim();

  const user = await User.findOne({
    email: new RegExp(`^${escapeRegex(emailNorm)}$`, 'i'),
  });

  if (!user) {
    const message =
      appContext === 'admin'
        ? 'Email not registered or this address is not an admin account.'
        : appContext === 'partner'
          ? 'Email not registered. Your administrator must create your Partner account first.'
          : 'Email not registered. Create an account on Register, then use a sign-in code.';
    return res.status(404).json({ success: false, message });
  }

  try {
    assertContextForExistingUser(user, appContext);
  } catch (e) {
    const code = e.statusCode || 403;
    return res.status(code).json({ success: false, message: e.message });
  }

  const otp = generateOTP();
  user.loginOtp = otp;
  user.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  try {
    await sendOTPEmail(user.email, user.name || 'there', otp);
    logger.info(`[auth/send-otp] code sent to ${user.email} context=${appContext}`);
  } catch (e) {
    logger.warn('[auth/send-otp] email failed:', e?.message || String(e));
    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;
    await user.save().catch(() => {});
    return res.status(503).json({
      success: false,
      message:
        'Could not send email. Configure EMAIL_USER and EMAIL_PASS (Gmail app password) on the server.',
    });
  }

  res.json({
    success: true,
    message: 'We sent a 6-digit code to your email. Enter it to sign in.',
  });
});

/**
 * POST /api/v1/auth/verify-otp
 * Body: { email, otp, appContext?: 'customer' | 'partner' | 'admin' }
 */
const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { email, otp, appContext: rawCtx } = req.body || {};
  const appContext = ['customer', 'partner', 'admin'].includes(rawCtx) ? rawCtx : 'customer';

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message:
        'Server database is temporarily unavailable. Please try again in a moment.',
    });
  }

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });
  }
  const emailNorm = email.toLowerCase().trim();
  const code = String(otp).trim();

  const user = await User.findOne({
    email: new RegExp(`^${escapeRegex(emailNorm)}$`, 'i'),
  }).select('+loginOtp +loginOtpExpires');

  if (!user || !user.loginOtp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP. Request a new sign-in code.',
    });
  }

  if (user.loginOtp !== code) {
    return res.status(400).json({ success: false, message: 'Invalid OTP.' });
  }

  if (!user.loginOtpExpires || user.loginOtpExpires.getTime() < Date.now()) {
    return res.status(400).json({
      success: false,
      message: 'Code expired. Request a new sign-in code.',
    });
  }

  try {
    assertContextForExistingUser(user, appContext);
  } catch (e) {
    const status = e.statusCode || 403;
    return res.status(status).json({ success: false, message: e.message });
  }

  user.loginOtp = undefined;
  user.loginOtpExpires = undefined;
  await user.save();

  const data = loginPayload(user);
  res.json({
    success: true,
    message: 'Signed in successfully',
    data,
  });
});

module.exports = {
  sendLoginOtp,
  verifyLoginOtp,
  normalizeRoleForResponse,
  assertContextForExistingUser,
};
