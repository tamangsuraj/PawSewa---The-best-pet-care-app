import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/storage_service.dart';
import '../../services/socket_service.dart';
import '../messages/marketplace_thread_screen.dart';
import '../../widgets/premium_empty_state.dart';
import '../../widgets/premium_shimmer.dart';

/// How to filter the owner’s shop orders in the list.
enum MyOrdersListMode {
  all,
  activeOnly,
  historyOnly,
}

class MyOrdersScreen extends StatefulWidget {
  const MyOrdersScreen({
    super.key,
    this.highlightOrderId,
    this.listMode = MyOrdersListMode.all,
  });

  /// If set, the list will scroll to and briefly highlight this order (e.g. after checkout).
  final String? highlightOrderId;

  final MyOrdersListMode listMode;

  @override
  State<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends State<MyOrdersScreen> {
  final _apiClient = ApiClient();
  final GlobalKey _highlightKey = GlobalKey();
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;
  String? _myUserId;

  void _onOrderSocket(Map<String, dynamic> payload) {
    final raw = payload['order'];
    if (raw is! Map) return;
    final order = Map<String, dynamic>.from(raw);
    final user = order['user'];
    String? ownerId;
    if (user is Map) {
      ownerId = user['_id']?.toString() ?? user['id']?.toString();
    }
    if (_myUserId != null && ownerId != null && ownerId != _myUserId) {
      return;
    }
    final id = order['_id']?.toString();
    if (id == null) return;
    if (!mounted) return;
    setState(() {
      final idx = _orders.indexWhere((o) => o['_id']?.toString() == id);
      if (idx >= 0) {
        _orders = List<Map<String, dynamic>>.from(_orders);
        _orders[idx] = {..._orders[idx], ...order};
      } else {
        _orders = [order, ..._orders];
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Order updated')),
    );
  }

  Future<void> _initUserAndSocket() async {
    final u = await StorageService().getUser();
    if (u != null && u.isNotEmpty) {
      try {
        final decoded = jsonDecode(u);
        if (decoded is Map) {
          _myUserId = decoded['_id']?.toString() ?? decoded['id']?.toString();
        }
      } catch (_) {}
    }
    await SocketService.instance.connect();
    SocketService.instance.addOrderUpdateListener(_onOrderSocket);
  }

  @override
  void initState() {
    super.initState();
    _load();
    _initUserAndSocket();
  }

  @override
  void dispose() {
    SocketService.instance.removeOrderUpdateListener(_onOrderSocket);
    super.dispose();
  }

  void _scrollToHighlighted() {
    if (widget.highlightOrderId == null || _orders.isEmpty) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _highlightKey.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
      }
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await _apiClient.getMyOrders();
      final data = resp.data;
      List<Map<String, dynamic>> list = [];
      if (data is Map && data['data'] is List) {
        for (final e in data['data'] as List) {
          if (e is Map<String, dynamic>) list.add(Map<String, dynamic>.from(e));
        }
      }
      if (!mounted) return;
      setState(() {
        _orders = list;
        _loading = false;
      });
      if (widget.highlightOrderId != null) _scrollToHighlighted();
    } catch (e) {
      if (kDebugMode) debugPrint('[MyOrders] Error: $e');
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is DioException && e.response?.data != null
            ? (e.response!.data as Map)['message']?.toString() ??
                  'Failed to load orders'
            : 'Failed to load orders';
      });
    }
  }

  static const Color _primary = Color(AppConstants.primaryColor);

  List<Map<String, dynamic>> get _visibleOrders {
    switch (widget.listMode) {
      case MyOrdersListMode.all:
        return _orders;
      case MyOrdersListMode.activeOnly:
        return _orders.where((o) {
          final s = o['status']?.toString() ?? 'pending';
          return s != 'delivered';
        }).toList();
      case MyOrdersListMode.historyOnly:
        return _orders.where((o) {
          final s = o['status']?.toString() ?? '';
          return s == 'delivered';
        }).toList();
    }
  }

  String get _appBarTitle {
    switch (widget.listMode) {
      case MyOrdersListMode.all:
        return 'My Orders';
      case MyOrdersListMode.activeOnly:
        return 'Current orders';
      case MyOrdersListMode.historyOnly:
        return 'Order history';
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visibleOrders;
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          _appBarTitle,
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            fontSize: 18,
            color: Colors.white,
          ),
        ),
      ),
      body: _loading
          ? PremiumShimmer(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                children: const [
                  SkeletonListTile(),
                  SkeletonListTile(),
                  SkeletonListTile(),
                  SkeletonListTile(),
                ],
              ),
            )
          : _error != null
              ? PremiumEmptyState(
                  title: 'Couldn’t load orders',
                  body: _error!,
                  icon: Icons.wifi_off_rounded,
                  primaryAction: FilledButton.icon(
                    onPressed: _load,
                    style: FilledButton.styleFrom(backgroundColor: _primary),
                    icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                    label: Text(
                      'Retry',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                    ),
                  ),
                )
          : _orders.isEmpty
              ? PremiumEmptyState(
                  title: 'No orders yet',
                  body:
                      'When you place an order from the Shop, it will appear here with live status updates.',
                  icon: Icons.receipt_long_rounded,
                  primaryAction: FilledButton.icon(
                    onPressed: () => Navigator.of(context).pop(),
                    style: FilledButton.styleFrom(backgroundColor: _primary),
                    icon: const Icon(Icons.shopping_bag_rounded, color: Colors.white),
                    label: Text(
                      'Back to shop',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                    ),
                  ),
                )
          : visible.isEmpty
              ? PremiumEmptyState(
                  title: widget.listMode == MyOrdersListMode.activeOnly
                      ? 'No active orders'
                      : 'No completed orders yet',
                  body: widget.listMode == MyOrdersListMode.activeOnly
                      ? 'Once an order is confirmed, you’ll see it here until it’s delivered.'
                      : 'Delivered orders will be listed here as your history.',
                  icon: Icons.inventory_2_outlined,
                  primaryAction: FilledButton.icon(
                    onPressed: _load,
                    style: FilledButton.styleFrom(backgroundColor: _primary),
                    icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                    label: Text(
                      'Refresh',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                    ),
                  ),
                )
          : RefreshIndicator(
              onRefresh: _load,
              color: _primary,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: visible.length,
                itemBuilder: (context, index) {
                  final o = visible[index];
                  final id = o['_id']?.toString();
                  final highlight = widget.highlightOrderId != null &&
                      id != null &&
                      id == widget.highlightOrderId;
                  return _OrderCard(
                    key: highlight ? _highlightKey : null,
                    order: o,
                    highlight: highlight,
                  );
                },
              ),
            ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({super.key, required this.order, this.highlight = false});

  final Map<String, dynamic> order;
  final bool highlight;

  /// Human-readable status for display.
  static String statusLabel(String raw) {
    switch (raw) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'out_for_delivery':
        return 'On the way';
      case 'delivered':
        return 'Delivered';
      default:
        return raw.replaceAll('_', ' ').split(' ').map((e) => e.isNotEmpty ? '${e[0].toUpperCase()}${e.substring(1)}' : '').join(' ');
    }
  }

  String get _status {
    final s = order['status']?.toString() ?? 'pending';
    return statusLabel(s);
  }

  String get _paymentStatus {
    final p = order['paymentStatus']?.toString() ?? '';
    return p == 'paid' ? 'Paid' : 'Unpaid';
  }

  bool get _canChatRider {
    final ar = order['assignedRider'];
    if (ar == null) return false;
    if (ar is Map && ar.isEmpty) return false;
    if (ar is String && ar.isEmpty) return false;
    final st = order['status']?.toString() ?? '';
    return st != 'pending';
  }

  Future<void> _openRiderChat(BuildContext context) async {
    final storage = StorageService();
    if (!await storage.isLoggedIn()) return;
    final id = order['_id']?.toString();
    if (id == null) return;
    try {
      final r = await ApiClient().getDeliveryChatByOrder(id);
      final body = r.data;
      if (body is Map && body['success'] == true && body['data'] is Map) {
        final conv = body['data'] as Map<String, dynamic>;
        final cid = conv['_id']?.toString();
        final partner = conv['partner'];
        final name = partner is Map ? (partner['name']?.toString() ?? 'Rider') : 'Rider';
        if (context.mounted && cid != null) {
          await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => MarketplaceThreadScreen(
                conversationId: cid,
                threadType: 'DELIVERY',
                peerName: name,
                peerSubtitle: 'Your order',
                highContrast: true,
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is DioException && e.response?.data is Map
                  ? (e.response!.data as Map)['message']?.toString() ?? 'Chat unavailable'
                  : 'Chat unavailable for this order',
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = const Color(AppConstants.primaryColor);
    final items = order['items'] as List<dynamic>? ?? [];
    final total = (order['totalAmount'] as num?)?.toDouble() ?? 0;
    final createdAt = order['createdAt']?.toString();
    final id = order['_id']?.toString() ?? '';
    final status = _status;
    final paymentStatus = _paymentStatus;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: highlight
            ? BorderSide(color: primary, width: 2)
            : BorderSide.none,
      ),
      elevation: highlight ? 2 : 0,
      color: highlight ? primary.withValues(alpha: 0.04) : Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '#${id.length >= 6 ? id.substring(id.length - 6) : id}',
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Colors.black87,
                  ),
                ),
                Text(
                  paymentStatus,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: paymentStatus == 'Paid'
                        ? Colors.green[700]
                        : Colors.orange[700],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (items.isNotEmpty)
              Text(
                items
                    .map(
                      (e) =>
                          '${(e is Map ? e['name'] : null) ?? 'Item'} × ${(e is Map ? e['quantity'] : null) ?? 1}',
                    )
                    .join(', '),
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  color: Colors.grey[700],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: primary,
                    ),
                  ),
                ),
                Text(
                  'NPR ${total.toStringAsFixed(0)}',
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
            if (createdAt != null && createdAt.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                _formatDate(createdAt),
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
              ),
            ],
            if (_canChatRider) ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.tonalIcon(
                  onPressed: () => _openRiderChat(context),
                  icon: const Icon(Icons.chat_bubble_outline, size: 18),
                  label: Text(
                    'Chat with Rider',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  style: FilledButton.styleFrom(
                    foregroundColor: primary,
                    backgroundColor: primary.withValues(alpha: 0.12),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
