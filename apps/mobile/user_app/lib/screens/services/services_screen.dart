import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/dog_vaccination_schedule.dart';
import 'guided_booking/guided_booking_flow_screen.dart';
import '../request_assistance_screen.dart';
import '../service_request_tracking_screen.dart';

// â”€â”€â”€ Design tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Color _kBrown = Color(AppConstants.primaryColor);
const Color _kInk = Color(AppConstants.inkColor);

const Color _kRed = Color(0xFFB71C1C);
const Color _kGreen = Color(0xFF1B5E20);
const Color _kAmber = Color(0xFFF59E0B);

// â”€â”€â”€ Internal models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _HealthAlert {
  const _HealthAlert({
    required this.petId,
    required this.petName,
    required this.severity,
    required this.message,
  });
  final String? petId;
  final String petName;
  final String severity; // 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING'
  final String message;

  bool get isUrgent => severity == 'OVERDUE' || severity == 'DUE_TODAY';
}

// â”€â”€â”€ Service catalogue entry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _ServiceTile {
  const _ServiceTile({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.serviceType,
    this.tag,
    this.isEmergency = false,
  });
  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final String serviceType;
  final String? tag;
  final bool isEmergency;
}

const List<_ServiceTile> _kServices = [
  _ServiceTile(
    id: 'home_visit',
    title: 'Home Visit',
    subtitle: 'A verified vet at your doorstep',
    icon: Icons.home_rounded,
    serviceType: 'Home Visit by Vet',
    tag: 'Popular',
  ),
  _ServiceTile(
    id: 'vaccination',
    title: 'Vaccinations',
    subtitle: 'Stay protected with timely doses',
    icon: Icons.vaccines_rounded,
    serviceType: 'Vaccination',
    tag: 'Prevention',
  ),
  _ServiceTile(
    id: 'grooming',
    title: 'Grooming',
    subtitle: 'Coat, claws, and confidence',
    icon: Icons.cut_rounded,
    serviceType: 'Grooming',
    tag: 'Care',
  ),
  _ServiceTile(
    id: 'nutrition',
    title: 'Nutrition',
    subtitle: 'Diet plans tailored for your pet',
    icon: Icons.restaurant_rounded,
    serviceType: 'Nutrition Consultation',
    tag: 'Wellness',
  ),
  _ServiceTile(
    id: 'online',
    title: 'Online Consult',
    subtitle: 'Talk to a vet from anywhere',
    icon: Icons.video_call_rounded,
    serviceType: 'Online Consultation',
    tag: 'Remote',
  ),
  _ServiceTile(
    id: 'emergency',
    title: 'Emergency',
    subtitle: 'Fast help for urgent symptoms',
    icon: Icons.emergency_rounded,
    serviceType: 'Emergency Care',
    tag: 'Urgent',
    isEmergency: true,
  ),
];

