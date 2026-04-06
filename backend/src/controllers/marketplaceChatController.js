const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const MarketplaceMessage = require('../models/MarketplaceMessage');
const Order = require('../models/Order');
const {
  ensureSellerConversation,
  ensureDeliveryConversationForOrder,
  loadConversationForUser,
  appendMessageAndNotify,
  isDeliveryThreadVisible,
  isOrderDeliveryChatActive,
} = require('../services/marketplaceChatService');
const { getIO } = require('../sockets/socketStore');

function serializeConversation(conv, orderLean) {
  const c = conv.customer;
  const p = conv.partner;
  return {
    _id: conv._id,
    type: conv.type,
    customer: c,
    partner: p,
    order: conv.order,
    lastProduct: conv.lastProduct,
    lastProductName: conv.lastProductName || '',
    lastMessageAt: conv.lastMessageAt,
    deliveryChatExpiresAt: conv.deliveryChatExpiresAt,
    updatedAt: conv.updatedAt,
    deliveryVisible: conv.type !== 'DELIVERY' || !orderLean || isDeliveryThreadVisible(conv, orderLean),
  };
}

/** GET /api/v1/marketplace-chat/inbox — customer: grouped threads */
const getCustomerInbox = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const list = await MarketplaceConversation.find({ customer: uid })
    .populate('partner', 'name profilePicture role')
    .populate('order')
    .populate('lastProduct', 'name images')
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  const sellers = [];
  const delivery = [];
  let support = null;
  for (const conv of list) {
    const ord = conv.order;
    if (conv.type === 'SUPPORT') {
      support = {
        _id: conv._id,
        type: 'SUPPORT',
        title: 'Customer Care',
        partner: conv.partner,
        lastMessageAt: conv.lastMessageAt,
        updatedAt: conv.updatedAt,
      };
    } else if (conv.type === 'SELLER') {
      sellers.push(serializeConversation(conv, null));
    } else if (conv.type === 'DELIVERY') {
      if (isDeliveryThreadVisible(conv, ord)) {
        delivery.push(serializeConversation(conv, ord));
      }
    }
  }

  res.json({
    success: true,
    data: {
      support,
      sellers,
      delivery,
    },
  });
});

/** GET /api/v1/marketplace-chat/seller/inbox */
const getSellerInbox = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const list = await MarketplaceConversation.find({ type: 'SELLER', partner: uid })
    .populate('customer', 'name profilePicture')
    .populate('lastProduct', 'name images price')
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  res.json({
    success: true,
    data: list.map((c) => serializeConversation(c, null)),
  });
});

/** GET /api/v1/marketplace-chat/rider/inbox */
const getRiderInbox = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const list = await MarketplaceConversation.find({ type: 'DELIVERY', partner: uid })
    .populate('customer', 'name profilePicture phone')
    .populate('order')
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  const visible = list.filter((conv) => isDeliveryThreadVisible(conv, conv.order));
  res.json({
    success: true,
    data: visible.map((c) => serializeConversation(c, c.order)),
  });
});

/** POST /api/v1/marketplace-chat/seller/open { productId } */
const openSellerThread = asyncHandler(async (req, res) => {
  const { productId } = req.body || {};
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ success: false, message: 'productId is required' });
  }
  const conv = await ensureSellerConversation(req.user._id, productId);
  const populated = await MarketplaceConversation.findById(conv._id)
    .populate('partner', 'name profilePicture role')
    .populate('lastProduct', 'name images')
    .lean();

  res.json({ success: true, data: populated });
});

/** GET /api/v1/marketplace-chat/delivery/by-order/:orderId */
const getOrCreateDeliveryByOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }
  const order = await Order.findById(orderId).populate('assignedRider', 'name profilePicture').lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (String(order.user) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Not your order' });
  }
  if (!order.assignedRider) {
    return res.status(400).json({ success: false, message: 'No rider assigned yet' });
  }

  const convDoc = await ensureDeliveryConversationForOrder(order);
  if (!isOrderDeliveryChatActive(order)) {
    return res.status(400).json({
      success: false,
      message: 'Delivery chat is not active for this order',
    });
  }

  const populated = await MarketplaceConversation.findById(convDoc._id)
    .populate('partner', 'name profilePicture role phone')
    .populate('order')
    .lean();

  res.json({ success: true, data: populated });
});

/** GET /api/v1/marketplace-chat/delivery/rider-order/:orderId — assigned rider opens thread */
const getRiderDeliveryByOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }
  const order = await Order.findById(orderId).populate('user', 'name profilePicture phone').lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const riderId = order.assignedRider?.toString?.() || String(order.assignedRider || '');
  if (!riderId || riderId !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Not assigned to this order' });
  }
  const convDoc = await ensureDeliveryConversationForOrder(order);
  if (!convDoc) {
    return res.status(400).json({ success: false, message: 'Could not open delivery chat' });
  }
  if (!isOrderDeliveryChatActive(order)) {
    return res.status(400).json({
      success: false,
      message: 'Delivery chat is not active for this order',
    });
  }
  const populated = await MarketplaceConversation.findById(convDoc._id)
    .populate('customer', 'name profilePicture role phone')
    .populate('order')
    .lean();
  res.json({ success: true, data: populated });
});

/** GET /api/v1/marketplace-chat/conversations/:id/messages */
const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conv = await loadConversationForUser(id, req.user._id);
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }
  const msgs = await MarketplaceMessage.find({ conversation: id })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate('sender', 'name profilePicture role')
    .populate('product', 'name')
    .lean();

  res.json({ success: true, data: msgs });
});

/** POST /api/v1/marketplace-chat/conversations/:id/messages { text, productId? } */
const postMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text, productId, mediaUrl, mediaType } = req.body || {};
  const io = getIO();
  const msg = await appendMessageAndNotify({
    conversationId: id,
    senderId: req.user._id,
    text,
    mediaUrl,
    mediaType,
    productId,
    io,
  });
  const populated = await MarketplaceMessage.findById(msg._id)
    .populate('sender', 'name profilePicture role')
    .populate('product', 'name')
    .lean();

  res.status(201).json({ success: true, data: populated });
});

/** GET /api/v1/marketplace-chat/conversations/:id — metadata */
const getConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conv = await loadConversationForUser(id, req.user._id);
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }
  res.json({ success: true, data: conv });
});

/** Admin: list recent marketplace threads */
const adminListThreads = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const list = await MarketplaceConversation.find({})
    .populate('customer', 'name email')
    .populate('partner', 'name email role')
    .populate('order')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  res.json({ success: true, data: list });
});

module.exports = {
  getCustomerInbox,
  getSellerInbox,
  getRiderInbox,
  openSellerThread,
  getOrCreateDeliveryByOrder,
  getRiderDeliveryByOrder,
  getMessages,
  postMessage,
  getConversation,
  adminListThreads,
};
