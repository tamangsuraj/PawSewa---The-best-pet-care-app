const admin = require('firebase-admin');
const logger = require('../utils/logger');

let initialized = false;

function isFirebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim());
}

/**
 * Initialize Firebase Admin from FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string).
 */
function initFirebaseAdmin() {
  if (initialized) return true;
  if (!isFirebaseAdminConfigured()) return false;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
    const cred = JSON.parse(raw);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(cred),
      });
    }
    initialized = true;
    logger.success('Service Account loaded. Push notifications active.');
    return true;
  } catch (e) {
    logger.error('FCM: Failed to initialize firebase-admin', e?.message || String(e));
    return false;
  }
}

function getAdmin() {
  return admin;
}

function isFirebaseAdminReady() {
  return initialized;
}

module.exports = {
  initFirebaseAdmin,
  isFirebaseAdminConfigured,
  isFirebaseAdminReady,
  getAdmin,
};