// â”€â”€â”€ Root widget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key, this.initialTabIndex = 0});

  /// 0 = Visits, 1 = Health, 2 = Book, 3 = Team
  final int initialTabIndex;

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late final TabController _tabs;

  List<dynamic> _requests = [];
  List<_HealthAlert> _alerts = [];
  List<dynamic> _pets = [];
  List<dynamic> _linkedVets = [];
  bool _loading = true;
  String? _error;
  String? _vacPetId;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(
      length: 4,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 3),
    );
    _loadAll();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  // â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Future<void> _loadAll() async {
    if (!mounted) return;
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
      if (!mounted) return;

      List<dynamic> pets = [];
      final pr = results[0];
      if (pr.statusCode == 200 && pr.data is Map) {
        final d = pr.data['data'];
        if (d is List) pets = d;
      }

      List<dynamic> reqs = [];
      final rr = results[1];
      if (rr.statusCode == 200 && rr.data is Map) {
        final d = rr.data['data'];
        if (d is List) reqs = d;
      }

      List<dynamic> vets = [];
      final vr = results[2];
      if (vr.statusCode == 200 && vr.data is Map) {
        final d = vr.data['data'];
        if (d is List) vets = d;
      }

      final alerts = _buildAlerts(pets);
      setState(() {
        _pets = pets;
        _requests = reqs;
        _linkedVets = vets;
        _alerts = alerts;
        _vacPetId ??= _firstPetId(pets);
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not load your services. Pull to retry.';
          _loading = false;
        });
      }
    }
  }

  String? _firstPetId(List<dynamic> pets) {
    for (final p in pets) {
      if (p is Map) {
        final id = (p['_id'] ?? p['id'])?.toString();
        if (id != null && id.isNotEmpty) return id;
      }
    }
    return null;
  }

  List<_HealthAlert> _buildAlerts(List<dynamic> pets) {
    final out = <_HealthAlert>[];
    final today = DateTime(
        DateTime.now().year, DateTime.now().month, DateTime.now().day);
    for (final raw in pets) {
      if (raw is! Map) continue;
      final m = Map<String, dynamic>.from(raw);
      final name = m['name']?.toString() ?? 'Pet';
      final id = m['_id']?.toString();
      final species = (m['species'] ?? '').toString().toLowerCase();

      final rawReminders = m['reminders'];
      final reminders = <Map<String, dynamic>>[];
      if (rawReminders is List) {
        for (final r in rawReminders) {
          if (r is Map) reminders.add(Map<String, dynamic>.from(r));
        }
      }

      if (species == 'dog') {
        final dob = DogVaccinationSchedule.parseDob(m['dob']);
        for (final e in DogVaccinationSchedule.build(
          petName: name,
          today: today,
          dob: dob,
          reminders: reminders,
        )) {
          if (e.state == VaccineState.overdue) {
            out.add(_HealthAlert(
                petId: id, petName: name, severity: 'OVERDUE', message: e.message));
          } else if (e.state == VaccineState.dueToday) {
            out.add(_HealthAlert(
                petId: id, petName: name, severity: 'DUE_TODAY', message: e.message));
          } else if (e.state == VaccineState.upcoming && e.dueDate != null) {
            if (e.dueDate!.difference(today).inDays <= 7) {
              out.add(_HealthAlert(
                  petId: id, petName: name, severity: 'UPCOMING', message: e.message));
            }
          }
        }
        continue;
      }

      final status = m['vaccinationStatus']?.toString();
      final nextRaw = m['nextVaccinationDate'];
      final nextDt = nextRaw != null ? DateTime.tryParse(nextRaw.toString()) : null;
      if (status == 'Overdue' ||
          (nextDt != null && !nextDt.isAfter(today) && status != 'Up to date')) {
        out.add(_HealthAlert(
          petId: id,
          petName: name,
          severity: 'OVERDUE',
          message: 'Vaccination is overdue. Please schedule a visit.',
        ));
      }
    }
    return out;
  }

  // â”€â”€ Getters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  List<dynamic> get _activeRequests => _requests.where((r) {
        final s = r['status']?.toString();
        return s != 'completed' && s != 'cancelled';
      }).toList()
        ..sort(_cmpAsc);

  List<dynamic> get _historyRequests => _requests.where((r) {
        final s = r['status']?.toString();
        return s == 'completed' || s == 'cancelled';
      }).toList()
        ..sort(_cmpDesc);

  int _cmpAsc(dynamic a, dynamic b) {
    final da = DateTime.tryParse((a['preferredDate'] ?? '').toString());
    final db = DateTime.tryParse((b['preferredDate'] ?? '').toString());
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    return da.compareTo(db);
  }

  int _cmpDesc(dynamic a, dynamic b) => -_cmpAsc(a, b);

  // â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  void _openBook({String? petId, String? serviceType}) {
    HapticFeedback.lightImpact();
    Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => GuidedBookingFlowScreen(initialPetId: petId),
      ),
    ).then((_) => _loadAll());
  }

  void _openTrack(String requestId, String? serviceType) {
    Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => ServiceRequestTrackingScreen(
          requestId: requestId,
          initialServiceType: serviceType,
        ),
      ),
    ).then((_) => _loadAll());
  }

  Future<void> _confirmCancel(String requestId) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text('Cancel appointment?',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 18)),
        content: Text(
          'This will cancel your request. You can book again anytime.',
          style: GoogleFonts.outfit(fontSize: 14, height: 1.45,
              color: _kInk.withValues(alpha: 0.65)),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          SizedBox(
            width: double.infinity,
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kInk,
                      side: BorderSide(color: _kInk.withValues(alpha: 0.18)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text('Keep it',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFB71C1C),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text('Cancel',
                        style: GoogleFonts.outfit(
                            color: Colors.white, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      final res = await _api.cancelMyServiceRequest(requestId);
      if (!mounted) return;
      final msg = res.statusCode == 200
          ? 'Appointment cancelled'
          : ((res.data is Map)
              ? (res.data['message']?.toString() ?? 'Could not cancel')
              : 'Could not cancel');
      _snack(msg);
      if (res.statusCode == 200) await _loadAll();
    } on DioException catch (e) {
      final msg = (e.response?.data is Map)
          ? (e.response!.data as Map)['message']?.toString() ?? 'Could not cancel'
          : 'Could not cancel';
      _snack(msg);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.outfit(fontWeight: FontWeight.w500)),
      behavior: SnackBarBehavior.floating,
      backgroundColor: _kInk,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
    ));
  }

  String _drName(String? n) {
    if (n == null || n.isEmpty) return 'Veterinarian';
    final t = n.trim();
    final l = t.toLowerCase();
    return (l.startsWith('dr.') || l.startsWith('dr ')) ? t : 'Dr. $t';
  }

  String _dateLine(dynamic d) {
    if (d == null) return 'â€”';
    final dt = DateTime.tryParse(d.toString());
    return dt == null ? d.toString() : DateFormat('EEE, MMM d').format(dt);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  @override
  Widget build(BuildContext context) {
    if (_loading) return const _Loader();
    if (_error != null) return _buildError();
    return _buildBody();
  }

  Widget _buildError() {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: _kBrown.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.wifi_off_rounded, color: _kBrown, size: 34),
            ),
            const SizedBox(height: 20),
            Text('Connection lost',
                style: GoogleFonts.outfit(
                    fontSize: 20, fontWeight: FontWeight.w700, color: _kInk)),
            const SizedBox(height: 8),
            Text(_error!,
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                    fontSize: 14,
                    color: _kInk.withValues(alpha: 0.55),
                    height: 1.4)),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _loadAll,
                icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                label: Text('Try again',
                    style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700, color: Colors.white)),
                style: FilledButton.styleFrom(
                  backgroundColor: _kBrown,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape:
                      RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildBody() {
    return Scaffold(
      backgroundColor: Colors.white,
      floatingActionButton: _BookFab(onTap: () => _openBook()),
      body: Column(
        children: [
          // â”€â”€ Pill tab bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          _PillTabBar(controller: _tabs),
          // â”€â”€ Tab content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _VisitsTab(
                  active: _activeRequests,
                  history: _historyRequests,
                  alerts: _alerts,
                  drName: _drName,
                  dateLine: _dateLine,
                  onBook: _openBook,
                  onTrack: _openTrack,
                  onCancel: _confirmCancel,
                  onRefresh: _loadAll,
                ),
                _HealthTab(
                  pets: _pets.whereType<Map>()
                      .map((e) => Map<String, dynamic>.from(e))
                      .toList(),
                  selectedPetId: _vacPetId,
                  onSelectPet: (id) => setState(() => _vacPetId = id),
                  onBook: (petId) => _openBook(petId: petId),
                  onRefresh: _loadAll,
                ),
                _BookTab(
                  onSelect: (tile) =>
                      _openBook(serviceType: tile.serviceType),
                  onEmergency: () => Navigator.push<void>(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const RequestAssistanceScreen()),
                  ),
                ),
                _TeamTab(
                  vets: _linkedVets,
                  drName: _drName,
                  onEmergency: () => Navigator.push<void>(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const RequestAssistanceScreen()),
                  ),
                  onRefresh: _loadAll,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PILL TAB BAR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class _PillTabBar extends StatelessWidget {
  const _PillTabBar({required this.controller});
  final TabController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: TabBar(
        controller: controller,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        padding: EdgeInsets.zero,
        labelPadding: const EdgeInsets.symmetric(horizontal: 4),
        indicator: BoxDecoration(
          color: _kBrown,
          borderRadius: BorderRadius.circular(999),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        labelColor: Colors.white,
        unselectedLabelColor: _kInk.withValues(alpha: 0.45),
        labelStyle:
            GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700),
        unselectedLabelStyle:
            GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500),
        tabs: const [
          Tab(text: '  Visits  '),
          Tab(text: '  Health  '),
          Tab(text: '  Book  '),
          Tab(text: '  Team  '),
        ],
      ),
    );
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 0 â€” VISITS  (active + history, health alerts surfaced inline)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class _VisitsTab extends StatelessWidget {
  const _VisitsTab({
    required this.active,
    required this.history,
    required this.alerts,
    required this.drName,
    required this.dateLine,
    required this.onBook,
    required this.onTrack,
    required this.onCancel,
    required this.onRefresh,
  });

  final List<dynamic> active;
  final List<dynamic> history;
  final List<_HealthAlert> alerts;
  final String Function(String?) drName;
  final String Function(dynamic) dateLine;
  final void Function({String? petId, String? serviceType}) onBook;
  final void Function(String id, String? type) onTrack;
  final void Function(String id) onCancel;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final urgentAlerts = alerts.where((a) => a.isUrgent).toList();
    final isEmpty = active.isEmpty && history.isEmpty && urgentAlerts.isEmpty;

    return RefreshIndicator(
      color: _kBrown,
      onRefresh: onRefresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // â”€â”€ Urgent health banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (urgentAlerts.isNotEmpty)
            SliverToBoxAdapter(
              child: _UrgentHealthBanner(
                alerts: urgentAlerts,
                onBook: (petId) => onBook(petId: petId),
              ),
            ),

          // â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _EmptyState(
                icon: Icons.event_available_outlined,
                title: 'No visits yet',
                body: "Book your first vet visit and it'll appear here with live tracking.",
                cta: FilledButton.icon(
                  onPressed: () => onBook(),
                  icon: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                  label: Text('Book a visit',
                      style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w700, color: Colors.white)),
                  style: FilledButton.styleFrom(
                    backgroundColor: _kBrown,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
            ),

          // â”€â”€ Active visits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (active.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 20, 18, 10),
                child: _SectionHeader(
                  label: 'Active',
                  count: active.length,
                  accentColor: _kBrown,
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              sliver: SliverList.separated(
                itemCount: active.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (_, i) => _AppointmentCard(
                  request: active[i],
                  isHistory: false,
                  drName: drName,
                  dateLine: dateLine,
                  onTrack: onTrack,
                  onReschedule: (petId) => onBook(petId: petId),
                  onCancel: onCancel,
                ),
              ),
            ),
          ],

          // â”€â”€ Past visits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          if (history.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 28, 18, 10),
                child: _SectionHeader(
                  label: 'History',
                  count: history.length,
                  accentColor: _kInk.withValues(alpha: 0.35),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
              sliver: SliverList.separated(
                itemCount: history.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (_, i) => _AppointmentCard(
                  request: history[i],
                  isHistory: true,
                  drName: drName,
                  dateLine: dateLine,
                  onTrack: onTrack,
                  onReschedule: (petId) => onBook(petId: petId),
                  onCancel: onCancel,
                ),
              ),
            ),
          ],

          if (!isEmpty && history.isEmpty)
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 1 â€” HEALTH & VACCINATION INTELLIGENCE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class _HealthTab extends StatelessWidget {
  const _HealthTab({
    required this.pets,
    required this.selectedPetId,
    required this.onSelectPet,
    required this.onBook,
    required this.onRefresh,
  });

  final List<Map<String, dynamic>> pets;
  final String? selectedPetId;
  final void Function(String id) onSelectPet;
  final void Function(String? petId) onBook;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    if (pets.isEmpty) {
      return const _EmptyState(
        icon: Icons.vaccines_outlined,
        title: 'Add a pet first',
        body: 'Your vaccination schedule and health timeline appear here once you add a pet.',
      );
    }

    final selId = selectedPetId ?? _petId(pets.first);
    final selected = pets.firstWhere(
      (p) => _petId(p) == selId,
      orElse: () => pets.first,
    );

    final petName = (selected['name'] ?? 'Pet').toString();
    final species = (selected['species'] ?? '').toString().toLowerCase();
    final dob = DogVaccinationSchedule.parseDob(selected['dob']);
    final rawReminders = selected['reminders'];
    final reminders = <Map<String, dynamic>>[];
    if (rawReminders is List) {
      for (final r in rawReminders) {
        if (r is Map) reminders.add(Map<String, dynamic>.from(r));
      }
    }
    final today = DateTime.now();

    final entries = species == 'dog'
        ? DogVaccinationSchedule.build(
            petName: petName, today: today, dob: dob, reminders: reminders)
        : const <VaccineEntry>[];

    final overdue = entries.where((e) => e.state == VaccineState.overdue).toList();
    final dueToday = entries.where((e) => e.state == VaccineState.dueToday).toList();
    final upcoming = entries.where((e) => e.state == VaccineState.upcoming).toList();
    final done = entries.where((e) => e.state == VaccineState.completed).toList();
    final info = entries.where((e) => e.state == VaccineState.historyIncomplete).toList();

    // Most urgent next vaccine
    VaccineEntry? next;
    final cands = [...overdue, ...dueToday, ...upcoming];
    if (cands.isNotEmpty) {
      cands.sort((a, b) {
        final c = a.sortKey.compareTo(b.sortKey);
        if (c != 0) return c;
        final ad = a.dueDate ?? DateTime(0);
        final bd = b.dueDate ?? DateTime(0);
        return ad.compareTo(bd);
      });
      next = cands.first;
    }

    return RefreshIndicator(
      color: _kBrown,
      onRefresh: onRefresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Pet selector
          SliverToBoxAdapter(
            child: _PetChipRow(
              pets: pets,
              selectedId: selId,
              onSelect: onSelectPet,
            ),
          ),

          // Non-dog notice
          if (species != 'dog') ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: _InfoCard(
                  icon: Icons.info_outline_rounded,
                  title: 'Dog schedule only for now',
                  body: 'Detailed schedules are for dogs. You can still book a vet visit and our team will guide you.',
                ),
              ),
            ),
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: FilledButton.icon(
                    onPressed: () => onBook(selId),
                    icon: const Icon(Icons.vaccines_rounded, color: Colors.white, size: 18),
                    label: Text('Book a vaccination visit',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: Colors.white)),
                    style: FilledButton.styleFrom(
                      backgroundColor: _kBrown,
                      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                ),
              ),
            ),
          ] else ...[
            // Info banner
            if (info.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: _InfoCard(
                    icon: Icons.health_and_safety_outlined,
                    title: info.first.title,
                    body: info.first.message,
                  ),
                ),
              ),

            // Highlight card â€” most urgent action
            if (next != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: _NextVaccineHighlight(
                    petName: petName,
                    entry: next,
                  ),
                ),
              ),

            // Vaccine sections
            if (overdue.isNotEmpty) ...[
              _vaccineHeader('Overdue', overdue.length, _kRed),
              _vaccineList(overdue, dob, _VaccineTone.overdue),
            ],
            if (dueToday.isNotEmpty) ...[
              _vaccineHeader('Due today', dueToday.length, _kAmber),
              _vaccineList(dueToday, dob, _VaccineTone.dueToday),
            ],
            if (upcoming.isNotEmpty) ...[
              _vaccineHeader('Upcoming', upcoming.length, _kBrown),
              _vaccineList(upcoming, dob, _VaccineTone.upcoming),
            ],
            if (done.isNotEmpty) ...[
              _vaccineHeader('Completed', done.length, _kGreen),
              _vaccineList(done.take(4).toList(), dob, _VaccineTone.done),
            ],

            // Contextual booking CTA
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 24, 16, 120),
                child: _VaccineBookingCta(
                  petName: petName,
                  onBook: () => onBook(selId),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String? _petId(Map<String, dynamic> p) =>
      (p['_id'] ?? p['id'])?.toString();

  Widget _vaccineHeader(String label, int count, Color color) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
        child: Row(children: [
          Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          Text(label.toUpperCase(),
              style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: color)),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(999)),
            child: Text('$count',
                style: GoogleFonts.outfit(
                    fontSize: 11, fontWeight: FontWeight.w800, color: color)),
          ),
        ]),
      ),
    );
  }

  Widget _vaccineList(List<VaccineEntry> entries, DateTime? dob, _VaccineTone tone) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverList.separated(
        itemCount: entries.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (_, i) => _VaccineRow(entry: entries[i], dob: dob, tone: tone),
      ),
    );
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 2 â€” BOOK A SERVICE  (NEW: service discovery grid)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class _BookTab extends StatelessWidget {
  const _BookTab({required this.onSelect, required this.onEmergency});
  final void Function(_ServiceTile tile) onSelect;
  final VoidCallback onEmergency;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const ClampingScrollPhysics(),
      slivers: [
        // Header
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 6),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('What do you need?',
                  style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: _kInk)),
              const SizedBox(height: 4),
              Text('Our verified vets will come to you.',
                  style: GoogleFonts.outfit(
                      fontSize: 14, color: _kInk.withValues(alpha: 0.45))),
            ]),
          ),
        ),

        // Service grid
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          sliver: SliverGrid.builder(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.05,
            ),
            itemCount: _kServices.length,
            itemBuilder: (_, i) => _ServiceCard(
              tile: _kServices[i],
              onTap: () => _kServices[i].isEmergency
                  ? onEmergency()
                  : onSelect(_kServices[i]),
            ),
          ),
        ),

        // Reassurance section
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: _kBrown.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
              ),
              child: Row(children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: _kBrown.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.verified_rounded, color: _kBrown, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Certified & trusted vets',
                        style: GoogleFonts.outfit(
                            fontSize: 14, fontWeight: FontWeight.w700, color: _kInk)),
                    const SizedBox(height: 3),
                    Text('All professionals on PawSewa are verified and background-checked.',
                        style: GoogleFonts.outfit(
                            fontSize: 12.5, color: _kInk.withValues(alpha: 0.50), height: 1.4)),
                  ]),
                ),
              ]),
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 120)),
      ],
    );
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 3 â€” YOUR CARE TEAM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class _TeamTab extends StatelessWidget {
  const _TeamTab({
    required this.vets,
    required this.drName,
    required this.onEmergency,
    required this.onRefresh,
  });
  final List<dynamic> vets;
  final String Function(String?) drName;
  final VoidCallback onEmergency;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: _kBrown,
      onRefresh: onRefresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Your care team',
                    style: GoogleFonts.outfit(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: _kInk)),
                const SizedBox(height: 4),
                Text('Vets from your past visits and records.',
                    style: GoogleFonts.outfit(
                        fontSize: 14, color: _kInk.withValues(alpha: 0.45))),
              ]),
            ),
          ),

          if (vets.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: _EmptyVetCard(),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              sliver: SliverList.separated(
                itemCount: vets.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final v = vets[i];
                  if (v is! Map) return const SizedBox.shrink();
                  final m = Map<String, dynamic>.from(v);
                  return _VetCard(
                    name: drName(m['name']?.toString()),
                    clinic: m['clinicName']?.toString() ?? '',
                    specialization: m['specialization']?.toString() ??
                        m['specialty']?.toString() ??
                        '',
                  );
                },
              ),
            ),

          // Emergency banner
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 28, 16, 120),
              child: _EmergencyBanner(onTap: onEmergency),
            ),
          ),
        ],
      ),
    );
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SHARED WIDGETS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Loader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _Loader extends StatelessWidget {
  const _Loader();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(
              color: _kBrown, strokeWidth: 2.5, strokeCap: StrokeCap.round),
          ),
          const SizedBox(height: 16),
          Text('Loading your care hubâ€¦',
              style: GoogleFonts.outfit(
                  fontSize: 14, color: _kInk.withValues(alpha: 0.45))),
        ]),
      ),
    );
  }
}

