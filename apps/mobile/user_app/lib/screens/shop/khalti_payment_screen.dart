import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/constants.dart';
import '../../widgets/editorial_canvas.dart';

/// In-app Khalti payment via WebView. Intercepts the backend callback URL
/// (any host — localhost, LAN IP, ngrok) and pops `true` on success or `false` on failure.
/// Also handles `pawsewa://payment-success` and `payment-success`/`payment-failed` URLs.
class KhaltiPaymentScreen extends StatefulWidget {
  const KhaltiPaymentScreen({
    super.key,
    required this.paymentUrl,
    required this.successUrl,
  });

  final String paymentUrl;
  final String successUrl;

  @override
  State<KhaltiPaymentScreen> createState() => _KhaltiPaymentScreenState();
}

class _KhaltiPaymentScreenState extends State<KhaltiPaymentScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _handledRedirect = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setUserAgent('PawSewaMobile/1.0 (KhaltiRedirectBypass)')
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _isLoading = true),
          onPageFinished: (_) => setState(() => _isLoading = false),
          onWebResourceError: (e) {
            if (mounted) setState(() => _isLoading = false);
          },
          onNavigationRequest: (request) {
            final url = request.url;
            final uri = Uri.tryParse(url);

            // Intercept the backend Khalti callback (any host/scheme) to prevent
            // WebView from loading localhost/LAN/ngrok warning pages.
            if (!_handledRedirect && _isKhaltiCallbackUrl(url)) {
              _handledRedirect = true;
              final pidx = uri?.queryParameters['pidx'] ?? '';
              final cbStatus = uri?.queryParameters['status'] ?? '';
              if (kDebugMode) {
                debugPrint('[INFO] Khalti callback intercepted. PIDX: $pidx');
              }
              final failed = cbStatus.toLowerCase().contains('fail') ||
                  cbStatus.toLowerCase() == 'canceled' ||
                  cbStatus.toLowerCase() == 'expired';
              if (mounted) Navigator.of(context).pop(!failed);
              return NavigationDecision.prevent;
            }

            if (uri != null && uri.scheme == 'pawsewa') {
              if (uri.host == 'payment-success') {
                if (mounted) Navigator.of(context).pop(true);
                return NavigationDecision.prevent;
              }
              if (uri.host == 'payment-failed') {
                if (mounted) Navigator.of(context).pop(false);
                return NavigationDecision.prevent;
              }
            }
            if (_isSuccessUrl(url)) {
              if (mounted) Navigator.of(context).pop(true);
              return NavigationDecision.prevent;
            }
            if (_isFailedUrl(url)) {
              if (mounted) Navigator.of(context).pop(false);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.paymentUrl));
  }

  /// Returns true for any Khalti callback URL regardless of host (localhost, LAN IP, ngrok).
  bool _isKhaltiCallbackUrl(String url) {
    final u = Uri.tryParse(url);
    if (u == null) return false;
    return u.path.contains('/payments/khalti/callback');
  }

  bool _isSuccessUrl(String url) {
    return url.contains('payment-success') ||
        url.contains(widget.successUrl) ||
        Uri.tryParse(widget.successUrl)?.host != null &&
            url.contains(Uri.parse(widget.successUrl).path);
  }

  bool _isFailedUrl(String url) {
    return url.contains('payment-failed');
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor); // #703418 PawSewa brown
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        title: Text(
          'Pay with Khalti',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: Stack(
              children: [
                WebViewWidget(controller: _controller),
                if (_isLoading)
                  const Center(
                    child: PawSewaLoader(),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
