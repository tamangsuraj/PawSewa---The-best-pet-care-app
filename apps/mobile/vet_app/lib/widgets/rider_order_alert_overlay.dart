import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';

/// Uber-style incoming delivery alert. Shown as a full-screen modal that
/// animates up from the bottom, pulses, and auto-declines after 60 s.
class RiderOrderAlertOverlay extends StatefulWidget {
  const RiderOrderAlertOverlay({
    super.key,
    required this.order,
    required this.onAccept,
    required this.onDecline,
  });

  final Map<String, dynamic> order;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  State<RiderOrderAlertOverlay> createState() => _RiderOrderAlertOverlayState();
}

class _RiderOrderAlertOverlayState extends State<RiderOrderAlertOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseScale;
  int _countdown = 60;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _pulseScale = Tween<double>(begin: 0.92, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _countdown--);
      if (_countdown <= 0) {
        t.cancel();
        widget.onDecline();
      }
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final id = order['_id']?.toString() ?? '';
    final shortId =
        id.length >= 6 ? id.substring(id.length - 6).toUpperCase() : id.toUpperCase();
    final total = (order['totalAmount'] as num?)?.toDouble() ?? 0;
    final items = order['items'] is List ? order['items'] as List : [];
    final address = (order['deliveryLocation'] is Map
                ? (order['deliveryLocation'] as Map)['address']
                : null)
            ?.toString() ??
        'See app for details';

    const riderAccent = Color(AppConstants.riderAccent);
    const accent = Color(AppConstants.accentColor);
    const successGreen = Color(AppConstants.primaryColor);

    // Inserted as an OverlayEntry — parent controls removal, no Navigator needed.
    return Material(
      color: Colors.black.withValues(alpha: 0.82),
      child: SafeArea(
          child: Column(
            children: [
              // ── Pulsing icon in the dark area ──────────────────────────
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ScaleTransition(
                        scale: _pulseScale,
                        child: Container(
                          width: 130,
                          height: 130,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: riderAccent.withValues(alpha: 0.18),
                            border: Border.all(color: riderAccent, width: 3),
                            boxShadow: [
                              BoxShadow(
                                color: riderAccent.withValues(alpha: 0.35),
                                blurRadius: 28,
                                spreadRadius: 4,
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.local_shipping_rounded,
                            size: 60,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'New Delivery Request',
                        style: GoogleFonts.outfit(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          letterSpacing: 0.4,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'A new order has been assigned to you',
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Colors.white60,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Bottom card ────────────────────────────────────────────
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A1A),
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(28)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.55),
                      blurRadius: 24,
                      offset: const Offset(0, -6),
                    ),
                  ],
                ),
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // header row: badge + countdown
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: riderAccent.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: riderAccent.withValues(alpha: 0.5)),
                          ),
                          child: Text(
                            'NEW ORDER',
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: riderAccent,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ),
                        const Spacer(),
                        AnimatedDefaultTextStyle(
                          duration: const Duration(milliseconds: 200),
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: _countdown <= 10
                                ? Colors.redAccent
                                : Colors.white60,
                          ),
                          child: Text('$_countdown s'),
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    Text(
                      'Order #$shortId',
                      style: GoogleFonts.outfit(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),

                    const SizedBox(height: 12),

                    _InfoRow(
                      icon: Icons.storefront_rounded,
                      label: 'Pickup',
                      value: 'PawSewa Shop',
                    ),
                    const SizedBox(height: 6),
                    _InfoRow(
                      icon: Icons.location_on_rounded,
                      label: 'Drop-off',
                      value: address,
                    ),
                    if (items.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      _InfoRow(
                        icon: Icons.inventory_2_rounded,
                        label: 'Items',
                        value: items
                            .map((e) =>
                                '${(e is Map ? e['name'] : null) ?? 'Item'} ×${(e is Map ? e['quantity'] : null) ?? 1}')
                            .join(', '),
                      ),
                    ],

                    const SizedBox(height: 16),

                    Text(
                      'Rs. ${total.toStringAsFixed(0)}',
                      style: GoogleFonts.fraunces(
                        fontSize: 36,
                        fontWeight: FontWeight.w700,
                        color: accent,
                        letterSpacing: 0.4,
                      ),
                    ),

                    const SizedBox(height: 22),

                    // Accept / Decline buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: widget.onDecline,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.redAccent,
                              side: const BorderSide(
                                  color: Colors.redAccent, width: 1.5),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: Text(
                              'Decline',
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: FilledButton(
                            onPressed: widget.onAccept,
                            style: FilledButton.styleFrom(
                              backgroundColor: successGreen,
                              foregroundColor: Colors.white,
                              padding:
                                  const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: Text(
                              'Accept',
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: Colors.white38),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: Colors.white54,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