// â”€â”€ FAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _BookFab extends StatelessWidget {
  const _BookFab({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.extended(
      onPressed: onTap,
      backgroundColor: _kBrown,
      foregroundColor: Colors.white,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      icon: const Icon(Icons.add_rounded, size: 22),
      label: Text('Book visit',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 14)),
    );
  }
}

// â”€â”€ Section header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.label,
    required this.count,
    required this.accentColor,
  });
  final String label;
  final int count;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Text(
        label.toUpperCase(),
        style: GoogleFonts.outfit(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
            color: accentColor),
      ),
      const SizedBox(width: 8),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: accentColor.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text('$count',
            style: GoogleFonts.outfit(
                fontSize: 11, fontWeight: FontWeight.w800, color: accentColor)),
      ),
    ]);
  }
}

// â”€â”€ Urgent health banner (top of Visits tab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _UrgentHealthBanner extends StatelessWidget {
  const _UrgentHealthBanner({required this.alerts, required this.onBook});
  final List<_HealthAlert> alerts;
  final void Function(String? petId) onBook;

  @override
  Widget build(BuildContext context) {
    final a = alerts.first;
    final isOverdue = a.severity == 'OVERDUE';
    final accent = isOverdue ? _kRed : _kAmber;
    final bgColor = isOverdue ? const Color(0xFFFFF0F0) : const Color(0xFFFFF8E7);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accent.withValues(alpha: 0.22)),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => onBook(a.petId),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(Icons.notifications_active_rounded,
                    color: accent, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    isOverdue
                        ? '${a.petName}\'s vaccination is overdue'
                        : '${a.petName}\'s vaccination is due today',
                    style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700, fontSize: 13.5, color: accent),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    a.message,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                        fontSize: 12, color: accent.withValues(alpha: 0.70), height: 1.35),
                  ),
                ]),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text('Book',
                    style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700, fontSize: 12, color: Colors.white)),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// â”€â”€ Appointment card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({
    required this.request,
    required this.isHistory,
    required this.drName,
    required this.dateLine,
    required this.onTrack,
    required this.onReschedule,
    required this.onCancel,
  });

  final dynamic request;
  final bool isHistory;
  final String Function(String?) drName;
  final String Function(dynamic) dateLine;
  final void Function(String id, String? type) onTrack;
  final void Function(String? petId) onReschedule;
  final void Function(String id) onCancel;

  static ({String label, Color bg, Color fg, Color stripe}) _badge(String s) =>
      switch (s) {
        'pending' => (
            label: 'Reviewing',
            bg: const Color(0xFFFFF8E1),
            fg: const Color(0xFF8D6E63),
            stripe: const Color(0xFFF9A825)
          ),
        'assigned' || 'accepted' => (
            label: 'Confirmed',
            bg: const Color(0xFFE8F5E9),
            fg: _kGreen,
            stripe: _kGreen
          ),
        'en_route' => (
            label: 'On the way',
            bg: const Color(0xFFE3F2FD),
            fg: const Color(0xFF1565C0),
            stripe: const Color(0xFF1565C0)
          ),
        'arrived' => (
            label: 'Arrived',
            bg: const Color(0xFFE8F5E9),
            fg: _kGreen,
            stripe: _kGreen
          ),
        'in_progress' => (
            label: 'In progress',
            bg: const Color(0xFFE8F5E9),
            fg: _kGreen,
            stripe: _kGreen
          ),
        'completed' => (
            label: 'Completed',
            bg: const Color(0xFFE8F5E9),
            fg: _kGreen,
            stripe: _kGreen
          ),
        'cancelled' => (
            label: 'Cancelled',
            bg: const Color(0xFFFFEBEE),
            fg: _kRed,
            stripe: _kRed
          ),
        _ => (
            label: s.replaceAll('_', ' '),
            bg: _kBrown.withValues(alpha: 0.08),
            fg: _kBrown,
            stripe: _kBrown
          ),
      };

  @override
  Widget build(BuildContext context) {
    final pet = request['pet'] is Map
        ? Map<String, dynamic>.from(request['pet'] as Map)
        : null;
    final staff = request['assignedStaff'] is Map
        ? Map<String, dynamic>.from(request['assignedStaff'] as Map)
        : null;
    final serviceType = request['serviceType']?.toString() ?? 'Visit';
    final preferredDate = request['preferredDate'];
    final timeWindow = request['timeWindow']?.toString() ?? '';
    final requestId = request['_id']?.toString();
    final petId = pet?['_id']?.toString();
    final photoUrl = pet?['photoUrl']?.toString();
    final petName = pet?['name']?.toString() ?? 'Pet';
    final status = request['status']?.toString() ?? 'pending';
    final b = _badge(status);
    final canCancel = !isHistory && status != 'cancelled' && status != 'completed';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isHistory ? 0.03 : 0.06),
            blurRadius: isHistory ? 8 : 18,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Status stripe
              Container(
                width: 4,
                color: isHistory
                    ? const Color(0xFFE0E0E0)
                    : b.stripe,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top row: avatar + details + badge
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _PetAvatar(photoUrl: photoUrl),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(children: [
                                  Expanded(
                                    child: Text(serviceType,
                                        style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 14.5,
                                            color: isHistory
                                                ? _kInk.withValues(alpha: 0.55)
                                                : _kInk)),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 9, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: b.bg,
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(b.label,
                                        style: GoogleFonts.outfit(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: b.fg)),
                                  ),
                                ]),
                                const SizedBox(height: 2),
                                Text(
                                  drName(staff?['name']?.toString()),
                                  style: GoogleFonts.outfit(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                      color: _kBrown.withValues(
                                          alpha: isHistory ? 0.45 : 1.0)),
                                ),
                                const SizedBox(height: 8),
                                _MetaRow(icon: Icons.pets_rounded, text: petName),
                                const SizedBox(height: 4),
                                _MetaRow(
                                    icon: Icons.calendar_today_outlined,
                                    text: dateLine(preferredDate)),
                                if (timeWindow.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  _MetaRow(
                                      icon: Icons.schedule_rounded,
                                      text: timeWindow),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),

                      // Actions
                      if (requestId != null) ...[
                        const SizedBox(height: 12),
                        const Divider(height: 1, color: Color(0xFFF3EEE8)),
                        const SizedBox(height: 10),
                        if (!isHistory)
                          Row(children: [
                            Expanded(
                              child: FilledButton.icon(
                                onPressed: () => onTrack(requestId, serviceType),
                                icon: const Icon(Icons.location_on_rounded,
                                    size: 15, color: Colors.white),
                                label: Text('Track',
                                    style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                        color: Colors.white)),
                                style: FilledButton.styleFrom(
                                  backgroundColor: _kBrown,
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12)),
                                  elevation: 0,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: OutlinedButton(
                                onPressed: () => onReschedule(petId),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: _kBrown,
                                  side: BorderSide(
                                      color: _kBrown.withValues(alpha: 0.30)),
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 10, horizontal: 12),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12)),
                                ),
                                child: Text('Reschedule',
                                    overflow: TextOverflow.ellipsis,
                                    maxLines: 1,
                                    style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.w700, fontSize: 13)),
                              ),
                            ),
                            if (canCancel) ...[
                              const SizedBox(width: 6),
                              IconButton(
                                onPressed: () => onCancel(requestId),
                                tooltip: 'Cancel',
                                icon: Icon(Icons.close_rounded,
                                    size: 17, color: Colors.grey.shade400),
                                style: IconButton.styleFrom(
                                  backgroundColor: Colors.grey.shade100,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10)),
                                  padding: const EdgeInsets.all(8),
                                ),
                              ),
                            ],
                          ])
                        else
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: () => onTrack(requestId, serviceType),
                              icon: Icon(Icons.receipt_long_rounded,
                                  size: 15, color: _kBrown.withValues(alpha: 0.55)),
                              label: Text('View details',
                                  style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                      color: _kInk.withValues(alpha: 0.55))),
                              style: OutlinedButton.styleFrom(
                                side: BorderSide(color: _kInk.withValues(alpha: 0.12)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// â”€â”€ Service discovery card (Book tab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.tile, required this.onTap});
  final _ServiceTile tile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isEmergency = tile.isEmergency;
    final accent = isEmergency ? _kRed : _kBrown;
    final bgColor =
        isEmergency ? const Color(0xFFFFF0F0) : _kBrown.withValues(alpha: 0.04);

    return Material(
      color: bgColor,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: accent.withValues(alpha: 0.14)),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(tile.icon, color: accent, size: 24),
                  ),
                  if (tile.tag != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(tile.tag!,
                          style: GoogleFonts.outfit(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              color: accent,
                              letterSpacing: 0.3)),
                    ),
                ],
              ),
              const Spacer(),
              Text(tile.title,
                  style: GoogleFonts.outfit(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: isEmergency ? _kRed : _kInk)),
              const SizedBox(height: 3),
              Text(tile.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                      fontSize: 11.5,
                      color: _kInk.withValues(alpha: 0.45),
                      height: 1.35)),
            ],
          ),
        ),
      ),
    );
  }
}

