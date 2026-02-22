const express = require('express');
const router = express.Router();

const {
  createOrder,
  getMyOrders,
  adminGetOrders,
  getRiderAssignedOrders,
  getRiderActiveOrders,
  updateOrderStatus,
  assignRiderToOrder,
  bulkAssignOrders,
  initiateKhaltiForOrder,
} = require('../controllers/orderController');
const { protect, admin, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.get('/my', protect, getMyOrders);
router.get('/rider/assigned', protect, authorize('rider'), getRiderAssignedOrders);
router.get('/rider/active', protect, authorize('rider'), getRiderActiveOrders);
router.get('/', protect, admin, adminGetOrders);
router.post('/bulk-assign', protect, admin, bulkAssignOrders);
router.patch('/:orderId/assign', protect, admin, assignRiderToOrder);
router.patch('/:orderId/status', protect, updateOrderStatus);
router.post('/:orderId/khalti/initiate', protect, initiateKhaltiForOrder);

module.exports = router;

