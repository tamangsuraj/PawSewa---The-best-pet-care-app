const express = require('express');
const router = express.Router();

const { assignServiceRequest } = require('../controllers/serviceRequestController');
const { protect, admin } = require('../middleware/authMiddleware');
const StaffLocation = require('../models/StaffLocation');
const ServiceRequest = require('../models/ServiceRequest');
const CareRequest = require('../models/CareRequest');
const Order = require('../models/Order');

// Admin dispatcher routes
// Mirror of PATCH /api/v1/service-requests/:id/assign, but namespaced for admin
router.patch('/requests/:id/assign', protect, admin, assignServiceRequest);

// Global live map data for admin dashboard:
// - All active staff (vets, riders, etc.) with recent (TTL-backed) locations
// - All pending/assigned customer service request pins
// - All active Care+ requests (blue paw pins)
router.get('/live-map', protect, admin, async (req, res, next) => {
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

module.exports = router;

