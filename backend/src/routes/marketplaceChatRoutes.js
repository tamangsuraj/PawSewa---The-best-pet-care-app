const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getCustomerInbox,
  getSellerInbox,
  getRiderInbox,
  getCareInbox,
  openCareThread,
  openSellerThread,
  getOrCreateDeliveryByOrder,
  getRiderDeliveryByOrder,
  getMessages,
  postMessage,
  getConversation,
  adminListThreads,
} = require('../controllers/marketplaceChatController');

router.get(
  '/inbox',
  protect,
  authorize('pet_owner', 'customer'),
  getCustomerInbox
);
router.post(
  '/seller/open',
  protect,
  authorize('pet_owner', 'customer'),
  openSellerThread
);
router.get(
  '/seller/inbox',
  protect,
  authorize('shop_owner', 'admin'),
  getSellerInbox
);
router.get(
  '/care/inbox',
  protect,
  authorize('hostel_owner', 'facility_owner', 'service_provider', 'groomer', 'trainer', 'admin'),
  getCareInbox
);
router.post(
  '/care/open',
  protect,
  authorize('hostel_owner', 'facility_owner', 'service_provider', 'groomer', 'trainer', 'admin'),
  openCareThread
);
router.get('/rider/inbox', protect, authorize('rider'), getRiderInbox);
router.get(
  '/delivery/by-order/:orderId',
  protect,
  authorize('pet_owner', 'customer'),
  getOrCreateDeliveryByOrder
);
router.get(
  '/delivery/rider-order/:orderId',
  protect,
  authorize('rider'),
  getRiderDeliveryByOrder
);

router.get('/conversations/:id', protect, getConversation);
router.get('/conversations/:id/messages', protect, getMessages);
router.post('/conversations/:id/messages', protect, postMessage);

router.get('/admin/threads', protect, authorize('admin'), adminListThreads);

module.exports = router;