// â”€â”€ Pet chip row (Health tab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _PetChipRow extends StatelessWidget {
  const _PetChipRow({
    required this.pets,
    required this.selectedId,
    required this.onSelect,
  });
  final List<Map<String, dynamic>> pets;
  final String? selectedId;
  final void Function(String id) onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Vaccination schedule',
            style: GoogleFonts.outfit(
                fontSize: 20, fontWeight: FontWeight.w800, color: _kInk)),
        const SizedBox(height: 4),
        Text('Age-aware doses and boosters for your pet.',
            style: GoogleFonts.outfit(
                fontSize: 13, color: _kInk.withValues(alpha: 0.45))),
        const SizedBox(height: 14),
        SizedBox(
          height: 38,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: pets.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final p = pets[i];
              final id = (p['_id'] ?? p['id'])?.toString() ?? '';
              final name = (p['name'] ?? 'Pet').toString();
              final sel = id == selectedId;
              return GestureDetector(
                onTap: () => onSelect(id),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: sel ? _kBrown : Colors.white,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                        color: sel ? _kBrown : _kBrown.withValues(alpha: 0.20)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.pets_rounded,
                        size: 13,
                        color: sel ? Colors.white : _kBrown.withValues(alpha: 0.50)),
                    const SizedBox(width: 6),
                    Text(name,
                        style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: sel ? Colors.white : _kInk)),
                  ]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

