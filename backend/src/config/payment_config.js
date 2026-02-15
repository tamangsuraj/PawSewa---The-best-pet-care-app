/**
 * Centralized payment configuration for PawSewa.
 * Single source of truth for Khalti and other payment gateways.
 */

// Khalti Sandbox: https://dev.khalti.com/api/v2/
// Production: https://khalti.com/api/v2
const KHALTI_BASE_URL =
  process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2/';

// Placeholder until Khalti registration is confirmed.
// Set KHALTI_SECRET_KEY in .env after registration.
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || '';
const KHALTI_PUBLIC_KEY = process.env.KHALTI_PUBLIC_KEY || '';

/**
 * Convert NPR amount to Paisa (Amount * 100).
 * Khalti API requires amounts in Paisa.
 * @param {number} amountNpr - Amount in Nepalese Rupees
 * @returns {number} Amount in Paisa (minimum 1000 for Khalti)
 */
function nprToPaisa(amountNpr) {
  return Math.round(Number(amountNpr) * 100);
}

/**
 * Check if Khalti is configured and ready.
 */
function isKhaltiConfigured() {
  return Boolean(KHALTI_SECRET_KEY && KHALTI_SECRET_KEY.trim().length > 0);
}

/**
 * Determine Khalti mode: sandbox if using dev.khalti.com, else production.
 */
function getKhaltiMode() {
  if (!isKhaltiConfigured()) return 'not_configured';
  const base = (KHALTI_BASE_URL || '').toLowerCase();
  return base.includes('dev.khalti.com') ? 'sandbox' : 'production';
}

/**
 * Map Khalti failure reason to user-friendly message.
 * Used across all apps for consistent error handling.
 * @param {string} reason - Khalti status/reason (e.g. "User canceled", "Expired")
 * @returns {string} User-friendly message
 */
function getPaymentFailureMessage(reason) {
  if (!reason || typeof reason !== 'string') {
    return 'Payment was not completed. Please try again.';
  }
  const r = reason.toLowerCase().trim();
  if (r.includes('cancel') || r.includes('user cancel')) {
    return 'Payment was cancelled. You can try again when ready.';
  }
  if (r.includes('expire') || r.includes('timeout')) {
    return 'Payment link expired. Please initiate a new payment.';
  }
  if (r.includes('insufficient') || r.includes('balance')) {
    return 'Insufficient balance. Please add funds to your wallet and try again.';
  }
  if (r.includes('decline') || r.includes('reject')) {
    return 'Payment was declined. Please try another payment method.';
  }
  if (r.includes('fail') || r.includes('error')) {
    return 'Payment failed. Please try again or use another payment method.';
  }
  return 'Payment was not completed. Please try again.';
}

module.exports = {
  KHALTI_BASE_URL: KHALTI_BASE_URL.replace(/\/$/, ''),
  KHALTI_SECRET_KEY,
  KHALTI_PUBLIC_KEY,
  nprToPaisa,
  isKhaltiConfigured,
  getKhaltiMode,
  getPaymentFailureMessage,
};
