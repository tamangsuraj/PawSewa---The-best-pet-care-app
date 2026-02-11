const express = require('express');
const router = express.Router();

const { createOrder, getMyOrders, adminGetOrders } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/', protect, admin, adminGetOrders);

module.exports = router;