// â”€â”€ Next-vaccine highlight card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _NextVaccineHighlight extends StatelessWidget {
  const _NextVaccineHighlight({required this.petName, required this.entry});
  final String petName;
  final VaccineEntry entry;

  @override
  Widget build(BuildContext context) {
    final due = entry.dueDate;
    final isOverdue = entry.state == VaccineState.overdue;
    final accent = isOverdue ? _kRed : _kBrown;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [accent.withValues(alpha: 0.07), accent.withValues(alpha: 0.02)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accent.withValues(alpha: 0.16)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(Icons.recommend_rounded, color: accent, size: 26),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              isOverdue ? "$petName's shot is overdue" : 'Next up for $petName',
              style: GoogleFonts.outfit(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: accent.withValues(alpha: 0.70)),
            ),
            const SizedBox(height: 4),
            Text(entry.title,
                style: GoogleFonts.outfit(
                    fontSize: 17, fontWeight: FontWeight.w800, color: accent)),
            const SizedBox(height: 4),
            Text(entry.message,
                style: GoogleFonts.outfit(
                    fontSize: 12.5,
                    height: 1.35,
                    color: _kInk.withValues(alpha: 0.55))),
            if (due != null) ...[
              const SizedBox(height: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'Due ${DateFormat('d MMM yyyy').format(due)}',
                  style: GoogleFonts.outfit(
                      fontSize: 11, fontWeight: FontWeight.w700, color: accent),
                ),
              ),
            ],
          ]),
        ),
      ]),
    );
  }
}

