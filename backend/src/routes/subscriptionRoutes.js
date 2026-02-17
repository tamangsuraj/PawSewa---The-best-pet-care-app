const express = require('express');
const router = express.Router();

const {
  getPlans,
  getMySubscription,
  initiateSubscriptionPayment,
} = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/plans', getPlans);
router.get('/my', protect, authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'), getMySubscription);
router.post('/initiate', protect, authorize('hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'), initiateSubscriptionPayment);

module.exports = router;
