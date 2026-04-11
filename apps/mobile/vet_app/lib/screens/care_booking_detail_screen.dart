import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'care_booking_checkout_screen.dart';
import 'partner_marketplace_chat_screen.dart';

/// Full care/hostel booking details: totals, actions (confirm → check-in → checkout complete).
class CareBookingDetailScreen extends StatefulWidget {
  const CareBookingDetailScreen({
    super.key,
    required this.initialBooking,
  });

  final Map<String, dynamic> initialBooking;

  @override
  State<CareBookingDetailScreen> createState() => _CareBookingDetailScreenState();
}

class _CareBookingDetailScreenState extends State<CareBookingDetailScreen> {
  final _api = ApiClient();
  late Map<String, dynamic> _b;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _b = Map<String, dynamic>.from(widget.initialBooking);
  }

  String get _bid => _b['_id']?.toString() ?? '';

  String _status() => (_b['status'] ?? '').toString();

  double? _n(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  bool _canConfirm() {
    const ok = {
      'awaiting_approval',
      'pending_payment',
      'pending',
      'paid',
    };
    return ok.contains(_status());
  }

  bool _canCheckIn() {
    const ok = {'confirmed', 'accepted'};
    return ok.contains(_status());
  }

  /// Backend allows complete from confirmed | accepted | checked_in.
  bool _canOpenCheckout() {
    const ok = {'checked_in', 'confirmed', 'accepted'};
    return ok.contains(_status());
  }

  void _merge(Map<String, dynamic>? m) {
    if (m == null) return;
    setState(() {
      for (final e in m.entries) {
        _b[e.key] = e.value;
      }
    });
  }

  Future<void> _respond(bool accept) async {
    if (_bid.isEmpty) return;
    if (!accept) {
      final go = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Decline booking?', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          content: Text(
            'The customer will be notified.',
            style: GoogleFonts.outfit(),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Decline')),
          ],
        ),
      );
      if (go != true) return;
    }
    setState(() => _busy = true);
    try {
      final resp = await _api.respondToBooking(_bid, accept: accept);
      final data = resp.data;
      if (data is Map && data['data'] is Map) {
        _merge(Map<String, dynamic>.from(data['data'] as Map));
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            accept ? 'Booking confirmed.' : 'Booking declined.',
            style: GoogleFonts.outfit(),
          ),
          backgroundColor: accept ? Colors.green.shade700 : Colors.orange.shade800,
        ),
      );
      if (!accept) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: GoogleFonts.outfit())),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkIn() async {
    if (_bid.isEmpty) return;
    setState(() => _busy = true);
    try {
      final resp = await _api.patchCareBookingCheckIn(_bid);
      final data = resp.data;
      if (data is Map && data['data'] is Map) {
        _merge(Map<String, dynamic>.from(data['data'] as Map));
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Checked in.', style: GoogleFonts.outfit()),
          backgroundColor: Colors.green.shade700,
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: GoogleFonts.outfit())),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openCheckout() async {
    final done = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => CareBookingCheckoutScreen(booking: Map<String, dynamic>.from(_b)),
      ),
    );
    if (done == true && mounted) Navigator.of(context).pop(true);
  }

  Future<void> _openChat() async {
    if (_bid.isEmpty) return;
    try {
      final r = await _api.openCareMarketplaceChat(_bid);
      final body = r.data;
      if (body is! Map || body['success'] != true) return;
      final conv = body['data'];
      if (conv is! Map) return;
      final cid = conv['_id']?.toString();
      if (cid == null || !mounted) return;
      final user = _b['userId'];
      final peer = user is Map ? (user['name']?.toString() ?? 'Customer') : 'Customer';
      await Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => PartnerMarketplaceChatScreen(
            conversationId: cid,
            peerName: peer,
            peerSubtitle: 'Care booking',
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: GoogleFonts.outfit())),
        );
      }
    }
  }

  Future<void> _openPickupMap() async {
    final pa = _b['pickupAddress'];
    if (pa is! Map) return;
    final pt = pa['point'];
    if (pt is! Map) return;
    final coords = pt['coordinates'];
    if (coords is! List || coords.length < 2) return;
    final lng = (coords[0] as num).toDouble();
    final lat = (coords[1] as num).toDouble();
    final uri = Uri.parse(
      'https://www.openstreetmap.org/?mlat=$lat&mlon=$lng#map=17/$lat/$lng',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey[600]),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Colors.grey[900],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _moneyRow(String label, double amount, {int fractionDigits = 0}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[800]),
          ),
          Text(
            'Rs. ${amount.toStringAsFixed(fractionDigits)}',
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.grey[900],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final pet = _b['petId'];
    final user = _b['userId'];
    final hostel = _b['hostelId'];
    final petName = pet is Map ? (pet['name']?.toString() ?? 'Pet') : 'Pet';
    final breed = pet is Map ? (pet['breed']?.toString() ?? '') : '';
    final ownerName = user is Map ? (user['name']?.toString() ?? '—') : '—';
    final ownerPhone = user is Map ? (user['phone']?.toString() ?? '') : '';
    final ownerEmail = user is Map ? (user['email']?.toString() ?? '') : '';
    final hostelName = hostel is Map ? (hostel['name']?.toString() ?? 'Service') : 'Service';
    final serviceType = _b['serviceType']?.toString() ?? '';
    final checkIn = _b['checkIn']?.toString();
    final checkOut = _b['checkOut']?.toString();
    final nights = _b['nights'];
    final logistics = (_b['logisticsType'] ?? '').toString();
    final payMethod = _b['paymentMethod']?.toString() ?? '';
    final payStatus = _b['paymentStatus']?.toString() ?? '';
    final status = _status();

    final subtotal = _n(_b['subtotal']) ?? 0;
    final cleaning = _n(_b['cleaningFee']) ?? 0;
    final serviceFee = _n(_b['serviceFee']) ?? 0;
    final platform = _n(_b['platformFee']) ?? 0;
    final tax = _n(_b['tax']) ?? 0;
    final total = _n(_b['totalAmount']) ?? 0;

    String fmt(String? iso) {
      if (iso == null) return '—';
      final d = DateTime.tryParse(iso);
      if (d == null) return iso;
      return '${d.day}/${d.month}/${d.year}';
    }

    String? pickupAddr;
    final pickup = _b['pickupAddress'];
    bool hasPickupCoords = false;
    if (pickup is Map) {
      pickupAddr = pickup['address']?.toString();
      final pt = pickup['point'];
      if (pt is Map && pt['coordinates'] is List && (pt['coordinates'] as List).length >= 2) {
        hasPickupCoords = true;
      }
    }

    final showActions = _canConfirm() || _canCheckIn() || _canOpenCheckout();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: primary,
        title: Text(
          'Booking details',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: primary),
        ),
        actions: [
          IconButton(
            tooltip: 'Message customer',
            onPressed: _busy ? null : _openChat,
            icon: Icon(Icons.chat_bubble_outline_rounded, color: primary),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  status.toUpperCase().replaceAll('_', ' '),
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    color: primary,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Pet',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 6),
              _row('Name', petName),
              if (breed.isNotEmpty) _row('Breed', breed),
              const SizedBox(height: 16),
              Text(
                'Customer',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 6),
              _row('Name', ownerName),
              if (ownerPhone.isNotEmpty) _row('Phone', ownerPhone),
              if (ownerEmail.isNotEmpty) _row('Email', ownerEmail),
              const SizedBox(height: 16),
              Text(
                'Service',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 6),
              _row('Centre', hostelName),
              if (serviceType.isNotEmpty) _row('Type', serviceType),
              _row('Check-in', fmt(checkIn)),
              _row('Check-out', fmt(checkOut)),
              _row('Nights', '$nights'),
              _row('Logistics', logistics == 'pickup' ? 'Pickup' : 'Self drop-off'),
              if (logistics == 'pickup' && pickupAddr != null && pickupAddr.isNotEmpty)
                _row('Pickup address', pickupAddr),
              if (hasPickupCoords)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: TextButton.icon(
                    onPressed: _openPickupMap,
                    icon: const Icon(Icons.map_rounded, size: 20),
                    label: const Text('View on map'),
                  ),
                ),
              const SizedBox(height: 20),
              Text(
                'Payment',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 8),
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
                    _moneyRow('Subtotal', subtotal),
                    if (cleaning > 0) _moneyRow('Cleaning fee', cleaning),
                    _moneyRow('Service fee', serviceFee),
                    if (platform > 0) _moneyRow('Platform fee', platform),
                    if (tax > 0) _moneyRow('Tax (VAT)', tax, fractionDigits: 2),
                    Divider(height: 20, color: Colors.grey.shade300),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Total',
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey[900],
                          ),
                        ),
                        Text(
                          'Rs. ${total.toStringAsFixed(2)}',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: primary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _row(
                'Payment method',
                payMethod == 'cash_on_delivery' ? 'Cash on delivery' : 'Online',
              ),
              _row('Payment status', payStatus),
              ],
            ),
          ),
          if (showActions)
            Material(
              elevation: 8,
              color: Colors.white,
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_busy)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Center(
                            child: SizedBox(
                              height: 24,
                              width: 24,
                              child: PawSewaLoader(width: 32, center: false),
                            ),
                          ),
                        ),
                      if (_canConfirm()) ...[
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: _busy ? null : () => _respond(false),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.red,
                                  side: const BorderSide(color: Colors.red),
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                ),
                                child: Text('Decline', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: FilledButton(
                                onPressed: _busy ? null : () => _respond(true),
                                style: FilledButton.styleFrom(
                                  backgroundColor: Colors.green.shade700,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                ),
                                child: Text(
                                  'Confirm booking',
                                  style: GoogleFonts.outfit(fontWeight: FontWeight.w800),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                      ],
                      if (_canCheckIn())
                        FilledButton.icon(
                          onPressed: _busy ? null : _checkIn,
                          icon: const Icon(Icons.pets_rounded),
                          label: Text(
                            'Record check-in',
                            style: GoogleFonts.outfit(fontWeight: FontWeight.w800),
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                        ),
                      if (_canOpenCheckout()) ...[
                        if (_canCheckIn()) const SizedBox(height: 10),
                        OutlinedButton(
                          onPressed: _busy ? null : _openCheckout,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: primary,
                            side: BorderSide(color: primary.withValues(alpha: 0.5)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            'View summary & complete',
                            style: GoogleFonts.outfit(fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
