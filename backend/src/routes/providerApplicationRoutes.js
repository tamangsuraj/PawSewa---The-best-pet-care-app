const express = require('express');
const router = express.Router();

const {
  createApplication,
  getMyApplication,
  getPendingApplications,
  reviewApplication,
} = require('../controllers/providerApplicationController');
const { protect, admin, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('hostel_owner', 'service_provider'), createApplication);
router.get('/my', protect, getMyApplication);
router.get('/pending', protect, admin, getPendingApplications);
router.patch('/:id/review', protect, admin, reviewApplication);

module.exports = router;
