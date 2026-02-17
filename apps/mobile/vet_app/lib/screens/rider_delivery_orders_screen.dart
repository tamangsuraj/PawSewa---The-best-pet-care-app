import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'rider_en_route_screen.dart';

/// For riders: list of assigned pet-supplies orders with status updates.
/// Flow: Select status → Processing (at shop) → On the way (left shop) → Delivered.
class RiderDeliveryOrdersScreen extends StatefulWidget {
  const RiderDeliveryOrdersScreen({super.key});

  @override
  State<RiderDeliveryOrdersScreen> createState() =>
      _RiderDeliveryOrdersScreenState();
}

class _RiderDeliveryOrdersScreenState extends State<RiderDeliveryOrdersScreen> {
  final _apiClient = ApiClient();
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;
  String? _updatingOrderId;
  String _filter = 'active'; // 'active' | 'delivered'

  List<Map<String, dynamic>> get _filteredOrders {
    if (_filter == 'delivered') {
      return _orders
          .where((o) => o['status']?.toString() == 'delivered')
          .toList();
    }
    return _orders
        .where((o) =>
            o['status'] != null && o['status'].toString() != 'delivered')
        .toList();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await _apiClient.getRiderAssignedOrders();
      final data = resp.data;
      List<Map<String, dynamic>> list = [];
      if (data is Map && data['data'] is List) {
        for (final e in data['data'] as List) {
          if (e is Map<String, dynamic>) {
            list.add(Map<String, dynamic>.from(e));
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _orders = list;
        _loading = false;
      });
    } catch (e) {
      if (kDebugMode) debugPrint('[RiderOrders] Error: $e');
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

  Future<void> _updateStatus(String orderId, String status) async {
    setState(() => _updatingOrderId = orderId);
    try {
      await _apiClient.updateOrderStatus(orderId: orderId, status: status);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Status updated to ${_statusLabel(status)}'),
          backgroundColor: Colors.green,
        ),
      );
      if (status == 'out_for_delivery') {
        Map<String, dynamic>? orderMap;
        for (final o in _orders) {
          if (o['_id']?.toString() == orderId) {
            orderMap = o;
            break;
          }
        }
        if (orderMap != null) {
          final Map<String, dynamic> orderToOpen = orderMap;
          final result = await Navigator.of(context).push<bool>(
            MaterialPageRoute<bool>(
              builder: (context) => RiderEnRouteScreen(order: orderToOpen),
            ),
          );
          if (result == true && mounted) await _load();
          return;
        }
      }
      await _load();
    } catch (e) {
      if (kDebugMode) debugPrint('[RiderOrders] Update error: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is DioException && e.response?.data != null
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

  static String _statusLabel(String status) {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'out_for_delivery':
        return 'On the way';
      case 'delivered':
        return 'Delivered';
      default:
        return status;
    }
  }

  static String? _nextStatus(String current) {
    switch (current) {
      case 'pending':
        return 'processing';
      case 'processing':
        return 'out_for_delivery';
      case 'out_for_delivery':
        return 'delivered';
      default:
        return null;
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'My delivery orders',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            fontSize: 18,
            color: Colors.white,
          ),
        ),
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: Colors.white,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: primary,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: Material(
                    color: _filter == 'active'
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(10),
                    child: InkWell(
                      onTap: () => setState(() => _filter = 'active'),
                      borderRadius: BorderRadius.circular(10),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.local_shipping_rounded,
                              size: 20,
                              color: _filter == 'active'
                                  ? primary
                                  : Colors.white,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Active',
                              style: GoogleFonts.poppins(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: _filter == 'active'
                                    ? primary
                                    : Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Material(
                    color: _filter == 'delivered'
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(10),
                    child: InkWell(
                      onTap: () => setState(() => _filter = 'delivered'),
                      borderRadius: BorderRadius.circular(10),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.check_circle_outline_rounded,
                              size: 20,
                              color: _filter == 'delivered'
                                  ? primary
                                  : Colors.white,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Delivered',
                              style: GoogleFonts.poppins(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: _filter == 'delivered'
                                    ? primary
                                    : Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
          ? const Center(child: CircularProgressIndicator(color: primary))
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
                      style: TextButton.styleFrom(foregroundColor: primary),
                    ),
                  ],
                ),
              ),
            )
          : _filteredOrders.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _filter == 'active'
                        ? Icons.local_shipping_rounded
                        : Icons.check_circle_outline_rounded,
                    size: 64,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _filter == 'active'
                        ? 'No active deliveries'
                        : 'No completed deliveries yet',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _filter == 'active'
                        ? 'Assigned orders will appear here.'
                        : 'Delivered orders show up here.',
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
              color: primary,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _filteredOrders.length,
                itemBuilder: (context, index) {
                  final order = _filteredOrders[index];
                  return _OrderCard(
                    order: order,
                    updatingOrderId: _updatingOrderId,
                    onUpdateStatus: _updateStatus,
                    statusLabel: _statusLabel,
                    nextStatus: _nextStatus,
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.updatingOrderId,
    required this.onUpdateStatus,
    required this.statusLabel,
    required this.nextStatus,
  });

  final Map<String, dynamic> order;
  final String? updatingOrderId;
  final void Function(String orderId, String status) onUpdateStatus;
  final String Function(String) statusLabel;
  final String? Function(String) nextStatus;

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final id = order['_id']?.toString() ?? '';
    final shortId = id.length >= 6 ? id.substring(id.length - 6) : id;
    final status = order['status']?.toString() ?? 'pending';
    final total = (order['totalAmount'] as num?)?.toDouble() ?? 0;
    final address =
        (order['deliveryLocation'] is Map
                ? (order['deliveryLocation'] as Map)['address']
                : null)
            ?.toString();
    final user = order['user'] is Map ? order['user'] as Map : null;
    final customerName = user?['name']?.toString() ?? 'Customer';
    final items = order['items'] is List ? order['items'] as List : [];
    final isUpdating = updatingOrderId == id;
    final next = nextStatus(status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '#$shortId',
                  style: GoogleFonts.poppins(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: Colors.black87,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: _statusColor(status).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusLabel(status),
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _statusColor(status),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              customerName,
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: Colors.black87,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (address != null && address.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                address,
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  color: Colors.grey[700],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (items.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                items
                    .map(
                      (e) =>
                          '${(e is Map ? e['name'] : null) ?? 'Item'} × ${(e is Map ? e['quantity'] : null) ?? 1}',
                    )
                    .join(', '),
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Flexible(
                  child: Text(
                    'Total NPR ${total.toStringAsFixed(0)}',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: Colors.black87,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 12),
                Flexible(
                  child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color:
                        (order['paymentStatus'] == 'paid'
                                ? Colors.green
                                : Colors.orange)
                            .withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    order['paymentStatus'] == 'paid'
                        ? (order['paymentMethod'] == 'khalti'
                              ? 'Paid via Khalti'
                              : 'Paid (online)')
                        : 'Cash on delivery',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: order['paymentStatus'] == 'paid'
                          ? Colors.green[700]
                          : Colors.orange[800],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const SizedBox.shrink(),
                if (next != null)
                  SizedBox(
                    height: 36,
                    child: FilledButton(
                      onPressed: isUpdating
                          ? null
                          : () => onUpdateStatus(id, next),
                      style: FilledButton.styleFrom(
                        backgroundColor: primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: isUpdating
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              'Mark as ${statusLabel(next)}',
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'pending':
        return Colors.orange;
      case 'processing':
        return Colors.blue;
      case 'out_for_delivery':
        return Colors.deepOrange;
      case 'delivered':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }
}
