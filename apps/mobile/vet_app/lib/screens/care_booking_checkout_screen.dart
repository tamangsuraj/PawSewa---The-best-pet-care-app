import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';

/// Read-only payment summary + **Complete booking** (PATCH /care-bookings/:id/complete).
class CareBookingCheckoutScreen extends StatefulWidget {
  const CareBookingCheckoutScreen({
    super.key,
    required this.booking,
  });

  final Map<String, dynamic> booking;

  @override
  State<CareBookingCheckoutScreen> createState() =>
      _CareBookingCheckoutScreenState();
}

class _CareBookingCheckoutScreenState extends State<CareBookingCheckoutScreen> {
  final _api = ApiClient();
  bool _submitting = false;

  String _id() => widget.booking['_id']?.toString() ?? '';

  double? _n(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  Future<void> _complete() async {
    final id = _id();
    if (id.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await _api.markBookingCompleted(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Booking marked completed.', style: GoogleFonts.outfit()),
          backgroundColor: Colors.green.shade700,
        ),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: GoogleFonts.outfit())),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final b = widget.booking;
    final pet = b['petId'];
    final hostel = b['hostelId'];
    final petName = pet is Map ? (pet['name']?.toString() ?? 'Pet') : 'Pet';
    final centre =
        hostel is Map ? (hostel['name']?.toString() ?? 'Care centre') : 'Care centre';
    final subtotal = _n(b['subtotal']) ?? 0;
    final cleaning = _n(b['cleaningFee']) ?? 0;
    final service = _n(b['serviceFee']) ?? 0;
    final platform = _n(b['platformFee']) ?? 0;
    final tax = _n(b['tax']) ?? 0;
    final total = _n(b['totalAmount']) ?? 0;
    final payStatus = b['paymentStatus']?.toString() ?? '';
    final payMethod = b['paymentMethod']?.toString() ?? '';

    Widget row(String label, double amount, {bool bold = false, int fractionDigits = 0}) {
      final decimals = bold ? 2 : fractionDigits;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.outfit(
                  fontSize: bold ? 15 : 14,
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                  color: Colors.grey[800],
                ),
              ),
            ),
            Text(
              'Rs. ${amount.toStringAsFixed(decimals)}',
              style: GoogleFonts.outfit(
                fontSize: bold ? 17 : 14,
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: bold ? primary : Colors.black87,
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: primary,
        title: Text(
          'Booking summary',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w700,
            color: primary,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            petName,
            style: GoogleFonts.outfit(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Colors.grey[900],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            centre,
            style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[700]),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Payment breakdown',
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey[700],
                  ),
                ),
                const SizedBox(height: 8),
                row('Subtotal', subtotal),
                if (cleaning > 0) row('Cleaning fee', cleaning),
                row('Service fee', service),
                if (platform > 0) row('Platform fee', platform),
                if (tax > 0) row('Tax (VAT)', tax, fractionDigits: 2),
                Divider(height: 24, color: Colors.grey.shade300),
                row('Total', total, bold: true),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Text(
                'Payment: ',
                style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey[700]),
              ),
              Text(
                payMethod == 'cash_on_delivery' ? 'Cash on delivery' : 'Online',
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[900],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  payStatus.toUpperCase(),
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'Review the total above. Completing marks this stay as finished and updates your records.',
            style: GoogleFonts.outfit(
              fontSize: 13,
              color: Colors.grey[700],
              height: 1.4,
            ),
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _submitting ? null : _complete,
              style: FilledButton.styleFrom(
                backgroundColor: primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: _submitting
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: PawSewaLoader(width: 36, center: false),
                    )
                  : Text(
                      'Complete booking',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
