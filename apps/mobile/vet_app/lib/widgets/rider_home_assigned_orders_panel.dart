import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../screens/rider_delivery_orders_screen.dart';
import '../services/socket_service.dart';

/// Shows assigned / in-progress pet-supply orders on rider home surfaces.
/// Same data as [RiderDeliveryOrdersScreen] (GET /orders/rider/assigned, non-delivered).
class RiderHomeAssignedOrdersPanel extends StatefulWidget {
  const RiderHomeAssignedOrdersPanel({
    super.key,
    this.onActiveCountChanged,
    this.refreshToken = 0,
  });

  /// Notifies parent (e.g. dashboard badge) when the active count changes.
  final ValueChanged<int>? onActiveCountChanged;

  /// Increment from parent after returning from [RiderDeliveryOrdersScreen] to refetch.
  final int refreshToken;

  @override
  State<RiderHomeAssignedOrdersPanel> createState() =>
      _RiderHomeAssignedOrdersPanelState();
}

class _RiderHomeAssignedOrdersPanelState
    extends State<RiderHomeAssignedOrdersPanel> {
  final _apiClient = ApiClient();
  List<Map<String, dynamic>> _activeOrders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    SocketService.instance.connect();
    SocketService.instance.addShopOrderListener(_onSocket);
    unawaited(_load());
  }

  @override
  void didUpdateWidget(covariant RiderHomeAssignedOrdersPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.refreshToken != oldWidget.refreshToken) {
      unawaited(_load());
    }
  }

  @override
  void dispose() {
    SocketService.instance.removeShopOrderListener(_onSocket);
    super.dispose();
  }

  void _onSocket(String event, Map<String, dynamic> payload) {
    if (event != 'job:available' &&
        event != 'order:assigned_rider' &&
        event != 'orderUpdate') {
      return;
    }
    if (!mounted) return;
    unawaited(_load());
  }

  /// Matches [RiderDeliveryOrdersScreen] active tab: not delivered.
  static bool _isActiveOrder(Map<String, dynamic> o) {
    final s = o['status'];
    if (s == null) return true;
    return s.toString() != 'delivered';
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await _apiClient.getRiderAssignedOrders();
      final data = resp.data;
      final list = <Map<String, dynamic>>[];
      if (data is Map && data['data'] is List) {
        for (final e in data['data'] as List) {
          if (e is Map<String, dynamic>) {
            list.add(Map<String, dynamic>.from(e));
          } else if (e is Map) {
            list.add(Map<String, dynamic>.from(e));
          }
        }
      }
      if (!mounted) return;
      final active = list.where(_isActiveOrder).toList();
      setState(() {
        _activeOrders = active;
        _loading = false;
      });
      widget.onActiveCountChanged?.call(active.length);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[RiderHomeOrders] $e');
      }
      if (mounted) {
        setState(() => _loading = false);
        widget.onActiveCountChanged?.call(0);
      }
    }
  }

  Future<void> _openDeliveryJobs() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const RiderDeliveryOrdersScreen(),
      ),
    );
    if (mounted) await _load();
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'pending_confirmation':
        return 'Awaiting shop';
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'ready_for_pickup':
        return 'Ready (pickup)';
      case 'packed':
        return 'Packed (pickup)';
      case 'assigned_to_rider':
        return 'Assigned to you';
      case 'out_for_delivery':
        return 'On the way';
      case 'delivered':
        return 'Delivered';
      default:
        return status;
    }
  }

  Widget _buildTile(Map<String, dynamic> order) {
    const primary = Color(AppConstants.primaryColor);
    final id = order['_id']?.toString() ?? '';
    final shortId = id.length >= 6 ? id.substring(id.length - 6) : id;
    final status = order['status']?.toString() ?? '';
    final address = (order['deliveryLocation'] is Map
            ? (order['deliveryLocation'] as Map)['address']
            : null)
        ?.toString();
    final total = (order['totalAmount'] as num?)?.toDouble();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        elevation: 2,
        shadowColor: Colors.black26,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: _openDeliveryJobs,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.local_shipping_outlined,
                    color: primary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Order #$shortId',
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Colors.black87,
                        ),
                      ),
                      if (address != null && address.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          address,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: Colors.grey[700],
                            height: 1.25,
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
                    'Rs. ${total.toStringAsFixed(0)}',
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.black87,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const accent = Color(AppConstants.accentColor);
    const primary = Color(AppConstants.primaryColor);
    final showLoader = _loading && _activeOrders.isEmpty;
    final display = _activeOrders.take(6).toList();
    final moreCount = _activeOrders.length - display.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Active deliveries',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: accent,
                ),
              ),
            ),
            TextButton(
              onPressed: _openDeliveryJobs,
              child: Text(
                'Delivery jobs',
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
          'Current assignments and in-progress drops appear here.',
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
        else if (_activeOrders.isEmpty)
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
                Icon(Icons.inbox_outlined, color: Colors.grey[500], size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No active deliveries right now. Assignments show here when you receive them.',
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
                '+ $moreCount more in Delivery jobs',
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
