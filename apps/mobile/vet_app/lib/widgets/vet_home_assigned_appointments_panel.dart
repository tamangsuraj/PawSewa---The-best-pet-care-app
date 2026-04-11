import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/vet_visit_swipe_flow.dart';
import '../screens/vet_assigned_appointments_screen.dart';
import '../services/socket_service.dart';

/// Rider-style home strip: merged active **appointments** + **assistance cases**.
/// Tap any row or **Assignment jobs** → full [VetAssignedAppointmentsScreen] (map, Google Maps, swipe).
class VetHomeAssignedAppointmentsPanel extends StatefulWidget {
  const VetHomeAssignedAppointmentsPanel({
    super.key,
    this.onActiveCountChanged,
    this.refreshToken = 0,
  });

  final ValueChanged<int>? onActiveCountChanged;
  final int refreshToken;

  @override
  State<VetHomeAssignedAppointmentsPanel> createState() =>
      _VetHomeAssignedAppointmentsPanelState();
}

class _VetHomeAssignedAppointmentsPanelState
    extends State<VetHomeAssignedAppointmentsPanel> {
  final _apiClient = ApiClient();
  List<Map<String, dynamic>> _active = [];
  bool _loading = true;

  void _onCaseStatusChange(dynamic _) {
    if (!mounted) return;
    unawaited(_load());
  }

  void _bindCaseStatusSocket() {
    final sock = SocketService.instance.socket;
    sock?.off('case_status_change', _onCaseStatusChange);
    sock?.on('case_status_change', _onCaseStatusChange);
  }

  @override
  void initState() {
    super.initState();
    SocketService.instance.connect();
    SocketService.instance.addStatusChangeListener(_onServiceSocket);
    SocketService.instance.addConnectListener(_bindCaseStatusSocket);
    _bindCaseStatusSocket();
    unawaited(_load());
  }

  @override
  void didUpdateWidget(covariant VetHomeAssignedAppointmentsPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.refreshToken != oldWidget.refreshToken) {
      unawaited(_load());
    }
  }

  @override
  void dispose() {
    SocketService.instance.removeStatusChangeListener(_onServiceSocket);
    SocketService.instance.removeConnectListener(_bindCaseStatusSocket);
    SocketService.instance.socket?.off('case_status_change', _onCaseStatusChange);
    super.dispose();
  }

  void _onServiceSocket(Map<String, dynamic> _) {
    if (!mounted) return;
    unawaited(_load());
  }

  bool _isActiveCase(Map<String, dynamic> c) {
    final s = c['status']?.toString() ?? '';
    return s == 'assigned' || s == 'in_progress';
  }

  Map<String, dynamic> _tagService(Map<String, dynamic> m) {
    final o = Map<String, dynamic>.from(m);
    o['_kind'] = 'service';
    return o;
  }

  Map<String, dynamic> _tagCase(Map<String, dynamic> m) {
    final o = Map<String, dynamic>.from(m);
    o['_kind'] = 'case';
    return o;
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final svc = await _apiClient.getMyServiceTasks();
      final cas = await _apiClient.getMyAssignments();

      final services = <Map<String, dynamic>>[];
      if (svc.data is Map && (svc.data as Map)['data'] is List) {
        for (final e in (svc.data as Map)['data'] as List) {
          if (e is Map<String, dynamic>) {
            services.add(_tagService(e));
          } else if (e is Map) {
            services.add(_tagService(Map<String, dynamic>.from(e)));
          }
        }
      }

      final cases = <Map<String, dynamic>>[];
      if (cas.data is Map && (cas.data as Map)['data'] is List) {
        for (final e in (cas.data as Map)['data'] as List) {
          if (e is Map<String, dynamic>) {
            cases.add(_tagCase(e));
          } else if (e is Map) {
            cases.add(_tagCase(Map<String, dynamic>.from(e)));
          }
        }
      }

      final active = <Map<String, dynamic>>[
        ...services.where(vetVisitTaskIsActive),
        ...cases.where(_isActiveCase),
      ];

      if (!mounted) return;
      setState(() {
        _active = active;
        _loading = false;
      });
      widget.onActiveCountChanged?.call(active.length);
    } catch (e) {
      if (kDebugMode) debugPrint('[VetHomeAssignments] $e');
      if (mounted) {
        setState(() {
          _loading = false;
          _active = [];
        });
        widget.onActiveCountChanged?.call(0);
      }
    }
  }

  Future<void> _openJobs() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => const VetAssignedAppointmentsScreen(),
      ),
    );
    if (mounted) await _load();
  }

  String _statusLabel(String status) {
    switch (status) {
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
        return status.replaceAll('_', ' ');
    }
  }

  Widget _buildTile(Map<String, dynamic> job) {
    const primary = Color(AppConstants.primaryColor);
    final id = job['_id']?.toString() ?? '';
    final shortId = id.length >= 6 ? id.substring(id.length - 6) : id;
    final status = job['status']?.toString() ?? '';
    final pet = job['pet'] is Map ? job['pet'] as Map<String, dynamic> : null;
    final petName = pet?['name']?.toString() ?? 'Pet';
    final kind = job['_kind']?.toString() ?? 'service';
    final loc = job['location'];
    String? address;
    if (loc is Map) {
      address = loc['address']?.toString();
    } else if (loc is String && loc.trim().isNotEmpty) {
      address = loc.trim();
    }
    final line2 = kind == 'case'
        ? 'Assistance · #$shortId'
        : '${(job['serviceType']?.toString() ?? 'Visit').replaceAll('_', ' ')} · #$shortId';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        elevation: 2,
        shadowColor: Colors.black26,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: _openJobs,
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
                  child: Icon(
                    kind == 'case' ? Icons.support_agent_rounded : Icons.medical_services_outlined,
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
                        petName,
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Colors.black87,
                        ),
                      ),
                      Text(
                        line2,
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[700]),
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
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
    final showLoader = _loading && _active.isEmpty;
    final display = _active.take(6).toList();
    final moreCount = _active.length - display.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Active assignments',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: accent,
                ),
              ),
            ),
            TextButton(
              onPressed: _openJobs,
              child: Text(
                'Assignment jobs',
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
          'Appointments and assistance cases assigned to you. Open a job for map, Google Maps directions, and swipe actions.',
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
        else if (_active.isEmpty)
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
                    'No active assignments right now. They appear here when admin assigns you.',
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
                '+ $moreCount more in Assignment jobs',
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
