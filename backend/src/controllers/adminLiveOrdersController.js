const asyncHandler = require('express-async-handler');
const CareBooking = require('../models/CareBooking');
const logger = require('../utils/logger');

const LIVE_CATEGORIES = ['Hostel', 'Grooming', 'Training'];
const PAST_STATUSES = ['completed', 'declined', 'rejected', 'cancelled'];

let liveOrdersModuleLogged = false;

function normalizeCategory(booking) {
  const st = booking.serviceType;
  if (st && LIVE_CATEGORIES.includes(st)) return st;
  const h = booking.hostelId;
  if (h && typeof h === 'object' && h.serviceType && LIVE_CATEGORIES.includes(h.serviceType)) {
    return h.serviceType;
  }
  return st || 'Hostel';
}

function centerNameFromBooking(booking) {
  const h = booking.hostelId;
  if (h && typeof h === 'object' && h.name) return String(h.name);
  return 'Unknown centre';
}

function displayStatusForLive(raw) {
  const s = raw || '';
  if (['awaiting_approval', 'pending', 'paid'].includes(s)) return 'Pending';
  if (['confirmed', 'checked_in', 'accepted'].includes(s)) return 'In-Progress';
  return s.replace(/_/g, ' ');
}

function displayStatusForPast(raw) {
  const s = raw || '';
  const map = {
    completed: 'Completed',
    cancelled: 'Cancelled',
    declined: 'Declined',
    rejected: 'Rejected',
  };
  return map[s] || s.replace(/_/g, ' ');
}

function petDetailsFromBooking(booking) {
  const p = booking.petId;
  if (!p || typeof p !== 'object') {
    return { name: 'Unknown', type: '—' };
  }
  return {
    name: p.name ? String(p.name) : 'Unknown',
    type: p.species ? String(p.species) : '—',
  };
}

/**
 * GET /api/v1/admin/live-orders?scope=live|past
 * Consolidated Grooming, Training, and Hostel care bookings (single CareBooking collection).
 */
const getAdminLiveOrders = asyncHandler(async (req, res) => {
  if (!liveOrdersModuleLogged) {
    liveOrdersModuleLogged = true;
    logger.success('Live Care Centers module initialized.');
  }
  logger.info('Consolidating Live Orders from 3 categories.');

  const scope = String(req.query.scope || 'live').toLowerCase();
  const isPast = scope === 'past';

  const filter = {
    serviceType: { $in: LIVE_CATEGORIES },
  };
  if (isPast) {
    filter.status = { $in: PAST_STATUSES };
  } else {
    filter.status = { $nin: PAST_STATUSES };
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    CareBooking.find(filter)
      .populate('hostelId', 'name location serviceType')
      .populate('petId', 'name species breed age')
      .populate('userId', 'name email phone')
      .populate('assignedPartner', 'name email phone role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CareBooking.countDocuments(filter),
  ]);

  const data = rows.map((b) => {
    const category = normalizeCategory(b);
    const centerName = centerNameFromBooking(b);
    const petDetails = petDetailsFromBooking(b);
    const rawStatus = b.status || '';
    const status = isPast ? displayStatusForPast(rawStatus) : displayStatusForLive(rawStatus);

    return {
      _id: b._id,
      category,
      centerName,
      status,
      rawStatus,
      petDetails,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      totalAmount: b.totalAmount,
      paymentStatus: b.paymentStatus,
      serviceType: b.serviceType,
      careAssignmentStatus: b.careAssignmentStatus,
      hostelId: b.hostelId,
      petId: b.petId,
      userId: b.userId,
      assignedPartner: b.assignedPartner,
      createdAt: b.createdAt,
    };
  });

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

module.exports = {
  getAdminLiveOrders,
};
