const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getPlans,
  getMySubscription,
  initiateKhalti,
  initiateFonepay,
  subscribe,
  cancelSubscription,
} = require('../controllers/petOwnerSubscriptionController');
router.get('/plans', getPlans);
router.get('/my', protect, authorize('pet_owner', 'customer'), getMySubscription);
router.post('/khalti/initiate', protect, authorize('pet_owner', 'customer'), initiateKhalti);
router.post('/fonepay/initiate', protect, authorize('pet_owner', 'customer'), initiateFonepay);
router.post('/subscribe', protect, authorize('pet_owner', 'customer'), subscribe);
router.post('/cancel', protect, authorize('pet_owner', 'customer'), cancelSubscription);

module.exports = router;
