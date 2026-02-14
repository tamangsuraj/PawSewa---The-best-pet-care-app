const express = require('express');
const router = express.Router();

const {
  initiateKhalti,
  verifyKhalti,
  khaltiCallback,
  paymentSuccessPage,
  paymentFailedPage,
  initiateEsewa,
  verifyEsewa,
} = require('../controllers/paymentController');

const { protect } = require('../middleware/authMiddleware');

// Khalti routes
router.post('/khalti/initiate', protect, initiateKhalti);
router.get('/khalti/verify', verifyKhalti);
router.get('/khalti/callback', khaltiCallback);
router.get('/payment-success', paymentSuccessPage);
router.get('/payment-failed', paymentFailedPage);

// eSewa routes
router.post('/esewa/initiate', protect, initiateEsewa);
router.get('/esewa/verify', verifyEsewa);

module.exports = router;

