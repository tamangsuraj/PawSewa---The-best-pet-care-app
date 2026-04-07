import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/constants.dart';
import '../widgets/partner_scaffold.dart';

class OrderProofViewScreen extends StatelessWidget {
  const OrderProofViewScreen({super.key, required this.order});

  final Map<String, dynamic> order;

  String _orderIdShort() {
    final id = order['_id']?.toString() ?? '';
    if (id.length <= 6) return id;
    return id.substring(id.length - 6);
  }

  Map<String, dynamic> _proof() {
    final p = order['proofOfDelivery'];
    if (p is Map) return Map<String, dynamic>.from(p);
    return <String, dynamic>{};
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    final proof = _proof();
    final otp = proof['otp']?.toString().trim() ?? '';
    final photoUrl = proof['photoUrl']?.toString().trim() ?? '';
    final notes = proof['notes']?.toString().trim() ?? '';
    final submittedAt = proof['submittedAt']?.toString();

    return PartnerScaffold(
      title: 'Delivery proof',
      subtitle: 'Order #${_orderIdShort()}',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Proof summary',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: ink),
                ),
                const SizedBox(height: 6),
                Text(
                  submittedAt != null && submittedAt.trim().isNotEmpty
                      ? 'Submitted: ${submittedAt.split('T').first}'
                      : 'Submitted: —',
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w600,
                    color: ink.withValues(alpha: 0.65),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (otp.isNotEmpty)
            _InfoRow(
              label: 'OTP',
              value: otp,
              trailing: IconButton(
                tooltip: 'Copy OTP',
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: otp));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('OTP copied')),
                    );
                  }
                },
                icon: const Icon(Icons.copy_rounded),
              ),
            ),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 10),
            _InfoRow(label: 'Notes', value: notes),
          ],
          if (photoUrl.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Photo',
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
                color: ink.withValues(alpha: 0.70),
              ),
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: CachedNetworkImage(
                  imageUrl: photoUrl,
                  fit: BoxFit.cover,
                  placeholder: (context, _) => Container(
                    color: const Color(AppConstants.sandColor),
                    child: const Center(
                      child: PawSewaLoader(),
                    ),
                  ),
                  errorWidget: (context, _, _) => Container(
                    color: const Color(AppConstants.sandColor),
                    child: const Center(child: Icon(Icons.broken_image_rounded)),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: () async {
                    final uri = Uri.tryParse(photoUrl);
                    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                  },
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: Text('Open', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                ),
              ],
            ),
          ],
          if (otp.isEmpty && notes.isEmpty && photoUrl.isEmpty) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: primary.withValues(alpha: 0.10)),
              ),
              child: Text(
                'No proof data found for this order.',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: ink.withValues(alpha: 0.75)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.trailing});
  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: primary.withValues(alpha: 0.10)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: GoogleFonts.outfit(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.7,
                    color: ink.withValues(alpha: 0.60),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: GoogleFonts.outfit(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: ink,
                  ),
                ),
              ],
            ),
          ),
      trailing ?? const SizedBox.shrink(),
        ],
      ),
    );
  }
}

