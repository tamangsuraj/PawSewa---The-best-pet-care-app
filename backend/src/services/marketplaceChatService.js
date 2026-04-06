const mongoose = require('mongoose');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const MarketplaceMessage = require('../models/MarketplaceMessage');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendMulticastToUser } = require('../utils/fcm');
const { bumpUnread, convKey } = require('./chatUnreadService');

const ROOM_PREFIX = 'mpchat:';
const DELIVERY_GRACE_MS = 30 * 60 * 1000;

function conversationRoom(conversationId) {
  return ROOM_PREFIX + String(conversationId);
}

async function resolveDefaultSellerId() {
  const shop = await User.findOne({ role: 'shop_owner' }).sort({ createdAt: 1 }).select('_id').lean();
  if (shop?._id) return shop._id;
  const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id').lean();
  return admin?._id || null;
}

async function resolveProductSellerId(product) {
  const vendorRef = product.seller || product.vendorId;
  if (vendorRef) return vendorRef;
  const sid = await resolveDefaultSellerId();
  if (sid && product._id) {
    await Product.updateOne({ _id: product._id }, { $set: { seller: sid } }).catch(() => {});
    product.seller = sid;
  }
  return sid;
}

function logSellerRouting({ convDoc, senderId, prodRef }) {
  if (convDoc.type !== 'SELLER') return;
  const customerId = String(convDoc.customer);
  const sellerId = String(convDoc.partner);
  const productId = prodRef
    ? String(prodRef)
    : convDoc.lastProduct
      ? String(convDoc.lastProduct)
      : 'n/a';
  if (String(senderId) === customerId) {
    logger.info(
      `[ROUTING] Message sent from Customer ${customerId} to Seller ${sellerId} for Product ${productId}`
    );
  } else {
    logger.info(
      `[ROUTING] Message sent from Seller ${sellerId} to Customer ${customerId} for Product ${productId}`
    );
  }
}

/**
 * Order is in the window where customer ↔ rider may exchange messages.
 */
function isOrderDeliveryChatActive(order) {
  if (!order || !order.assignedRider) return false;
  const st = order.status;
  if (st === 'pending') return false;
  if (st === 'delivered') {
    const ref = order.deliveredAt || order.updatedAt;
    if (!ref) return false;
    return Date.now() - new Date(ref).getTime() < DELIVERY_GRACE_MS;
  }
  return true;
}

/**
 * Whether a DELIVERY conversation should appear in inbox lists.
 */
function isDeliveryThreadVisible(conv, order) {
  if (!order) return false;
  if (conv.deliveryChatExpiresAt && Date.now() > new Date(conv.deliveryChatExpiresAt).getTime()) {
    return false;
  }
  return isOrderDeliveryChatActive(order);
}

async function ensureSellerConversation(customerId, productId) {
  const product = await Product.findById(productId).lean();
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }
  const sellerId = await resolveProductSellerId(product);
  if (!sellerId) {
    const err = new Error('No seller is assigned to this product yet');
    err.statusCode = 400;
    throw err;
  }
  if (String(sellerId) === String(customerId)) {
    const err = new Error('Cannot chat with yourself');
    err.statusCode = 400;
    throw err;
  }

  let conv = await MarketplaceConversation.findOne({
    type: 'SELLER',
    customer: customerId,
    partner: sellerId,
  });
  if (!conv) {
    conv = await MarketplaceConversation.create({
      type: 'SELLER',
      customer: customerId,
      partner: sellerId,
      lastProduct: product._id,
      lastProductName: product.name || '',
      lastMessageAt: new Date(),
    });
  } else {
    conv.lastProduct = product._id;
    conv.lastProductName = product.name || '';
    conv.lastMessageAt = new Date();
    await conv.save();
  }
  return conv;
}

async function ensureDeliveryConversationForOrder(orderDoc) {
  const order =
    orderDoc && typeof orderDoc.toObject === 'function'
      ? orderDoc.toObject()
      : orderDoc;
  if (!order?.assignedRider || !order.user) return null;

  const customerId = order.user._id || order.user;
  const riderId = order.assignedRider._id || order.assignedRider;

  let conv = await MarketplaceConversation.findOne({ type: 'DELIVERY', order: order._id });
  if (!conv) {
    conv = await MarketplaceConversation.create({
      type: 'DELIVERY',
      customer: customerId,
      partner: riderId,
      order: order._id,
      lastMessageAt: new Date(),
    });
  } else if (String(conv.partner) !== String(riderId)) {
    conv.partner = riderId;
    await conv.save();
  }
  return conv;
}

async function setDeliveryConversationExpiry(orderId) {
  const expires = new Date(Date.now() + DELIVERY_GRACE_MS);
  await MarketplaceConversation.updateMany(
    { type: 'DELIVERY', order: orderId },
    { $set: { deliveryChatExpiresAt: expires } }
  ).exec();
}

async function loadConversationForUser(conversationId, userId) {
  const conv = await MarketplaceConversation.findById(conversationId)
    .populate('customer', 'name profilePicture')
    .populate('partner', 'name profilePicture role')
    .populate('order')
    .populate('lastProduct', 'name images')
    .lean();
  if (!conv) return null;
  const uid = String(userId);
  if (String(conv.customer._id || conv.customer) !== uid && String(conv.partner._id || conv.partner) !== uid) {
    return null;
  }
  return conv;
}

function canSendInConversation(convLean, userId) {
  const uid = String(userId);
  const cust = String(convLean.customer._id || convLean.customer);
  const part = String(convLean.partner._id || convLean.partner);
  if (uid !== cust && uid !== part) return false;
  if (convLean.type === 'DELIVERY') {
    const ord = convLean.order;
    if (!ord || !isOrderDeliveryChatActive(ord)) return false;
  }
  return true;
}

