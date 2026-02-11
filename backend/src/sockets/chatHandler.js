const ServiceRequest = require('../models/ServiceRequest');
const ServiceRequestMessage = require('../models/ServiceRequestMessage');
const Chat = require('../models/Chat');

const ROOM_PREFIX = 'request:';
const SUPPORT_ROOM = 'support:global';

/**
 * Register chat-related socket events.
 * @param {import('socket.io').Server} io
 */
function registerChatHandler(io) {
  io.on('connection', (socket) => {
    // Join a static support room – always allowed for authenticated users
    socket.on('join_support_room', (callback) => {
      const userId = socket.user?._id?.toString();
      if (!userId) {
        callback?.({ success: false, message: 'Not authenticated' });
        return;
      }
      socket.join(SUPPORT_ROOM);
      callback?.({ success: true, room: SUPPORT_ROOM });
    });

    // Join a service request chat room (user must be requester or assigned staff, and within time window)
    socket.on('join_request_room', async (requestId, callback) => {
      if (!requestId || typeof requestId !== 'string') {
        callback?.({ success: false, message: 'Invalid requestId' });
        return;
      }

      const userId = socket.user?._id?.toString();
      if (!userId) {
        callback?.({ success: false, message: 'Not authenticated' });
        return;
      }

      try {
        const request = await ServiceRequest.findById(requestId)
          .select('user assignedStaff status completedAt')
          .lean();

        if (!request) {
          callback?.({ success: false, message: 'Request not found' });
          return;
        }

        const isRequester = request.user?.toString() === userId;
        const isAssignedStaff = request.assignedStaff?.toString() === userId;
        const isAdmin = socket.user?.role === 'admin';

        if (!isRequester && !isAssignedStaff && !isAdmin) {
          callback?.({ success: false, message: 'Not allowed to join this room' });
          return;
        }

        let readOnly = false;
        if (request.status === 'completed' && request.completedAt) {
          const completedAt = new Date(request.completedAt);
          const diffMs = Date.now() - completedAt.getTime();
          const hours = diffMs / (1000 * 60 * 60);
          if (hours > 24) {
            readOnly = true;
          }
        }
        // Sync to Chat document if it exists
        try {
          await Chat.updateOne(
            { serviceRequest: request._id },
            { $set: { isReadOnly: readOnly } }
          ).exec();
        } catch {
          // ignore
        }

        const room = ROOM_PREFIX + requestId;
        await socket.join(room);
        callback?.({ success: true, room, readOnly });
      } catch (err) {
        console.error('[chatHandler] join_request_room error:', err?.message);
        callback?.({ success: false, message: err?.message || 'Server error' });
      }
    });

    // Send message: save to DB and emit to room
    socket.on('send_message', async (payload, callback) => {
      const { requestId, text, timestamp } = payload || {};
      if (!requestId || typeof text !== 'string' || !text.trim()) {
        callback?.({ success: false, message: 'Missing requestId or text' });
        return;
      }

      const userId = socket.user?._id;
      if (!userId) {
        callback?.({ success: false, message: 'Not authenticated' });
        return;
      }

      try {
        const request = await ServiceRequest.findById(requestId)
          .select('user assignedStaff status completedAt')
          .lean();

        if (!request) {
          callback?.({ success: false, message: 'Request not found' });
          return;
        }

        const uid = userId.toString();
        const isRequester = request.user?.toString() === uid;
        const isAssignedStaff = request.assignedStaff?.toString() === uid;
        const isAdmin = socket.user?.role === 'admin';

        if (!isRequester && !isAssignedStaff && !isAdmin) {
          callback?.({ success: false, message: 'Not allowed to send in this room' });
          return;
        }

        // Enforce 24h window after completion
        if (request.status === 'completed' && request.completedAt) {
          const completedAt = new Date(request.completedAt);
          const diffMs = Date.now() - completedAt.getTime();
          const hours = diffMs / (1000 * 60 * 60);
          if (hours > 24) {
            callback?.({
              success: false,
              message: 'Chat window expired. You can no longer send messages for this request.',
            });
            return;
          }
        }

        const msg = await ServiceRequestMessage.create({
          serviceRequest: requestId,
          sender: userId,
          content: text.trim(),
        });

        const room = ROOM_PREFIX + requestId;
        const emitPayload = {
          requestId,
          messageId: msg._id.toString(),
          sender: userId.toString(),
          text: msg.content,
          timestamp: msg.createdAt || new Date(),
        };
        io.to(room).emit('new_message', emitPayload);
        callback?.({ success: true, messageId: msg._id });
      } catch (err) {
        console.error('[chatHandler] send_message error:', err?.message);
        callback?.({ success: false, message: err?.message || 'Server error' });
      }
    });

    // Typing indicator
    socket.on('is_typing', (payload) => {
      const { requestId, isTyping } = payload || {};
      if (!requestId) return;
      const room = ROOM_PREFIX + requestId;
      socket.to(room).emit('is_typing', {
        requestId,
        userId: socket.user?._id?.toString(),
        userName: socket.user?.name,
        isTyping: Boolean(isTyping),
      });
    });
  });
}

module.exports = { registerChatHandler, ROOM_PREFIX };
