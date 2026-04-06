const express = require('express');
const router = express.Router();

const {
  createOrder,
  getMyOrders,
  adminGetOrders,
  getRiderAssignedOrders,
  getSellerAssignedOrders,
  getRiderActiveOrders,
  updateOrderStatus,
  deliverOrderWithProof,
  assignRiderToOrder,
  assignSellerToOrder,
  confirmSellerOrder,
  sellerMarkPacked,
  sellerSetTracking,
  sellerCloseOrder,
  getOrderInvoice,
  getSellerShopAnalytics,
  bulkAssignOrders,
  initiateKhaltiForOrder,
  updateMyOrderDeliveryGps,
} = require('../controllers/orderController');
const { protect, admin, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.patch('/:orderId/delivery-gps', protect, updateMyOrderDeliveryGps);
router.get('/my', protect, getMyOrders);
router.get('/rider/assigned', protect, authorize('rider'), getRiderAssignedOrders);
router.get('/rider/active', protect, authorize('rider'), getRiderActiveOrders);
router.get('/seller/assigned', protect, authorize('shop_owner'), getSellerAssignedOrders);
router.get('/seller/analytics', protect, authorize('shop_owner'), getSellerShopAnalytics);
router.get('/:orderId/invoice', protect, getOrderInvoice);
router.get('/', protect, admin, adminGetOrders);
router.post('/bulk-assign', protect, admin, bulkAssignOrders);
router.patch('/:orderId/assign', protect, admin, assignRiderToOrder);
router.patch('/:orderId/assign-seller', protect, admin, assignSellerToOrder);
router.patch('/:orderId/seller-confirm', protect, authorize('shop_owner'), confirmSellerOrder);
router.patch('/:orderId/seller-pack', protect, authorize('shop_owner'), sellerMarkPacked);
router.patch('/:orderId/seller-tracking', protect, authorize('shop_owner'), sellerSetTracking);
router.patch('/:orderId/seller-close', protect, authorize('shop_owner', 'admin'), sellerCloseOrder);
router.patch('/:orderId/status', protect, updateOrderStatus);
router.patch('/:orderId/deliver', protect, authorize('rider', 'admin'), deliverOrderWithProof);
router.post('/:orderId/khalti/initiate', protect, initiateKhaltiForOrder);

module.exports = router;

