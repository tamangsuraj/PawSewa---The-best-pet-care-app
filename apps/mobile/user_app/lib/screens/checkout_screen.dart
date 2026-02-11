import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';

class CheckoutScreen extends StatefulWidget {
  final String serviceRequestId;
  final double amount;

  const CheckoutScreen({
    super.key,
    required this.serviceRequestId,
    required this.amount,
  });

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _apiClient = ApiClient();
  bool _isLoading = false;

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not open payment page', style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _payWithKhalti() async {
    setState(() => _isLoading = true);
    try {
      final resp = await _apiClient.initiateKhaltiPayment(
        serviceRequestId: widget.serviceRequestId,
        amount: widget.amount,
      );
      final data = resp.data is Map ? resp.data['data'] as Map<String, dynamic>? : null;
      final url = data?['paymentUrl']?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('Missing payment URL from server');
      }
      await _openUrl(url);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to start Khalti payment: $e', style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _payWithEsewa() async {
    setState(() => _isLoading = true);
    try {
      final resp = await _apiClient.initiateEsewaPayment(
        serviceRequestId: widget.serviceRequestId,
        amount: widget.amount,
      );
      final data = resp.data is Map ? resp.data['data'] as Map<String, dynamic>? : null;
      final url = data?['redirect_url']?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('Missing eSewa redirect URL from server');
      }
      await _openUrl(url);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to start eSewa payment: $e', style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = const Color(AppConstants.primaryColor);

    return Scaffold(
      backgroundColor: const Color(AppConstants.bentoBackgroundColor),
      appBar: AppBar(
        title: Text(
          'Checkout',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: primary,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Select a payment method',
              style: GoogleFonts.poppins(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.grey[900],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Amount: NPR ${widget.amount.toStringAsFixed(2)}',
              style: GoogleFonts.poppins(
                fontSize: 14,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 24),
            _paymentButton(
              color: Colors.deepPurple,
              label: 'Pay with Khalti',
              subtitle: 'Instant payment via Khalti wallet',
              onTap: _isLoading ? null : _payWithKhalti,
            ),
            const SizedBox(height: 12),
            _paymentButton(
              color: Colors.green.shade600,
              label: 'Pay with eSewa',
              subtitle: 'Popular wallet in Nepal',
              onTap: _isLoading ? null : _payWithEsewa,
            ),
            const SizedBox(height: 12),
            _paymentButton(
              color: Colors.blueGrey.shade700,
              label: 'Bank Transfer',
              subtitle: 'Manual transfer – we will verify',
              onTap: _isLoading
                  ? null
                  : () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            'Bank transfer flow not implemented yet.',
                            style: GoogleFonts.poppins(),
                          ),
                        ),
                      );
                    },
            ),
          ],
        ),
      ),
    );
  }

  Widget _paymentButton({
    required Color color,
    required String label,
    required String subtitle,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Ink(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.25), width: 2),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.payments, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: GoogleFonts.poppins(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[900],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: GoogleFonts.poppins(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}