/**
 * Persist message, socket emit, FCM to other party.
 */
function previewFromMessage({ trimmedText, mediaUrl, mediaType }) {
  if (trimmedText) {
    return trimmedText.length > 120 ? `${trimmedText.slice(0, 117)}...` : trimmedText;
  }
  if (mediaUrl && mediaType === 'video') return '📹 Video';
  if (mediaUrl && mediaType === 'image') return '📷 Photo';
  return '';
}

async function appendMessageAndNotify({
  conversationId,
  senderId,
  text,
  mediaUrl: mediaUrlRaw,
  mediaType: mediaTypeRaw,
  productId,
  io,
}) {
  const trimmed = (text || '').trim();
  const mediaUrl =
    typeof mediaUrlRaw === 'string' && mediaUrlRaw.trim().startsWith('http')
      ? mediaUrlRaw.trim().slice(0, 2000)
      : '';
  const mediaType =
    mediaTypeRaw === 'image' || mediaTypeRaw === 'video' ? mediaTypeRaw : '';
  const hasMedia = Boolean(mediaUrl && mediaType);
  if (!trimmed && !hasMedia) {
    const err = new Error('Message text or media is required');
    err.statusCode = 400;
    throw err;
  }

  const convDoc = await MarketplaceConversation.findById(conversationId);
  if (!convDoc) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  if (convDoc.type === 'SUPPORT') {
    const err = new Error('Support chat uses Customer Care only');
    err.statusCode = 400;
    throw err;
  }

  const convLean = await loadConversationForUser(conversationId, senderId);
  if (!convLean || !canSendInConversation(convLean, senderId)) {
    const err = new Error('Not allowed to send in this conversation');
    err.statusCode = 403;
    throw err;
  }

  let prodName = '';
  let prodRef = null;
  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    const p = await Product.findById(productId).select('name').lean();
    if (p) {
      prodRef = p._id;
      prodName = p.name || '';
    }
  }
  if (convDoc.type === 'SELLER' && prodRef) {
    convDoc.lastProduct = prodRef;
    convDoc.lastProductName = prodName;
  }

  const msg = await MarketplaceMessage.create({
    conversation: conversationId,
    sender: senderId,
    receiver: null,
    content: trimmed.slice(0, 4000),
    mediaUrl: hasMedia ? mediaUrl : '',
    mediaType: hasMedia ? mediaType : '',
    product: prodRef,
    productName: prodName,
  });

  convDoc.lastMessageAt = new Date();
  await convDoc.save();

  const preview = previewFromMessage({
    trimmedText: trimmed,
    mediaUrl: msg.mediaUrl,
    mediaType: msg.mediaType,
  });

  const payload = {
    conversationId: String(conversationId),
    messageId: msg._id.toString(),
    senderId: String(senderId),
    text: msg.content,
    mediaUrl: msg.mediaUrl || '',
    mediaType: msg.mediaType || '',
    productId: prodRef ? String(prodRef) : null,
    productName: prodName,
    timestamp: (msg.createdAt || new Date()).toISOString(),
  };

  const custId = String(convDoc.customer);
  const partId = String(convDoc.partner);
  const receiverId = String(senderId) === custId ? partId : custId;

  const room = conversationRoom(conversationId);
  if (io) {
    io.to(room).emit('marketplace_new_message', payload);
    io.to(room).emit('receive_message', {
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      senderId: payload.senderId,
      receiverId,
      content: payload.text,
      text: payload.text,
      mediaUrl: payload.mediaUrl,
      mediaType: payload.mediaType,
      productId: payload.productId,
      productName: payload.productName,
      timestamp: payload.timestamp,
      threadType: convDoc.type === 'DELIVERY' ? 'delivery' : 'seller',
    });
  }

  logSellerRouting({ convDoc, senderId, prodRef });

  const sender = await User.findById(senderId).select('name role').lean();
  const senderName = (sender?.name || 'Someone').trim();

  let title = 'PawSewa';
  let body = preview;
  if (convDoc.type === 'DELIVERY') {
    title = sender?.role === 'rider' ? 'Delivery' : 'Customer';
    body =
      sender?.role === 'rider'
        ? `Rider: ${preview}`
        : `Customer message: ${preview}`;
  } else {
    const productLabel = convDoc.lastProductName || prodName || 'your product';
    if (String(senderId) === custId) {
      title = 'Customer question';
      body = `About ${productLabel}: ${preview}`;
    } else {
      title = senderName;
      body = `Seller replied about ${productLabel}: ${preview}`;
    }
  }

  await sendMulticastToUser(receiverId, {
    title,
    body,
    data: {
      type: 'marketplace_chat',
      conversationId: String(conversationId),
      threadType: convDoc.type,
    },
    senderId: null,
  }).catch(() => {});

  if (io && receiverId && String(receiverId) !== String(senderId)) {
    await bumpUnread(io, receiverId, convKey(conversationId), {
      senderName,
      preview,
      conversationId: String(conversationId),
      threadType: convDoc.type === 'DELIVERY' ? 'delivery' : 'seller',
    });
  }

  return msg;
}

module.exports = {
  ROOM_PREFIX,
  conversationRoom,
  ensureSellerConversation,
  ensureDeliveryConversationForOrder,
  setDeliveryConversationExpiry,
  loadConversationForUser,
  canSendInConversation,
  appendMessageAndNotify,
  isOrderDeliveryChatActive,
  isDeliveryThreadVisible,
  resolveDefaultSellerId,
};
