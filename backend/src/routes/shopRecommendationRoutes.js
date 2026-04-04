const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  postRecommendationEvent,
  getAdminRecommendationActivity,
} = require('../controllers/shopRecommendationController');

router.post('/shop/recommendation-events', protect, postRecommendationEvent);
router.get('/admin/shop-recommendation-activity', protect, authorize('admin'), getAdminRecommendationActivity);

module.exports = router;
