import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../services/socket_service.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';
import '../widgets/swipe_action_button.dart';
import 'partner_marketplace_chat_screen.dart';

/// Shop section: incoming purchases + ready-for-rider state (synced with backend lifecycle).
class SellerNewOrdersScreen extends StatefulWidget {
  const SellerNewOrdersScreen({super.key});

  @override
  State<SellerNewOrdersScreen> createState() => _SellerNewOrdersScreenState();
}

class _SellerNewOrdersScreenState extends State<SellerNewOrdersScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late TabController _tabs;
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;
  String? _dispatchingOrderId;

  void _onSocket(String event, Map<String, dynamic> payload) {
    if (event != 'job:available' &&
        event != 'order:assigned_rider' &&
        event != 'order:assigned_seller' &&
        event != 'orderUpdate') {
      return;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Orders updated')),
    );
    _load();
  }

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
    SocketService.instance.connect();
    SocketService.instance.addShopOrderListener(_onSocket);
  }

  @override
  void dispose() {
    SocketService.instance.removeShopOrderListener(_onSocket);
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await _api.getSellerAssignedOrders();
      final body = r.data;
      if (body is Map && body['success'] == true && body['data'] is List) {
        _orders = (body['data'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
    } catch (e) {
      _error = e is DioException ? '${e.response?.data ?? e.message}' : '$e';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static String _statusLine(String s) {
    switch (s) {
      case 'pending_confirmation':
        return 'Awaiting your confirmation';
      case 'ready_for_pickup':
        return 'Ready — admin will assign a rider';
      case 'packed':
        return 'Packed — waiting for rider';
      case 'assigned_to_rider':
        return 'Rider assigned';
      case 'out_for_delivery':
        return 'Out for delivery';
      case 'delivered':
        return 'Delivered';
      case 'processing':
        return 'Preparing (legacy)';
      default:
        return s.replaceAll('_', ' ');
    }
  }

  List<Map<String, dynamic>> get _incoming {
    return _orders.where((o) {
      final s = o['status']?.toString() ?? '';
      return s == 'pending_confirmation' ||
          s == 'pending' ||
          s == 'processing';
    }).toList();
  }

  List<Map<String, dynamic>> get _ready {
    return _orders.where((o) {
      final s = o['status']?.toString() ?? '';
      return s == 'ready_for_pickup' ||
          s == 'packed' ||
          s == 'assigned_to_rider' ||
          s == 'out_for_delivery' ||
          s == 'delivered';
    }).toList();
  }

  Future<void> _confirm(String orderId) async {
    try {
      await _api.confirmSellerOrderStock(orderId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Stock confirmed — order is ready for rider')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    }
  }

  Future<void> _dispatchFromShop(String orderId) async {
    if (orderId.isEmpty) return;
    setState(() => _dispatchingOrderId = orderId);
    try {
      await _api.sellerDispatchFromShop(orderId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Dispatched — order is out for delivery')),
      );
      await _load();
    } on DioException catch (e) {
      if (!mounted) return;
      final m = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString()
          : null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(m ?? 'Could not dispatch')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e')),
      );
    } finally {
      if (mounted) setState(() => _dispatchingOrderId = null);
    }
  }

  Future<void> _markPacked(String orderId) async {
    try {
      await _api.sellerMarkPacked(orderId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Marked ready for pickup')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is DioException && e.response?.data is Map
                ? (e.response!.data as Map)['message']?.toString() ?? '$e'
                : '$e',
          ),
        ),
      );
    }
  }

  Future<void> _openChat(String orderId, String customerName) async {
    if (orderId.isEmpty) return;
    try {
      final r = await _api.openSellerMarketplaceChatFromOrder(orderId);
      final body = r.data;
      if (body is Map && body['success'] == true && body['data'] is Map) {
        final conv = body['data'] as Map<String, dynamic>;
        final cid = conv['_id']?.toString();
        if (!mounted || cid == null) return;
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => PartnerMarketplaceChatScreen(
              conversationId: cid,
              peerName: customerName,
              peerSubtitle: 'Customer',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Widget _orderCard(Map<String, dynamic> o, Color primary) {
    const successGreen = Color(0xFF00C853);
    final id = o['_id']?.toString() ?? '';
    final short = id.length > 6 ? id.substring(id.length - 6) : id;
    final user = o['user'];
    final name = user is Map ? (user['name']?.toString() ?? 'Customer') : 'Customer';
    final status = o['status']?.toString() ?? '';
    final addr = o['deliveryLocation'] is Map
        ? (o['deliveryLocation'] as Map)['address']?.toString() ?? ''
        : '';
    final confirmed = o['sellerConfirmedAt'] != null;
    final riderRaw = o['assignedRider'];
    String? riderName;
    String? riderPhone;
    bool hasRider = false;
    if (riderRaw is Map) {
      riderName = riderRaw['name']?.toString();
      riderPhone = riderRaw['phone']?.toString();
      hasRider = (riderRaw['_id'] != null && riderRaw['_id'].toString().isNotEmpty) ||
          (riderName != null && riderName.isNotEmpty);
    }
    final showDispatchSwipe =
        status == 'assigned_to_rider' && hasRider && id.isNotEmpty;
    final dispatchBusy = _dispatchingOrderId != null;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: primary.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Order #$short',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
              IconButton.filledTonal(
                onPressed: () => _openChat(id, name),
                icon: const Icon(Icons.chat_bubble_outline_rounded),
                tooltip: 'Message customer',
              ),
            ],
          ),
          Text(
            name,
            style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade700),
          ),
          const SizedBox(height: 6),
          Text(
            _statusLine(status),
            style: GoogleFonts.outfit(
              fontWeight: FontWeight.w600,
              fontSize: 13,
              color: primary,
            ),
          ),
          if (hasRider) ...[
            const SizedBox(height: 8),
            Text(
              riderName != null && riderName.isNotEmpty
                  ? 'Rider: $riderName'
                  : 'Rider assigned',
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade800,
              ),
            ),
            if (riderPhone != null && riderPhone.isNotEmpty)
              Text(
                riderPhone,
                style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade600),
              ),
          ],
          if (addr.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              addr,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade800),
            ),
          ],
          const SizedBox(height: 12),
          if (!confirmed &&
              (status == 'pending_confirmation' || status == 'pending'))
            FilledButton(
              onPressed: id.isEmpty ? null : () => _confirm(id),
              style: FilledButton.styleFrom(
                backgroundColor: primary,
                foregroundColor: Colors.white,
              ),
              child: Text('Confirm stock', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
            ),
          if (confirmed && status == 'processing')
            FilledButton.tonal(
              onPressed: id.isEmpty ? null : () => _markPacked(id),
              child: Text('Mark ready for pickup', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
            ),
          if (showDispatchSwipe) ...[
            const SizedBox(height: 12),
            SwipeActionButton(
              disabled: dispatchBusy && _dispatchingOrderId != id,
              backgroundColor: successGreen,
              label: 'Swipe — Dispatched from shop',
              loading: _dispatchingOrderId == id,
              onSwiped: () => unawaited(_dispatchFromShop(id)),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'New orders',
      subtitle: 'Confirm stock → ready for rider',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded),
          onPressed: _loading ? null : _load,
        ),
      ],
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: Column(
              children: [
                Material(
                  color: Colors.white.withValues(alpha: 0.92),
                  child: TabBar(
                    controller: _tabs,
                    labelColor: primary,
                    unselectedLabelColor: Colors.grey.shade600,
                    indicatorColor: primary,
                    tabs: [
                      Tab(text: 'Incoming (${_incoming.length})'),
                      Tab(text: 'Pipeline (${_ready.length})'),
                    ],
                  ),
                ),
                Expanded(
                  child: _loading
                      ? Center(child: const PawSewaLoader())
                      : _error != null
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Text(_error!, textAlign: TextAlign.center),
                              ),
                            )
                          : TabBarView(
                              controller: _tabs,
                              children: [
                                RefreshIndicator(
                                  onRefresh: _load,
                                  child: ListView(
                                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                                    children: [
                                      if (_incoming.isEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 48),
                                          child: Text(
                                            'No orders awaiting confirmation.',
                                            textAlign: TextAlign.center,
                                            style: GoogleFonts.outfit(
                                              fontSize: 15,
                                              color: Colors.grey.shade600,
                                            ),
                                          ),
                                        )
                                      else
                                        ..._incoming.map((o) => _orderCard(o, primary)),
                                    ],
                                  ),
                                ),
                                RefreshIndicator(
                                  onRefresh: _load,
                                  child: ListView(
                                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                                    children: [
                                      if (_ready.isEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 48),
                                          child: Text(
                                            'Nothing in the pipeline yet.',
                                            textAlign: TextAlign.center,
                                            style: GoogleFonts.outfit(
                                              fontSize: 15,
                                              color: Colors.grey.shade600,
                                            ),
                                          ),
                                        )
                                      else
                                        ..._ready.map((o) => _orderCard(o, primary)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
