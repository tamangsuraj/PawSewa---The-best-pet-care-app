import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../core/constants.dart';
import '../core/dog_vaccination_schedule.dart';
import '../models/pet.dart';
import '../services/pet_service.dart';
import 'book_service_screen.dart';
import 'medical_history/medical_history_screen.dart';
import 'pets/edit_pet_screen.dart';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const Color _kPrimary = Color(AppConstants.primaryColor);
const Color _kInk = Color(AppConstants.inkColor);
const Color _kTeal = Color(AppConstants.accentColor);
const Color _kBg = Colors.white;
const Color _kCard = Colors.white;

class PetDetailsScreen extends StatefulWidget {
  final Pet pet;
  const PetDetailsScreen({super.key, required this.pet});

  @override
  State<PetDetailsScreen> createState() => _PetDetailsScreenState();
}

class _PetDetailsScreenState extends State<PetDetailsScreen> {
  final PetService _petService = PetService();
  Map<String, dynamic>? _summary;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _petService.getPetHealthSummary(widget.pet.id);
      if (mounted) {
        setState(() {
          _summary = data;
          _loading = false;
          if (data == null) _error = 'Could not load pet details';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  // ─── Actions ────────────────────────────────────────────────────────────
  void _openMedicalHistory() {
    Navigator.push(context,
        MaterialPageRoute<void>(builder: (_) => MedicalHistoryScreen(pet: widget.pet)));
  }

  void _openBooking() {
    Navigator.push(context,
        MaterialPageRoute(builder: (_) => BookServiceScreen(initialPetId: widget.pet.id)));
  }

  Future<void> _openEdit() async {
    final updated = await Navigator.push<bool>(
        context, MaterialPageRoute(builder: (_) => EditPetScreen(pet: widget.pet)));
    if (updated == true && mounted) _loadSummary();
  }

  Future<void> _confirmDelete() async {
    final navigator = Navigator.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Remove ${widget.pet.name}?',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        content: Text('This cannot be undone.',
            style: GoogleFonts.outfit(fontSize: 14)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Keep', style: GoogleFonts.outfit()),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text('Delete', style: GoogleFonts.outfit(color: Colors.white)),
          ),
        ],
      ),
    );
    if (ok == true) {
      await _petService.deletePet(widget.pet.id);
      if (mounted) navigator.pop(true);
    }
  }

  void _showOverflowMenu() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: _kCard,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 8),
              ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                leading: Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(color: _kPrimary.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.edit_outlined, color: _kPrimary, size: 20)),
                title: Text('Edit pet profile', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                onTap: () { Navigator.pop(ctx); _openEdit(); },
              ),
              ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                leading: Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(12)),
                    child: Icon(Icons.delete_outline, color: Colors.red.shade700, size: 20)),
                title: Text('Remove pet', style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w600, color: Colors.red.shade700)),
                onTap: () { Navigator.pop(ctx); _confirmDelete(); },
              ),
              ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                leading: Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(color: _kPrimary.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
                    child: const Icon(Icons.refresh_rounded, color: _kPrimary, size: 20)),
                title: Text('Refresh data', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                onTap: () { Navigator.pop(ctx); _loadSummary(); },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Build ───────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    if (_loading) {
      // Loading: CustomScrollView already contains a SliverAppBar.
      return Scaffold(backgroundColor: _kBg, body: _buildSkeleton());
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: _kBg,
        appBar: AppBar(
          backgroundColor: _kPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(widget.pet.name,
              style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: Colors.white)),
        ),
        body: _buildErrorBody(),
      );
    }
    // Content: CustomScrollView with expandable SliverAppBar inside.
    return Scaffold(backgroundColor: _kBg, body: _buildContent());
  }

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  Widget _buildSkeleton() {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 220,
          backgroundColor: _kPrimary,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          flexibleSpace: FlexibleSpaceBar(
            background: Container(color: _kPrimary),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(children: [
              _SkeletonBox(height: 20, width: 140),
              const SizedBox(height: 12),
              _SkeletonBox(height: 14, width: 200),
              const SizedBox(height: 24),
              Row(children: [
                for (int i = 0; i < 3; i++) ...[
                  Expanded(child: _SkeletonBox(height: 72)),
                  if (i < 2) const SizedBox(width: 10),
                ],
              ]),
              const SizedBox(height: 20),
              _SkeletonBox(height: 100),
              const SizedBox(height: 12),
              _SkeletonBox(height: 80),
            ]),
          ),
        ),
      ],
    );
  }

  // ─── Error body (no Scaffold — caller wraps it) ───────────────────────────
  Widget _buildErrorBody() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: _kPrimary.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.error_outline_rounded, size: 32, color: _kPrimary),
            ),
            const SizedBox(height: 18),
            Text(_error ?? 'Something went wrong',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(fontSize: 15, color: _kInk, height: 1.4)),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _loadSummary,
              style: FilledButton.styleFrom(
                backgroundColor: _kPrimary,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Try again',
                  style: GoogleFonts.outfit(
                      color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Main content ─────────────────────────────────────────────────────────
  Widget _buildContent() {
    final s = _summary!;
    final name = (s['name'] ?? widget.pet.name)?.toString() ?? '';
    final breed = (s['breed'] ?? widget.pet.breed)?.toString() ?? '';
    final photoUrl = s['photoUrl']?.toString();
    final pawId = (s['pawId'] ?? widget.pet.pawId)?.toString();
    final ageObj = s['age'];
    final ageDisplay = ageObj is Map
        ? (ageObj['display'] ?? '${ageObj['years'] ?? 0} years')?.toString()
        : (s['age'] != null ? '${s['age']} years' : null);
    final gender = (s['gender'] ?? widget.pet.gender)?.toString() ?? '—';
    final weight = s['weight'];
    final weightStr = weight != null
        ? '${weight is num ? weight.toInt() : weight}kg'
        : '—';
    final species = (s['species'] ?? widget.pet.species)?.toString() ?? '';
    final dob = s['dob'] ?? widget.pet.dob;
    String dobStr = '—';
    if (dob != null) {
      try {
        final d = dob is DateTime ? dob : DateTime.tryParse(dob.toString());
        if (d != null) dobStr = DateFormat("d MMM ''yy").format(d);
      } catch (_) {}
    }
    final vaccinationStatus = (s['vaccinationStatus'] ?? '').toString();
    final visitDaysAgo = s['visit_days_ago'] is int ? s['visit_days_ago'] as int? : null;

    return CustomScrollView(
      slivers: [
        // ── Hero sliver app bar ───────────────────────────────────────────
        SliverAppBar(
          expandedHeight: 240,
          pinned: true,
          backgroundColor: _kPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.edit_rounded, color: Colors.white, size: 20),
              tooltip: 'Edit pet',
              onPressed: _openEdit,
            ),
            IconButton(
              icon: const Icon(Icons.more_vert, color: Colors.white),
              onPressed: _showOverflowMenu,
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            titlePadding: const EdgeInsets.fromLTRB(16, 0, 16, 56),
            title: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(name,
                    style: GoogleFonts.outfit(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Colors.white)),
                if (breed.isNotEmpty)
                  Text(breed,
                      style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withValues(alpha: 0.75))),
              ],
            ),
            background: Stack(
              fit: StackFit.expand,
              children: [
                // Photo or gradient
                if (photoUrl != null && photoUrl.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: photoUrl,
                    fit: BoxFit.cover,
                    placeholder: (ctx, url) => Container(color: _kPrimary),
                    errorWidget: (ctx, url, err) => _HeroPlaceholder(name: name),
                  )
                else
                  _HeroPlaceholder(name: name),
                // Gradient overlay for legibility
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.transparent,
                        _kPrimary.withValues(alpha: 0.85),
                      ],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      stops: const [0.4, 1.0],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // ── PAW ID pill ───────────────────────────────────────────────────
        if (pawId != null && pawId.isNotEmpty)
          SliverToBoxAdapter(
            child: Container(
              color: _kBg,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: _kPrimary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.fingerprint_rounded, size: 14, color: _kPrimary.withValues(alpha: 0.6)),
                        const SizedBox(width: 5),
                        Text('Paw ID #$pawId',
                            style: GoogleFonts.outfit(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _kPrimary)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _kTeal.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified_rounded, size: 13, color: _kTeal),
                        const SizedBox(width: 4),
                        Text('Verified', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _kTeal)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

        // ── Stat pills row ────────────────────────────────────────────────
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                _StatPill(icon: Icons.wc_rounded, label: gender),
                const SizedBox(width: 8),
                _StatPill(
                    icon: Icons.monitor_weight_outlined,
                    label: weightStr),
                const SizedBox(width: 8),
                _StatPill(
                    icon: Icons.cake_outlined,
                    label: dobStr),
                if (ageDisplay != null && ageDisplay.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  _StatPill(
                      icon: Icons.timer_outlined,
                      label: ageDisplay),
                ],
              ],
            ),
          ),
        ),

        // ── Health status cards ────────────────────────────────────────────
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SectionTitle(
                  title: 'Health Overview',
                  action: 'Full history',
                  onAction: _openMedicalHistory,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                        child: _VaccineStatusCard(status: vaccinationStatus)),
                    const SizedBox(width: 10),
                    Expanded(
                        child: _LastVisitCard(visitDaysAgo: visitDaysAgo)),
                  ],
                ),
              ],
            ),
          ),
        ),

        // ── Medical history link ───────────────────────────────────────────
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: _MedicalHistoryTile(onTap: _openMedicalHistory),
          ),
        ),

        // ── Vaccination / care timeline ────────────────────────────────────
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
            child: _SectionTitle(
              title: 'Care Timeline',
              action: null,
              onAction: null,
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: _CareTimeline(
              reminders: s['reminders'],
              petName: name,
              petSpecies: species,
              petDob: dob,
            ),
          ),
        ),

        // ── Book a visit CTA ──────────────────────────────────────────────
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 48),
            child: _BookVisitCta(
              petName: name,
              onBook: _openBooking,
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-widgets
// ─────────────────────────────────────────────────────────────────────────────

class _HeroPlaceholder extends StatelessWidget {
  const _HeroPlaceholder({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _kPrimary,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'P',
          style: GoogleFonts.outfit(
              fontSize: 80,
              fontWeight: FontWeight.w800,
              color: Colors.white.withValues(alpha: 0.25)),
        ),
      ),
    );
  }
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
class _StatPill extends StatelessWidget {
  const _StatPill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: _kPrimary.withValues(alpha: 0.60)),
          const SizedBox(width: 5),
          Text(label,
              style: GoogleFonts.outfit(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: _kInk)),
        ],
      ),
    );
  }
}

