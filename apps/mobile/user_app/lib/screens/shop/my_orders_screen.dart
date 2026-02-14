import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';

class MyOrdersScreen extends StatefulWidget {
  const MyOrdersScreen({super.key, this.highlightOrderId});

  /// If set, the list will scroll to and briefly highlight this order (e.g. after checkout).
  final String? highlightOrderId;

  @override
  State<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends State<MyOrdersScreen> {
  final _apiClient = ApiClient();
  final GlobalKey _highlightKey = GlobalKey();
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'My Orders',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            fontSize: 18,
            color: Colors.black87,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _primary))
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error!,
                      style: GoogleFonts.poppins(color: Colors.red[700]),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    TextButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                      style: TextButton.styleFrom(foregroundColor: _primary),
                    ),
                  ],
                ),
              ),
            )
          : _orders.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.receipt_long_rounded,
                    size: 64,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No orders yet',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Your shop orders will appear here.',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: Colors.grey[500],
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: _primary,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _orders.length,
                itemBuilder: (context, index) {
                  final o = _orders[index];
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
      color: highlight ? primary.withOpacity(0.04) : Colors.white,
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
                  style: GoogleFonts.poppins(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                    color: Colors.black87,
                  ),
                ),
                Text(
                  paymentStatus,
                  style: GoogleFonts.poppins(
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
                style: GoogleFonts.poppins(
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
                    color: primary.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status,
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: primary,
                    ),
                  ),
                ),
                Text(
                  'NPR ${total.toStringAsFixed(0)}',
                  style: GoogleFonts.poppins(
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
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  color: Colors.grey[600],
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
