import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/partner_scaffold.dart';
import '../widgets/paw_sewa_loader.dart';

/// Rider: all assigned shop orders split into current vs past (terminal statuses).
class PartnerRiderOrderHistoryScreen extends StatefulWidget {
  const PartnerRiderOrderHistoryScreen({super.key});

  @override
  State<PartnerRiderOrderHistoryScreen> createState() =>
      _PartnerRiderOrderHistoryScreenState();
}

class _PartnerRiderOrderHistoryScreenState
    extends State<PartnerRiderOrderHistoryScreen> {
  final _api = ApiClient();
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;

  static bool _isTerminal(String? s) {
    final x = s ?? '';
    return x == 'delivered' ||
        x == 'returned' ||
        x == 'refunded' ||
        x == 'cancelled';
  }

  @override
  void initState() {
    super.initState();
    if (kDebugMode) {
      debugPrint('[DEBUG] Navigating to History Screen via Sidebar.');
    }
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await _api.getRiderAssignedOrders();
      final data = resp.data;
      final list = <Map<String, dynamic>>[];
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

  static const Color _tealActive = Color(0xFF0D9488);

  static String _statusLabel(String raw) {
    switch (raw) {
      case 'pending_confirmation':
        return 'Awaiting shop';
      case 'pending':
        return 'New';
      case 'processing':
        return 'Preparing';
      case 'ready_for_pickup':
        return 'Ready for rider';
      case 'packed':
        return 'Packed';
      case 'assigned_to_rider':
        return 'Assigned';
      case 'out_for_delivery':
        return 'Out for delivery';
      case 'delivered':
        return 'Delivered';
      case 'returned':
        return 'Returned';
      case 'refunded':
        return 'Refunded';
      case 'cancelled':
        return 'Cancelled';
      default:
        return raw.replaceAll('_', ' ');
    }
  }

  @override
  Widget build(BuildContext context) {
    final ink = const Color(AppConstants.inkColor);
    final current =
        _orders.where((o) => !_isTerminal(o['status']?.toString())).toList();
    final past =
        _orders.where((o) => _isTerminal(o['status']?.toString())).toList();

    return PartnerScaffold(
      title: 'Delivery history',
      subtitle: 'Current and past assigned orders',
      actions: [
        IconButton(
          onPressed: _load,
          icon: const Icon(Icons.refresh_rounded),
          tooltip: 'Refresh',
        ),
      ],
      body: _loading
          ? const Center(child: PawSewaLoader(width: 140, height: 140))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(color: Colors.red.shade800),
                    ),
                  ),
                )
              : _orders.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'No orders yet.\nAssigned deliveries will appear here.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.outfit(
                            fontSize: 15,
                            color: ink.withValues(alpha: 0.7),
                          ),
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: CustomScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                              child: Text(
                                'Current orders',
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: ink.withValues(alpha: 0.75),
                                ),
                              ),
                            ),
                          ),
                          if (current.isEmpty)
                            SliverToBoxAdapter(
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 16),
                                child: Text(
                                  'No active deliveries.',
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    color: ink.withValues(alpha: 0.55),
                                  ),
                                ),
                              ),
                            )
                          else
                            SliverPadding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              sliver: SliverList(
                                delegate: SliverChildBuilderDelegate(
                                  (context, i) => _RiderHistoryCard(
                                    order: current[i],
                                    isPast: false,
                                    statusLabel: _statusLabel,
                                    tealActive: _tealActive,
                                  ),
                                  childCount: current.length,
                                ),
                              ),
                            ),
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                              child: Text(
                                'Past orders',
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: ink.withValues(alpha: 0.75),
                                ),
                              ),
                            ),
                          ),
                          if (past.isEmpty)
                            SliverToBoxAdapter(
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 16),
                                child: Text(
                                  'No completed or cancelled orders yet.',
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    color: ink.withValues(alpha: 0.55),
                                  ),
                                ),
                              ),
                            )
                          else
                            SliverPadding(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 0, 16, 24),
                              sliver: SliverList(
                                delegate: SliverChildBuilderDelegate(
                                  (context, i) => _RiderHistoryCard(
                                    order: past[i],
                                    isPast: true,
                                    statusLabel: _statusLabel,
                                    tealActive: _tealActive,
                                  ),
                                  childCount: past.length,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
    );
  }
}

class _RiderHistoryCard extends StatelessWidget {
  const _RiderHistoryCard({
    required this.order,
    required this.isPast,
    required this.statusLabel,
    required this.tealActive,
  });

  final Map<String, dynamic> order;
  final bool isPast;
  final String Function(String) statusLabel;
  final Color tealActive;

  @override
  Widget build(BuildContext context) {
    final id = order['_id']?.toString() ?? '';
    final shortId = id.length >= 6 ? id.substring(id.length - 6) : id;
    final st = order['status']?.toString() ?? '';
    final user = order['user'];
    String customer = 'Customer';
    if (user is Map) {
      customer = user['name']?.toString() ?? customer;
    }
    final total = (order['totalAmount'] as num?)?.toDouble() ?? 0;
    final created = order['createdAt']?.toString() ?? '';
    String dateStr = created;
    try {
      final d = DateTime.parse(created);
      dateStr =
          '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {}

    final badgeBg = isPast ? Colors.grey.shade200 : tealActive.withValues(alpha: 0.15);
    final badgeFg = isPast ? Colors.grey.shade800 : tealActive;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '#$shortId',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    'NPR ${total.toStringAsFixed(0)}',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.end,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Pet: All pets',
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade800,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              'Service: Product',
              style: GoogleFonts.outfit(
                fontSize: 12,
                color: Colors.grey.shade600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              customer,
              style: GoogleFonts.outfit(
                fontSize: 13,
                color: Colors.grey.shade700,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Flexible(
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: badgeBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      statusLabel(st),
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: badgeFg,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  dateStr,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
