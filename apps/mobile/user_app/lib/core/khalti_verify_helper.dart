import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import 'api_client.dart';

/// Shown when Khalti lookup fails or returns non-success after WebView completes.
const String kKhaltiVerificationFailedMessage =
    'Payment Verification Failed. Please contact support.';

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
  try {
    final resp = await api.verifyPayment(pidx: pidx.trim());
    final data = resp.data;
    final ok = data is Map && data['success'] == true;
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(kKhaltiVerificationFailedMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    return ok;
  } on DioException catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(kKhaltiVerificationFailedMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    return false;
  } catch (_) {
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
}
