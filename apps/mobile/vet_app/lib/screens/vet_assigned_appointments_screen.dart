import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/google_maps_directions.dart';
import '../core/vet_visit_swipe_flow.dart';
import '../core/vet_visit_status_apply.dart';
import '../services/location_service.dart';
import '../services/socket_service.dart';
import '../widgets/map_pin_marker.dart';
import '../widgets/swipe_action_button.dart';
import 'service_task_detail_screen.dart';
import 'vet_visit_flow_screen.dart';

/// Rider-style control center: appointments + assistance cases, map preview,
/// **Open in Google Maps** (same URL pattern as rider), and swipe actions.
class VetAssignedAppointmentsScreen extends StatefulWidget {
  const VetAssignedAppointmentsScreen({super.key});

  @override
  State<VetAssignedAppointmentsScreen> createState() =>
      _VetAssignedAppointmentsScreenState();
}

class _VetAssignedAppointmentsScreenState extends State<VetAssignedAppointmentsScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late TabController _tabController;

  List<Map<String, dynamic>> _activeJobs = [];
  List<Map<String, dynamic>> _historyJobs = [];
  bool _loading = true;
  bool _loadingHistory = false;
  bool _historyLoadedOnce = false;
  String? _error;
  String? _historyError;
  String? _patchingId;

  LatLng? _currentLatLng;

  static const _primary = Color(AppConstants.primaryColor);
  static const _accent = Color(AppConstants.accentColor);
  static const _successGreen = Color(0xFF00C853);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    SocketService.instance.connect();
    SocketService.instance.addStatusChangeListener(_onServiceSocket);
    SocketService.instance.addConnectListener(_bindCaseStatusSocket);
    _bindCaseStatusSocket();
    unawaited(_loadCurrentLocation());
    unawaited(_load());
  }

  void _onCaseStatusChange(dynamic _) {
    if (!mounted) return;
    unawaited(_load());
    if (_historyLoadedOnce) unawaited(_loadHistory());
  }

  void _bindCaseStatusSocket() {
    final sock = SocketService.instance.socket;
    sock?.off('case_status_change', _onCaseStatusChange);
    sock?.on('case_status_change', _onCaseStatusChange);
  }

  void _onTabChanged() {
    if (!mounted || _tabController.indexIsChanging) return;
    if (_tabController.index == 1 && !_historyLoadedOnce && !_loadingHistory) {
      unawaited(_loadHistory());
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    SocketService.instance.removeStatusChangeListener(_onServiceSocket);
    SocketService.instance.removeConnectListener(_bindCaseStatusSocket);
    SocketService.instance.socket?.off('case_status_change', _onCaseStatusChange);
    super.dispose();
  }

  void _onServiceSocket(Map<String, dynamic> _) {
    if (!mounted) return;
    unawaited(_load());
    if (_historyLoadedOnce) unawaited(_loadHistory());
  }

  Future<void> _loadCurrentLocation() async {
    try {
      final ok = await LocationService().ensureLocationPermission(context);
      if (!ok || !mounted) return;
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (!mounted) return;
      setState(() {
        _currentLatLng = LatLng(pos.latitude, pos.longitude);
      });
    } catch (_) {
      if (mounted) setState(() => _currentLatLng = null);
    }
  }

  Map<String, dynamic> _normalizeService(Map<String, dynamic> m) {
    final o = Map<String, dynamic>.from(m);
    o['_kind'] = 'service';
    return o;
  }

  Map<String, dynamic> _normalizeCase(Map<String, dynamic> m) {
    final o = Map<String, dynamic>.from(m);
    if (o['customer'] != null && o['user'] == null) {
      o['user'] = o['customer'];
    }
    o['_kind'] = 'case';
    o['_requestType'] = 'case';
    return o;
  }

  bool _isActiveCase(Map<String, dynamic> c) {
    final s = c['status']?.toString() ?? '';
    return s == 'assigned' || s == 'in_progress';
  }

  LatLng? _parseCustomerLatLng(Map<String, dynamic> job) {
    final kind = job['_kind']?.toString();
    if (kind == 'case') {
      final la = job['latitude'];
      final ln = job['longitude'];
      if (la is num && ln is num) {
        return LatLng(la.toDouble(), ln.toDouble());
      }
      return null;
    }
    final live = job['liveLocation'] as Map<String, dynamic>?;
    if (live != null) {
      final la = live['lat'];
      final ln = live['lng'];
      if (la is num && ln is num) return LatLng(la.toDouble(), ln.toDouble());
    }
    final lat = job['latitude'];
    final lng = job['longitude'];
    if (lat is num && lng is num) return LatLng(lat.toDouble(), lng.toDouble());
    final loc = job['location'];
    if (loc is Map && loc['coordinates'] is Map) {
      final c = loc['coordinates'] as Map<String, dynamic>;
      final la = c['lat'];
      final ln = c['lng'];
      if (la is num && ln is num) return LatLng(la.toDouble(), ln.toDouble());
    }
    return null;
  }

  String? _addressLine(Map<String, dynamic> job) {
    if (job['_kind']?.toString() == 'case') {
      final loc = job['location'];
      if (loc is String && loc.trim().isNotEmpty) return loc.trim();
      if (loc is Map && loc['address'] != null) return loc['address'].toString();
      return null;
    }
    final loc = job['location'];
    if (loc is Map && loc['address'] != null) return loc['address'].toString();
    return null;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final svc = await _api.getMyServiceTasks();
      final cas = await _api.getMyAssignments();

      final services = <Map<String, dynamic>>[];
      if (svc.data is Map && (svc.data as Map)['data'] is List) {
        for (final e in (svc.data as Map)['data'] as List) {
          if (e is Map<String, dynamic>) {
            services.add(_normalizeService(e));
          } else if (e is Map) {
            services.add(_normalizeService(Map<String, dynamic>.from(e)));
          }
        }
      }

      final cases = <Map<String, dynamic>>[];
      if (cas.data is Map && (cas.data as Map)['data'] is List) {
        for (final e in (cas.data as Map)['data'] as List) {
          if (e is Map<String, dynamic>) {
            cases.add(_normalizeCase(e));
          } else if (e is Map) {
            cases.add(_normalizeCase(Map<String, dynamic>.from(e)));
          }
        }
      }

      final active = <Map<String, dynamic>>[
        ...services.where(vetVisitTaskIsActive),
        ...cases.where(_isActiveCase),
      ];

      active.sort((a, b) {
        final ta = _sortTime(a);
        final tb = _sortTime(b);
        return tb.compareTo(ta);
      });

      if (!mounted) return;
      setState(() {
        _activeJobs = active;
        _loading = false;
      });
    } catch (e) {
      if (kDebugMode) debugPrint('[VetAssignments] $e');
      if (mounted) {
        setState(() {
          _error = 'Could not load assignments';
          _loading = false;
        });
      }
    }
  }

  DateTime _sortTime(Map<String, dynamic> j) {
    for (final k in ['assignedAt', 'scheduledTime', 'preferredDate', 'updatedAt', 'createdAt']) {
      final v = j[k];
      if (v == null) continue;
      final d = DateTime.tryParse(v.toString());
      if (d != null) return d;
    }
    return DateTime.fromMillisecondsSinceEpoch(0);
  }

  Future<void> _loadHistory() async {
    setState(() {
      _loadingHistory = true;
      _historyError = null;
    });
    try {
      final svc = await _api.getMyServiceTasks(history: true);
      final cas = await _api.getMyAssignments();

      final out = <Map<String, dynamic>>[];
      if (svc.data is Map && (svc.data as Map)['data'] is List) {
        for (final e in (svc.data as Map)['data'] as List) {
          if (e is Map<String, dynamic>) {
            out.add(_normalizeService(e));
          } else if (e is Map) {
            out.add(_normalizeService(Map<String, dynamic>.from(e)));
          }
        }
      }
      if (cas.data is Map && (cas.data as Map)['data'] is List) {
        for (final e in (cas.data as Map)['data'] as List) {
          Map<String, dynamic>? m;
          if (e is Map<String, dynamic>) {
            m = _normalizeCase(e);
          } else if (e is Map) {
            m = _normalizeCase(Map<String, dynamic>.from(e));
          }
          if (m != null) {
            final s = m['status']?.toString() ?? '';
            if (s == 'completed' || s == 'cancelled') out.add(m);
          }
        }
      }

      out.sort((a, b) => _sortTime(b).compareTo(_sortTime(a)));

      if (!mounted) return;
      setState(() {
        _historyJobs = out;
        _loadingHistory = false;
        _historyLoadedOnce = true;
      });
    } catch (e) {
      if (kDebugMode) debugPrint('[VetAssignmentsHistory] $e');
      if (mounted) {
        setState(() {
          _historyError = 'Could not load history';
          _loadingHistory = false;
        });
      }
    }
  }

  Future<void> _openDirections(Map<String, dynamic> job) async {
    final pt = _parseCustomerLatLng(job);
    final addr = _addressLine(job);
    await openGoogleMapsDrivingDirections(
      context: context,
      lat: pt?.latitude,
      lng: pt?.longitude,
      address: addr,
    );
  }

  Future<void> _startCase(Map<String, dynamic> caseData) async {
    final caseId = caseData['_id']?.toString();
    if (caseId == null || caseId.isEmpty) return;
    try {
      final response = await _api.startCase(caseId);
      if (response.statusCode == 200 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Visit started', style: GoogleFonts.outfit()),
            backgroundColor: Colors.blue.shade700,
          ),
        );
        await _load();
      }
    } on DioException catch (e) {
      if (!mounted) return;
      var msg = 'Could not start visit';
      final b = e.response?.data;
      if (b is Map && b['message'] is String) msg = b['message'] as String;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _completeCase(Map<String, dynamic> caseData) async {
    final caseId = caseData['_id']?.toString();
    if (caseId == null || caseId.isEmpty) return;
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Complete visit', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        content: TextField(
          controller: controller,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Visit notes',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Complete')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _api.completeCase(caseId, notes: controller.text.trim().isEmpty ? null : controller.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Case completed', style: GoogleFonts.outfit())),
      );
      await _load();
      if (_historyLoadedOnce) await _loadHistory();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
      );
    } finally {
      controller.dispose();
    }
  }

  Future<void> _handleSwipe(Map<String, dynamic> job, String nextStatus) async {
    final id = job['_id']?.toString();
    if (id == null) return;

    if (job['_kind']?.toString() == 'case') {
      if (nextStatus == kVetCaseSwipeStart) {
        setState(() => _patchingId = id);
        try {
          await _startCase(job);
        } finally {
          if (mounted) setState(() => _patchingId = null);
        }
        return;
      }
      if (nextStatus == kVetCaseSwipeComplete) {
        setState(() => _patchingId = id);
        try {
          await _completeCase(job);
        } finally {
          if (mounted) setState(() => _patchingId = null);
        }
        return;
      }
      return;
    }

    final prev = job['status']?.toString() ?? '';
    setState(() => _patchingId = id);
    try {
      final res = await applyVetServiceRequestStatus(
        _api,
        requestId: id,
        nextStatus: nextStatus,
        currentStatus: job['status']?.toString(),
      );
      if (!mounted) return;
      if (res.statusCode != 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not update (${res.statusCode})')),
        );
        return;
      }
      Map<String, dynamic>? updated;
      if (res.data is Map && (res.data as Map)['data'] is Map) {
        updated = Map<String, dynamic>.from((res.data as Map)['data'] as Map);
      }
      if (prev == 'assigned' && nextStatus == 'accepted') {
        final merged = updated ?? Map<String, dynamic>.from(job);
        merged['_kind'] = 'service';
        if (!mounted) return;
        final flowResult = await Navigator.push<dynamic>(
          context,
          MaterialPageRoute<dynamic>(
            builder: (_) => VetVisitFlowScreen(initialTask: merged),
          ),
        );
        if (!mounted) return;
        if (flowResult is Map<String, dynamic>) {
          _showCompletionSummary(context, flowResult);
        }
        await _load();
        if (_historyLoadedOnce) await _loadHistory();
        return;
      }
      if (nextStatus == 'completed' && updated != null) {
        _showCompletionSummary(context, updated);
      }
      await _load();
      if (_historyLoadedOnce) await _loadHistory();
    } on DioException catch (e) {
      if (!mounted) return;
      final body = e.response?.data;
      var msg = 'Could not update. Try again.';
      if (body is Map) {
        final m = body['message'];
        if (m is String && m.isNotEmpty) msg = m;
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) setState(() => _patchingId = null);
    }
  }

  void _showCompletionSummary(BuildContext context, Map<String, dynamic> data) {
    final pet = data['pet'] is Map ? data['pet'] as Map<String, dynamic> : null;
    final petName = pet?['name']?.toString() ?? '—';
    final serviceType = data['serviceType']?.toString() ?? '—';
    final timeWindow = data['timeWindow']?.toString();
    final pm = data['paymentMethod']?.toString();
    final ps = data['paymentStatus']?.toString();
    String? addr;
    final loc = data['location'];
    if (loc is Map) addr = loc['address']?.toString();
    final completedAt = data['completedAt']?.toString();
    var completedLine = '—';
    if (completedAt != null) {
      final dt = DateTime.tryParse(completedAt);
      if (dt != null) {
        completedLine =
            '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} '
            '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      }
    }

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Visit completed', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _summaryRow('Pet', petName),
              _summaryRow('Service', serviceType),
              if (timeWindow != null) _summaryRow('Time window', timeWindow),
              if (addr != null && addr.isNotEmpty) _summaryRow('Location', addr),
              if (pm != null) _summaryRow('Payment', '$pm (${ps ?? 'unknown'})'),
              _summaryRow('Completed at', completedLine),
              const SizedBox(height: 8),
              Text(
                'If this visit was cash on delivery, confirm payment with the owner.',
                style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[700]),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done')),
        ],
      ),
    );
  }

  Widget _summaryRow(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              k,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
          ),
          Expanded(child: Text(v, style: GoogleFonts.outfit(fontSize: 13))),
        ],
      ),
    );
  }

  String _statusLabel(Map<String, dynamic> job) {
    final s = job['status']?.toString() ?? '';
    if (job['_kind']?.toString() == 'case') {
      switch (s) {
        case 'assigned':
          return 'Assigned';
        case 'in_progress':
          return 'In progress';
        default:
          return s;
      }
    }
    switch (s) {
      case 'pending':
        return 'Pending';
      case 'assigned':
        return 'Assigned';
      case 'accepted':
        return 'Accepted';
      case 'en_route':
        return 'On the way';
      case 'arrived':
        return 'Reached';
      case 'in_progress':
        return 'In progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return s.replaceAll('_', ' ');
    }
  }

  Color _statusColor(Map<String, dynamic> job) {
    final s = job['status']?.toString() ?? '';
    if (job['_kind']?.toString() == 'case') {
      if (s == 'assigned') return Colors.teal;
      if (s == 'in_progress') return Colors.deepOrange;
      return Colors.grey;
    }
    switch (s) {
      case 'assigned':
        return Colors.teal;
      case 'accepted':
        return _accent;
      case 'en_route':
        return Colors.blue.shade700;
      case 'arrived':
        return Colors.orange.shade800;
      case 'in_progress':
        return Colors.deepOrange;
      default:
        return Colors.grey;
    }
  }

  VetVisitSwipeStep? _swipeFor(Map<String, dynamic> job) {
    if (job['_kind']?.toString() == 'case') {
      return nextVetCaseSwipeStep(job);
    }
    return nextVetVisitSwipeStep(job);
  }

  Widget _buildMapPreview(LatLng? center) {
    if (center == null) {
      return Container(
        height: 160,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.grey.shade200,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          'No map pin — use directions if you have an address.',
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[700]),
        ),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: 160,
        child: FlutterMap(
          options: MapOptions(initialCenter: center, initialZoom: 14),
          children: [
            TileLayer(
              urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              subdomains: const ['a', 'b', 'c'],
              userAgentPackageName: 'com.pawsewa.partner_app',
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: center,
                  width: 38,
                  height: 48,
                  alignment: Alignment.bottomCenter,
                  child: const MapPinMarker(
                    color: Color(AppConstants.primaryColor),
                    size: 36,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildJobCard(Map<String, dynamic> job) {
    final id = job['_id']?.toString() ?? '';
    final shortId = id.length >= 6 ? id.substring(id.length - 6) : id;
    final pet = job['pet'] is Map ? job['pet'] as Map<String, dynamic> : null;
    final petName = pet?['name']?.toString() ?? 'Pet';
    final kind = job['_kind']?.toString() ?? 'service';
    final headline = kind == 'case'
        ? 'Assistance · $petName'
        : '${(job['serviceType']?.toString() ?? 'Visit').replaceAll('_', ' ')} · $petName';
    final sub = kind == 'case'
        ? (job['issueDescription']?.toString() ?? '').trim()
        : (job['timeWindow']?.toString() ?? '');
    final addr = _addressLine(job);
    final customer = _parseCustomerLatLng(job);
    double? distanceKm;
    if (_currentLatLng != null && customer != null) {
      distanceKm = const Distance().as(LengthUnit.Kilometer, _currentLatLng!, customer);
    }
    final distanceText =
        distanceKm == null ? 'Distance —' : '${distanceKm.toStringAsFixed(1)} km';
    final swipe = _swipeFor(job);
    final isPatching = _patchingId == id;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    '#$shortId',
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: Colors.black87,
                    ),
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      distanceText,
                      style: GoogleFonts.fraunces(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: _accent,
                        letterSpacing: 0.4,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _statusColor(job).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _statusLabel(job),
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _statusColor(job),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              headline,
              style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800),
            ),
            if (sub.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                sub,
                maxLines: kind == 'case' ? 3 : 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey[700], height: 1.25),
              ),
            ],
            if (addr != null && addr.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                kind == 'case' ? 'Location: $addr' : 'Drop-off: $addr',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Colors.black87,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 10),
            _buildMapPreview(customer),
            const SizedBox(height: 10),
            if (customer != null || (addr != null && addr.isNotEmpty)) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => unawaited(_openDirections(job)),
                  style: FilledButton.styleFrom(
                    backgroundColor: _accent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.map_rounded, size: 20),
                  label: Text(
                    'Open in Google Maps',
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.push<void>(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => ServiceTaskDetailScreen(
                            task: Map<String, dynamic>.from(job),
                          ),
                        ),
                      ).then((_) => _load());
                    },
                    icon: const Icon(Icons.info_outline_rounded, size: 18),
                    label: Text('Details', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
            if (swipe != null) ...[
              const SizedBox(height: 8),
              SwipeActionButton(
                label: swipe.label,
                backgroundColor: (swipe.nextStatus == 'completed' ||
                        swipe.nextStatus == kVetCaseSwipeComplete)
                    ? _successGreen
                    : swipe.color,
                disabled: isPatching,
                loading: isPatching,
                onSwiped: () => unawaited(_handleSwipe(job, swipe.nextStatus)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildActiveTab() {
    return RefreshIndicator(
      color: _primary,
      onRefresh: _load,
      child: _loading && _activeJobs.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 120),
                Center(child: PawSewaLoader()),
              ],
            )
          : _error != null
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(_error!, textAlign: TextAlign.center, style: GoogleFonts.outfit()),
                    ),
                  ],
                )
              : _activeJobs.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(32),
                          child: Text(
                            'No active assignments. Appointments and assistance cases appear here when assigned.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[700]),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                      itemCount: _activeJobs.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 4),
                      itemBuilder: (context, i) => _buildJobCard(_activeJobs[i]),
                    ),
    );
  }

  String _historyStatusLabel(String? s) {
    switch (s) {
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return s?.replaceAll('_', ' ') ?? '—';
    }
  }

  Widget _buildHistoryTab() {
    return RefreshIndicator(
      color: _primary,
      onRefresh: _loadHistory,
      child: _loadingHistory && _historyJobs.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 120),
                Center(child: PawSewaLoader()),
              ],
            )
          : _historyError != null
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        _historyError!,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.outfit(),
                      ),
                    ),
                  ],
                )
              : _historyJobs.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(32),
                          child: Text(
                            'No past assignments yet.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[700]),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                      itemCount: _historyJobs.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, i) {
                        final job = _historyJobs[i];
                        final pet = job['pet'] is Map ? job['pet'] as Map<String, dynamic> : null;
                        final petName = pet?['name']?.toString() ?? 'Pet';
                        final kind = job['_kind']?.toString() ?? 'service';
                        final sub = kind == 'case'
                            ? 'Assistance'
                            : (job['serviceType']?.toString() ?? 'Visit').replaceAll('_', ' ');
                        final st = job['status']?.toString();
                        return Card(
                          child: ListTile(
                            title: Text(petName, style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                            subtitle: Text(
                              '$sub · ${_historyStatusLabel(st)}',
                              style: GoogleFonts.outfit(fontSize: 13),
                            ),
                            trailing: const Icon(Icons.chevron_right_rounded),
                            onTap: () {
                              Navigator.push<void>(
                                context,
                                MaterialPageRoute<void>(
                                  builder: (_) => ServiceTaskDetailScreen(
                                    task: Map<String, dynamic>.from(job),
                                  ),
                                ),
                              );
                            },
                          ),
                        );
                      },
                    ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Assignment jobs',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: [
            Tab(text: 'Active (${_activeJobs.length})'),
            Tab(text: 'History (${_historyJobs.length})'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildActiveTab(),
          _buildHistoryTab(),
        ],
      ),
    );
  }
}
