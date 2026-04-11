import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../screens/care_booking_detail_screen.dart';
import '../screens/my_business_screen.dart';
import '../services/socket_service.dart';

/// Care / hostel partner home: shows non-completed care bookings (same API as [MyBusinessScreen] Incoming).
class CareHomeActiveBookingsPanel extends StatefulWidget {
  const CareHomeActiveBookingsPanel({super.key});

  @override
  State<CareHomeActiveBookingsPanel> createState() =>
      _CareHomeActiveBookingsPanelState();
}

class _CareHomeActiveBookingsPanelState extends State<CareHomeActiveBookingsPanel> {
  final _api = ApiClient();
  List<Map<String, dynamic>> _bookings = [];
  bool _loading = true;
  String? _confirmingId;

  static bool _isActive(Map<String, dynamic> b) {
    final s = (b['status'] ?? '').toString().toLowerCase();
    const closed = {'completed', 'cancelled', 'declined', 'rejected'};
    return !closed.contains(s);
  }

  @override
  void initState() {
    super.initState();
    SocketService.instance.connect();
    SocketService.instance.addCareBookingListener(_onCareSocket);
    unawaited(_load());
  }

  @override
  void dispose() {
    SocketService.instance.removeCareBookingListener(_onCareSocket);
    super.dispose();
  }

  void _onCareSocket(String event, Map<String, dynamic> payload) {
    if (event != 'care_booking:new' &&
        event != 'care_booking:update' &&
        event != 'care_booking:assigned') {
      return;
    }
    if (!mounted) return;
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await _api.getIncomingBookings();
      final data = resp.data;
      final list = <Map<String, dynamic>>[];
      if (data is Map && data['data'] is List) {
        for (final e in data['data'] as List) {
          if (e is Map<String, dynamic>) {
            list.add(e);
          } else if (e is Map) {
            list.add(Map<String, dynamic>.from(e));
          }
        }
      }
      if (!mounted) return;
      final active = list.where(_isActive).toList()
        ..sort((a, b) {
          final da =
              DateTime.tryParse((a['createdAt'] ?? '').toString()) ?? DateTime(1970);
          final db =
              DateTime.tryParse((b['createdAt'] ?? '').toString()) ?? DateTime(1970);
          return db.compareTo(da);
        });
      setState(() {
        _bookings = active;
        _loading = false;
      });
    } catch (e) {
      if (kDebugMode) debugPrint('[CareHomeBookings] $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _canConfirm(Map<String, dynamic> b) {
    final s = (b['status'] ?? '').toString();
    return const {
      'awaiting_approval',
      'pending_payment',
      'pending',
      'paid',
    }.contains(s);
  }

  Future<void> _openBooking(Map<String, dynamic> b) async {
    await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => CareBookingDetailScreen(
          initialBooking: Map<String, dynamic>.from(b),
        ),
      ),
    );
    if (mounted) await _load();
  }

  Future<void> _confirmBooking(Map<String, dynamic> b) async {
    final id = b['_id']?.toString();
    if (id == null || !_canConfirm(b)) return;
    setState(() => _confirmingId = id);
    try {
      await _api.respondToBooking(id, accept: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Booking confirmed.', style: GoogleFonts.outfit()),
          backgroundColor: Colors.green.shade700,
        ),
      );
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: GoogleFonts.outfit())),
        );
      }
    } finally {
      if (mounted) setState(() => _confirmingId = null);
    }
  }

  String _statusLabel(String raw) {
    switch (raw) {
      case 'awaiting_approval':
        return 'Awaiting your response';
      case 'pending_payment':
        return 'Payment pending';
      case 'confirmed':
      case 'accepted':
        return 'Confirmed';
      case 'checked_in':
        return 'Checked in';
      case 'pending':
        return 'Pending';
      case 'paid':
        return 'Paid';
      default:
        return raw.replaceAll('_', ' ');
    }
  }

  Widget _buildTile(Map<String, dynamic> b) {
    const primary = Color(AppConstants.primaryColor);
    final pet = b['petId'];
    final hostel = b['hostelId'];
    final petName = pet is Map ? (pet['name']?.toString() ?? 'Pet') : 'Pet';
    final place =
        hostel is Map ? (hostel['name']?.toString() ?? 'Care') : 'Care';
    final status = b['status']?.toString() ?? '';
    final checkIn = b['checkIn']?.toString();
    var dateStr = '';
    if (checkIn != null) {
      final d = DateTime.tryParse(checkIn);
      if (d != null) {
        dateStr = '${d.day}/${d.month}/${d.year}';
      }
    }
    final total = b['totalAmount'];

    final bid = b['_id']?.toString() ?? '';
    final confirming = _confirmingId == bid && bid.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        elevation: 2,
        shadowColor: Colors.black26,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.pets_rounded, color: primary, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          petName,
                          style: GoogleFonts.outfit(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          place,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: Colors.grey[700],
                          ),
                        ),
                        if (dateStr.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            'From $dateStr',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            _statusLabel(status),
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (total != null)
                    Text(
                      'Rs. ${(total as num).toStringAsFixed(0)}',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.black87,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  TextButton.icon(
                    onPressed: () => _openBooking(b),
                    icon: const Icon(Icons.visibility_rounded, size: 18),
                    label: const Text('View'),
                  ),
                  if (_canConfirm(b)) ...[
                    const SizedBox(width: 4),
                    FilledButton.tonal(
                      onPressed: confirming ? null : () => _confirmBooking(b),
                      child: confirming
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: PawSewaLoader(width: 28, center: false),
                            )
                          : const Text('Confirm'),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openMyBusiness() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(builder: (_) => const MyBusinessScreen()),
    );
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    const accent = Color(AppConstants.accentColor);
    const primary = Color(AppConstants.primaryColor);
    final showLoader = _loading && _bookings.isEmpty;
    final display = _bookings.take(6).toList();
    final moreCount = _bookings.length - display.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Active bookings',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: accent,
                ),
              ),
            ),
            TextButton(
              onPressed: _openMyBusiness,
              child: Text(
                'My business',
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w600,
                  color: primary,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Customer bookings for your care centre appear here as soon as they are placed (no admin reassignment needed). Manage details in My business.',
          style: GoogleFonts.outfit(
            fontSize: 13,
            color: Colors.grey[700],
            height: 1.3,
          ),
        ),
        const SizedBox(height: 12),
        if (showLoader)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: PawSewaLoader(),
            ),
          )
        else if (_bookings.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.event_note_outlined, color: Colors.grey[500], size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No active bookings right now. New requests will show here as soon as a customer books.',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      color: Colors.grey[700],
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          )
        else ...[
          ...display.map(_buildTile),
          if (moreCount > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '+ $moreCount more in My business',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: primary,
                ),
              ),
            ),
        ],
      ],
    );
  }
}
