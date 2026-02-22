const express = require('express');
const router = express.Router();

const {
  initiateKhalti,
  verifyKhalti,
  initiatePayment,
  verifyPayment,
  verifyPaymentGet,
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

// GET /api/v1/payments/verify?pidx=... - Server-side Khalti verification (no auth required for redirect callback)
router.get('/verify', verifyPaymentGet);

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

