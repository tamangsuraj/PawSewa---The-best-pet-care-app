import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../services/socket_service.dart';

/// Full delivery timeline + rider contact + pinned drop location (checkout GPS).
/// Refreshes from API and listens for `orderUpdate` so admin/status changes appear live.
class TrackPackageScreen extends StatefulWidget {
  const TrackPackageScreen({
    super.key,
    required this.orderId,
    this.initialOrder,
  });

  final String orderId;
  final Map<String, dynamic>? initialOrder;

  @override
  State<TrackPackageScreen> createState() => _TrackPackageScreenState();
}

class _TrackPackageScreenState extends State<TrackPackageScreen>
    with WidgetsBindingObserver {
  final _apiClient = ApiClient();
  Map<String, dynamic>? _order;
  bool _loading = true;
  String? _error;
  Timer? _pollTimer;
  void Function()? _onSocketConnect;

  static const Set<String> _terminalStatuses = {
    'delivered',
    'cancelled',
    'returned',
    'refunded',
  };

  static String _statusLabel(String raw) {
    switch (raw) {
      case 'pending_confirmation':
        return 'Awaiting shop confirmation';
      case 'pending':
        return 'Order received';
      case 'processing':
        return 'Preparing';
      case 'ready_for_pickup':
        return 'Ready for rider pickup';
      case 'packed':
        return 'Packed';
      case 'assigned_to_rider':
        return 'Rider assigned';
      case 'out_for_delivery':
        return 'Out for delivery';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return raw.replaceAll('_', ' ');
    }
  }

  static int _stepIndex(String status) {
    switch (status) {
      case 'pending_confirmation':
      case 'pending':
        return 0;
      case 'processing':
        return 1;
      case 'ready_for_pickup':
      case 'packed':
        return 2;
      case 'assigned_to_rider':
        return 3;
      case 'out_for_delivery':
        return 4;
      case 'delivered':
        return 5;
      default:
        return 0;
    }
  }

  bool _isTerminal(String? status) =>
      status != null && _terminalStatuses.contains(status);

  static String? _idString(dynamic value) {
    if (value == null) return null;
    if (value is Map) {
      return value['_id']?.toString() ?? value['\$oid']?.toString();
    }
    return value.toString();
  }

  static Map<String, dynamic> _normalizeOrderMap(Map raw) {
    final out = <String, dynamic>{};
    raw.forEach((key, value) {
      final k = key.toString();
      if (value is Map) {
        out[k] = Map<String, dynamic>.from(value);
      } else {
        out[k] = value;
      }
    });
    return out;
  }

  void _applyOrderUpdate(Map<String, dynamic> incoming) {
    if (!mounted) return;
    setState(() {
      _order = _order == null ? incoming : {..._order!, ...incoming};
      _loading = false;
      _error = null;
    });
    final status = _order?['status']?.toString();
    if (_isTerminal(status)) {
      _stopPolling();
    } else {
      _startPollingIfNeeded();
    }
  }

  void _onOrderSocket(Map<String, dynamic> payload) {
    final raw = payload['order'];
    if (raw is! Map) return;
    final incoming = _normalizeOrderMap(raw);
    if (_idString(incoming['_id']) != widget.orderId) return;
    _applyOrderUpdate(incoming);
    unawaited(_refreshOrder(silent: true));
  }

  void _startPollingIfNeeded() {
    if (_pollTimer != null) return;
    final status = _order?['status']?.toString();
    if (_isTerminal(status)) return;
    _pollTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _refreshOrder(silent: true),
    );
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_refreshOrder(silent: true));
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.initialOrder != null) {
      _order = Map<String, dynamic>.from(widget.initialOrder!);
      _loading = false;
      if (!_isTerminal(_order?['status']?.toString())) {
        _startPollingIfNeeded();
      }
    }
    SocketService.instance.addOrderUpdateListener(_onOrderSocket);
    _onSocketConnect = () => unawaited(_refreshOrder(silent: true));
    SocketService.instance.addConnectListener(_onSocketConnect!);
    unawaited(_bootstrap());
  }

  Future<void> _bootstrap() async {
    await SocketService.instance.connect();
    if (!mounted) return;
    await _refreshOrder();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopPolling();
    SocketService.instance.removeOrderUpdateListener(_onOrderSocket);
    if (_onSocketConnect != null) {
      SocketService.instance.removeConnectListener(_onSocketConnect!);
    }
    super.dispose();
  }

  Future<void> _refreshOrder({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = _order == null;
        _error = null;
      });
    }
    try {
      final resp = await _apiClient.getMyOrders();
      final data = resp.data;
      Map<String, dynamic>? found;
      if (data is Map && data['data'] is List) {
        for (final e in data['data'] as List) {
          if (e is Map && e['_id']?.toString() == widget.orderId) {
            found = Map<String, dynamic>.from(e);
            break;
          }
        }
      }
      if (!mounted) return;
      if (found == null) {
        setState(() {
          _loading = false;
          _error = _order == null ? 'Order not found' : null;
        });
        return;
      }
      setState(() {
        _order = found;
        _loading = false;
        _error = null;
      });
      if (_isTerminal(found['status']?.toString())) {
        _stopPolling();
      } else {
        _startPollingIfNeeded();
      }
    } catch (e) {
      if (!mounted) return;
      if (!silent || _order == null) {
        setState(() {
          _loading = false;
          _error = 'Could not refresh order status';
        });
      }
    }
  }

  Future<void> _openMaps(double lat, double lng) async {
    final url = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    const accent = Color(AppConstants.accentColor);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_loading && _order == null) {
      return Scaffold(
        backgroundColor: isDark ? Colors.grey.shade900 : Colors.white,
        appBar: AppBar(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          title: Text(
            'Track package',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
          ),
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null && _order == null) {
      return Scaffold(
        backgroundColor: isDark ? Colors.grey.shade900 : Colors.white,
        appBar: AppBar(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          title: Text(
            'Track package',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _refreshOrder,
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final order = _order!;
    final id = order['_id']?.toString() ?? widget.orderId;
    final short = id.length >= 6 ? id.substring(id.length - 6) : id;
    final status = order['status']?.toString() ?? 'pending_confirmation';
    final rider = order['assignedRider'];
    final riderName = rider is Map ? (rider['name']?.toString() ?? '') : '';
    final riderPhone = rider is Map ? (rider['phone']?.toString() ?? '') : '';

    double? lat;
    double? lng;
    final loc = order['location'];
    if (loc is Map) {
      final la = loc['lat'];
      final ln = loc['lng'];
      if (la is num && ln is num) {
        lat = la.toDouble();
        lng = ln.toDouble();
      }
    }
    if (lat == null || lng == null) {
      final dl = order['deliveryLocation'];
      if (dl is Map) {
        final point = dl['point'];
        if (point is Map) {
          final c = point['coordinates'];
          if (c is List && c.length >= 2) {
            lng = (c[0] as num).toDouble();
            lat = (c[1] as num).toDouble();
          }
        }
      }
    }

    final addr = order['deliveryLocation'] is Map
        ? (order['deliveryLocation'] as Map)['address']?.toString()
        : loc is Map
            ? loc['address']?.toString()
            : null;

    const steps = [
      'Shop confirms your order',
      'Shop prepares items',
      'Ready for rider',
      'Rider assigned',
      'On the way',
      'Delivered',
    ];
    final idx = _stepIndex(status);

    return Scaffold(
      backgroundColor: isDark ? Colors.grey.shade900 : Colors.white,
      appBar: AppBar(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        title: Text(
          'Track package',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () => _refreshOrder(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshOrder,
        color: primary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          children: [
            Text(
              'Order #$short',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w800,
                fontSize: 22,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: status == 'delivered'
                    ? Colors.green.shade50
                    : accent.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: status == 'delivered'
                      ? Colors.green.shade200
                      : accent.withValues(alpha: 0.35),
                ),
              ),
              child: Text(
                _statusLabel(status),
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w700,
                  color: status == 'delivered'
                      ? Colors.green.shade800
                      : accent,
                  fontSize: 15,
                ),
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'Progress',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            ...List.generate(steps.length, (i) {
              final done = i < idx || (i == idx && status == 'delivered');
              final current = i == idx && status != 'delivered';
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: done
                            ? primary
                            : current
                                ? accent.withValues(alpha: 0.25)
                                : Colors.grey.shade300,
                        border: Border.all(
                          color: current ? accent : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: Icon(
                        done ? Icons.check_rounded : Icons.circle_outlined,
                        size: done ? 18 : 10,
                        color: done ? Colors.white : Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        steps[i],
                        style: GoogleFonts.outfit(
                          fontWeight:
                              current || done ? FontWeight.w600 : FontWeight.w500,
                          fontSize: 14,
                          color: isDark
                              ? (done || current
                                  ? Colors.white
                                  : Colors.white54)
                              : (done || current
                                  ? Colors.black87
                                  : Colors.grey.shade600),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 24),
            Text(
              'Your rider',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 10),
            if (riderName.isEmpty && riderPhone.isEmpty)
              Text(
                status == 'assigned_to_rider' || status == 'out_for_delivery'
                    ? 'Rider details will appear here once assigned.'
                    : 'A rider will be assigned after your order is ready for pickup.',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  color: isDark ? Colors.white70 : Colors.grey.shade700,
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? Colors.grey.shade800 : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: primary.withValues(alpha: 0.12),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (riderName.isNotEmpty)
                      Text(
                        riderName,
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                    if (riderPhone.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        riderPhone,
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          color: isDark ? Colors.white70 : Colors.grey.shade700,
                        ),
                      ),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: () async {
                          final tel = Uri(scheme: 'tel', path: riderPhone);
                          if (await canLaunchUrl(tel)) {
                            await launchUrl(tel);
                          }
                        },
                        icon: const Icon(Icons.phone_rounded, size: 20),
                        label: Text(
                          'Call rider',
                          style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: primary,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 28),
            Text(
              'Delivery pin',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            if (addr != null && addr.isNotEmpty)
              Text(
                addr,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  height: 1.35,
                  color: isDark ? Colors.white70 : Colors.grey.shade800,
                ),
              ),
            if (lat != null && lng != null) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () => _openMaps(lat!, lng!),
                icon: const Icon(Icons.map_rounded),
                label: Text(
                  'Open in Google Maps',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: primary,
                  side: BorderSide(color: primary.withValues(alpha: 0.5)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