// ── Section title ─────────────────────────────────────────────────────────────
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(title,
              style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: _kInk)),
        ),
        if (action != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            child: Text(action!,
                style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _kPrimary)),
          ),
      ],
    );
  }
}

// ── Vaccination status card ───────────────────────────────────────────────────
class _VaccineStatusCard extends StatelessWidget {
  const _VaccineStatusCard({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final isOverdue = status.toLowerCase().contains('overdue');
    final bg = isOverdue ? const Color(0xFFFFF0F0) : const Color(0xFFE8F5E9);
    final fg = isOverdue ? const Color(0xFFC62828) : const Color(0xFF2E7D32);
    final icon = isOverdue ? Icons.warning_amber_rounded : Icons.check_circle_rounded;
    final label = isOverdue
        ? 'Action needed'
        : (status.isNotEmpty ? status : 'Up to date');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: fg, size: 22),
          const SizedBox(height: 10),
          Text('Vaccination',
              style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: _kInk.withValues(alpha: 0.50))),
          const SizedBox(height: 2),
          Text(label,
              style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: fg)),
        ],
      ),
    );
  }
}

// ── Last vet visit card ───────────────────────────────────────────────────────
class _LastVisitCard extends StatelessWidget {
  const _LastVisitCard({this.visitDaysAgo});
  final int? visitDaysAgo;

