const logger = require('./logger');
const User = require('../models/User');
const {
  initFirebaseAdmin,
  isFirebaseAdminConfigured,
  getAdmin,
} = require('../config/firebaseAdmin');

const CARE_ADMIN_ID = (process.env.CUSTOMER_CARE_ADMIN_ID || '').trim();

function initFcm() {
  return initFirebaseAdmin();
}

function isFcmConfigured() {
  return isFirebaseAdminConfigured();
}

/**
 * Send a data + notification payload to multiple FCM registration tokens.
 * Uses admin.messaging().sendEachForMulticast when available.
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: Record<string, string> }} payload
 */
async function sendMulticastNotification(tokens, { title, body, data = {} }) {
  if (!initFcm() || !Array.isArray(tokens) || tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }
  const uniq = [...new Set(tokens.filter((t) => typeof t === 'string' && t.length > 0))];
  if (uniq.length === 0) return { sent: 0, failed: 0 };

  const admin = getAdmin();
  const messaging = admin.messaging();
  const dataStrings = {};
  Object.entries(data).forEach(([k, v]) => {
    dataStrings[k] = v == null ? '' : String(v);
  });

  const message = {
    tokens: uniq,
    notification: { title, body },
    data: dataStrings,
    android: {
      priority: 'high',
      notification: {
        // Drawable name in each app’s res/drawable (no extension). Channel uses manifest default per app.
        icon: 'ic_stat_pawsewa',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    let batch;
    if (typeof messaging.sendEachForMulticast === 'function') {
      batch = await messaging.sendEachForMulticast(message);
    } else if (typeof messaging.sendMulticast === 'function') {
      batch = await messaging.sendMulticast(message);
    } else {
      return { sent: 0, failed: uniq.length };
    }
    return { sent: batch.successCount, failed: batch.failureCount };
  } catch (e) {
    logger.warn('FCM: multicast send failed', e?.message || String(e));
    return { sent: 0, failed: uniq.length };
  }
}

/**
 * Resolve receiverId → User.fcmTokens (+select) and multicast.
 * @param {string|import('mongoose').Types.ObjectId} receiverId
 * @param {{ title: string, body: string, data?: Record<string,string>, senderId?: string|import('mongoose').Types.ObjectId|null }} opts
 */
async function sendMulticastToUser(receiverId, { title, body, data = {}, senderId = null }) {
  if (!initFcm()) return { sent: 0, failed: 0 };
  const uid = receiverId?.toString?.() ?? String(receiverId);
  const user = await User.findById(uid).select('+fcmTokens').lean();
  const raw = Array.isArray(user?.fcmTokens) ? user.fcmTokens : [];
  const uniq = [...new Set(raw.filter((t) => typeof t === 'string' && t.length > 0))];
  if (uniq.length === 0) {
    logger.info(`[FCM] No active tokens for User: ${uid}`);
    return { sent: 0, failed: 0 };
  }
  logger.info(`[FCM] Sending multicast to ${uniq.length} devices for User: ${uid}`);
  const result = await sendMulticastNotification(uniq, { title, body, data });
  if (result.sent > 0 && CARE_ADMIN_ID && senderId != null && String(senderId) === CARE_ADMIN_ID) {
    logger.success(`[SUCCESS] Notification sent for Admin ID: ${CARE_ADMIN_ID}`);
  }
  return result;
}

module.exports = {
  initFcm,
  isFcmConfigured,
  sendMulticastNotification,
  sendMulticastToUser,
};
