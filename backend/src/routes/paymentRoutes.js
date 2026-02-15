const express = require('express');
const router = express.Router();

const {
  initiateKhalti,
  verifyKhalti,
  initiatePayment,
  verifyPayment,
  khaltiCallback,
  paymentSuccessPage,
  paymentFailedPage,
  initiateEsewa,
  verifyEsewa,
} = require('../controllers/paymentController');

const { protect } = require('../middleware/authMiddleware');

// Unified Khalti routes (POST for User App/Web)
router.post('/initiate-payment', protect, initiatePayment);
router.post('/verify-payment', verifyPayment);

// Legacy Khalti routes
router.post('/khalti/initiate', protect, initiateKhalti);
router.get('/khalti/verify', verifyKhalti);
router.get('/khalti/callback', khaltiCallback);
router.get('/payment-success', paymentSuccessPage);
router.get('/payment-failed', paymentFailedPage);

// eSewa routes
router.post('/esewa/initiate', protect, initiateEsewa);
router.get('/esewa/verify', verifyEsewa);

module.exports = router;