// â”€â”€ Vaccine row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
enum _VaccineTone { upcoming, dueToday, overdue, done }

class _VaccineRow extends StatelessWidget {
  const _VaccineRow({required this.entry, required this.dob, required this.tone});
  final VaccineEntry entry;
  final DateTime? dob;
  final _VaccineTone tone;

  @override
  Widget build(BuildContext context) {
    final due = entry.dueDate;
    final dueAge = (dob != null && due != null)
        ? due.difference(DateTime(dob!.year, dob!.month, dob!.day)).inDays
        : null;

    final (Color bg, Color fg, String badge, Color stripe) = switch (tone) {
      _VaccineTone.overdue => (
          const Color(0xFFFFEBEE),
          _kRed,
          'OVERDUE',
          _kRed,
        ),
      _VaccineTone.dueToday => (
          const Color(0xFFFFF8E1),
          const Color(0xFF8D6E63),
          'DUE TODAY',
          _kAmber,
        ),
      _VaccineTone.done => (
          const Color(0xFFE8F5E9),
          _kGreen,
          'DONE',
          _kGreen,
        ),
      _VaccineTone.upcoming => (
          _kBrown.withValues(alpha: 0.08),
          _kBrown,
          'UPCOMING',
          _kBrown,
        ),
    };

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: stripe),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(
                          child: Text(entry.title,
                              style: GoogleFonts.outfit(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: _kInk)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                              color: bg,
                              borderRadius: BorderRadius.circular(999)),
                          child: Text(badge,
                              style: GoogleFonts.outfit(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: fg)),
                        ),
                      ]),
                      if (entry.protectsAgainst != null &&
                          entry.protectsAgainst!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text('Protects: ${entry.protectsAgainst}',
                            style: GoogleFonts.outfit(
                                fontSize: 11.5,
                                color: _kInk.withValues(alpha: 0.48))),
                      ],
                      const SizedBox(height: 4),
                      Text(entry.message,
                          style: GoogleFonts.outfit(
                              fontSize: 12,
                              height: 1.35,
                              color: _kInk.withValues(alpha: 0.58))),
                      if (due != null || dueAge != null) ...[
                        const SizedBox(height: 6),
                        Row(children: [
                          if (due != null) ...[
                            Icon(Icons.calendar_today_rounded,
                                size: 11,
                                color: _kInk.withValues(alpha: 0.35)),
                            const SizedBox(width: 4),
                            Text(DateFormat('d MMM yyyy').format(due),
                                style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: _kInk.withValues(alpha: 0.42))),
                          ],
                          if (due != null && dueAge != null)
                            Text('  Â·  ',
                                style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    color: _kInk.withValues(alpha: 0.28))),
                          if (dueAge != null)
                            Text('Age $dueAge days',
                                style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: _kInk.withValues(alpha: 0.35))),
                        ]),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// â”€â”€ Vaccination booking CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _VaccineBookingCta extends StatelessWidget {
  const _VaccineBookingCta({required this.petName, required this.onBook});
  final String petName;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _kBrown.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kBrown.withValues(alpha: 0.12)),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Ready to vaccinate $petName?',
                style: GoogleFonts.outfit(
                    fontSize: 14, fontWeight: FontWeight.w700, color: _kInk)),
            const SizedBox(height: 4),
            Text('Our verified vets will come to you.',
                style: GoogleFonts.outfit(
                    fontSize: 12.5, color: _kInk.withValues(alpha: 0.50))),
          ]),
        ),
        const SizedBox(width: 14),
        FilledButton(
          onPressed: onBook,
          style: FilledButton.styleFrom(
            backgroundColor: _kBrown,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            elevation: 0,
          ),
          child: Text('Book',
              style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w700, color: Colors.white, fontSize: 14)),
        ),
      ]),
    );
  }
}