  @override
  Widget build(BuildContext context) {
    String text = 'No visits yet';
    if (visitDaysAgo != null) {
      if (visitDaysAgo! >= 14) {
        final weeks = visitDaysAgo! ~/ 7;
        text = '$weeks ${weeks == 1 ? 'week' : 'weeks'} ago';
      } else {
        text = '${visitDaysAgo!} ${visitDaysAgo == 1 ? 'day' : 'days'} ago';
      }
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3E0),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.medical_services_outlined, color: _kPrimary, size: 22),
          const SizedBox(height: 10),
          Text('Last visit',
              style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: _kInk.withValues(alpha: 0.50))),
          const SizedBox(height: 2),
          Text(text,
              style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: _kPrimary)),
        ],
      ),
    );
  }
}

// ── Medical history link tile ─────────────────────────────────────────────────
class _MedicalHistoryTile extends StatelessWidget {
  const _MedicalHistoryTile({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _kCard,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _kPrimary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.history_edu_rounded, color: _kPrimary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Medical history',
                        style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: _kInk)),
                    const SizedBox(height: 2),
                    Text('Visits, diagnoses & prescriptions',
                        style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: _kInk.withValues(alpha: 0.45))),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded,
                  color: _kInk.withValues(alpha: 0.25)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Care timeline ─────────────────────────────────────────────────────────────
