const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const NotificationLog = require('../models/NotificationLog');
const logger = require('../utils/logger');
const { isFcmConfigured, sendMulticastNotification } = require('../config/fcm');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Admin: broadcast to all device tokens.
 * POST /api/v1/notifications/broadcast
 * Body: { title, message }
 */
const broadcastNotification = asyncHandler(async (req, res) => {
  const { title, message } = req.body || {};
  const t = typeof title === 'string' ? title.trim() : '';
  const m = typeof message === 'string' ? message.trim() : '';

  if (!t || !m) {
    res.status(400);
    throw new Error('Title and message are required');
  }

  const adminId = req.user?._id?.toString() || 'unknown';
  logger.info('Broadcast initiated by Admin', adminId, '| Message:', t);

  // Collect tokens from all users (select false by default).
  const users = await User.find({ fcmTokens: { $exists: true, $ne: [] } })
    .select('_id fcmTokens')
    .lean();

  const tokenSet = new Set();
  users.forEach((u) => {
    (u.fcmTokens || []).forEach((tok) => {
      if (typeof tok === 'string' && tok.trim()) tokenSet.add(tok.trim());
    });
  });

  const tokens = [...tokenSet];
  const targetCount = tokens.length;

  const log = await NotificationLog.create({
    title: t,
    message: m,
    senderId: req.user._id,
    targetCount,
    successCount: 0,
    failureCount: 0,
  });

  let successCount = 0;
  let failureCount = 0;

  if (targetCount > 0 && isFcmConfigured()) {
    const batches = chunk(tokens, 500); // FCM multicast limit
    for (const b of batches) {
      // eslint-disable-next-line no-await-in-loop
      const r = await sendMulticastNotification(b, {
        title: t,
        body: m,
        data: { type: 'broadcast', logId: String(log._id) },
      });
      successCount += r.sent;
      failureCount += r.failed;
    }
  }

  await NotificationLog.updateOne(
    { _id: log._id },
    { $set: { successCount, failureCount } }
  );

  res.json({
    success: true,
    message: '[SUCCESS] Notification broadcasted to all active devices.',
    data: {
      id: log._id,
      targetCount,
      successCount,
      failureCount,
      createdAt: log.createdAt,
    },
  });
});

/**
 * Admin: list broadcast history.
 * GET /api/v1/notifications/broadcast/history?search=...
 */
const getBroadcastHistory = asyncHandler(async (req, res) => {
  const q = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const filter = q
    ? {
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { message: { $regex: q, $options: 'i' } },
        ],
      }
    : {};

  const logs = await NotificationLog.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, count: logs.length, data: logs });
});

module.exports = {
  broadcastNotification,
  getBroadcastHistory,
};

