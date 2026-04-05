import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../book_service_screen.dart';
import '../request_assistance_screen.dart';
import '../service_request_tracking_screen.dart';

/// Brand brown from mock / [AppConstants.primaryColor].
const Color _kVetBrown = Color(AppConstants.primaryColor);

/// Soft pink alert surface (Urgent Health Alerts).
const Color _kAlertPink = Color(0xFFFFE8EE);
const Color _kAlertPinkBorder = Color(0xFFF5C6D4);

/// Health alert derived from each pet’s vaccination fields and `reminders`
/// (stored on the pet document in `pawsewa_chat.pets` — same cluster as the API).
class _HealthAlert {
  const _HealthAlert({
    required this.petId,
    required this.petName,
    required this.severityLabel,
    required this.message,
  });

  final String? petId;
  final String petName;
  final String severityLabel;
  final String message;
}

class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key, this.initialTabIndex = 0});

  /// Tab index: 0 Upcoming, 1 Vaccinations, 2 Records, 3 Clinics.
  final int initialTabIndex;

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late TabController _tabController;

  List<dynamic> _requests = [];
  List<_HealthAlert> _alerts = [];
  bool _loading = true;
  String? _error;
  List<dynamic> _linkedVets = [];

  @override
  void initState() {
    super.initState();
    final idx = widget.initialTabIndex.clamp(0, 3);
    _tabController = TabController(length: 4, vsync: this, initialIndex: idx);
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.getMyPets(),
        _api.getMyServiceRequests(),
        _api.getLinkedVets(),
      ]);
      if (!mounted) {
        return;
      }
      final petsResp = results[0];
      final reqResp = results[1];
      final vetsResp = results[2];

      List<dynamic> pets = [];
      if (petsResp.statusCode == 200 && petsResp.data is Map) {
        final d = petsResp.data['data'];
        if (d is List) {
          pets = d;
        }
      }

      List<dynamic> requests = [];
      if (reqResp.statusCode == 200 && reqResp.data is Map) {
        final d = reqResp.data['data'];
        if (d is List) {
          requests = d;
        }
      }

      List<dynamic> vets = [];
      if (vetsResp.statusCode == 200 && vetsResp.data is Map) {
        final d = vetsResp.data['data'];
        if (d is List) {
          vets = d;
        }
      }

      final alerts = _buildHealthAlerts(pets);

      setState(() {
        _requests = requests;
        _linkedVets = vets;
        _alerts = alerts;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not load vet services. Pull to retry.';
          _loading = false;
        });
      }
    }
  }

  List<_HealthAlert> _buildHealthAlerts(List<dynamic> pets) {
    final out = <_HealthAlert>[];
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    for (final raw in pets) {
      if (raw is! Map) {
        continue;
      }
      final m = Map<String, dynamic>.from(raw);
      final name = m['name']?.toString() ?? 'Pet';
      final id = m['_id']?.toString();
      final status = m['vaccinationStatus']?.toString();
      final nextRaw = m['nextVaccinationDate'];
      DateTime? nextDt;
      if (nextRaw != null) {
        nextDt = DateTime.tryParse(nextRaw.toString());
      }

      final bool overdueByStatus = status == 'Overdue';
      final bool overdueByDate =
          nextDt != null &&
          !nextDt.isAfter(today) &&
          status != 'Up to date';

      if (overdueByStatus || overdueByDate) {
        final rel = nextDt != null ? _relativeOverdueCopy(nextDt) : null;
        out.add(
          _HealthAlert(
            petId: id,
            petName: name,
            severityLabel: 'OVERDUE',
            message: rel != null
                ? 'Vaccination was due $rel. Please schedule immediately.'
                : 'Vaccination is overdue. Please schedule a visit immediately.',
          ),
        );
      }

      final reminders = m['reminders'];
      if (reminders is List) {
        for (final r in reminders) {
          if (r is! Map) {
            continue;
          }
          final rm = Map<String, dynamic>.from(r);
          if (rm['category']?.toString() != 'vaccination') {
            continue;
          }
          if (rm['status']?.toString() == 'completed') {
            continue;
          }
          final dueRaw = rm['dueDate'];
          final due = dueRaw != null ? DateTime.tryParse(dueRaw.toString()) : null;
          if (due == null) {
            continue;
          }
          if (!due.isBefore(now)) {
            continue;
          }
          final title = rm['title']?.toString() ?? 'Vaccination';
          out.add(
            _HealthAlert(
              petId: id,
              petName: name,
              severityLabel: 'OVERDUE',
              message:
                  '$title was due ${_relativeOverdueCopy(due)}. Please schedule immediately.',
            ),
          );
        }
      }
    }
    return out;
  }

  String _relativeOverdueCopy(DateTime due) {
    final today = DateTime.now();
    final d0 = DateTime(due.year, due.month, due.day);
    final t0 = DateTime(today.year, today.month, today.day);
    final days = t0.difference(d0).inDays;
    if (days <= 0) {
      return 'today';
    }
    if (days == 1) {
      return '1 day ago';
    }
    return '$days days ago';
  }

  List<dynamic> get _upcomingRequests {
    return _requests.where((r) {
      final s = r['status']?.toString();
      if (s == 'completed' || s == 'cancelled') {
        return false;
      }
      return true;
    }).toList()
      ..sort((a, b) => _comparePreferredAsc(a, b));
  }

  List<dynamic> get _vaccinationRequests {
    return _requests.where((r) {
      final t = (r['serviceType'] ?? '').toString().toLowerCase();
      return t.contains('vaccin');
    }).toList()
      ..sort((a, b) => _comparePreferredAsc(a, b));
  }

  List<dynamic> get _recordRequests {
    return _requests.where((r) {
      final s = r['status']?.toString();
      return s == 'completed' || s == 'cancelled';
    }).toList()
      ..sort((a, b) => _comparePreferredDesc(a, b));
  }

  int _comparePreferredAsc(dynamic a, dynamic b) {
    final da = DateTime.tryParse((a['preferredDate'] ?? '').toString());
    final db = DateTime.tryParse((b['preferredDate'] ?? '').toString());
    if (da == null && db == null) {
      return 0;
    }
    if (da == null) {
      return 1;
    }
    if (db == null) {
      return -1;
    }
    return da.compareTo(db);
  }

  int _comparePreferredDesc(dynamic a, dynamic b) {
    return -_comparePreferredAsc(a, b);
  }

  String _drName(String? n) {
    if (n == null || n.isEmpty) {
      return 'Veterinarian';
    }
    final t = n.trim();
    final lower = t.toLowerCase();
    if (lower.startsWith('dr.') || lower.startsWith('dr ')) {
      return t;
    }
    return 'Dr. $t';
  }

  String _dateLine(dynamic preferredDate) {
    if (preferredDate == null) {
      return '—';
    }
    final d = DateTime.tryParse(preferredDate.toString());
    if (d == null) {
      return preferredDate.toString();
    }
    return DateFormat('MMM d, yyyy').format(d);
  }

  Future<void> _confirmCancel(String requestId) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text('Cancel appointment?', style: GoogleFonts.outfit()),
          content: Text(
            'This will cancel your service request. You can book again anytime.',
            style: GoogleFonts.outfit(fontSize: 14),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('Keep', style: GoogleFonts.outfit()),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: Colors.grey[800]),
              child: Text('Cancel visit', style: GoogleFonts.outfit(color: Colors.white)),
            ),
          ],
        );
      },
    );
    if (ok != true || !mounted) {
      return;
    }
    try {
      final res = await _api.cancelMyServiceRequest(requestId);
      if (!mounted) {
        return;
      }
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Appointment cancelled', style: GoogleFonts.outfit()),
            behavior: SnackBarBehavior.floating,
          ),
        );
        await _loadAll();
      } else {
        final msg = res.data is Map ? (res.data['message']?.toString() ?? 'Failed') : 'Failed';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
        );
      }
    } on DioException catch (e) {
      if (!mounted) {
        return;
      }
      final msg = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ?? 'Could not cancel'
          : 'Could not cancel';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
      );
    }
  }

  void _openBook({String? initialPetId}) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BookServiceScreen(initialPetId: initialPetId),
      ),
    ).then((_) => _loadAll());
  }

  void _openTrack(String requestId, String? serviceType) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => ServiceRequestTrackingScreen(
          requestId: requestId,
          initialServiceType: serviceType,
        ),
      ),
    ).then((_) => _loadAll());
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final fabBottom = 12.0 + bottomInset;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: _kVetBrown),
                )
              : _error != null
              ? _buildError()
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 320),
                      switchInCurve: Curves.easeOutCubic,
                      transitionBuilder: (child, anim) {
                        return SizeTransition(
                          sizeFactor: anim,
                          axisAlignment: -1,
                          child: FadeTransition(opacity: anim, child: child),
                        );
                      },
                      child: _alerts.isEmpty
                          ? const SizedBox(key: ValueKey('no-alerts'), height: 0)
                          : Padding(
                              key: const ValueKey('alerts'),
                              padding: const EdgeInsets.fromLTRB(16, 12, 0, 8),
                              child: _buildAlertsCarousel(),
                            ),
                    ),
                    Material(
                      color: const Color(AppConstants.secondaryColor),
                      child: TabBar(
                        controller: _tabController,
                        isScrollable: true,
                        tabAlignment: TabAlignment.start,
                        labelColor: _kVetBrown,
                        unselectedLabelColor: Colors.brown.shade200,
                        indicatorColor: _kVetBrown,
                        indicatorWeight: 3,
                        labelStyle: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                        unselectedLabelStyle: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                        tabs: const [
                          Tab(text: 'Upcoming'),
                          Tab(text: 'Vaccinations'),
                          Tab(text: 'Records'),
                          Tab(text: 'Clinics'),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Container(
                        color: const Color(AppConstants.secondaryColor),
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            _buildRequestsTab(
                              _upcomingRequests,
                              showActions: true,
                              sectionTitle: 'Upcoming Appointments',
                            ),
                            _buildRequestsTab(
                              _vaccinationRequests,
                              showActions: true,
                              sectionTitle: 'Vaccination visits',
                            ),
                            _buildRequestsTab(
                              _recordRequests,
                              showActions: false,
                              sectionTitle: 'Past visits',
                            ),
                            _buildClinicsTab(),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(height: fabBottom + 64),
                  ],
                ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: fabBottom,
          child: FilledButton.icon(
            onPressed: () => _openBook(),
            icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.white),
            label: Text(
              'Book New Appointment',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: Colors.white,
              ),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: _kVetBrown,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              elevation: 4,
              shadowColor: _kVetBrown.withValues(alpha: 0.35),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!, textAlign: TextAlign.center, style: GoogleFonts.outfit()),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loadAll,
              style: FilledButton.styleFrom(backgroundColor: _kVetBrown),
              child: Text('Retry', style: GoogleFonts.outfit(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAlertsCarousel() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Urgent Health Alerts',
          style: GoogleFonts.domine(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: _kVetBrown,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 132,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _alerts.length,
            separatorBuilder: (context, index) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final a = _alerts[i];
              return _HealthAlertCard(
                alert: a,
                onBook: () => _openBook(initialPetId: a.petId),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildRequestsTab(
    List<dynamic> list, {
    required bool showActions,
    required String sectionTitle,
  }) {
    if (list.isEmpty) {
      return RefreshIndicator(
        color: _kVetBrown,
        onRefresh: _loadAll,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 8),
            Text(
              sectionTitle,
              style: GoogleFonts.domine(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: _kVetBrown,
              ),
            ),
            const SizedBox(height: 40),
            Icon(Icons.event_available_outlined, size: 56, color: Colors.brown.shade200),
            const SizedBox(height: 16),
            Text(
              'Nothing here yet',
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: Colors.brown.shade800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Book a visit to see it in this list.',
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(fontSize: 14, color: Colors.brown.shade300),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: _kVetBrown,
      onRefresh: _loadAll,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: list.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12, left: 2),
              child: Text(
                sectionTitle,
                style: GoogleFonts.domine(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: _kVetBrown,
                ),
              ),
            );
          }
          final req = list[index - 1];
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: _AppointmentCard(
              request: req,
              showActions: showActions,
              drName: _drName,
              dateLine: _dateLine,
              onReschedule: (petId) => _openBook(initialPetId: petId),
              onCancel: _confirmCancel,
              onTrack: _openTrack,
            ),
          );
        },
      ),
    );
  }

  Widget _buildClinicsTab() {
    return RefreshIndicator(
      color: _kVetBrown,
      onRefresh: _loadAll,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Text(
            'Your clinics & vets',
            style: GoogleFonts.domine(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: _kVetBrown,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Vets linked from your visits and medical records.',
            style: GoogleFonts.outfit(fontSize: 13, color: Colors.brown.shade300),
          ),
          const SizedBox(height: 16),
          if (_linkedVets.isEmpty)
            Card(
              elevation: 0,
              color: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'No linked clinics yet. After your first vet visit, your care team will appear here.',
                  style: GoogleFonts.outfit(fontSize: 14, color: Colors.brown.shade400),
                ),
              ),
            )
          else
            ..._linkedVets.map((v) {
              if (v is! Map) {
                return const SizedBox.shrink();
              }
              final m = Map<String, dynamic>.from(v);
              final name = m['name']?.toString() ?? 'Veterinarian';
              final clinic = m['clinicName']?.toString();
              final spec =
                  m['specialization']?.toString() ?? m['specialty']?.toString() ?? '';
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Card(
                  elevation: 0,
                  color: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: _kVetBrown.withValues(alpha: 0.12),
                      child: Icon(Icons.medical_services_rounded, color: _kVetBrown),
                    ),
                    title: Text(
                      _drName(name),
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      [if (clinic != null && clinic.isNotEmpty) clinic, spec]
                          .where((e) => e.isNotEmpty)
                          .join(' · '),
                      style: GoogleFonts.outfit(fontSize: 12, color: Colors.brown.shade300),
                    ),
                  ),
                ),
              );
            }),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute<void>(builder: (_) => const RequestAssistanceScreen()),
              );
            },
            icon: Icon(Icons.emergency_outlined, color: _kVetBrown),
            label: Text(
              'Request emergency assistance',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w600,
                color: _kVetBrown,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: _kVetBrown, width: 1.4),
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      ),
    );
  }
}

