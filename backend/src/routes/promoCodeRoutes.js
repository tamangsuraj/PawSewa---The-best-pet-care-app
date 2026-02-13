const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  validatePromoCode,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  incrementUsage,
} = require('../controllers/promoCodeController');

// Public: validate (no auth)
router.post('/validate', validatePromoCode);

// Admin only
router.get('/', protect, authorize('admin'), listPromoCodes);
router.post('/', protect, authorize('admin'), createPromoCode);
router.patch('/:id', protect, authorize('admin'), updatePromoCode);
router.delete('/:id', protect, authorize('admin'), deletePromoCode);
router.post('/:id/increment-usage', protect, authorize('admin'), incrementUsage);

module.exports = router;
