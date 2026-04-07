const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { assignServiceRequest } = require('../controllers/serviceRequestController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { isKhaltiConfigured, getKhaltiMode } = require('../config/payment_config');
const StaffLocation = require('../models/StaffLocation');
const ServiceRequest = require('../models/ServiceRequest');
const CareRequest = require('../models/CareRequest');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const PaymentLog = require('../models/PaymentLog');
const CareBooking = require('../models/CareBooking');
const Hostel = require('../models/Hostel');
const LiveLocation = require('../models/LiveLocation');
const User = require('../models/User');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const MarketplaceMessage = require('../models/MarketplaceMessage');
const ShopChat = require('../models/ShopChat');
const {
  adminAssignCarePartner,
  adminCareBookingCancel,
  adminCareBookingReassignCentre,
  adminGetCareBookingChat,
} = require('../controllers/careBookingController');
const {
  ensureDefaultCustomerCareConversation,
  toClientConversationShape,
} = require('../services/customerCareService');
const { formatRoleLabel } = require('../utils/roleLabels');
const { findUserByEmail } = require('../controllers/chatController');
const CallSession = require('../models/CallSession');
const { normalizeRole } = require('../middleware/authMiddleware');

const DISPATCH_RIDER_ROLES = ['rider'];
const DISPATCH_SELLER_ROLES = ['shop_owner'];
const DISPATCH_CARE_ROLES = [
  'veterinarian',
  'vet',
  'groomer',
  'trainer',
  'hostel_owner',
  'care_service',
  'service_provider',
  'facility_owner',
];

// Admin dispatcher routes
// Mirror of PATCH /api/v1/service-requests/:id/assign, but namespaced for admin
// RBAC: Only admins can assign requests via this namespace.
router.patch('/requests/:id/assign', protect, authorize('admin'), assignServiceRequest);

// Global live map data for admin dashboard:
// - All active staff (vets, riders, etc.) with recent (TTL-backed) locations
// - All pending/assigned customer service request pins
// - All active Care+ requests (blue paw pins)
router.get('/live-map', protect, authorize('admin'), async (req, res, next) => {
  try {
    const [
      staffLocations,
      usersWithLiveLocation,
      pendingRequests,
      careRequests,
      productOrders,
      careBookings,
      livePins,
    ] = await Promise.all([
        StaffLocation.find({}).populate('staff', 'name role phone'),
        User.find({
          role: { $in: ['veterinarian', 'vet', 'VET', 'rider', 'RIDER', 'staff'] },
          'liveLocation.coordinates.lat': { $exists: true, $ne: null },
          'liveLocation.coordinates.lng': { $exists: true, $ne: null },
        })
          .select('name role phone liveLocation')
          .lean(),
        ServiceRequest.find({
          status: { $in: ['pending', 'assigned', 'in_progress'] },
        }).select('location status serviceType assignedStaff'),
        CareRequest.find({
          status: { $in: ['pending_review', 'assigned', 'in_progress'] },
        }).select('location status serviceType assignedStaff'),
        Order.find({
          status: { $in: ['pending', 'processing', 'out_for_delivery'] },
        }).select('deliveryLocation status assignmentStatus'),
        CareBooking.find({
          status: {
            $in: [
              'awaiting_approval',
              'pending',
              'paid',
              'confirmed',
              'accepted',
              'checked_in',
            ],
          },
        })
          .populate('hostelId', 'name location serviceType')
          .populate('assignedPartner', 'name role')
          .select('status serviceType hostelId assignedPartner careAssignmentStatus')
          .lean(),
        LiveLocation.find({}).sort({ category: 1, name: 1 }).lean(),
      ]);

    const staffFromPins = staffLocations.map((s) => ({
      _id: s._id,
      staffId: s.staff?._id,
      name: s.staff?.name,
      role: s.role,
      phone: s.staff?.phone,
      coordinates: s.coordinates,
    }));
    const seenStaffIds = new Set(
      staffFromPins.map((row) => (row.staffId ? String(row.staffId) : '')).filter(Boolean)
    );
    const staffFromUsers = [];
    for (const u of usersWithLiveLocation) {
      const id = u._id ? String(u._id) : '';
      if (!id || seenStaffIds.has(id)) continue;
      const lat = u.liveLocation?.coordinates?.lat;
      const lng = u.liveLocation?.coordinates?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
        continue;
      }
      const norm = normalizeRole(u.role);
      const mapRole =
        norm === 'rider' ? 'rider' : norm === 'veterinarian' ? 'veterinarian' : norm || 'veterinarian';
      staffFromUsers.push({
        _id: `user-live-${id}`,
        staffId: u._id,
        name: u.name,
        role: mapRole,
        phone: u.phone,
        coordinates: { lat, lng },
      });
      seenStaffIds.add(id);
    }

    res.json({
      success: true,
      data: {
        staff: [...staffFromPins, ...staffFromUsers],
        requests: pendingRequests
          .filter((r) => r.location && r.location.coordinates)
          .map((r) => ({
            _id: r._id,
            status: r.status,
            serviceType: r.serviceType,
            coordinates: r.location.coordinates,
            assignedStaff: r.assignedStaff,
          })),
        careRequests: careRequests
          .filter((c) => c.location && c.location.point && Array.isArray(c.location.point.coordinates))
          .map((c) => ({
            _id: c._id,
            status: c.status,
            serviceType: c.serviceType,
            coordinates: {
              lat: c.location.point.coordinates[1],
              lng: c.location.point.coordinates[0],
            },
            assignedStaff: c.assignedStaff,
          })),
        // Product delivery orders – use green box icon in admin map
        orders: productOrders
          .filter(
            (o) =>
              o.deliveryLocation &&
              o.deliveryLocation.point &&
              Array.isArray(o.deliveryLocation.point.coordinates)
          )
          .map((o) => ({
            _id: o._id,
            status: o.status,
            assignmentStatus: o.assignmentStatus,
            coordinates: {
              lat: o.deliveryLocation.point.coordinates[1],
              lng: o.deliveryLocation.point.coordinates[0],
            },
          })),
        // Hostel / Grooming / etc. bookings at facility GPS (same shape as customer-facing hostel map)
        careBookings: careBookings
          .filter((b) => {
            const loc = b.hostelId && b.hostelId.location;
            return (
              loc &&
              loc.coordinates &&
              typeof loc.coordinates.lat === 'number' &&
              typeof loc.coordinates.lng === 'number'
            );
          })
          .map((b) => ({
            _id: b._id,
            status: b.status,
            serviceType: b.serviceType || b.hostelId?.serviceType,
            hostelName: b.hostelId?.name,
            careAssignmentStatus: b.careAssignmentStatus,
            assignedPartner: b.assignedPartner,
            coordinates: {
              lat: b.hostelId.location.coordinates.lat,
              lng: b.hostelId.location.coordinates.lng,
            },
          })),
        // Seeded venues + simulated fleet (MongoDB live_locations). Never includes customer home addresses.
        liveLocations: livePins.map((p) => ({
          _id: p._id,
          key: p.key,
          category: p.category,
          name: p.name,
          status: p.status,
          isDynamic: p.isDynamic,
          detailPath: p.detailPath || '/',
          coordinates: { lat: p.lat, lng: p.lng },
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/transactions
// List all payments (orders + Payment records) for admin Transactions tab
router.get('/transactions', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { status, limit: limitQ, page: pageQ } = req.query;
    const limit = Math.min(Math.max(Number(limitQ) || 50, 1), 100);
    const page = Math.max(Number(pageQ) || 1, 1);
    const skip = (page - 1) * limit;

    const orderFilter = {};
    if (status === 'success' || status === 'paid') {
      orderFilter.paymentStatus = 'paid';
    } else if (status === 'failed') {
      orderFilter.paymentStatus = { $ne: 'paid' };
    }
    const orderPayments = await Order.find(orderFilter)
      .populate('user', 'name email phone')
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    const paymentFilter = {};
    if (status === 'success' || status === 'paid') {
      paymentFilter.status = 'completed';
    } else if (status === 'failed') {
      paymentFilter.status = 'failed';
    }
    const servicePayments = await Payment.find(paymentFilter)
      .populate('user', 'name email phone')
      .populate('serviceRequest', 'serviceType preferredDate')
      .populate('careRequest', 'serviceType preferredDate')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const orderTxns = orderPayments.map((o) => ({
      _id: o._id,
      type: 'order',
      amount: o.totalAmount,
      status: o.paymentStatus === 'paid' ? 'success' : 'unpaid',
      gateway: o.paymentMethod || 'khalti',
      user: o.user,
      createdAt: o.updatedAt || o.createdAt,
      orderId: o._id,
    }));

    const paymentTxns = servicePayments.map((p) => ({
      _id: p._id,
      type: p.targetType,
      amount: p.amount,
      status: p.status === 'completed' ? 'success' : p.status === 'failed' ? 'failed' : 'pending',
      gateway: p.gateway,
      user: p.user,
      createdAt: p.createdAt,
      serviceRequest: p.serviceRequest,
      careRequest: p.careRequest,
    }));

    const all = [...orderTxns, ...paymentTxns].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const total = all.length;
    const paginated = all.slice(skip, skip + limit);

    res.json({
      success: true,
      data: paginated,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/payment-logs
// Payment Logs dashboard: pidx, amount, status for all test transactions
router.get('/payment-logs', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { limit: limitQ, page: pageQ, status } = req.query;
    const limit = Math.min(Math.max(Number(limitQ) || 50, 1), 100);
    const page = Math.max(Number(pageQ) || 1, 1);
    const skip = (page - 1) * limit;
    const filter = status ? { status: status } : {};
    const [logs, total] = await Promise.all([
      PaymentLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PaymentLog.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/provider-revenue
// Platform fees from care bookings (provider subscription commission)
router.get('/provider-revenue', protect, authorize('admin'), async (req, res, next) => {
  try {
    const bookings = await CareBooking.find({ paymentStatus: 'paid' }).lean();
    const totalPlatformFee = bookings.reduce((sum, b) => sum + (b.platformFee || 0), 0);
    const byServiceType = {};
    for (const b of bookings) {
      const t = b.serviceType || 'Hostel';
      if (!byServiceType[t]) byServiceType[t] = { count: 0, platformFee: 0 };
      byServiceType[t].count += 1;
      byServiceType[t].platformFee += b.platformFee || 0;
    }
    const subscriptionPayments = await Payment.find({
      targetType: 'subscription',
      status: 'completed',
    }).lean();
    const subscriptionRevenue = subscriptionPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({
      success: true,
      data: {
        totalPlatformFee,
        totalSubscriptionRevenue: subscriptionRevenue,
        totalProviderRevenue: totalPlatformFee + subscriptionRevenue,
        byServiceType,
        bookingCount: bookings.length,
        subscriptionCount: subscriptionPayments.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/hostels
// List all hostels/care services with filter by serviceType (like Cases dropdown)
router.get('/hostels', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { serviceType, limit: limitQ, page: pageQ } = req.query;
    const filter = {};
    const types = ['Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'];
    if (serviceType && types.includes(serviceType)) {
      filter.serviceType = serviceType;
    }
    const limit = Math.min(Math.max(Number(limitQ) || 50, 1), 100);
    const page = Math.max(Number(pageQ) || 1, 1);
    const skip = (page - 1) * limit;
    const [hostels, total] = await Promise.all([
      Hostel.find(filter)
        .populate('ownerId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Hostel.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: hostels,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/hostels/:id/verify
// Verify a hostel (admin only)
router.patch('/hostels/:id/verify', protect, authorize('admin'), async (req, res, next) => {
  try {
    const hostel = await Hostel.findByIdAndUpdate(
      req.params.id,
      { isVerified: true, isActive: true },
      { new: true }
    );
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }
    res.json({ success: true, data: hostel });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/shop-chat/threads — customer ↔ shop_owner (super-view; all threads)
router.get('/shop-chat/threads', protect, authorize('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200);
    const [threads, indexed] = await Promise.all([
      MarketplaceConversation.find({ type: 'SELLER' })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .limit(limit)
        .populate('customer', 'name email phone')
        .populate('partner', 'name email phone role')
        .populate('lastProduct', 'name images')
        .lean(),
      ShopChat.find()
        .sort({ lastMessageAt: -1 })
        .limit(limit)
        .populate('shopId', 'name email phone')
        .populate('customerId', 'name email phone')
        .lean(),
    ]);
    res.json({
      success: true,
      data: { conversations: threads, shopChatIndex: indexed },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/shop-chat/:conversationId/messages — audit transcript
router.get('/shop-chat/:conversationId/messages', protect, authorize('admin'), async (req, res, next) => {
  try {
    const convId = req.params.conversationId;
    const conv = await MarketplaceConversation.findById(convId).lean();
    if (!conv || conv.type !== 'SELLER') {
      return res.status(404).json({ success: false, message: 'Seller conversation not found' });
    }
    const messages = await MarketplaceMessage.find({ conversation: convId })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    res.json({
      success: true,
      data: {
        conversation: conv,
        messages,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/dispatch-operators
// Riders, sellers, and care professionals for assignment UIs
router.get('/dispatch-operators', protect, authorize('admin'), async (req, res, next) => {
  try {
    const select = 'name email phone role';
    const [riders, sellers, carePartners] = await Promise.all([
      User.find({ role: { $in: DISPATCH_RIDER_ROLES } }).select(select).sort({ name: 1 }).lean(),
      User.find({ role: { $in: DISPATCH_SELLER_ROLES } }).select(select).sort({ name: 1 }).lean(),
      User.find({ role: { $in: DISPATCH_CARE_ROLES } }).select(select).sort({ name: 1 }).lean(),
    ]);
    res.json({
      success: true,
      data: { riders, sellers, carePartners },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/care-bookings/:id/assign-partner
router.patch(
  '/care-bookings/:id/assign-partner',
  protect,
  authorize('admin'),
  adminAssignCarePartner
);

router.patch(
  '/care-bookings/:id/cancel',
  protect,
  authorize('admin'),
  adminCareBookingCancel
);

router.patch(
  '/care-bookings/:id/reassign-centre',
  protect,
  authorize('admin'),
  adminCareBookingReassignCentre
);

router.get(
  '/care-bookings/:id/chat',
  protect,
  authorize('admin'),
  adminGetCareBookingChat
);

// GET /api/v1/admin/care-bookings
// All care bookings with filter by serviceType
router.get('/care-bookings', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { serviceType, status, limit: limitQ, page: pageQ } = req.query;
    const filter = {};
    if (serviceType && ['Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'].includes(serviceType)) {
      filter.serviceType = serviceType;
    }
    if (status) filter.status = status;
    const limit = Math.min(Math.max(Number(limitQ) || 50, 1), 100);
    const page = Math.max(Number(pageQ) || 1, 1);
    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      CareBooking.find(filter)
        .populate('hostelId', 'name location serviceType')
        .populate('petId', 'name breed age')
        .populate('userId', 'name email phone')
        .populate('assignedPartner', 'name email phone role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CareBooking.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: bookings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/support/user-lookup?email=exact@match.com
router.get('/support/user-lookup', protect, authorize('admin'), findUserByEmail);

// POST /api/v1/admin/support/ensure-thread  { "email" } or { "userId" }
router.post('/support/ensure-thread', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { email, userId } = req.body || {};
    let targetId = userId;
    if (!targetId && email) {
      const u = await User.findOne({ email: String(email).toLowerCase().trim() })
        .select('_id')
        .lean();
      if (!u) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      targetId = u._id;
    }
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'userId or email required' });
    }
    const conv = await ensureDefaultCustomerCareConversation(targetId);
    if (!conv) {
      return res.status(503).json({
        success: false,
        message: 'Customer Care is not configured on the server',
      });
    }
    const populated = await MarketplaceConversation.findById(conv._id)
      .populate('customer', 'name email phone profilePicture role')
      .lean();
    const shaped = toClientConversationShape(populated);
    const cust = populated.customer;
    res.json({
      success: true,
      data: {
        conversation: shaped,
        threadLabel: `${cust?.name || 'User'} — ${formatRoleLabel(cust?.role)}`,
        customer: cust,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/payment-gateway-status
// Returns Khalti configuration status for admin UI indicator
router.get('/payment-gateway-status', protect, authorize('admin'), (req, res) => {
  const configured = isKhaltiConfigured();
  const mode = getKhaltiMode();
  res.json({
    success: true,
    data: {
      khalti: {
        configured,
        mode: configured ? mode : 'not_configured',
        status: configured
          ? mode === 'production'
            ? 'active'
            : 'sandbox'
          : 'inactive',
      },
    },
  });
});

// Agora call logs (linked to appointment / care booking when provided by clients)
router.get('/call-sessions', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { appointmentId, careBookingId, limit } = req.query;
    const q = {};
    if (appointmentId && mongoose.Types.ObjectId.isValid(String(appointmentId))) {
      q.appointment = appointmentId;
    }
    if (careBookingId && mongoose.Types.ObjectId.isValid(String(careBookingId))) {
      q.careBooking = careBookingId;
    }
    const lim = Math.min(100, Math.max(1, parseInt(String(limit || '40'), 10) || 40));
    const rows = await CallSession.find(q)
      .sort({ createdAt: -1 })
      .limit(lim)
      .populate('caller', 'name email')
      .populate('callee', 'name email')
      .lean();
    res.json({ success: true, data: rows });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