class _CareTimeline extends StatelessWidget {
  const _CareTimeline({
    required this.reminders,
    required this.petName,
    required this.petSpecies,
    required this.petDob,
  });
  final dynamic reminders;
  final String petName;
  final String petSpecies;
  final dynamic petDob;

  @override
  Widget build(BuildContext context) {
    // Build the parsed list
    final rawList = reminders is List ? reminders as List : const [];
    final parsed = <Map<String, dynamic>>[];
    for (final r in rawList) {
      if (r is Map) parsed.add(Map<String, dynamic>.from(r));
    }

    // For dogs: replace with DOB-gated schedule entries
    if (petSpecies.toLowerCase() == 'dog') {
      final dob = DogVaccinationSchedule.parseDob(petDob);
      final entries = DogVaccinationSchedule.build(
        petName: petName,
        today: DateTime.now(),
        dob: dob,
        reminders: parsed,
      );
      parsed
        ..clear()
        ..addAll(entries.map((e) {
          String status;
          switch (e.state) {
            case VaccineState.completed:
              status = 'completed';
              break;
            case VaccineState.overdue:
              status = 'overdue';
              break;
            case VaccineState.dueToday:
              status = 'due_today';
              break;
            case VaccineState.upcoming:
              status = 'upcoming';
              break;
            case VaccineState.historyIncomplete:
              status = 'info';
              break;
          }
          return <String, dynamic>{
            'category': 'vaccination',
            'title': e.title,
            'dueDate': e.dueDate?.toIso8601String(),
            'status': status,
            'message': e.message,
            'protectsAgainst': e.protectsAgainst,
          };
        }));
    }

    if (parsed.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _kCard,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(Icons.event_note_rounded,
                color: _kInk.withValues(alpha: 0.30), size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Text('No care reminders yet for $petName.',
                  style: GoogleFonts.outfit(
                      fontSize: 14,
                      color: _kInk.withValues(alpha: 0.50),
                      height: 1.4)),
            ),
          ],
        ),
      );
    }

    DateTime? parseDate(dynamic v) {
      if (v == null) return null;
      if (v is DateTime) return v;
      return DateTime.tryParse(v.toString());
    }

    parsed.sort((a, b) {
      final ad = parseDate(a['dueDate']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bd = parseDate(b['dueDate']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return ad.compareTo(bd);
    });

    // Partition
    final urgent = parsed.where((r) {
      final s = (r['status'] ?? '').toString();
      return s == 'overdue' || s == 'due_today';
    }).toList();

    final upcomingList = parsed.where((r) {
      final s = (r['status'] ?? '').toString();
      return s == 'upcoming' || s == 'info';
    }).take(6).toList();

    final completedList = parsed
        .where((r) => (r['status'] ?? '').toString() == 'completed')
        .take(3)
        .toList()
        .reversed
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (urgent.isNotEmpty) ...[
          ...urgent.map((r) => _TimelineRow(
                reminder: r,
                parseDate: parseDate,
                showConnector: r != urgent.last || upcomingList.isNotEmpty || completedList.isNotEmpty,
              )),
        ],
        if (upcomingList.isNotEmpty) ...[
          ...upcomingList.map((r) => _TimelineRow(
                reminder: r,
                parseDate: parseDate,
                showConnector: r != upcomingList.last || completedList.isNotEmpty,
              )),
        ],
        if (upcomingList.isEmpty && urgent.isEmpty)
          _EmptyTimelineRow(),
        if (completedList.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 16, 0, 8),
            child: Text('Recently Completed',
                style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: _kInk.withValues(alpha: 0.45))),
          ),
          ...completedList.map((r) => _TimelineRow(
                reminder: r,
                parseDate: parseDate,
                showConnector: r != completedList.last,
                isDone: true,
              )),
        ],
      ],
    );
  }
}

