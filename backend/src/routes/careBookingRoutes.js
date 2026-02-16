const express = require('express');
const router = express.Router();

const {
  createCareBooking,
  getMyBookings,
  getIncomingBookings,
  respondToBooking,
  initiateCareBookingPayment,
} = require('../controllers/careBookingController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Pet owner routes
router.post('/', protect, createCareBooking);
router.get('/my', protect, getMyBookings);
router.post('/:id/pay', protect, initiateCareBookingPayment);

// Hostel owner routes
router.get('/incoming', protect, authorize('hostel_owner', 'service_provider', 'admin'), getIncomingBookings);
router.patch('/:id/respond', protect, respondToBooking);

module.exports = router;
