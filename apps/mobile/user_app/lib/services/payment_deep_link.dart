import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import '../core/app_navigator.dart';
import '../screens/shop/order_success_screen.dart';

/// Handles `pawsewa://payment-success` after Khalti server redirect (outside WebView).
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
    if (uri.host == 'payment-success') {
      final orderId = uri.queryParameters['orderId']?.trim();
      final nav = appNavigatorKey.currentState;
      if (nav == null || orderId == null || orderId.isEmpty) return;
      nav.push(
        MaterialPageRoute<void>(
          builder: (_) => OrderSuccessScreen(orderId: orderId),
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
