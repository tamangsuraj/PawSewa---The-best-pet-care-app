import 'dart:async';

import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../services/socket_service.dart';

/// New assignments (`assigned`) and completed clinic appointments for this vet.
class VetClinicAssignmentsScreen extends StatefulWidget {
  const VetClinicAssignmentsScreen({super.key});

  @override
  State<VetClinicAssignmentsScreen> createState() => _VetClinicAssignmentsScreenState();
}

class _VetClinicAssignmentsScreenState extends State<VetClinicAssignmentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _api = ApiClient();
  List<Map<String, dynamic>> _all = [];
  bool _loading = true;
  String? _error;
  Timer? _poll;
  void Function(Map<String, dynamic>)? _socketCb;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
    _poll = Timer.periodic(const Duration(seconds: 18), (_) => _load(silent: true));
    _socketCb = (_) {
      if (mounted) _load(silent: true);
    };
    SocketService.instance.addAppointmentUpdateListener(_socketCb!);
    SocketService.instance.connect();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _tabs.dispose();
    if (_socketCb != null) {
      SocketService.instance.removeAppointmentUpdateListener(_socketCb!);
    }
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final res = await _api.getMyClinicAppointments();
      final data = res.data;
      final list = data is Map && data['data'] is List
          ? List<Map<String, dynamic>>.from(
              (data['data'] as List).map(
                (e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{},
              ),
            )
          : <Map<String, dynamic>>[];
      if (mounted) {
        setState(() {
          _all = list;
          _loading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && !silent) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  static String _when(Map<String, dynamic> row) {
    final pd = row['preferredDate'];
    if (pd is String) {
      final dt = DateTime.tryParse(pd);
      if (dt != null) {
        final l = dt.toLocal();
        return '${l.year}-${l.month.toString().padLeft(2, '0')}-${l.day.toString().padLeft(2, '0')} '
            '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
      }
    }
    return row['timeWindow']?.toString() ?? '—';
  }

  static String? _id(Map<String, dynamic> row) => row['_id']?.toString();

  static Map<String, dynamic>? _owner(Map<String, dynamic> row) {
    final c = row['customerId'];
    return c is Map<String, dynamic> ? c : null;
  }

  static Map<String, dynamic>? _pet(Map<String, dynamic> row) {
    final p = row['petId'];
    return p is Map<String, dynamic> ? p : null;
  }

  List<Map<String, dynamic>> get _active =>
      _all.where((r) {
        final s = (r['status'] ?? '').toString();
        return s == 'assigned' || s == 'in_progress';
      }).toList();

  List<Map<String, dynamic>> get _done =>
      _all.where((r) => (r['status'] ?? '').toString() == 'completed').toList();

  Future<void> _start(String id) async {
    try {
      await _api.patchClinicAppointmentStatus(id, status: 'in_progress');
      if (mounted) await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _complete(String id) async {
    try {
      await _api.patchClinicAppointmentStatus(id, status: 'completed');
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Marked completed')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Scaffold(
      appBar: AppBar(
        title: Text('Clinic appointments', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        bottom: TabBar(
          controller: _tabs,
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'New assignments'),
            Tab(text: 'Completed'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: PawSewaLoader())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        FilledButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : TabBarView(
                  controller: _tabs,
                  children: [
                    RefreshIndicator(
                      onRefresh: _load,
                      child: _active.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                const SizedBox(height: 80),
                                Center(
                                  child: Text(
                                    'No active assignments.',
                                    style: GoogleFonts.outfit(
                                      fontSize: 15,
                                      color: const Color(AppConstants.inkColor).withValues(alpha: 0.65),
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.all(16),
                              itemCount: _active.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 12),
                              itemBuilder: (context, i) {
                                final row = _active[i];
                                final id = _id(row);
                                final status = (row['status'] ?? '').toString();
                                final pet = _pet(row);
                                final owner = _owner(row);
                                final petName = pet?['name']?.toString() ?? 'Pet';
                                final ownerName = owner?['name']?.toString() ?? 'Owner';
                                final amt = row['totalAmount'];
                                return Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        Text(
                                          '${row['type']} · $petName',
                                          style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 15,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Owner: $ownerName',
                                          style: GoogleFonts.outfit(
                                            fontSize: 13,
                                            color: Colors.grey[700],
                                          ),
                                        ),
                                        Text(
                                          'When: ${_when(row)}',
                                          style: GoogleFonts.outfit(
                                            fontSize: 13,
                                            color: Colors.grey[700],
                                          ),
                                        ),
                                        if (amt is num && amt > 0)
                                          Text(
                                            'Amount: $amt',
                                            style: GoogleFonts.outfit(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: primary,
                                            ),
                                          ),
                                        const SizedBox(height: 12),
                                        if (status == 'assigned')
                                          FilledButton(
                                            onPressed: id == null ? null : () => _start(id),
                                            child: const Text('Start appointment'),
                                          ),
                                        if (status == 'in_progress')
                                          FilledButton(
                                            onPressed: id == null ? null : () => _complete(id),
                                            child: const Text('Mark as completed'),
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                    RefreshIndicator(
                      onRefresh: _load,
                      child: _done.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                const SizedBox(height: 80),
                                Center(
                                  child: Text(
                                    'No completed visits yet.',
                                    style: GoogleFonts.outfit(
                                      fontSize: 15,
                                      color: const Color(AppConstants.inkColor).withValues(alpha: 0.65),
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.all(16),
                              itemCount: _done.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 12),
                              itemBuilder: (context, i) {
                                final row = _done[i];
                                final pet = _pet(row);
                                final petName = pet?['name']?.toString() ?? 'Pet';
                                final amt = row['totalAmount'];
                                return ListTile(
                                  title: Text(
                                    '${row['type']} · $petName',
                                    style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                                  ),
                                  subtitle: Text(
                                    _when(row),
                                    style: GoogleFonts.outfit(fontSize: 13),
                                  ),
                                  trailing: amt is num && amt > 0
                                      ? Text(
                                          '$amt',
                                          style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.w700,
                                            color: primary,
                                          ),
                                        )
                                      : null,
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}
