const express = require('express');
const router = express.Router();

const {
  createCareBooking,
  getMyBookings,
  getIncomingBookings,
  respondToBooking,
  initiateCareBookingPayment,
  getOwnerCalendar,
  updateFacilityNotes,
  addExtraCharge,
  updateIntake,
  addIncident,
  markBookingCompleted,
  notifyBookingCheckIn,
} = require('../controllers/careBookingController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Pet owner routes
router.post('/', protect, createCareBooking);
router.get('/my', protect, getMyBookings);
router.post('/:id/pay', protect, initiateCareBookingPayment);

// Hostel owner routes
router.get('/incoming', protect, authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'), getIncomingBookings);
router.get(
  '/owner/calendar',
  protect,
  authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'),
  getOwnerCalendar
);
router.patch('/:id/respond', protect, respondToBooking);
router.patch(
  '/:id/check-in',
  protect,
  authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'),
  notifyBookingCheckIn
);
router.patch(
  '/:id/facility-notes',
  protect,
  authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'),
  updateFacilityNotes
);
router.post(
  '/:id/extra-charges',
  protect,
  authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'),
  addExtraCharge
);
router.patch(
  '/:id/intake',
  protect,
  authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'),
  updateIntake
);
router.post(
  '/:id/incidents',
  protect,
  authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'),
  addIncident
);
router.patch(
  '/:id/complete',
  protect,
  authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'),
  markBookingCompleted
);

module.exports = router;
