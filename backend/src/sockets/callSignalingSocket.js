const logger = require('../utils/logger');

/**
 * Socket.io signaling for Agora 1:1 calls (ring / answer / hang-up).
 * Clients fetch RTC tokens via GET /api/v1/calls/token; do not ship tokens peer-to-peer.
 */
function registerCallSignaling(io) {
  io.on('connection', (socket) => {
    socket.on('make_call', (payload, callback) => {
      const from = socket.user?._id?.toString();
      if (!from) {
        callback?.({ success: false, message: 'Unauthorized' });
        return;
      }
      const p = payload && typeof payload === 'object' ? payload : {};
      const toUserId = p.toUserId != null ? String(p.toUserId).trim() : '';
      const channelName = p.channelName != null ? String(p.channelName).trim().slice(0, 64) : '';
      if (!toUserId || !channelName) {
        callback?.({ success: false, message: 'toUserId and channelName required' });
        return;
      }
      io.to(`user:${toUserId}`).emit('incoming_call', {
        fromUserId: from,
        callerName: String(p.callerName || '').slice(0, 120),
        channelName,
        callType: p.callType === 'video' ? 'video' : 'audio',
        appointmentId: p.appointmentId ? String(p.appointmentId) : undefined,
        careBookingId: p.careBookingId ? String(p.careBookingId) : undefined,
      });
      callback?.({ success: true });
      logger.info('[call] make_call', from, '->', toUserId, channelName);
    });

    socket.on('answer_call', (payload, callback) => {
      const from = socket.user?._id?.toString();
      if (!from) {
        callback?.({ success: false, message: 'Unauthorized' });
        return;
      }
      const p = payload && typeof payload === 'object' ? payload : {};
      const toUserId = p.toUserId != null ? String(p.toUserId).trim() : '';
      const channelName = p.channelName != null ? String(p.channelName).trim().slice(0, 64) : '';
      if (!toUserId || !channelName) {
        callback?.({ success: false, message: 'toUserId and channelName required' });
        return;
      }
      io.to(`user:${toUserId}`).emit('call_answered', {
        fromUserId: from,
        channelName,
      });
      callback?.({ success: true });
      logger.info('[call] answer_call', from, '->', toUserId, channelName);
    });

    socket.on('hang_up', (payload, callback) => {
      const from = socket.user?._id?.toString();
      const p = payload && typeof payload === 'object' ? payload : {};
      const toUserId = p.toUserId != null ? String(p.toUserId).trim() : '';
      const channelName = p.channelName != null ? String(p.channelName).trim().slice(0, 64) : '';
      const durationSeconds = Math.max(0, parseInt(String(p.durationSeconds ?? 0), 10) || 0);
      if (toUserId) {
        io.to(`user:${toUserId}`).emit('call_ended', {
          fromUserId: from,
          channelName,
          durationSeconds,
        });
      }
      callback?.({ success: true });
      logger.info('[call] hang_up', from, '->', toUserId || '?', durationSeconds, 's');
    });
  });
}

module.exports = { registerCallSignaling };
