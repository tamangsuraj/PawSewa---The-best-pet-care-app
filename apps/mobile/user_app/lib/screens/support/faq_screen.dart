import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants.dart';

class FaqScreen extends StatelessWidget {
  const FaqScreen({super.key});

  static const brown = Color(AppConstants.primaryColor);
  static const cream = Color(AppConstants.secondaryColor);

  @override
  Widget build(BuildContext context) {
    final items = <({String q, String a})>[
      (
        q: 'How do I book a vet appointment?',
        a:
            'Go to Services → choose Vet/Clinic → pick a time window → submit. You can track progress from your Requests screen.',
      ),
      (
        q: 'Where can I see my orders?',
        a:
            'Open Shop → My Orders. You’ll see all orders with live status updates and delivery chat when available.',
      ),
      (
        q: 'How do I contact support?',
        a:
            'Open Messages → Customer Care. You can share text, photos, or videos to explain an issue faster.',
      ),
      (
        q: 'Why can’t I see products or care centers?',
        a:
            'This is usually a network or server base URL issue. On Login you can set the server IP (recommended on local Wi‑Fi) instead of ngrok for more stable loading.',
      ),
      (
        q: 'Can I cancel a booking/request?',
        a:
            'If it hasn’t been completed, open your request details and tap Cancel. The app will update the status and notify the partner.',
      ),
    ];

    return Scaffold(
      backgroundColor: cream,
      appBar: AppBar(
        backgroundColor: brown,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'FAQs',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final it = items[i];
          return Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: brown.withValues(alpha: 0.10)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 14,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Theme(
              data: Theme.of(context).copyWith(
                dividerColor: Colors.transparent,
                splashColor: brown.withValues(alpha: 0.06),
                highlightColor: brown.withValues(alpha: 0.04),
              ),
              child: ExpansionTile(
                tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                shape: const Border(),
                collapsedShape: const Border(),
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: brown.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.help_outline_rounded, color: brown),
                ),
                title: Text(
                  it.q,
                  style: GoogleFonts.outfit(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: const Color(AppConstants.inkColor),
                  ),
                ),
                children: [
                  Text(
                    it.a,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      height: 1.35,
                      color:
                          const Color(AppConstants.inkColor).withValues(alpha: 0.72),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

