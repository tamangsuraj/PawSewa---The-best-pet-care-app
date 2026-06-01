import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/khalti_verify_helper.dart';
import '../widgets/app_loader_overlay.dart';
import '../widgets/editorial_canvas.dart';
import 'shop/khalti_payment_screen.dart';
import 'subscription_fonepay_screen.dart';

/// Khalti or Fonepay only — required before a PawSewa Pro plan activates.
class SubscriptionPaymentScreen extends StatefulWidget {
  const SubscriptionPaymentScreen({
    super.key,
    required this.planId,
    required this.planName,
    required this.price,
    required this.cycle,
  });

  final String planId;
  final String planName;
  final num price;
  final String cycle;

  @override
  State<SubscriptionPaymentScreen> createState() => _SubscriptionPaymentScreenState();
}

class _SubscriptionPaymentScreenState extends State<SubscriptionPaymentScreen> {
  final _api = ApiClient();
  bool _busy = false;

  Future<void> _payWithKhalti() async {
    setState(() => _busy = true);
    AppLoaderOverlayController? loader;
    if (mounted) loader = AppLoaderOverlay.show(context, message: 'Starting Khalti…');
    try {
      final data = await _api.initiateSubscriptionKhalti(widget.planId);
      loader?.hide();
      loader = null;
      final url = data['paymentUrl']?.toString();
      final successUrl = data['successUrl']?.toString() ?? '';
      final pidx = data['pidx']?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('No payment URL from server');
      }
      if (!mounted) return;
      final paid = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => KhaltiPaymentScreen(paymentUrl: url, successUrl: successUrl),
        ),
      );
      if (!mounted) return;
      if (paid != true) {
        setState(() => _busy = false);
        return;
      }
      if (mounted) loader = AppLoaderOverlay.show(context, message: 'Verifying payment…');
      final verified = await verifyKhaltiPaymentOrNotify(context, _api, pidx);
      loader?.hide();
      if (!mounted) return;
      setState(() => _busy = false);
      if (verified) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Subscription activated'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true);
      }
    } on DioException catch (e) {
      loader?.hide();
      if (mounted) {
        setState(() => _busy = false);
        final msg = e.response?.data is Map
            ? e.response!.data['message']?.toString()
            : 'Could not start Khalti payment';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg ?? 'Payment failed')));
      }
    } catch (e) {
      loader?.hide();
      if (mounted) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  Future<void> _payWithFonepay() async {
    setState(() => _busy = true);
    AppLoaderOverlayController? loader;
    if (mounted) loader = AppLoaderOverlay.show(context, message: 'Creating reference…');
    try {
      final data = await _api.initiateSubscriptionFonepay(widget.planId);
      loader?.hide();
      if (!mounted) return;
      setState(() => _busy = false);
      final ref = data['referenceId']?.toString() ?? '';
      final amount = (data['amount'] as num?) ?? widget.price;
      final name = data['planName']?.toString() ?? widget.planName;
      final done = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => SubscriptionFonepayScreen(
            planName: name,
            amount: amount,
            referenceId: ref,
          ),
        ),
      );
      if (mounted && done == true) Navigator.of(context).pop(true);
    } on DioException catch (e) {
      loader?.hide();
      if (mounted) {
        setState(() => _busy = false);
        final msg = e.response?.data is Map
            ? e.response!.data['message']?.toString()
            : 'Fonepay setup failed';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg ?? 'Failed')));
      }
    } catch (e) {
      loader?.hide();
      if (mounted) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text('Subscribe', style: GoogleFonts.fraunces(fontWeight: FontWeight.w600)),
      ),
      body: Stack(
        children: [
          const EditorialBodyBackdrop(),
          ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                widget.planName,
                style: GoogleFonts.fraunces(fontSize: 22, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              Text(
                'NPR ${widget.price} / ${widget.cycle}',
                style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                'Choose how you want to pay. Your plan activates after payment is confirmed.',
                style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade700, height: 1.35),
              ),
              const SizedBox(height: 28),
              Text(
                'PAY WITH',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey.shade600,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 12),
              _methodTile(
                primary: primary,
                label: 'Khalti',
                subtitle: 'Pay instantly with Khalti wallet',
                asset: 'assets/khalti.png',
                borderColor: const Color(0xFF5C2D91),
                onTap: _busy ? null : _payWithKhalti,
              ),
              const SizedBox(height: 12),
              _methodTile(
                primary: primary,
                label: 'Fonepay',
                subtitle: 'Pay via Fonepay app — we verify your transfer',
                asset: 'assets/fonepay.webp',
                borderColor: const Color(AppConstants.accentColor),
                onTap: _busy ? null : _payWithFonepay,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _methodTile({
    required Color primary,
    required String label,
    required String subtitle,
    required String asset,
    required Color borderColor,
    required VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor.withValues(alpha: 0.35), width: 2),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Image.asset(
                  asset,
                  height: 36,
                  width: 36,
                  errorBuilder: (_, _, _) => Icon(Icons.payment, color: primary, size: 36),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: borderColor),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
