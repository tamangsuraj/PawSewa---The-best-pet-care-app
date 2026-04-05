const ServiceRequest = require('../models/ServiceRequest');
const ServiceRequestMessage = require('../models/ServiceRequestMessage');
const Chat = require('../models/Chat');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendMulticastToUser } = require('../config/fcm');
const { isAdminRole } = require('../services/customerCareService');
const { handleUnifiedSendMessage } = require('./unifiedChatSocket');
const { getIO } = require('./socketStore');
const { bumpUnread, requestKey } = require('../services/chatUnreadService');

const ROOM_PREFIX = 'request:';
const SUPPORT_ROOM = 'support:global';

function isVeterinarianRole(role) {
  if (!role) return false;
  return String(role).toLowerCase() === 'veterinarian';
}

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
        const isAdmin = isAdminRole(socket.user?.role);

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

    // Client cannot call socket.leave() — leave server-side when UI closes chat.
    socket.on('leave_request_room', (requestId, callback) => {
      if (!requestId || typeof requestId !== 'string') {
        callback?.({ success: false, message: 'Invalid requestId' });
        return;
      }
      const room = ROOM_PREFIX + requestId;
      socket.leave(room);
      callback?.({ success: true, room });
    });

    // Send message: service-request chat (requestId) OR unified marketplace/support (conversationId)
    socket.on('send_message', async (payload, callback) => {
      if (payload && typeof payload.conversationId === 'string') {
        return handleUnifiedSendMessage(socket, io, payload, callback);
      }

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
        const isAdmin = isAdminRole(socket.user?.role);

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

        const requesterId = request.user?.toString();
        const staffId = request.assignedStaff?.toString();
        const senderStr = userId.toString();
        const recipientForUnread =
          senderStr === requesterId ? staffId : requesterId;
        if (
          recipientForUnread &&
          String(recipientForUnread) !== senderStr
        ) {
          const senderLean = await User.findById(userId).select('name').lean();
          const ioServer = getIO();
          if (ioServer) {
            await bumpUnread(ioServer, recipientForUnread, requestKey(requestId), {
              senderName: (senderLean?.name || 'Someone').trim(),
              preview: text.trim(),
              requestId: String(requestId),
              threadType: 'request',
            });
          }
        }

        setImmediate(async () => {
          try {
            const senderUser = await User.findById(userId).select('name role').lean();
            const isVet = isVeterinarianRole(senderUser?.role);
            const adminSender = isAdminRole(senderUser?.role);

            if (senderStr === requesterId && staffId) {
              const body =
                (text || '').trim().slice(0, 200) ||
                'A customer sent a new message.';
              await sendMulticastToUser(staffId, {
                title: 'Customer message',
                body,
                data: {
                  type: 'vet_request_chat',
                  requestId: String(requestId),
                },
              });
              return;
            }

            if (senderStr !== requesterId && requesterId) {
              if (!adminSender && !isVet) return;
              const body = (text || '').trim().slice(0, 200) || 'New message.';
              let title = 'Customer Care';
              if (isVet) {
                title =
                  (senderUser?.name && String(senderUser.name).trim()) ||
                  'Your veterinarian';
              }
              await sendMulticastToUser(requesterId, {
                title,
                body,
                data: {
                  type: 'vet_request_chat',
                  requestId: String(requestId),
                },
                senderId: userId,
              });
            }
          } catch (e) {
            logger.warn('FCM: vet/service chat push skipped', e?.message || String(e));
          }
        });
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