class _HealthAlertCard extends StatelessWidget {
  const _HealthAlertCard({required this.alert, required this.onBook});

  final _HealthAlert alert;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    const red = Color(0xFFC62828);
    return Container(
      width: MediaQuery.sizeOf(context).width * 0.82,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _kAlertPink,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kAlertPinkBorder, width: 1.2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: red.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.vaccines_rounded, color: Colors.white, size: 26),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.petName,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: _kVetBrown,
                  ),
                ),
                Text(
                  alert.severityLabel,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                    letterSpacing: 0.6,
                    color: red,
                  ),
                ),
                const SizedBox(height: 4),
                Expanded(
                  child: Text(
                    alert.message,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      height: 1.35,
                      color: red.withValues(alpha: 0.85),
                    ),
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: onBook,
                    style: TextButton.styleFrom(
                      foregroundColor: _kVetBrown,
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      'Book vaccine',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
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

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({
    required this.request,
    required this.showActions,
    required this.drName,
    required this.dateLine,
    required this.onReschedule,
    required this.onCancel,
    required this.onTrack,
  });

  final dynamic request;
  final bool showActions;
  final String Function(String?) drName;
  final String Function(dynamic) dateLine;
  final void Function(String? petId) onReschedule;
  final void Function(String requestId) onCancel;
  final void Function(String requestId, String? serviceType) onTrack;

  @override
  Widget build(BuildContext context) {
    final pet = request['pet'] as Map<String, dynamic>?;
    final staff = request['assignedStaff'] as Map<String, dynamic>?;
    final serviceType = request['serviceType']?.toString() ?? 'Visit';
    final preferredDate = request['preferredDate'];
    final timeWindow = request['timeWindow']?.toString() ?? '';
    final requestId = request['_id']?.toString();
    final petId = pet?['_id']?.toString();
    final photo = pet?['photoUrl']?.toString();

    return Material(
      color: Colors.white,
      elevation: 2,
      shadowColor: Colors.black26,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _PetAvatar(photoUrl: photo),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        serviceType,
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        drName(staff?['name']?.toString()),
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: _kVetBrown,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey[600]),
                          const SizedBox(width: 6),
                          Text(
                            dateLine(preferredDate),
                            style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[700]),
                          ),
                          const SizedBox(width: 14),
                          Icon(Icons.schedule_rounded, size: 14, color: Colors.grey[600]),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              timeWindow.isNotEmpty ? timeWindow : 'Time TBD',
                              style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[700]),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (requestId != null)
                  PopupMenuButton<String>(
                    icon: Icon(Icons.more_vert_rounded, color: Colors.grey[700]),
                    onSelected: (value) {
                      if (value == 'track') {
                        onTrack(requestId, serviceType);
                      }
                    },
                    itemBuilder: (ctx) {
                      return [
                        PopupMenuItem(
                          value: 'track',
                          child: Text('View details', style: GoogleFonts.outfit()),
                        ),
                      ];
                    },
                  ),
              ],
            ),
            if (showActions && requestId != null) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => onReschedule(petId),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _kVetBrown,
                        side: const BorderSide(color: _kVetBrown, width: 1.4),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        'Reschedule',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => onCancel(requestId),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.grey.shade200,
                        foregroundColor: Colors.grey.shade800,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        'Cancel',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PetAvatar extends StatelessWidget {
  const _PetAvatar({this.photoUrl});

  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    final u = photoUrl?.trim();
    if (u != null && u.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: u,
          width: 52,
          height: 52,
          fit: BoxFit.cover,
          placeholder: (context, url) => _placeholder(),
          errorWidget: (context, url, error) => _placeholder(),
        ),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() {
    return CircleAvatar(
      radius: 26,
      backgroundColor: _kVetBrown.withValues(alpha: 0.12),
      child: Icon(Icons.pets_rounded, color: _kVetBrown, size: 28),
    );
  }
}
