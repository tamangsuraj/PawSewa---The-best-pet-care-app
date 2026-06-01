import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';
import 'messages/messages_screen.dart';

/// After Fonepay initiate — show reference and instructions (manual verification).
class SubscriptionFonepayScreen extends StatelessWidget {
  const SubscriptionFonepayScreen({
    super.key,
    required this.planName,
    required this.amount,
    required this.referenceId,
  });

  final String planName;
  final num amount;
  final String referenceId;

  @override
  Widget build(BuildContext context) {
    const brown = Color(AppConstants.primaryColor);
    final ink = Colors.grey.shade900;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: brown,
        foregroundColor: Colors.white,
        title: Text(
          'Pay with Fonepay',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: brown.withValues(alpha: 0.12)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  planName,
                  style: GoogleFonts.fraunces(fontSize: 20, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  'NPR ${amount.toStringAsFixed(0)}',
                  style: GoogleFonts.outfit(fontSize: 26, fontWeight: FontWeight.w800, color: ink),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5F3),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(AppConstants.accentColor).withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Image.asset(
                  'assets/fonepay.webp',
                  height: 40,
                  width: 40,
                  errorBuilder: (_, _, _) => const Icon(Icons.account_balance_wallet_outlined, size: 40),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Open the Fonepay app and send the exact amount. Use the reference in the payment remarks.',
                    style: GoogleFonts.outfit(fontSize: 13, height: 1.35, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: brown.withValues(alpha: 0.12)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Payment reference (required)',
                  style: GoogleFonts.outfit(fontSize: 12.5, fontWeight: FontWeight.w700, color: ink.withValues(alpha: 0.7)),
                ),
                const SizedBox(height: 6),
                SelectableText(
                  referenceId,
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: brown),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Your subscription stays pending until we verify your Fonepay transfer. This usually takes up to one business day. You can check status under My Subscription.',
            style: GoogleFonts.outfit(fontSize: 13, height: 1.4, color: ink.withValues(alpha: 0.75)),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: brown),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const MessagesScreen()),
                );
              },
              icon: const Icon(Icons.support_agent_rounded, color: Colors.white),
              label: Text(
                'Send receipt in Customer Care',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Done'),
            ),
          ),
        ],
      ),
    );
  }
}
