/// Centralized payment configuration for PawSewa User App.
/// Mirrors backend payment_config for consistent behavior.
library;

class PaymentConfig {
  PaymentConfig._();

  /// Khalti sandbox base URL. Production: https://khalti.com/api/v2/
  static const String khaltiBaseUrl = 'https://dev.khalti.com/api/v2/';

  /// Convert NPR amount to Paisa (Amount * 100).
  /// Khalti API requires amounts in Paisa.
  static int nprToPaisa(double amountNpr) {
    return (amountNpr * 100).round();
  }

  /// Map Khalti failure reason to user-friendly message.
  /// Use across app for consistent error handling.
  static String getPaymentFailureMessage(String? reason) {
    if (reason == null || reason.trim().isEmpty) {
      return 'Payment was not completed. Please try again.';
    }
    final r = reason.toLowerCase().trim();
    if (r.contains('cancel') || r.contains('user cancel')) {
      return 'Payment was cancelled. You can try again when ready.';
    }
    if (r.contains('expire') || r.contains('timeout')) {
      return 'Payment link expired. Please initiate a new payment.';
    }
    if (r.contains('insufficient') || r.contains('balance')) {
      return 'Insufficient balance. Please add funds to your wallet and try again.';
    }
    if (r.contains('decline') || r.contains('reject')) {
      return 'Payment was declined. Please try another payment method.';
    }
    if (r.contains('fail') || r.contains('error')) {
      return 'Payment failed. Please try again or use another payment method.';
    }
    return 'Payment was not completed. Please try again.';
  }
}
