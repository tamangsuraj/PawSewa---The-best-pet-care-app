import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';

class ShopAnalyticsScreen extends StatefulWidget {
  const ShopAnalyticsScreen({super.key});

  @override
  State<ShopAnalyticsScreen> createState() => _ShopAnalyticsScreenState();
}

class _ShopAnalyticsScreenState extends State<ShopAnalyticsScreen> {
  final _api = ApiClient();
  bool _loading = true;
  String? _error;

  int _productCount = 0;
  int _lowStockCount = 0;
  int _assignedOrders = 0;
  int _pendingConfirmations = 0;

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final productsResp = await _api.getProducts();
      final ordersResp = await _api.getSellerAssignedOrders();

      final products = (productsResp.data is Map)
          ? ((productsResp.data as Map)['data'] as List<dynamic>? ?? [])
          : <dynamic>[];
      final orders = (ordersResp.data is Map &&
              (ordersResp.data as Map)['success'] == true &&
              (ordersResp.data as Map)['data'] is List)
          ? ((ordersResp.data as Map)['data'] as List).cast<dynamic>()
          : <dynamic>[];

      int low = 0;
      for (final p in products) {
        if (p is Map) {
          final sq = p['stockQuantity'];
          final n = (sq is num) ? sq.toInt() : int.tryParse('$sq') ?? 0;
          if (n <= 5) low += 1;
        }
      }

      int pending = 0;
      for (final o in orders) {
        if (o is Map) {
          final confirmed = o['sellerConfirmed'] == true;
          if (!confirmed) pending += 1;
        }
      }

      if (!mounted) return;
      setState(() {
        _productCount = products.length;
        _lowStockCount = low;
        _assignedOrders = orders.length;
        _pendingConfirmations = pending;
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.response?.data is Map
            ? (e.response!.data as Map)['message']?.toString() ?? 'Network error'
            : 'Network error';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Shop analytics',
      subtitle: 'Inventory health & fulfillment overview',
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
      body: Stack(
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: _loading
                ? Center(child: CircularProgressIndicator(color: primary))
                : _error != null
                    ? PartnerEmptyState(
                        title: 'Couldn’t load analytics',
                        body: _error!,
                        icon: Icons.query_stats_rounded,
                        primaryAction: OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                        children: [
                          _MetricCard(
                            title: 'Products',
                            value: _productCount.toString(),
                            subtitle: 'Total items listed in your shop',
                            icon: Icons.inventory_2_rounded,
                          ),
                          const SizedBox(height: 12),
                          _MetricCard(
                            title: 'Low stock',
                            value: _lowStockCount.toString(),
                            subtitle: 'Items with stock ≤ 5',
                            icon: Icons.warning_amber_rounded,
                            highlight: _lowStockCount > 0,
                          ),
                          const SizedBox(height: 12),
                          _MetricCard(
                            title: 'Assigned orders',
                            value: _assignedOrders.toString(),
                            subtitle: 'Orders waiting for fulfillment',
                            icon: Icons.local_shipping_rounded,
                          ),
                          const SizedBox(height: 12),
                          _MetricCard(
                            title: 'Pending confirmations',
                            value: _pendingConfirmations.toString(),
                            subtitle: 'Confirm stock so rider pickup can start',
                            icon: Icons.checklist_rounded,
                            highlight: _pendingConfirmations > 0,
                          ),
                          const SizedBox(height: 16),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Text(
                                'This dashboard is computed from your live inventory + assigned orders. For deeper reports (sales over time), we can add a dedicated backend endpoint later without changing the UI.',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: const Color(AppConstants.inkColor)
                                          .withValues(alpha: 0.7),
                                      fontWeight: FontWeight.w600,
                                      height: 1.35,
                                    ),
                              ),
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

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    this.highlight = false,
  });

  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    final badge = highlight
        ? const Color(AppConstants.accentColor)
        : primary.withValues(alpha: 0.10);
    final badgeIcon =
        highlight ? const Color(AppConstants.accentColor) : primary;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: badge.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: badge.withValues(alpha: 0.35)),
              ),
              child: Icon(icon, color: badgeIcon),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: ink,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: ink.withValues(alpha: 0.65),
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: ink,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

