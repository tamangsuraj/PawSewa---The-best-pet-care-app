const mongoose = require('mongoose');
const CustomerCareConversation = require('../models/CustomerCareConversation');
const CustomerCareMessage = require('../models/CustomerCareMessage');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendMulticastNotification } = require('../config/fcm');

const WELCOME_TEXT =
  'Namaste! Welcome to PawSewa. How can we help you and your pet today?';

const ROOM_PREFIX = 'ccare:';

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
 * Idempotent: create conversation + welcome message if missing.
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

  let conv = await CustomerCareConversation.findOne({ customer: customerUserId });
  if (conv) return conv;

  conv = await CustomerCareConversation.create({
    customer: customerUserId,
    careAdmin: careAdminId,
  });

  await CustomerCareMessage.create({
    conversation: conv._id,
    senderId: careAdminId,
    receiverId: customerUserId,
    text: WELCOME_TEXT,
  });

  logger.info('Chat Engine: Default conversation created for User', String(customerUserId));
  return conv;
}

function conversationRoom(conversationId) {
  return ROOM_PREFIX + String(conversationId);
}

/**
 * Persist message, optional socket emit, optional FCM when admin replies.
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

  const custId = conversation.customer.toString();
  const designatedAdminId = conversation.careAdmin.toString();
  const sid = senderId.toString();

  const sender = await User.findById(senderId).select('role').lean();
  const senderIsCustomer = sid === custId;
  const senderIsAdmin = sender && isAdminRole(sender.role);

  if (!senderIsCustomer && !senderIsAdmin) {
    const err = new Error('Not a participant in this conversation');
    err.statusCode = 403;
    throw err;
  }

  let receiverId;
  if (senderIsCustomer) {
    receiverId = conversation.careAdmin;
  } else {
    receiverId = conversation.customer;
  }

  const msg = await CustomerCareMessage.create({
    conversation: conversation._id,
    senderId,
    receiverId,
    text: trimmed,
  });

  await CustomerCareConversation.updateOne(
    { _id: conversation._id },
    { $set: { updatedAt: new Date() } }
  ).exec();

  const payload = {
    conversationId: conversation._id.toString(),
    messageId: msg._id.toString(),
    senderId: sid,
    receiverId: receiverId.toString(),
    text: msg.text,
    timestamp: (msg.createdAt || new Date()).toISOString(),
  };

  if (io) {
    io.to(conversationRoom(conversation._id)).emit('customer_care_new_message', payload);
  }

  const fromAdmin = senderIsAdmin;
  if (fromAdmin && !skipPush) {
    const customer = await User.findById(conversation.customer).select('+fcmTokens').lean();
    const tokens = Array.isArray(customer?.fcmTokens) ? customer.fcmTokens : [];
    if (tokens.length > 0) {
      await sendMulticastNotification(tokens, {
        title: 'Customer Care',
        body: 'Customer Care replied to your message.',
        data: {
          type: 'customer_care_reply',
          conversationId: conversation._id.toString(),
        },
      });
    }
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
};
