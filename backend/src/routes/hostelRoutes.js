const express = require('express');
const router = express.Router();

const {
  getHostels,
  getHostelById,
  createHostel,
  updateHostel,
  verifyHostel,
  getMyHostels,
  toggleAvailability,
} = require('../controllers/hostelController');
const { protect, admin, authorize, verifyProviderSubscription } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getHostels);
router.get('/my/list', protect, authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'), getMyHostels); // before /:id
router.get('/:id', getHostelById);

// Protected: hostel owner or admin (subscription required for non-admin providers)
router.post('/', protect, authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'), verifyProviderSubscription, createHostel);
router.patch('/:id', protect, verifyProviderSubscription, updateHostel);
router.patch('/:id/availability', protect, toggleAvailability);

// Admin only
router.patch('/:id/verify', protect, admin, verifyHostel);

module.exports = router;
