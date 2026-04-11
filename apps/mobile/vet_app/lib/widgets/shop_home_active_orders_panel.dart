import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../screens/seller_new_orders_screen.dart';
import '../services/socket_service.dart';

/// Home summary of shop orders still in play (same feed as New orders).
class ShopHomeActiveOrdersPanel extends StatefulWidget {
  const ShopHomeActiveOrdersPanel({
    super.key,
    this.onActiveCountChanged,
    this.refreshToken = 0,
  });

  final ValueChanged<int>? onActiveCountChanged;
  final int refreshToken;

  @override
  State<ShopHomeActiveOrdersPanel> createState() =>
      _ShopHomeActiveOrdersPanelState();
}

class _ShopHomeActiveOrdersPanelState extends State<ShopHomeActiveOrdersPanel> {
  final _apiClient = ApiClient();
  List<Map<String, dynamic>> _activeOrders = [];
  bool _loading = true;

  static bool _isActiveOrder(Map<String, dynamic> o) {
    final s = o['status']?.toString() ?? '';
    return ![
      'delivered',
      'cancelled',
      'returned',
      'refunded',
    ].contains(s);
  }

  static bool _needsStockConfirm(Map<String, dynamic> o) {
    final s = o['status']?.toString() ?? '';
    final confirmed = o['sellerConfirmedAt'] != null;
    return !confirmed && (s == 'pending_confirmation' || s == 'pending');
  }

  @override
  void initState() {
    super.initState();
    SocketService.instance.connect();
    SocketService.instance.addShopOrderListener(_onSocket);
    unawaited(_load());
  }

  @override
  void didUpdateWidget(covariant ShopHomeActiveOrdersPanel oldWidget) {
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
        event != 'order:assigned_seller' &&
        event != 'orderUpdate') {
      return;
    }
    if (!mounted) return;
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final resp = await _apiClient.getSellerAssignedOrders();
      final list = <Map<String, dynamic>>[];
      if (resp.data is Map && (resp.data as Map)['data'] is List) {
        for (final e in (resp.data as Map)['data'] as List) {
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
      if (kDebugMode) debugPrint('[ShopHomeOrders] $e');
      if (mounted) {
        setState(() => _loading = false);
        widget.onActiveCountChanged?.call(0);
      }
    }
  }

  Future<void> _confirmStock(String orderId) async {
    try {
      await _apiClient.confirmSellerOrderStock(orderId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Stock confirmed')),
      );
      await _load();
    } on DioException catch (e) {
      if (!mounted) return;
      final m = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString()
          : null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(m ?? 'Could not confirm')),
      );
    }
  }

  Future<void> _openOrders() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const SellerNewOrdersScreen(),
      ),
    );
    if (mounted) await _load();
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'pending_confirmation':
        return 'Awaiting confirm';
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'ready_for_pickup':
        return 'Ready for rider';
      case 'packed':
        return 'Packed';
      case 'assigned_to_rider':
        return 'Rider assigned';
      case 'out_for_delivery':
        return 'Out for delivery';
      case 'delivered':
        return 'Delivered';
      default:
        return status.replaceAll('_', ' ');
    }
  }

  Widget _buildTile(Map<String, dynamic> order) {
    const primary = Color(AppConstants.primaryColor);
    final id = order['_id']?.toString() ?? '';
    final shortId = id.length >= 6 ? id.substring(id.length - 6) : id;
    final status = order['status']?.toString() ?? '';
    final rider = order['assignedRider'];
    String? riderName;
    if (rider is Map) {
      riderName = rider['name']?.toString();
    }
    final total = (order['totalAmount'] as num?)?.toDouble();
    final needConfirm = _needsStockConfirm(order);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        elevation: 2,
        shadowColor: Colors.black26,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: _openOrders,
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
                      child: const Icon(
                        Icons.storefront_outlined,
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
                          if (riderName != null && riderName.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Rider: $riderName',
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: Colors.grey[800],
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                          const SizedBox(height: 6),
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
                if (needConfirm && id.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton.tonal(
                      onPressed: () => unawaited(_confirmStock(id)),
                      child: Text(
                        'Confirm stock',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
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
                'Active shop orders',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: accent,
                ),
              ),
            ),
            TextButton(
              onPressed: _openOrders,
              child: Text(
                'New orders',
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
          'See rider assignment, confirm stock, then dispatch when the rider is ready.',
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
                    'No active orders. New purchases appear here.',
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
                '+ $moreCount more in New orders',
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
