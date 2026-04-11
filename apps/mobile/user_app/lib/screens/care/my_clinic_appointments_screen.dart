import 'dart:async';

import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../services/socket_service.dart';

/// Live status for vet clinic bookings (polling + socket).
class MyClinicAppointmentsScreen extends StatefulWidget {
  const MyClinicAppointmentsScreen({super.key});

  @override
  State<MyClinicAppointmentsScreen> createState() => _MyClinicAppointmentsScreenState();
}

class _MyClinicAppointmentsScreenState extends State<MyClinicAppointmentsScreen> {
  final _api = ApiClient();
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;
  Timer? _poll;
  void Function(Map<String, dynamic>)? _socketCb;

  @override
  void initState() {
    super.initState();
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
          _items = list;
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

  static String _statusLine(Map<String, dynamic> row) {
    final s = (row['status'] ?? '').toString();
    if (s == 'pending_admin' || s == 'pending') {
      return 'Waiting for admin';
    }
    if (s == 'assigned' || s == 'in_progress') {
      final vet = row['vetId'] ?? row['staffId'];
      String name = 'your vet';
      if (vet is Map && vet['name'] != null) {
        name = vet['name'].toString();
      }
      if (s == 'in_progress') {
        return 'In progress with $name';
      }
      final dr = name.startsWith('Dr') ? name : 'Dr. $name';
      return 'Vet assigned: $dr';
    }
    if (s == 'completed') return 'Completed';
    if (s == 'cancelled') return 'Cancelled';
    return s;
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Clinic visits (current & past)',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
        ),
        backgroundColor: primary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => _load(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: primary,
        onRefresh: _load,
        child: _loading
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
                    padding: const EdgeInsets.all(24),
                    children: [
                      Text(_error!, style: GoogleFonts.outfit(color: Colors.red[800])),
                      const SizedBox(height: 16),
                      FilledButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  )
                : _items.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(24),
                        children: [
                          Text(
                            'No clinic appointments yet.',
                            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Book a vaccination or checkup from Pet Care+.',
                            style: GoogleFonts.outfit(color: Colors.grey[700]),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        itemCount: _items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final row = _items[i];
                          final pet = row['petId'];
                          final petName = pet is Map ? (pet['name']?.toString() ?? 'Pet') : 'Pet';
                          final type = (row['type'] ?? '').toString();
                          final pd = row['preferredDate'];
                          DateTime? dt;
                          if (pd is String) {
                            dt = DateTime.tryParse(pd);
                          }
                          final when = dt != null
                              ? DateFormat.yMMMd().add_jm().format(dt.toLocal())
                              : (row['timeWindow']?.toString() ?? '—');
                          return Card(
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(color: primary.withValues(alpha: 0.12)),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$type · $petName',
                                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 15),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(when, style: GoogleFonts.outfit(color: Colors.grey[700], fontSize: 13)),
                                  const SizedBox(height: 10),
                                  Text(
                                    _statusLine(row),
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.w600,
                                      color: primary,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
