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
const { protect, authorizeCarePartnerOrListingOwner } = require('../middleware/authMiddleware');

/** Partner roles that can manage care centre bookings (must match vet_app + Hostel.ownerId accounts). */
const CARE_PARTNER_ROLES = [
  'hostel_owner',
  'service_provider',
  'groomer',
  'trainer',
  'facility_owner',
  'veterinarian',
  'care_service',
  'admin',
];

// Pet owner routes
router.post('/', protect, createCareBooking);
router.get('/my', protect, getMyBookings);
router.post('/:id/pay', protect, initiateCareBookingPayment);

// Care centre partner routes (listing owner + vet_app care providers)
router.get(
  '/incoming',
  protect,
  authorizeCarePartnerOrListingOwner(CARE_PARTNER_ROLES),
  getIncomingBookings,
);
router.get(
  '/owner/calendar',
  protect,
  authorizeCarePartnerOrListingOwner(CARE_PARTNER_ROLES),
  getOwnerCalendar,
);
router.patch('/:id/respond', protect, respondToBooking);
router.patch(
  '/:id/check-in',
  protect,
  authorizeCarePartnerOrListingOwner(CARE_PARTNER_ROLES),
  notifyBookingCheckIn,
);
router.patch(
  '/:id/facility-notes',
  protect,
  authorizeCarePartnerOrListingOwner(CARE_PARTNER_ROLES),
  updateFacilityNotes,
);
router.post(
  '/:id/extra-charges',
  protect,
  authorizeCarePartnerOrListingOwner(CARE_PARTNER_ROLES),
  addExtraCharge,
);
router.patch(
  '/:id/intake',
  protect,
  authorizeCarePartnerOrListingOwner(CARE_PARTNER_ROLES),
  updateIntake,
);
router.post(
  '/:id/incidents',
  protect,
  authorizeCarePartnerOrListingOwner(CARE_PARTNER_ROLES),
  addIncident,
);
router.patch(
  '/:id/complete',
  protect,
  authorizeCarePartnerOrListingOwner(CARE_PARTNER_ROLES),
  markBookingCompleted,
);

module.exports = router;
