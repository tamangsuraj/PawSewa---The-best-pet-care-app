import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/constants.dart';
import '../../models/pet.dart';
import '../../services/pet_service.dart';
import '../../widgets/premium_empty_state.dart';
import '../../widgets/premium_shimmer.dart';
import '../book_service_screen.dart';
import 'medical_report_detail_screen.dart';

/// Clinical timeline of vet visits for one pet (`GET /pets/:id/medical-history`).
class MedicalHistoryScreen extends StatefulWidget {
  const MedicalHistoryScreen({super.key, required this.pet});

  final Pet pet;

  @override
  State<MedicalHistoryScreen> createState() => _MedicalHistoryScreenState();
}

class _MedicalHistoryScreenState extends State<MedicalHistoryScreen> {
  final PetService _petService = PetService();
  List<Map<String, dynamic>> _records = [];
  bool _loading = true;
  String? _error;

  static const Color _primary = Color(AppConstants.primaryColor);
  static const Color _bg = Color(0xFFF8F9FA);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final raw = await _petService.getPetMedicalHistory(widget.pet.id);
      if (!mounted) {
        return;
      }
      if (raw == null) {
        setState(() {
          _records = [];
          _loading = false;
          _error = 'Could not load medical history.';
        });
        return;
      }
      final list = raw['records'];
      final out = <Map<String, dynamic>>[];
      if (list is List) {
        for (final e in list) {
          if (e is Map) {
            out.add(Map<String, dynamic>.from(e));
          }
        }
      }
      setState(() {
        _records = out;
        _loading = false;
        _error = null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = 'Something went wrong. Pull to retry.';
      });
    }
  }

  String _str(dynamic v) {
    if (v == null) {
      return '';
    }
    return v.toString();
  }

  DateTime? _parseDate(dynamic v) {
    if (v == null) {
      return null;
    }
    if (v is DateTime) {
      return v;
    }
    return DateTime.tryParse(v.toString());
  }

  List<Widget> _prescribedBlocks(String prescribed) {
    final lines = prescribed.split('\n');
    final widgets = <Widget>[];
    for (final line in lines) {
      final t = line.trim();
      if (t.isEmpty) {
        continue;
      }
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 7),
                child: Container(
                  width: 5,
                  height: 5,
                  decoration: const BoxDecoration(
                    color: Color(0xFF6B7280),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  t,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    height: 1.45,
                    color: const Color(0xFF374151),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    if (widgets.isEmpty) {
      return [
        Text(
          '—',
          style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[600]),
        ),
      ];
    }
    return widgets;
  }

  List<Map<String, dynamic>> _badgeList(Map<String, dynamic> record) {
    final raw = record['badges'];
    final out = <Map<String, dynamic>>[];
    if (raw is List) {
      for (final e in raw) {
        if (e is Map) {
          out.add(Map<String, dynamic>.from(e));
        }
      }
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: _primary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Medical History',
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: _primary,
          ),
        ),
      ),
      body: _loading
          ? PremiumShimmer(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: const [
                  SkeletonBox(height: 18, width: 180, radius: 8),
                  SizedBox(height: 12),
                  SkeletonBox(height: 110, radius: 16),
                  SizedBox(height: 14),
                  SkeletonBox(height: 110, radius: 16),
                  SizedBox(height: 14),
                  SkeletonBox(height: 110, radius: 16),
                ],
              ),
            )
          : _error != null
          ? _buildError()
          : _records.isEmpty
          ? _buildEmpty()
          : RefreshIndicator(
              color: _primary,
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                itemCount: _records.length,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _MedicalRecordCard(
                      record: _records[index],
                      prescribedBlocks: _prescribedBlocks,
                      str: _str,
                      parseDate: _parseDate,
                      badgeList: _badgeList,
                      onViewReport: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute<void>(
                            builder: (_) => MedicalReportDetailScreen(
                              petName: widget.pet.name,
                              record: _records[index],
                            ),
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
    );
  }

  Widget _buildError() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        SizedBox(height: MediaQuery.sizeOf(context).height * 0.12),
        PremiumEmptyState(
          title: 'Couldn’t load medical history',
          body: _error ?? 'Please check your connection and try again.',
          icon: Icons.cloud_off_outlined,
          primaryAction: ElevatedButton.icon(
            onPressed: _load,
            style: ElevatedButton.styleFrom(
              backgroundColor: _primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            icon: const Icon(Icons.refresh_rounded),
            label: Text('Retry', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  Widget _buildEmpty() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        SizedBox(height: MediaQuery.sizeOf(context).height * 0.10),
        PremiumEmptyState(
          title: 'No medical history yet',
          body:
              'When your vet completes visits and adds clinical notes, they’ll appear here for ${widget.pet.name}.',
          icon: Icons.medical_information_outlined,
          primaryAction: ElevatedButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => BookServiceScreen(initialPetId: widget.pet.id),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: Text('Book first checkup', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          ),
          secondaryAction: OutlinedButton.icon(
            onPressed: _load,
            style: OutlinedButton.styleFrom(
              foregroundColor: _primary,
              side: const BorderSide(color: _primary),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            icon: const Icon(Icons.refresh_rounded),
            label: Text('Refresh', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
}

class _MedicalRecordCard extends StatelessWidget {
  const _MedicalRecordCard({
    required this.record,
    required this.prescribedBlocks,
    required this.str,
    required this.parseDate,
    required this.badgeList,
    required this.onViewReport,
  });

  final Map<String, dynamic> record;
  final List<Widget> Function(String) prescribedBlocks;
  final String Function(dynamic) str;
  final DateTime? Function(dynamic) parseDate;
  final List<Map<String, dynamic>> Function(Map<String, dynamic>) badgeList;
  final VoidCallback onViewReport;

  static const Color _primary = Color(AppConstants.primaryColor);
  static const Color _labelGray = Color(0xFF9CA3AF);

  @override
  Widget build(BuildContext context) {
    final title = str(record['title']).isEmpty ? 'Veterinary visit' : str(record['title']);
    final appt = str(record['appointmentNumber']);
    final doctor = str(record['doctorName']);
    final date = parseDate(record['date']);
    final dateText = date != null ? DateFormat('MMM d, yyyy').format(date) : '';

    final diagnosis = str(record['diagnosis']);
    final prescribed = str(record['prescribed']);
    final badges = badgeList(record);

    final vitals = record['vitals'];
    double? weightKg;
    double? temp;
    int? hr;
    if (vitals is Map) {
      final w = vitals['weightKg'];
      if (w is num) weightKg = w.toDouble();
      final t = vitals['temperatureC'];
      if (t is num) temp = t.toDouble();
      final h = vitals['heartRateBpm'];
      if (h is num) hr = h.round();
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: _primary,
                    height: 1.25,
                  ),
                ),
              ),
              if (appt.isNotEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  'APPOINTMENT NO:\n#$appt',
                  textAlign: TextAlign.right,
                  style: GoogleFonts.outfit(
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                    color: _labelGray,
                    height: 1.35,
                    letterSpacing: 0.35,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (dateText.isNotEmpty)
                _MetaChip(icon: Icons.calendar_today_rounded, text: dateText),
              if (doctor.trim().isNotEmpty)
                _MetaChip(icon: Icons.person_rounded, text: doctor),
              if (weightKg != null)
                _MetaChip(icon: Icons.monitor_weight_outlined, text: '${weightKg.toStringAsFixed(1)} kg'),
              if (temp != null)
                _MetaChip(icon: Icons.thermostat_rounded, text: '${temp.toStringAsFixed(1)} °C'),
              if (hr != null) _MetaChip(icon: Icons.favorite_rounded, text: '$hr bpm'),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'DIAGNOSIS',
            style: GoogleFonts.outfit(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.15,
              color: _labelGray,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            diagnosis.isEmpty ? '—' : diagnosis,
            style: GoogleFonts.outfit(
              fontSize: 14,
              height: 1.45,
              color: const Color(0xFF374151),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'PRESCRIBED',
            style: GoogleFonts.outfit(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.15,
              color: _labelGray,
            ),
          ),
          const SizedBox(height: 6),
          ...prescribedBlocks(prescribed),
          if (badges.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final b in badges) _BadgeChip(map: b),
              ],
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: onViewReport,
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: _primary, width: 1.2),
                foregroundColor: _primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                'VIEW FULL REPORT',
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.65,
                  fontSize: 12,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.text});
  final IconData icon;
  final String text;
  static const Color _primary = Color(AppConstants.primaryColor);

  @override
  Widget build(BuildContext context) {
    final bg = const Color(AppConstants.secondaryColor).withValues(alpha: 0.55);
    final ink = const Color(AppConstants.inkColor).withValues(alpha: 0.78);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _primary.withValues(alpha: 0.12)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: _primary.withValues(alpha: 0.85)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeChip extends StatelessWidget {
  const _BadgeChip({required this.map});

  final Map<String, dynamic> map;

  static const Color _followUpBg = Color(0xFFFFF4E5);
  static const Color _followUpInk = Color(0xFFC2410C);
  static const Color _resolvedBg = Color(0xFFE8F5E9);
  static const Color _resolvedInk = Color(0xFF2E7D32);

  @override
  Widget build(BuildContext context) {
    final type = (map['type'] ?? '').toString();
    final label = (map['label'] ?? '').toString();
    final isResolved = type == 'resolved';
    final bg = isResolved ? _resolvedBg : _followUpBg;
    final fg = isResolved ? _resolvedInk : _followUpInk;
    final icon = isResolved ? Icons.check_circle_outline_rounded : Icons.calendar_month_rounded;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: fg,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
