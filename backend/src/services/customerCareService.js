const mongoose = require('mongoose');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const MarketplaceMessage = require('../models/MarketplaceMessage');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendMulticastToUser } = require('../config/fcm');

const WELCOME_TEXT =
  'Namaste! Welcome to PawSewa. How can we help you and your pet today?';

const ROOM_PREFIX = 'ccare:';

/** Legacy collection names (Mongoose default pluralization). */
const LEGACY_CONV_COLLECTION = 'customercareconversations';
const LEGACY_MSG_COLLECTION = 'customercaremessages';

function isPetOwnerRole(role) {
  if (!role) return false;
  const r = String(role).toLowerCase();
  return r === 'pet_owner' || r === 'customer';
}

function isAdminRole(role) {
  if (!role) return false;
  const r = String(role).toLowerCase();
  return r === 'admin';
}

async function resolveCareAdminId() {
  const envId = process.env.CUSTOMER_CARE_ADMIN_ID;
  if (envId && mongoose.Types.ObjectId.isValid(envId)) {
    const u = await User.findById(envId).select('_id role');
    if (u && isAdminRole(u.role)) return u._id;
    logger.warn(
      'Chat Engine: CUSTOMER_CARE_ADMIN_ID is set but user missing or not admin; falling back to first admin.'
    );
  }
  const admin = await User.findOne({ role: { $in: ['admin', 'ADMIN'] } })
    .select('_id')
    .sort({ createdAt: 1 })
    .lean();
  return admin?._id || null;
}

/**
 * Copy one legacy Customer Care thread + messages into MarketplaceConversation / MarketplaceMessage (same _ids).
 */
async function migrateLegacyCustomerCareThread(legacyConv) {
  const db = mongoose.connection.db;
  if (!db || !legacyConv?._id) return null;

  const convId = legacyConv._id;
  const existing = await MarketplaceConversation.findById(convId).lean();
  if (existing) {
    return MarketplaceConversation.findById(convId);
  }

  const now = new Date();
  try {
    await db.collection('marketplaceconversations').insertOne({
      _id: convId,
      type: 'SUPPORT',
      customer: legacyConv.customer,
      partner: legacyConv.careAdmin,
      order: null,
      lastProduct: null,
      lastProductName: '',
      deliveryChatExpiresAt: null,
      lastMessageAt: legacyConv.updatedAt || now,
      createdAt: legacyConv.createdAt || now,
      updatedAt: legacyConv.updatedAt || now,
    });
  } catch (e) {
    if (e && e.code === 11000) {
      return MarketplaceConversation.findById(convId);
    }
    throw e;
  }

  const oldMsgs = await db
    .collection(LEGACY_MSG_COLLECTION)
    .find({ conversation: convId })
    .sort({ createdAt: 1 })
    .toArray();

  for (const m of oldMsgs) {
    const mid = m._id;
    const msgExists = await db.collection('marketplacemessages').findOne({ _id: mid });
    if (msgExists) continue;
    try {
      await db.collection('marketplacemessages').insertOne({
        _id: mid,
        conversation: m.conversation,
        sender: m.senderId,
        receiver: m.receiverId,
        content: m.text,
        product: null,
        productName: '',
        createdAt: m.createdAt || now,
        updatedAt: m.updatedAt || now,
      });
    } catch (err) {
      if (err && err.code !== 11000) logger.warn('[customerCare] migrate message skip', mid, err.message);
    }
  }

  logger.info('[customerCare] Migrated legacy thread to MarketplaceConversation', String(convId));
  return MarketplaceConversation.findById(convId);
}

/**
 * Idempotent: ensure SUPPORT conversation (+ welcome) or migrate legacy.
 */
async function ensureDefaultCustomerCareConversation(customerUserId) {
  const careAdminId = await resolveCareAdminId();
  if (!careAdminId) {
    logger.warn(
      'Chat Engine: No Customer Care admin (set CUSTOMER_CARE_ADMIN_ID or seed an admin); skipping default conversation.'
    );
    return null;
  }
  if (String(careAdminId) === String(customerUserId)) return null;

  let conv = await MarketplaceConversation.findOne({
    type: 'SUPPORT',
    customer: customerUserId,
  });
  if (conv) return conv;

  const db = mongoose.connection.db;
  if (db) {
    const custOid = mongoose.Types.ObjectId.isValid(String(customerUserId))
      ? new mongoose.Types.ObjectId(String(customerUserId))
      : customerUserId;
    const legacy = await db.collection(LEGACY_CONV_COLLECTION).findOne({ customer: custOid });
    if (legacy) {
      conv = await migrateLegacyCustomerCareThread(legacy);
      if (conv) return conv;
    }
  }

  conv = await MarketplaceConversation.create({
    type: 'SUPPORT',
    customer: customerUserId,
    partner: careAdminId,
    lastMessageAt: new Date(),
  });

  await MarketplaceMessage.create({
    conversation: conv._id,
    sender: careAdminId,
    receiver: customerUserId,
    content: WELCOME_TEXT,
  });

  logger.info('Chat Engine: Default SUPPORT conversation created for User', String(customerUserId));
  logger.info('[INFO] Chat Room Created for user', String(customerUserId));
  return conv;
}

