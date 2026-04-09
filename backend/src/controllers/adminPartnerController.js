const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Roles allowed in PawSewa Partner app (vet_app). */
const PARTNER_APP_ROLE_KEYS = new Set([
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

/** Admin provisioning UI maps to these stored roles. */
const PROVISION_ROLE_ALIASES = {
  vet: 'veterinarian',
  veterinarian: 'veterinarian',
  shop_owner: 'shop_owner',
  rider: 'rider',
  petcare: 'care_service',
  care_service: 'care_service',
};

function normalizeProvisionRole(input) {
  const s = String(input || '')
    .trim()
    .toLowerCase();
  return PROVISION_ROLE_ALIASES[s] || s;
}

function listPartnerRoleFilter() {
  return { role: { $in: [...PARTNER_APP_ROLE_KEYS] } };
}

/**
 * GET /api/v1/admin/partners
 */
const adminListPartners = asyncHandler(async (req, res) => {
  const q = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const filter = listPartnerRoleFilter();
  if (q) {
    filter.$or = [
      { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ];
  }
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '80'), 10) || 80));
  const users = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.json({ success: true, data: users });
});

/**
 * POST /api/v1/admin/partners
 * Body: { name, email, password, role } — role: shop_owner | veterinarian | vet | rider | petcare | care_service
 */
const adminProvisionPartner = asyncHandler(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const emailRaw = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const password = req.body.password != null ? String(req.body.password) : '';
  const roleRaw = req.body.role != null ? String(req.body.role) : '';

  if (!name || !emailRaw || !password || !roleRaw) {
    res.status(400);
    throw new Error('Name, email, password, and role are required');
  }
  const email = emailRaw.toLowerCase();
  if (!EMAIL_RE.test(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }
  if (password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  const role = normalizeProvisionRole(roleRaw);
  if (!PARTNER_APP_ROLE_KEYS.has(role)) {
    res.status(400);
    throw new Error(
      `Invalid role for partner provisioning. Use: shop_owner, veterinarian (vet), rider, petcare (care_service), or other partner roles.`,
    );
  }

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error('An account with this email already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    isVerified: true,
    isAccountActive: true,
  });

  logger.info(`[INFO] New Partner Account provisioned by Admin: ${email}`);

  res.status(201).json({
    success: true,
    message: 'Partner account created',
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAccountActive: user.isAccountActive,
    },
  });
});

/**
 * PATCH /api/v1/admin/partners/:id/password
 * Body: { password }
 */
const adminResetPartnerPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const password = req.body.password != null ? String(req.body.password) : '';
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid user id');
  }
  if (password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }
  const filter = { _id: id, ...listPartnerRoleFilter() };
  const user = await User.findOne(filter);
  if (!user) {
    res.status(404);
    throw new Error('Partner user not found');
  }
  user.password = password;
  await user.save();
  logger.info(`[INFO] Partner password reset by admin for: ${user.email}`);
  res.json({ success: true, message: 'Password updated' });
});

/**
 * PATCH /api/v1/admin/partners/:id/active
 * Body: { isAccountActive: boolean }
 */
const adminSetPartnerAccountActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const active = req.body.isAccountActive;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid user id');
  }
  if (typeof active !== 'boolean') {
    res.status(400);
    throw new Error('isAccountActive (boolean) is required');
  }
  const filter = { _id: id, ...listPartnerRoleFilter() };
  const user = await User.findOneAndUpdate(
    filter,
    { $set: { isAccountActive: active } },
    { new: true },
  ).select('-password');
  if (!user) {
    res.status(404);
    throw new Error('Partner user not found');
  }
  logger.info(
    `[INFO] Partner account ${active ? 'activated' : 'deactivated'} by admin: ${user.email}`,
  );
  res.json({ success: true, data: user });
});

module.exports = {
  adminListPartners,
  adminProvisionPartner,
  adminResetPartnerPassword,
  adminSetPartnerAccountActive,
};
