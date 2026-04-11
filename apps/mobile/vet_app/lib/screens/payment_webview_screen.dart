import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../core/constants.dart';
import '../widgets/paw_sewa_loader.dart';

/// Generic in-app payment WebView for Khalti and any other payment gateway.
///
/// Pops with `true` when [successUrl] or "payment-success" is detected in the
/// redirected URL. Pops with `false` on "payment-failed" or manual close.
///
/// Using an in-app WebView instead of url_launcher allows injecting the
/// `ngrok-skip-browser-warning` header on the initial request so the Ngrok
/// interstitial page never blocks the payment flow.
class PaymentWebViewScreen extends StatefulWidget {
  const PaymentWebViewScreen({
    super.key,
    required this.paymentUrl,
    required this.successUrl,
    this.title = 'Complete Payment',
  });

  final String paymentUrl;
  final String successUrl;
  final String title;

  @override
  State<PaymentWebViewScreen> createState() => _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends State<PaymentWebViewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  static const _primary = Color(AppConstants.primaryColor);

  @override
  void initState() {
    super.initState();

    // Ngrok free-tier intercepts the first request with an HTML warning page
    // unless this header is present. A non-browser User-Agent provides a
    // second layer of bypass in case the header check is skipped.
    const ngrokHeaders = <String, String>{
      'ngrok-skip-browser-warning': 'true',
    };

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent('PawSewaPartnerApp/1.0 (Flutter; Payment)')
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _isLoading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
          onWebResourceError: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
          onNavigationRequest: (request) {
            final url = request.url;
            final uri = Uri.tryParse(url);

            // Khalti / backend callback — detect success / failure by URL pattern.
            if (uri != null &&
                (uri.path.contains('/payments/khalti/callback') ||
                    uri.path.contains('/khalti/callback'))) {
              final status =
                  (uri.queryParameters['status'] ?? '').toLowerCase();
              if (status == 'completed') {
                if (mounted) Navigator.of(context).pop(true);
                return NavigationDecision.prevent;
              }
              if (mounted) Navigator.of(context).pop(false);
              return NavigationDecision.prevent;
            }

            if (url.contains('payment-success') ||
                url.contains(widget.successUrl)) {
              if (mounted) Navigator.of(context).pop(true);
              return NavigationDecision.prevent;
            }
            if (url.contains('payment-failed') ||
                url.contains('status=User+canceled') ||
                url.contains('status=Expired')) {
              if (mounted) Navigator.of(context).pop(false);
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.paymentUrl), headers: ngrokHeaders);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        title: Text(
          widget.title,
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(child: PawSewaLoader()),
        ],
      ),
    );
  }
}