function conversationRoom(conversationId) {
  return ROOM_PREFIX + String(conversationId);
}

/**
 * Expose legacy shape for API/clients expecting careAdmin.
 */
function toClientConversationShape(doc) {
  if (doc == null) return doc;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (o && o.type === 'SUPPORT' && o.partner) {
    o.careAdmin = o.partner;
  }
  return o;
}

/**
 * Persist message, optional socket emit, optional FCM when admin replies.
 * @param {import('mongoose').Document} conversation — MarketplaceConversation (type SUPPORT)
 * @param {import('socket.io').Server|null} io
 */
async function appendMessageAndNotify({
  conversation,
  senderId,
  text,
  io,
  skipPush = false,
}) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    const err = new Error('Message text is required');
    err.statusCode = 400;
    throw err;
  }

  if (conversation.type !== 'SUPPORT') {
    const err = new Error('Invalid conversation type for Customer Care');
    err.statusCode = 400;
    throw err;
  }

  const custId = conversation.customer.toString();
  const adminId = conversation.partner.toString();
  const sid = senderId.toString();

  const sender = await User.findById(senderId).select('role').lean();
  const senderIsCustomer = sid === custId;
  const senderIsAdmin = sender && isAdminRole(sender.role);

  if (!senderIsCustomer && !senderIsAdmin) {
    const err = new Error('Not a participant in this conversation');
    err.statusCode = 403;
    throw err;
  }

  const receiverId = senderIsCustomer ? conversation.partner : conversation.customer;

  const receiverUser = await User.findById(receiverId).select('role').lean();

  const msg = await MarketplaceMessage.create({
    conversation: conversation._id,
    sender: senderId,
    receiver: receiverId,
    content: trimmed.slice(0, 4000),
    senderRole: sender?.role || '',
    receiverRole: receiverUser?.role || '',
  });

  await MarketplaceConversation.updateOne(
    { _id: conversation._id },
    { $set: { updatedAt: new Date(), lastMessageAt: new Date() } }
  ).exec();

  const payload = {
    conversationId: conversation._id.toString(),
    messageId: msg._id.toString(),
    senderId: sid,
    receiverId: receiverId.toString(),
    text: msg.content,
    timestamp: (msg.createdAt || new Date()).toISOString(),
    senderRole: msg.senderRole || sender?.role || '',
  };

  if (io) {
    const room = conversationRoom(conversation._id);
    io.to(room).emit('customer_care_new_message', payload);
    io.to(room).emit('receive_message', {
      conversationId: payload.conversationId,
      messageId: payload.messageId,
      senderId: payload.senderId,
      receiverId: payload.receiverId,
      content: payload.text,
      text: payload.text,
      timestamp: payload.timestamp,
      threadType: 'support',
      senderRole: payload.senderRole,
    });

    const custPop = await User.findById(conversation.customer).select('name email role').lean();
    io.to('admin_room').emit('support_inbox_bump', {
      conversationId: conversation._id.toString(),
      lastMessageAt: payload.timestamp,
      lastMessagePreview: trimmed.slice(0, 220),
      customerId: custPop?._id?.toString(),
      customerName: custPop?.name || 'User',
      customerEmail: custPop?.email || '',
      customerRole: custPop?.role || '',
    });
  }

  const fromAdmin = senderIsAdmin;
  if (fromAdmin && !skipPush) {
    const preview =
      trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
    await sendMulticastToUser(conversation.customer, {
      title: 'Customer Care',
      body: preview,
      data: {
        type: 'customer_care_reply',
        conversationId: conversation._id.toString(),
      },
      senderId,
    });
  }

  return msg;
}

module.exports = {
  WELCOME_TEXT,
  ROOM_PREFIX,
  conversationRoom,
  isPetOwnerRole,
  isAdminRole,
  resolveCareAdminId,
  ensureDefaultCustomerCareConversation,
  appendMessageAndNotify,
  toClientConversationShape,
};
