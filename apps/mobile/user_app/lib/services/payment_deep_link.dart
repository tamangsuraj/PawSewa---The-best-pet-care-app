import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../core/app_navigator.dart';
import '../screens/shop/my_orders_screen.dart';
import '../screens/shop/order_success_screen.dart';

/// Handles `pawsewa://payment-success` and `pawsewa://payment-failed` deep links
/// that arrive from the Khalti server redirect (outside WebView context).
class PaymentDeepLinkScope extends StatefulWidget {
  const PaymentDeepLinkScope({super.key, required this.child});

  final Widget child;

  @override
  State<PaymentDeepLinkScope> createState() => _PaymentDeepLinkScopeState();
}

class _PaymentDeepLinkScopeState extends State<PaymentDeepLinkScope> {
  StreamSubscription<Uri>? _sub;
  final _appLinks = AppLinks();

  @override
  void initState() {
    super.initState();
    _sub = _appLinks.uriLinkStream.listen(_handleUri);
    unawaited(_consumeInitial());
  }

  Future<void> _consumeInitial() async {
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) _handleUri(initial);
    } catch (_) {
      /* ignore */
    }
  }

  void _handleUri(Uri uri) {
    if (uri.scheme != 'pawsewa') return;
    final nav = appNavigatorKey.currentState;
    if (nav == null) return;

    if (uri.host == 'payment-success') {
      final orderId = uri.queryParameters['orderId']?.trim();
      if (kDebugMode) {
        debugPrint('[INFO] Deep link received: payment-success. orderId: $orderId');
      }
      nav.push(
        MaterialPageRoute<void>(
          builder: (_) => OrderSuccessScreen(
            orderId: (orderId != null && orderId.isNotEmpty) ? orderId : null,
          ),
        ),
      );
    } else if (uri.host == 'payment-failed') {
      final reason = uri.queryParameters['reason']?.trim() ?? 'Payment was not completed.';
      if (kDebugMode) {
        debugPrint('[INFO] Deep link received: payment-failed. reason: $reason');
      }
      nav.push(
        MaterialPageRoute<void>(
          builder: (ctx) => Scaffold(
            backgroundColor: Colors.white,
            appBar: AppBar(
              backgroundColor: Colors.white,
              elevation: 0,
              leading: BackButton(color: Colors.black87),
              title: const Text(
                'Payment failed',
                style: TextStyle(
                  color: Colors.black87,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            body: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.cancel_outlined,
                      size: 88,
                      color: Color(0xFFD32F2F),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Payment not completed',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Colors.black87,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      reason,
                      style: const TextStyle(
                        fontSize: 14,
                        color: Colors.black54,
                        height: 1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 40),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () {
                          nav.pushReplacement(
                            MaterialPageRoute<void>(
                              builder: (_) => const MyOrdersScreen(),
                            ),
                          );
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF703418),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        child: const Text(
                          'View my orders',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }
  }

  @override
  void dispose() {
    unawaited(_sub?.cancel() ?? Future<void>.value());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