// â”€â”€ Info card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF9F4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: _kBrown.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: _kBrown, size: 18),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w700, fontSize: 13, color: _kInk)),
            const SizedBox(height: 4),
            Text(body,
                style: GoogleFonts.outfit(
                    fontSize: 12.5,
                    height: 1.4,
                    color: _kInk.withValues(alpha: 0.55))),
          ]),
        ),
      ]),
    );
  }
}

// â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.body,
    this.cta,
  });
  final IconData icon;
  final String title;
  final String body;
  final Widget? cta;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: _kBrown.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: _kBrown, size: 34),
          ),
          const SizedBox(height: 20),
          Text(title,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                  fontSize: 18, fontWeight: FontWeight.w700, color: _kInk)),
          const SizedBox(height: 8),
          Text(body,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                  fontSize: 14, color: _kInk.withValues(alpha: 0.50), height: 1.45)),
          if (cta != null) ...[const SizedBox(height: 28), cta!],
        ]),
      ),
    );
  }
}

// â”€â”€ Pet avatar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _PetAvatar extends StatelessWidget {
  const _PetAvatar({this.photoUrl});
  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    final u = photoUrl?.trim();
    if (u != null && u.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: u,
          width: 46,
          height: 46,
          fit: BoxFit.cover,
          placeholder: (_, _) => _placeholder(),
          errorWidget: (_, _, _) => _placeholder(),
        ),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() => Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: _kBrown.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(Icons.pets_rounded, color: _kBrown, size: 22),
      );
}

