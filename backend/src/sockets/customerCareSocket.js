const CustomerCareConversation = require('../models/CustomerCareConversation');
const logger = require('../utils/logger');
const {
  conversationRoom,
  appendMessageAndNotify,
  isAdminRole,
} = require('../services/customerCareService');

/**
 * Realtime Customer Care chat (separate from service-request rooms).
 * @param {import('socket.io').Server} io
 */
function registerCustomerCareSocket(io) {
  io.on('connection', (socket) => {
    const role = socket.user?.role;
    if (isAdminRole(role)) {
      logger.success('Admin Socket connected: Ready for support replies.');
    }

    socket.on('join_customer_care_room', async (conversationId, callback) => {
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
        const conv = await CustomerCareConversation.findById(conversationId)
          .select('customer careAdmin')
          .lean();
        if (!conv) {
          callback?.({ success: false, message: 'Conversation not found' });
          return;
        }
        const isCustomer = conv.customer.toString() === userId;
        const adminOk = isAdminRole(socket.user?.role);
        if (!isCustomer && !adminOk) {
          callback?.({ success: false, message: 'Not allowed' });
          return;
        }
        const room = conversationRoom(conversationId);
        await socket.join(room);
        callback?.({ success: true, room });
      } catch (err) {
        logger.error('[customerCareSocket] join_customer_care_room', err?.message);
        callback?.({ success: false, message: err?.message || 'Server error' });
      }
    });

    socket.on('send_customer_care_message', async (payload, callback) => {
      const { conversationId, text } = payload || {};
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
        const conv = await CustomerCareConversation.findById(conversationId);
        if (!conv) {
          callback?.({ success: false, message: 'Conversation not found' });
          return;
        }
        const uid = userId.toString();
        const isCustomer = conv.customer.toString() === uid;
        const adminOk = isAdminRole(socket.user?.role);
        if (!isCustomer && !adminOk) {
          callback?.({ success: false, message: 'Not allowed' });
          return;
        }

        await appendMessageAndNotify({
          conversation: conv,
          senderId: userId,
          text,
          io,
        });
        callback?.({ success: true });
      } catch (err) {
        const code = err.statusCode === 400 ? err.message : err.message;
        logger.error('[customerCareSocket] send_customer_care_message', err?.message);
        callback?.({
          success: false,
          message: code || 'Server error',
        });
      }
    });

    socket.on('customer_care_typing', (payload) => {
      const { conversationId, isTyping } = payload || {};
      if (!conversationId) return;
      const room = conversationRoom(conversationId);
      socket.to(room).emit('customer_care_is_typing', {
        conversationId,
        userId: socket.user?._id?.toString(),
        userName: socket.user?.name,
        isTyping: Boolean(isTyping),
      });
    });
  });
}

module.exports = { registerCustomerCareSocket };