class _EmptyTimelineRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: _kPrimary.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded, size: 14, color: _kPrimary),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _kCard,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text('All vaccinations up to date!',
                  style: GoogleFonts.outfit(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF2E7D32))),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.reminder,
    required this.parseDate,
    required this.showConnector,
    this.isDone = false,
  });
  final Map<String, dynamic> reminder;
  final DateTime? Function(dynamic) parseDate;
  final bool showConnector;
  final bool isDone;

  @override
  Widget build(BuildContext context) {
    final category = (reminder['category'] ?? '').toString();
    final title = (reminder['title'] ?? category).toString();
    final status = (reminder['status'] ?? 'upcoming').toString();
    final due = parseDate(reminder['dueDate']);
    final msg = (reminder['message'] ?? '').toString();

    Color dotColor;
    Color dotBg;
    IconData dotIcon;

    if (isDone || status == 'completed') {
      dotColor = const Color(0xFF2E7D32);
      dotBg = const Color(0xFFE8F5E9);
      dotIcon = Icons.check_rounded;
    } else if (status == 'overdue') {
      dotColor = const Color(0xFFC62828);
      dotBg = const Color(0xFFFFEBEE);
      dotIcon = Icons.priority_high_rounded;
    } else if (status == 'due_today') {
      dotColor = const Color(0xFFF9A825);
      dotBg = const Color(0xFFFFF8E1);
      dotIcon = Icons.schedule_rounded;
    } else {
      dotColor = _kPrimary;
      dotBg = _kPrimary.withValues(alpha: 0.08);
      dotIcon = _iconForCategory(category);
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Timeline spine
            Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: dotBg,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(dotIcon, size: 14, color: dotColor),
                ),
                if (showConnector)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 3),
                      decoration: BoxDecoration(
                        color: _kInk.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(1),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            // Card content
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _kCard,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: dotColor.withValues(alpha: 0.10)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(title,
                              style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: _kInk)),
                        ),
                        if (due != null)
                          Text(
                            DateFormat('d MMM').format(due),
                            style: GoogleFonts.outfit(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: dotColor),
                          ),
                      ],
                    ),
                    if (msg.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(msg,
                          style: GoogleFonts.outfit(
                              fontSize: 12,
                              height: 1.35,
                              color: _kInk.withValues(alpha: 0.52)),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconForCategory(String c) {
    switch (c) {
      case 'vaccination':
        return Icons.vaccines_outlined;
      case 'deworming':
        return Icons.medication_outlined;
      case 'flea_tick':
        return Icons.bug_report_outlined;
      case 'checkup':
        return Icons.medical_services_outlined;
      default:
        return Icons.event_note_outlined;
    }
  }
}

// ── Book a visit CTA ──────────────────────────────────────────────────────────
class _BookVisitCta extends StatelessWidget {
  const _BookVisitCta({required this.petName, required this.onBook});
  final String petName;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_kPrimary, _kPrimary.withValues(alpha: 0.85)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: _kPrimary.withValues(alpha: 0.28),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Book a vet visit',
                    style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Colors.white)),
                const SizedBox(height: 4),
                Text('Verified vets at $petName\'s doorstep.',
                    style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: Colors.white.withValues(alpha: 0.75))),
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: onBook,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text('Book',
                  style: GoogleFonts.outfit(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: _kPrimary)),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────
class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({required this.height, this.width});
  final double height;
  final double? width;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width ?? double.infinity,
      height: height,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(10),
      ),
    );
  }
}