// â”€â”€ Meta row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Icon(icon, size: 13, color: _kInk.withValues(alpha: 0.35)),
      const SizedBox(width: 5),
      Expanded(
        child: Text(text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.outfit(
                fontSize: 12, color: _kInk.withValues(alpha: 0.55))),
      ),
    ]);
  }
}

// â”€â”€ Vet card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _VetCard extends StatelessWidget {
  const _VetCard({
    required this.name,
    required this.clinic,
    required this.specialization,
  });
  final String name;
  final String clinic;
  final String specialization;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: _kBrown.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.person_rounded, color: _kBrown, size: 24),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name,
                style: GoogleFonts.outfit(
                    fontSize: 14, fontWeight: FontWeight.w700, color: _kInk)),
            if (specialization.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(specialization,
                  style: GoogleFonts.outfit(
                      fontSize: 12.5,
                      color: _kBrown,
                      fontWeight: FontWeight.w600)),
            ],
            if (clinic.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(clinic,
                  style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: _kInk.withValues(alpha: 0.45))),
            ],
          ]),
        ),
      ]),
    );
  }
}

// â”€â”€ Empty vet card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _EmptyVetCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _kBrown.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
      ),
      child: Row(children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: _kBrown.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.person_search_rounded, color: _kBrown, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('No care team yet',
                style: GoogleFonts.outfit(
                    fontSize: 14, fontWeight: FontWeight.w700, color: _kInk)),
            const SizedBox(height: 3),
            Text('Vets from your past visits will appear here after your first booking.',
                style: GoogleFonts.outfit(
                    fontSize: 12.5,
                    color: _kInk.withValues(alpha: 0.48),
                    height: 1.4)),
          ]),
        ),
      ]),
    );
  }
}

// â”€â”€ Emergency banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _EmergencyBanner extends StatelessWidget {
  const _EmergencyBanner({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFFF0F0),
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _kRed.withValues(alpha: 0.20)),
          ),
          child: Row(children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: _kRed.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.emergency_rounded, color: _kRed, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Emergency assistance',
                    style: GoogleFonts.outfit(
                        fontSize: 15, fontWeight: FontWeight.w800, color: _kRed)),
                const SizedBox(height: 3),
                Text('Something urgent? Request immediate help and our team will respond fast.',
                    style: GoogleFonts.outfit(
                        fontSize: 12.5,
                        color: _kRed.withValues(alpha: 0.65),
                        height: 1.4)),
              ]),
            ),
            const SizedBox(width: 10),
            Icon(Icons.arrow_forward_ios_rounded,
                size: 14, color: _kRed.withValues(alpha: 0.50)),
          ]),
        ),
      ),
    );
  }
}
