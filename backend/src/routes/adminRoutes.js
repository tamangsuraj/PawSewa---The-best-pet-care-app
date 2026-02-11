const express = require('express');
const router = express.Router();

const { assignServiceRequest } = require('../controllers/serviceRequestController');
const { protect, admin } = require('../middleware/authMiddleware');
const StaffLocation = require('../models/StaffLocation');
const ServiceRequest = require('../models/ServiceRequest');

// Admin dispatcher routes
// Mirror of PATCH /api/v1/service-requests/:id/assign, but namespaced for admin
router.patch('/requests/:id/assign', protect, admin, assignServiceRequest);

// Global live map data for admin dashboard:
// - All active staff (vets, riders, etc.) with recent (TTL-backed) locations
// - All pending/assigned customer service request pins
router.get('/live-map', protect, admin, async (req, res, next) => {
  try {
    const [staffLocations, pendingRequests] = await Promise.all([
      StaffLocation.find({}).populate('staff', 'name role phone'),
      ServiceRequest.find({
        status: { $in: ['pending', 'assigned', 'in_progress'] },
      }).select('location status serviceType assignedStaff'),
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
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

