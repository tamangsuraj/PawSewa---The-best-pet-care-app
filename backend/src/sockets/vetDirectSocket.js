const logger = require('../utils/logger');
const VetDirectMessage = require('../models/VetDirectMessage');
const { bumpUnread, vetDirectKey } = require('../services/chatUnreadService');
const { batchOnline } = require('./presenceStore');
const {
  makeVetDirectRoomId,
  socketRoomName,
  canOwnerChatWithVet,
  canVetChatWithOwner,
} = require('../utils/vetChatEligibility');

function registerVetDirectSocket(io) {
  io.on('connection', (socket) => {
    socket.on('query_vet_presence', (vetIds, callback) => {
      if (typeof callback !== 'function') return;
      if (!Array.isArray(vetIds)) {
        callback({});
        return;
      }
      callback(batchOnline(vetIds));
    });

    socket.on('join_vet_direct_room', async (payload, callback) => {
      const ownerId = payload?.ownerId;
      const vetId = payload?.vetId;
      if (!ownerId || !vetId) {
        callback?.({ success: false, message: 'ownerId and vetId required' });
        return;
      }

      const me = socket.user;
      if (!me) {
        callback?.({ success: false, message: 'Not authenticated' });
        return;
      }

      const uid = me._id.toString();
      const role = me.role;
      let ok = false;
      if (role === 'pet_owner' && uid === String(ownerId)) {
        ok = await canOwnerChatWithVet(ownerId, vetId);
      } else if ((role === 'veterinarian' || role === 'vet') && uid === String(vetId)) {
        ok = await canVetChatWithOwner(vetId, ownerId);
      }

      if (!ok) {
        callback?.({ success: false, message: 'Not allowed to join this chat' });
        return;
      }

      const room = socketRoomName(ownerId, vetId);
      await socket.join(room);
      const roomId = makeVetDirectRoomId(ownerId, vetId);
      logger.info(
        `[INFO] Chat Room created for User ${ownerId} and Vet ${vetId} based on shared history.`
      );
      callback?.({ success: true, room, roomId });
    });

    socket.on('leave_vet_direct_room', (payload, callback) => {
      const ownerId = payload?.ownerId;
      const vetId = payload?.vetId;
      if (!ownerId || !vetId) {
        callback?.({ success: false, message: 'ownerId and vetId required' });
        return;
      }
      socket.leave(socketRoomName(ownerId, vetId));
      callback?.({ success: true });
    });

    socket.on('send_vet_direct_message', async (payload, callback) => {
      const ownerId = payload?.ownerId;
      const vetId = payload?.vetId;
      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      const mediaUrl = typeof payload?.mediaUrl === 'string' ? payload.mediaUrl.trim() : '';
      const mediaType = payload?.mediaType;
      const hasText = text.length > 0;
      const hasMedia =
        mediaUrl.startsWith('http') && (mediaType === 'image' || mediaType === 'video');
      if (!ownerId || !vetId || (!hasText && !hasMedia)) {
        callback?.({ success: false, message: 'ownerId, vetId, and text or media required' });
        return;
      }

      const me = socket.user;
      if (!me) {
        callback?.({ success: false, message: 'Not authenticated' });
        return;
      }

      const uid = me._id.toString();
      const role = me.role;
      let ok = false;
      if (role === 'pet_owner' && uid === String(ownerId)) {
        ok = await canOwnerChatWithVet(ownerId, vetId);
      } else if ((role === 'veterinarian' || role === 'vet') && uid === String(vetId)) {
        ok = await canVetChatWithOwner(vetId, ownerId);
      }

      if (!ok) {
        callback?.({ success: false, message: 'Not allowed' });
        return;
      }

      try {
        const roomId = makeVetDirectRoomId(ownerId, vetId);
        const msg = await VetDirectMessage.create({
          roomId,
          ownerUser: ownerId,
          vetUser: vetId,
          sender: me._id,
          text: hasText ? text : '',
          mediaUrl: hasMedia ? mediaUrl.slice(0, 2000) : '',
          mediaType: hasMedia ? mediaType : '',
        });

        const emitPayload = {
          roomId,
          ownerId: String(ownerId),
          vetId: String(vetId),
          messageId: msg._id.toString(),
          sender: me._id.toString(),
          text: msg.text,
          mediaUrl: msg.mediaUrl || '',
          mediaType: msg.mediaType || '',
          timestamp: msg.createdAt || new Date(),
        };

        io.to(socketRoomName(ownerId, vetId)).emit('vet_direct_new_message', emitPayload);

        const recipientId =
          uid === String(ownerId) ? String(vetId) : String(ownerId);
        if (recipientId && recipientId !== uid) {
          const preview =
            text ||
            (hasMedia && mediaType === 'video' ? 'Video' : hasMedia ? 'Photo' : '');
          await bumpUnread(io, recipientId, vetDirectKey(ownerId, vetId), {
            senderName: (me.name || 'Someone').trim(),
            preview,
            ownerId: String(ownerId),
            vetId: String(vetId),
            threadType: 'vetdirect',
          });
        }

        callback?.({ success: true, messageId: msg._id.toString() });
      } catch (err) {
        logger.error('[vetDirectSocket] send_vet_direct_message', err?.message);
        callback?.({ success: false, message: err?.message || 'Server error' });
      }
    });

    socket.on('vet_direct_typing', (payload) => {
      const ownerId = payload?.ownerId;
      const vetId = payload?.vetId;
      if (!ownerId || !vetId || !socket.user) return;
      const room = socketRoomName(ownerId, vetId);
      socket.to(room).emit('vet_direct_is_typing', {
        ownerId: String(ownerId),
        vetId: String(vetId),
        userId: socket.user._id.toString(),
        isTyping: Boolean(payload?.isTyping),
      });
    });
  });
}

module.exports = { registerVetDirectSocket };
