const express = require('express');
const router = express.Router();

const {
  createOrder,
  getMyOrders,
  adminGetOrders,
  initiateKhaltiForOrder,
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/', protect, admin, adminGetOrders);
router.post('/:orderId/khalti/initiate', protect, initiateKhaltiForOrder);

module.exports = router;

