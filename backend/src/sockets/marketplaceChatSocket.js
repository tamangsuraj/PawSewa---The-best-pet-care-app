const mongoose = require('mongoose');
const logger = require('../utils/logger');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const {
  conversationRoom,
  loadConversationForUser,
  appendMessageAndNotify,
  canSendInConversation,
} = require('../services/marketplaceChatService');
const { getIO } = require('./socketStore');

function registerMarketplaceChatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join_marketplace_room', async (conversationId, callback) => {
      if (!conversationId || typeof conversationId !== 'string') {
        callback?.({ success: false, message: 'Invalid conversationId' });
        return;
      }
      const userId = socket.user?._id;
      if (!userId) {
        callback?.({ success: false, message: 'Not authenticated' });
        return;
      }
      try {
        const conv = await loadConversationForUser(conversationId, userId);
        if (!conv) {
          callback?.({ success: false, message: 'Conversation not found' });
          return;
        }
        if (!canSendInConversation(conv, userId)) {
          callback?.({ success: false, message: 'Chat not active' });
          return;
        }
        const room = conversationRoom(conversationId);
        await socket.join(room);
        callback?.({ success: true, room });
      } catch (err) {
        logger.error('[marketplaceChatSocket] join', err?.message);
        callback?.({ success: false, message: err?.message || 'Server error' });
      }
    });

    socket.on('leave_marketplace_room', (conversationId, callback) => {
      if (!conversationId) {
        callback?.({ success: false });
        return;
      }
      socket.leave(conversationRoom(conversationId));
      callback?.({ success: true });
    });

    socket.on('send_marketplace_message', async (payload, callback) => {
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
        await appendMessageAndNotify({
          conversationId,
          senderId: userId,
          text,
          productId:
            productId && mongoose.Types.ObjectId.isValid(productId) ? productId : undefined,
          io: ioServer,
        });
        callback?.({ success: true });
      } catch (err) {
        const code = err.statusCode === 400 ? err.message : err.message;
        logger.warn('[marketplaceChatSocket] send', code);
        callback?.({ success: false, message: code || 'Server error' });
      }
    });

    socket.on('marketplace_typing', async (payload) => {
      const { conversationId, isTyping } = payload || {};
      if (!conversationId) return;
      const room = conversationRoom(conversationId);
      const uid = socket.user?._id?.toString();
      const base = {
        conversationId,
        userId: uid,
        userName: socket.user?.name,
        isTyping: Boolean(isTyping),
      };
      socket.to(room).emit('marketplace_is_typing', base);
      let threadType = 'seller';
      try {
        const c = await MarketplaceConversation.findById(conversationId).select('type').lean();
        if (c?.type === 'DELIVERY') threadType = 'delivery';
      } catch (_) {
        /* ignore */
      }
      socket.to(room).emit('typing_status', { ...base, threadType });
    });
  });
}

module.exports = { registerMarketplaceChatSocket };
