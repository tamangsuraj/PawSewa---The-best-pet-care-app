import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/rider_order_flow.dart';
import '../screens/rider_delivery_orders_screen.dart';
import '../screens/rider_en_route_screen.dart';
import '../services/socket_service.dart';

/// Rider home hub: today's earnings + active deliveries (no separate portal).
class RiderHomeAssignedOrdersPanel extends StatefulWidget {
  const RiderHomeAssignedOrdersPanel({
    super.key,
    this.onActiveCountChanged,
    this.refreshToken = 0,
  });

  final ValueChanged<int>? onActiveCountChanged;
  final int refreshToken;

  @override
  State<RiderHomeAssignedOrdersPanel> createState() =>
      _RiderHomeAssignedOrdersPanelState();
}

class _RiderHomeAssignedOrdersPanelState
    extends State<RiderHomeAssignedOrdersPanel> {
  final _apiClient = ApiClient();
  List<Map<String, dynamic>> _allOrders = [];
  List<Map<String, dynamic>> _activeOrders = [];
  bool _loading = true;
  double _todaysEarnings = 0;
  int _completedToday = 0;
  String? _updatingOrderId;

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

  void _applyMetrics(List<Map<String, dynamic>> list) {
    final delivered =
        list.where((o) => RiderOrderFlow.isDelivered(o)).toList();
    final today = DateTime.now();
    _todaysEarnings = RiderOrderFlow.sumEarningsForDate(delivered, today);
    _completedToday = RiderOrderFlow.countDeliveredOnDate(delivered, today);
    _activeOrders = list.where(RiderOrderFlow.isActive).toList();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await _apiClient.getRiderAssignedOrders();
      final data = resp.data;
      final list = <Map<String, dynamic>>[];
      if (data is Map && data['data'] is List) {
        for (final e in data['data'] as List) {
          if (e is Map) {
            list.add(Map<String, dynamic>.from(e));
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _allOrders = list;
        _applyMetrics(list);
        _loading = false;
      });
      widget.onActiveCountChanged?.call(_activeOrders.length);
    } catch (e) {
      if (kDebugMode) debugPrint('[RiderHomeOrders] $e');
      if (mounted) {
        setState(() => _loading = false);
        widget.onActiveCountChanged?.call(0);
      }
    }
  }

  Future<void> _updateStatus(
    String orderId,
    String status, {
    bool popSheet = false,
  }) async {
    setState(() => _updatingOrderId = orderId);
    try {
      await _apiClient.updateOrderStatus(orderId: orderId, status: status);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Updated to ${RiderOrderFlow.statusLabel(status)}',
          ),
          backgroundColor: const Color(AppConstants.primaryColor),
        ),
      );
      if (status == 'out_for_delivery') {
        Map<String, dynamic>? orderMap;
        for (final o in _allOrders) {
          if (o['_id']?.toString() == orderId) {
            orderMap = o;
            break;
          }
        }
        if (orderMap != null && mounted) {
          if (popSheet) Navigator.of(context).pop();
          final done = await Navigator.of(context).push<bool>(
            MaterialPageRoute<bool>(
              builder: (_) => RiderEnRouteScreen(order: orderMap!),
            ),
          );
          if (done == true) await _load();
          return;
        }
      }
      if (popSheet && mounted) Navigator.of(context).pop();
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is DioException && e.response?.data is Map
                ? (e.response!.data as Map)['message']?.toString() ??
                    'Update failed'
                : 'Update failed',
          ),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _updatingOrderId = null);
    }
  }

  Future<void> _openOrder(Map<String, dynamic> order) async {
    final status = order['status']?.toString() ?? '';
    if (status == 'out_for_delivery') {
      final done = await Navigator.of(context).push<bool>(
        MaterialPageRoute<bool>(
          builder: (_) => RiderEnRouteScreen(order: order),
        ),
      );
      if (done == true) await _load();
      return;
    }
    if (!mounted) return;
    final id = order['_id']?.toString() ?? '';
    final next = RiderOrderFlow.nextStatus(status);
    final address = (order['deliveryLocation'] is Map
            ? (order['deliveryLocation'] as Map)['address']
            : null)
        ?.toString();

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        const primary = Color(AppConstants.primaryColor);
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Delivery #${id.length >= 6 ? id.substring(id.length - 6) : id}',
                style: GoogleFonts.fraunces(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: const Color(AppConstants.inkColor),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                RiderOrderFlow.statusLabel(status),
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: RiderOrderFlow.statusColor(status),
                ),
              ),
              if (address != null && address.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  address,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    color: Colors.grey.shade700,
                    height: 1.35,
                  ),
                ),
              ],
              if (next != null) ...[
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _updatingOrderId == id
                      ? null
                      : () => _updateStatus(id, next, popSheet: true),
                  style: FilledButton.styleFrom(
                    backgroundColor: primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(
                    _updatingOrderId == id
                        ? 'Updating…'
                        : 'Mark as ${RiderOrderFlow.statusLabel(next)}',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _earningsCard() {
    const riderAccent = Color(AppConstants.riderAccent);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [riderAccent, riderAccent.withValues(alpha: 0.82)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: riderAccent.withValues(alpha: 0.28),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Today's earnings",
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.88),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Rs. ${_todaysEarnings.toStringAsFixed(0)}',
            style: GoogleFonts.fraunces(
              fontSize: 32,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Completed today: $_completedToday',
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ],
      ),
    );
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

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        elevation: 2,
        shadowColor: Colors.black26,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _openOrder(order),
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
                          color: const Color(AppConstants.inkColor),
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
                          color: RiderOrderFlow.statusColor(status)
                              .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          RiderOrderFlow.statusLabel(status),
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: RiderOrderFlow.statusColor(status),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.grey.shade500,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openFullHub({int tabIndex = 0}) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => RiderDeliveryOrdersScreen(initialTabIndex: tabIndex),
      ),
    ).then((_) {
      if (mounted) _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final showLoader = _loading && _activeOrders.isEmpty && _allOrders.isEmpty;
    final display = _activeOrders.take(8).toList();
    final moreCount = _activeOrders.length - display.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Delivery hub',
                style: GoogleFonts.fraunces(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: const Color(AppConstants.inkColor),
                ),
              ),
            ),
            TextButton(
              onPressed: () => _openFullHub(tabIndex: 1),
              child: Text(
                '7-day history',
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w600,
                  color: primary,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _earningsCard(),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                'Active deliveries',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: const Color(AppConstants.accentColor),
                ),
              ),
            ),
            if (_activeOrders.isNotEmpty)
              TextButton(
                onPressed: () => _openFullHub(),
                child: Text(
                  'Manage all',
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w600,
                    color: primary,
                    fontSize: 13,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
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
                    'No active deliveries. New assignments appear here — tap to update status.',
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
              child: TextButton(
                onPressed: () => _openFullHub(),
                child: Text(
                  '+ $moreCount more — manage all',
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: primary,
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}
