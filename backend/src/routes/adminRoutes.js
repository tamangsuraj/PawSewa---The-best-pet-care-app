const express = require('express');
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
    const [staffLocations, pendingRequests, careRequests, productOrders] = await Promise.all([
      StaffLocation.find({}).populate('staff', 'name role phone'),
      ServiceRequest.find({
        status: { $in: ['pending', 'assigned', 'in_progress'] },
      }).select('location status serviceType assignedStaff'),
      CareRequest.find({
        status: { $in: ['pending_review', 'assigned', 'in_progress'] },
      }).select('location status serviceType assignedStaff'),
      Order.find({
        status: { $in: ['pending', 'processing', 'out_for_delivery'] },
      }).select('deliveryLocation status'),
    ]);

    res.json({
      success: true,
      data: {
        staff: staffLocations.map((s) => ({
          _id: s._id,
          staffId: s.staff?._id,
          name: s.staff?.name,
          role: s.role,
          phone: s.staff?.phone,
          coordinates: s.coordinates,
        })),
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
            coordinates: {
              lat: o.deliveryLocation.point.coordinates[1],
              lng: o.deliveryLocation.point.coordinates[0],
            },
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

module.exports = router;

