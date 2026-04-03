/**
 * Centralized payment configuration for PawSewa User Web.
 * Mirrors backend payment_config for consistent behavior.
 */

/** Khalti sandbox base URL. Production: https://khalti.com/api/v2/ */
export const KHALTI_BASE_URL = 'https://dev.khalti.com/api/v2/';

/** Convert NPR amount to Paisa (Amount * 100). Khalti API requires amounts in Paisa. */
export function nprToPaisa(amountNpr: number): number {
  return Math.round(amountNpr * 100);
}

/**
 * Map Khalti failure reason to user-friendly message.
 * Use across app for consistent error handling.
 */
export function getPaymentFailureMessage(reason: string | null | undefined): string {
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
