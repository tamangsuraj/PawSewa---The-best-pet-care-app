const logger = require('../utils/logger');
const {
  initFirebaseAdmin,
  isFirebaseAdminConfigured,
  getAdmin,
} = require('./firebaseAdmin');

function initFcm() {
  return initFirebaseAdmin();
}

function isFcmConfigured() {
  return isFirebaseAdminConfigured();
}

/**
 * Send a data + notification payload to multiple FCM registration tokens.
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
    android: { priority: 'high' },
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
    if (typeof messaging.sendMulticast === 'function') {
      batch = await messaging.sendMulticast(message);
    } else {
      batch = await messaging.sendEachForMulticast(message);
    }
    return { sent: batch.successCount, failed: batch.failureCount };
  } catch (e) {
    logger.warn('FCM: sendEachForMulticast failed', e?.message || String(e));
    return { sent: 0, failed: uniq.length };
  }
}

module.exports = {
  initFcm,
  isFcmConfigured,
  sendMulticastNotification,
};
