const mongoose = require('mongoose');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const logger = require('../utils/logger');
const { batchOnline } = require('./presenceStore');
const { getIO } = require('./socketStore');
const {
  conversationRoom: careRoom,
  appendMessageAndNotify: careAppend,
  isAdminRole,
} = require('../services/customerCareService');
const {
  conversationRoom: mpRoom,
  loadConversationForUser,
  canSendInConversation,
  appendMessageAndNotify: mpAppend,
} = require('../services/marketplaceChatService');

function threadTypeFromConvType(t) {
  if (t === 'SUPPORT') return 'support';
  if (t === 'DELIVERY') return 'delivery';
  return 'seller';
}

/**
 * Marketplace / Customer Care branch for `send_message` (disambiguated from service-request chat).
 */
async function handleUnifiedSendMessage(socket, io, payload, callback) {
  const { conversationId, text, productId } = payload || {};
  if (!conversationId || typeof text !== 'string') {
    callback?.({ success: false, message: 'Invalid payload' });
    return;
  }
  const userId = socket.user?._id;
  if (!userId) {
    callback?.({ success: false, message: 'Not authenticated' });
    return;
  }
  try {
    const ioServer = getIO();
    const conv = await MarketplaceConversation.findById(conversationId);
    if (!conv) {
      callback?.({ success: false, message: 'Conversation not found' });
      return;
    }
    if (conv.type === 'SUPPORT') {
      const uid = userId.toString();
      const isCustomer = conv.customer.toString() === uid;
      const adminOk = isAdminRole(socket.user?.role);
      const isCarePartner = conv.partner.toString() === uid;
      if (!isCustomer && !adminOk && !isCarePartner) {
        callback?.({ success: false, message: 'Not allowed' });
        return;
      }
      await careAppend({
        conversation: conv,
        senderId: userId,
        text,
        io: ioServer,
      });
    } else {
      await mpAppend({
        conversationId,
        senderId: userId,
        text,
        productId:
          productId && mongoose.Types.ObjectId.isValid(productId) ? productId : undefined,
        io: ioServer,
      });
    }
    callback?.({ success: true });
  } catch (err) {
    const code = err.statusCode === 400 ? err.message : err.message;
    logger.warn('[unifiedChatSocket] send_message (unified)', code);
    callback?.({ success: false, message: code || 'Server error' });
  }
}

/**
 * Unified Socket.io API (join_room, typing_status, mark_read, query_presence)
 * for web + mobile parity. `send_message` with conversationId is handled in chatHandler.
 */
function registerUnifiedChatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join_room', async (raw, callback) => {
      const conversationId =
        typeof raw === 'string' ? raw : raw && typeof raw === 'object' ? raw.conversationId : null;
      if (!conversationId || typeof conversationId !== 'string') {
        callback?.({ success: false, message: 'Invalid conversationId' });
        return;
      }
      const userId = socket.user?._id?.toString();
      if (!userId) {
        callback?.({ success: false, message: 'Not authenticated' });
        return;
      }
      try {
        const conv = await MarketplaceConversation.findById(conversationId)
          .select('type customer partner')
          .lean();
        if (!conv) {
          callback?.({ success: false, message: 'Conversation not found' });
          return;
        }

        if (conv.type === 'SUPPORT') {
          const isCustomer = conv.customer.toString() === userId;
          const adminOk = isAdminRole(socket.user?.role);
          const isCarePartner = conv.partner.toString() === userId;
          if (!isCustomer && !adminOk && !isCarePartner) {
            callback?.({ success: false, message: 'Not allowed' });
            return;
          }
          const room = careRoom(conversationId);
          await socket.join(room);
          logger.info(`[WEB-SYNC] Socket connected. Room joined for User: ${userId}.`);
          callback?.({
            success: true,
            room,
            threadType: 'support',
            conversationId,
          });
          return;
        }

        const fullUserId = socket.user._id;
        const loaded = await loadConversationForUser(conversationId, fullUserId);
        if (!loaded) {
          callback?.({ success: false, message: 'Conversation not found' });
          return;
        }
        if (!canSendInConversation(loaded, fullUserId)) {
          callback?.({ success: false, message: 'Chat not active' });
          return;
        }
        const room = mpRoom(conversationId);
        await socket.join(room);
        logger.info(`[WEB-SYNC] Socket connected. Room joined for User: ${userId}.`);
        callback?.({
          success: true,
          room,
          threadType: threadTypeFromConvType(conv.type),
          conversationId,
        });
      } catch (err) {
        logger.error('[unifiedChatSocket] join_room', err?.message);
        callback?.({ success: false, message: err?.message || 'Server error' });
      }
    });

    socket.on('typing_status', async (payload) => {
      const { conversationId, isTyping } = payload || {};
      if (!conversationId) return;
      const userId = socket.user?._id?.toString();
      if (!userId) return;
      try {
        const conv = await MarketplaceConversation.findById(conversationId).select('type').lean();
        if (!conv) return;
        const room = conv.type === 'SUPPORT' ? careRoom(conversationId) : mpRoom(conversationId);
        const threadType = threadTypeFromConvType(conv.type);
        const unified = {
          conversationId,
          userId,
          userName: socket.user?.name,
          isTyping: Boolean(isTyping),
          threadType,
        };
        socket.to(room).emit('typing_status', unified);
        if (conv.type === 'SUPPORT') {
          socket.to(room).emit('customer_care_is_typing', {
            conversationId,
            userId,
            userName: socket.user?.name,
            isTyping: Boolean(isTyping),
          });
        } else {
          socket.to(room).emit('marketplace_is_typing', {
            conversationId,
            userId,
            userName: socket.user?.name,
            isTyping: Boolean(isTyping),
          });
        }
      } catch (err) {
        logger.error('[unifiedChatSocket] typing_status', err?.message);
      }
    });

    socket.on('mark_read', async (payload) => {
      const conversationId = payload && typeof payload === 'object' ? payload.conversationId : null;
      if (!conversationId) return;
      const readerId = socket.user?._id?.toString();
      if (!readerId) return;
      try {
        const conv = await MarketplaceConversation.findById(conversationId)
          .select('type customer partner')
          .lean();
        if (!conv) return;
        const cust = conv.customer.toString();
        const part = conv.partner.toString();
        if (readerId !== cust && readerId !== part && !isAdminRole(socket.user?.role)) return;
        const room = conv.type === 'SUPPORT' ? careRoom(conversationId) : mpRoom(conversationId);
        socket.to(room).emit('seen_receipt', {
          conversationId,
          readerId,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('[unifiedChatSocket] mark_read', err?.message);
      }
    });

    socket.on('query_presence', (userIds, callback) => {
      if (typeof callback !== 'function') return;
      try {
        callback(batchOnline(Array.isArray(userIds) ? userIds : []));
      } catch (_) {
        callback({});
      }
    });
  });
}

module.exports = { registerUnifiedChatSocket, handleUnifiedSendMessage };
