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
const { protect, admin, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getHostels);
router.get('/my/list', protect, authorize('hostel_owner', 'service_provider', 'admin'), getMyHostels); // before /:id
router.get('/:id', getHostelById);

// Protected: hostel owner or admin
router.post('/', protect, authorize('hostel_owner', 'service_provider', 'admin'), createHostel);
router.patch('/:id', protect, updateHostel);
router.patch('/:id/availability', protect, toggleAvailability);

// Admin only
router.patch('/:id/verify', protect, admin, verifyHostel);

module.exports = router;
