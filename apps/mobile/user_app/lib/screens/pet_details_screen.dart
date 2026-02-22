import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';

import '../core/constants.dart';
import '../models/pet.dart';
import '../services/pet_service.dart';
import 'book_service_screen.dart';

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

  static const _primary = Color(AppConstants.primaryColor);
  static const _bg = Color(0xFFF8F9FA);
  static const _verifiedTeal = Color(0xFF00897B);

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _primary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _summary != null ? "${_summary!['name'] ?? widget.pet.name}'s Profile" : '${widget.pet.name}\'s Profile',
          style: GoogleFonts.poppins(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: _primary,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert, color: _primary),
            onPressed: () {},
          ),
        ],
      ),
      body: _loading ? _buildSkeleton() : _error != null ? _buildError() : _buildContent(),
      bottomNavigationBar: _summary != null ? _buildStickyButton() : null,
    );
  }

  Widget _buildSkeleton() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        children: [
          const SizedBox(height: 24),
          Center(
            child: Container(
              width: 120,
              height: 120,
              decoration: const BoxDecoration(
                color: Color(0xFFE0E0E0),
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Container(height: 24, width: 120, color: const Color(0xFFE0E0E0)),
          const SizedBox(height: 8),
          Container(height: 16, width: 180, color: const Color(0xFFE0E0E0)),
          const SizedBox(height: 24),
          Row(
            children: List.generate(
              3,
              (i) => Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < 2 ? 10 : 0),
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.grey[600]),
            const SizedBox(height: 16),
            Text(
              _error ?? 'Something went wrong',
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(color: Colors.grey[700]),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _loadSummary,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

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
    final weightStr = weight != null ? '${weight is num ? weight.toInt() : weight}kg' : '—';
    final dob = s['dob'];
    String dobStr = '—';
    if (dob != null) {
      try {
        final d = dob is DateTime ? dob : DateTime.tryParse(dob.toString());
        if (d != null) dobStr = DateFormat("d MMM ''yy").format(d);
      } catch (_) {}
    }
    final vaccinationStatus = (s['vaccinationStatus'] ?? '')?.toString();
    final visitDaysAgo = s['visit_days_ago'] is int ? s['visit_days_ago'] as int? : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
      child: Column(
        children: [
          const SizedBox(height: 16),
          // Avatar + verified badge
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xFF4A5D4A),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: CircleAvatar(
                    radius: 52,
                    backgroundColor: const Color(0xFFEEEEEE),
                    backgroundImage: photoUrl != null && photoUrl.isNotEmpty
                        ? null
                        : null,
                    child: photoUrl != null && photoUrl.isNotEmpty
                        ? ClipOval(
                            child: CachedNetworkImage(
                              imageUrl: photoUrl,
                              fit: BoxFit.cover,
                              width: 104,
                              height: 104,
                              placeholder: (_, _) => const Icon(Icons.pets, size: 48, color: _primary),
                              errorWidget: (_, _, _) => const Icon(Icons.pets, size: 48, color: _primary),
                            ),
                          )
                        : const Icon(Icons.pets, size: 48, color: _primary),
                  ),
                ),
              ),
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                    color: _verifiedTeal,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black26,
                        blurRadius: 4,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.check, color: Colors.white, size: 16),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            name,
            style: GoogleFonts.poppins(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: _primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            [if (breed.isNotEmpty) breed, if (ageDisplay != null && ageDisplay.isNotEmpty) ageDisplay]
                .join(' • '),
            style: GoogleFonts.poppins(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
          if (pawId != null && pawId.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Pet ID: #$pawId',
              style: GoogleFonts.poppins(
                fontSize: 12,
                color: Colors.grey[500],
              ),
            ),
          ],
          const SizedBox(height: 24),
          // Stats row
          Row(
            children: [
              _StatCard(
                icon: Icons.male,
                label: 'GENDER',
                value: gender,
              ),
              const SizedBox(width: 10),
              _StatCard(
                icon: Icons.monitor_weight_outlined,
                label: 'WEIGHT',
                value: weightStr,
              ),
              const SizedBox(width: 10),
              _StatCard(
                icon: Icons.cake_outlined,
                label: 'DOB',
                value: dobStr,
              ),
            ],
          ),
          const SizedBox(height: 28),
          // Health Dashboard
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Health Dashboard',
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF2D2D2D),
                ),
              ),
              GestureDetector(
                onTap: () {},
                child: Text(
                  'See All',
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: _primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 100,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _VaccinationCard(status: vaccinationStatus ?? ''),
                const SizedBox(width: 12),
                _LastVetVisitCard(visitDaysAgo: visitDaysAgo),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Upcoming Tasks',
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF2D2D2D),
                ),
              ),
              GestureDetector(
                onTap: () {},
                child: Text(
                  'See All',
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: _primary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStickyButton() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => BookServiceScreen(initialPetId: widget.pet.id),
                ),
              );
            },
            icon: const Icon(Icons.calendar_today, color: Colors.white, size: 20),
            label: Text(
              'Book Vet Visit',
              style: GoogleFonts.poppins(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: _primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 0,
            ),
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  static const _primary = Color(AppConstants.primaryColor);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: _primary),
            const SizedBox(height: 6),
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _primary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _VaccinationCard extends StatelessWidget {
  final String status;

  const _VaccinationCard({required this.status});

  static const _vaccinationCyan = Color(0xFFE0F2F1);
  static const _vaccinationTeal = Color(0xFF00695C);
  static const _overdueRed = Color(0xFFFFEBEE);
  static const _overdueRedText = Color(0xFFC62828);

  @override
  Widget build(BuildContext context) {
    final isOverdue = status.toLowerCase().contains('overdue');
    final bg = isOverdue ? _overdueRed : _vaccinationCyan;
    final fg = isOverdue ? _overdueRedText : _vaccinationTeal;
    final statusText = isOverdue ? 'Action Needed' : (status.isNotEmpty ? status : 'Up to date');
    final showCheck = !isOverdue;

    return Container(
      width: 160,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(
            Icons.vaccines,
            size: 24,
            color: fg,
          ),
          Text(
            'Vaccination',
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: Colors.black87,
            ),
          ),
          Row(
            children: [
              if (showCheck) Icon(Icons.check_circle, size: 16, color: fg),
              if (showCheck) const SizedBox(width: 4),
              Expanded(
                child: Text(
                  statusText,
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: fg,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LastVetVisitCard extends StatelessWidget {
  final int? visitDaysAgo;

  const _LastVetVisitCard({this.visitDaysAgo});

  static const _primary = Color(AppConstants.primaryColor);
  static const _lastVisitBeige = Color(0xFFFFF3E0);

  @override
  Widget build(BuildContext context) {
    String text = '—';
    if (visitDaysAgo != null) {
      if (visitDaysAgo! >= 14) {
        final weeks = visitDaysAgo! ~/ 7;
        text = '$weeks ${weeks == 1 ? 'week' : 'weeks'} ago';
      } else {
        text = '${visitDaysAgo!} ${visitDaysAgo == 1 ? 'day' : 'days'} ago';
      }
    }

    return Container(
      width: 160,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _lastVisitBeige,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(
            Icons.medical_services_outlined,
            size: 24,
            color: _primary,
          ),
          Text(
            'Last Vet Visit',
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: Colors.black87,
            ),
          ),
          Text(
            text,
            style: GoogleFonts.poppins(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _primary,
            ),
          ),
        ],
      ),
    );
  }
}
