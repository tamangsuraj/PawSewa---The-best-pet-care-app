const User = require('../models/User');
const Pet = require('../models/Pet');
const Order = require('../models/Order');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const { formatRoleLabel } = require('../utils/roleLabels');

/**
 * Exact email match + lightweight stats for admin support / discovery.
 */
async function lookupUserByEmailWithStats(email) {
  const normalized = String(email || '')
    .toLowerCase()
    .trim();
  if (!normalized) {
    const err = new Error('email query required (exact match)');
    err.statusCode = 400;
    throw err;
  }
  const user = await User.findOne({ email: normalized }).select('-password').lean();
  if (!user) {
    const err = new Error('No user with that email');
    err.statusCode = 404;
    throw err;
  }

  const uid = user._id;
  const role = user.role || '';
  const stats = {};

  if (role === 'pet_owner' || role === 'customer') {
    stats.petCount = await Pet.countDocuments({ owner: uid });
  }

  if (role === 'rider') {
    stats.deliveredOrderCount = await Order.countDocuments({
      assignedRider: uid,
      status: 'delivered',
    });
    stats.activeDeliveryCount = await Order.countDocuments({
      assignedRider: uid,
      status: { $in: ['pending', 'processing', 'out_for_delivery'] },
    });
  }

  if (role === 'veterinarian' || role === 'vet') {
    const joined = new Date(user.createdAt || Date.now());
    stats.yearsOnPlatform = Math.max(
      0,
      Math.floor((Date.now() - joined.getTime()) / (365.25 * 86400000))
    );
  }

  const conv = await MarketplaceConversation.findOne({ type: 'SUPPORT', customer: uid })
    .select('_id')
    .lean();
  const supportConversationId = conv?._id ? String(conv._id) : null;

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role,
      roleLabel: formatRoleLabel(role),
      phone: user.phone,
      profilePicture: user.profilePicture,
      clinicName: user.clinicName,
      specialization: user.specialization,
    },
    stats,
    supportConversationId,
  };
}

module.exports = { lookupUserByEmailWithStats };
