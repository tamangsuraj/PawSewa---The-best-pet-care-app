import 'package:flutter/material.dart';

import 'api_client.dart';

/// Shown when Khalti lookup fails or returns non-success after WebView completes.
const String kKhaltiVerificationFailedMessage =
    'Payment Verification Failed. Please contact support.';

Future<bool> _verifyOnce(ApiClient api, String pidx) async {
  final tuple = await _verifyOnceWithOrderId(api, pidx);
  return tuple.$1;
}

/// Returns (success, orderId from backend when present).
Future<(bool, String?)> _verifyOnceWithOrderId(ApiClient api, String pidx) async {
  try {
    final resp = await api.verifyPayment(pidx: pidx.trim());
    final data = resp.data;
    if (data is! Map || data['success'] != true) {
      return (false, null);
    }
    if (data['orderId'] != null) {
      return (true, data['orderId'].toString());
    }
    final d = data['data'];
    if (d is Map && d['orderId'] != null) {
      return (true, d['orderId'].toString());
    }
    return (true, null);
  } catch (_) {
    return (false, null);
  }
}

/// Calls unified POST /payments/verify-payment with [pidx]. Shows [SnackBar] on failure.
/// Returns true only when backend responds with `success: true`.
Future<bool> verifyKhaltiPaymentOrNotify(
  BuildContext context,
  ApiClient api,
  String? pidx,
) async {
  if (pidx == null || pidx.trim().isEmpty) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(kKhaltiVerificationFailedMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    return false;
  }
  final ok = await _verifyOnce(api, pidx);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(kKhaltiVerificationFailedMessage),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
  return ok;
}

/// Backend retries Khalti lookup for Pending/Initiated; client retries for slow networks.
Future<bool> verifyKhaltiPaymentWithRetries(
  BuildContext context,
  ApiClient api,
  String? pidx, {
  int maxAttempts = 4,
}) async {
  if (pidx == null || pidx.trim().isEmpty) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(kKhaltiVerificationFailedMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    return false;
  }
  for (var i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    final ok = await _verifyOnce(api, pidx);
    if (ok) return true;
  }
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(kKhaltiVerificationFailedMessage),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
  return false;
}

/// Like [verifyKhaltiPaymentWithRetries] but returns the created [orderId] when the API includes it.
Future<(bool, String?)> verifyKhaltiPaymentWithRetriesAndOrderId(
  BuildContext context,
  ApiClient api,
  String? pidx, {
  int maxAttempts = 5,
}) async {
  if (pidx == null || pidx.trim().isEmpty) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(kKhaltiVerificationFailedMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    return (false, null);
  }
  String? orderId;
  for (var i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    final r = await _verifyOnceWithOrderId(api, pidx);
    if (r.$1) {
      orderId = r.$2 ?? orderId;
      return (true, orderId);
    }
  }
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(kKhaltiVerificationFailedMessage),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
  return (false, null);
}
