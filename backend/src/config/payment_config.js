/**
 * Centralized payment configuration for PawSewa.
 * Single source of truth for Khalti and other payment gateways.
 */

// Khalti Sandbox: https://dev.khalti.com/api/v2/
// Production: https://khalti.com/api/v2
const KHALTI_BASE_URL =
  process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2/';

// Configure when Khalti merchant registration is complete.
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
/**
 * Base URL reachable by the user device and Khalti (return_url / website_url).
 * Prefer PUBLIC_API_BASE_URL (e.g. http://192.168.x.x:3000) when testing on a physical phone;
 * otherwise BASE_URL, KHALTI_RETURN_BASE, or localhost for emulator/desktop.
 * For phone WebView + Khalti, set PUBLIC_API_BASE_URL, KHALTI_PUBLIC_BASE_URL, or NGROK_TUNNEL_URL
 * to your public API origin (e.g. https://YOUR_SUBDOMAIN.ngrok-free.app) so return_url is not loopback.
 * Clients should send publicApiBase in the initiate body when using a tunnel; otherwise
 * completed payments may fail to reach the API (ERR_CONNECTION_REFUSED on localhost).
 */
function getKhaltiPublicBaseUrl() {
  const explicit = (
    process.env.PUBLIC_API_BASE_URL ||
    process.env.KHALTI_PUBLIC_BASE_URL ||
    process.env.NGROK_TUNNEL_URL ||
    ''
  ).trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const fallback = (
    process.env.BASE_URL ||
    process.env.KHALTI_RETURN_BASE ||
    process.env.NGROK_TUNNEL_URL ||
    'http://localhost:3000'
  ).trim();
  return fallback.replace(/\/$/, '');
}

/**
 * Same as getKhaltiPublicBaseUrl(), but when no explicit PUBLIC/KHALTI URL is set,
 * derive the base from the incoming HTTP request (Host / X-Forwarded-*).
 * Use this for Khalti initiate + callback redirects so a phone hitting http://192.168.x.x:3000
 * gets return_url on that host instead of localhost.
 */
function isLoopbackHost(host) {
  if (!host || typeof host !== 'string') return true;
  const h = host.split(':')[0].replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0:0:0:0:0:0:0:1'
  );
}

/**
 * Normalize a public API origin for Khalti (scheme://host:port only).
 * Rejects loopback — unsafe for phone WebView return_url.
 */
function tryNormalizePublicBase(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) {
    s = `http://${s}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (isLoopbackHost(u.hostname)) return '';
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

function getKhaltiPublicBaseUrlFromRequest(req) {
  const fromClient = tryNormalizePublicBase(req?.body?.publicApiBase);
  if (fromClient) {
    return fromClient;
  }

  const explicit = (
    process.env.PUBLIC_API_BASE_URL ||
    process.env.KHALTI_PUBLIC_BASE_URL ||
    process.env.NGROK_TUNNEL_URL ||
    ''
  ).trim();
  if (explicit) {
    const n = tryNormalizePublicBase(explicit);
    if (n) return n;
  }

  const baseEnv = (process.env.BASE_URL || process.env.KHALTI_RETURN_BASE || '').trim();
  if (baseEnv) {
    const n = tryNormalizePublicBase(baseEnv);
    if (n) return n;
  }

  if (req && typeof req.get === 'function') {
    const host = (req.get('x-forwarded-host') || req.get('host') || '').trim();
    const rawProto = (req.get('x-forwarded-proto') || '')
      .split(',')[0]
      .trim();
    const proto =
      rawProto ||
      (typeof req.protocol === 'string' ? req.protocol : 'http') ||
      'http';
    if (host && !isLoopbackHost(host.split(':')[0])) {
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  }

  return getKhaltiPublicBaseUrl();
}

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
  getKhaltiPublicBaseUrl,
  getKhaltiPublicBaseUrlFromRequest,
  tryNormalizePublicBase,
  getPaymentFailureMessage,
};
