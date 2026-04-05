import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/constants.dart';
import '../../models/pet.dart';
import '../../services/pet_service.dart';
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
          ? const Center(child: CircularProgressIndicator(color: _primary))
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
      children: [
        SizedBox(height: MediaQuery.sizeOf(context).height * 0.25),
        Icon(Icons.cloud_off_outlined, size: 56, color: Colors.grey[400]),
        const SizedBox(height: 12),
        Text(
          _error ?? 'Error',
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(color: Colors.grey[700]),
        ),
        const SizedBox(height: 16),
        Center(
          child: TextButton(
            onPressed: _load,
            child: Text('Retry', style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _primary)),
          ),
        ),
      ],
    );
  }

  Widget _buildEmpty() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 32),
      children: [
        SizedBox(height: MediaQuery.sizeOf(context).height * 0.12),
        Icon(
          Icons.medical_information_outlined,
          size: 88,
          color: Colors.grey[400],
        ),
        const SizedBox(height: 20),
        Text(
          'No medical history yet',
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: _primary,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'When your vet completes visits and adds clinical notes, they will appear here for ${widget.pet.name}.',
          textAlign: TextAlign.center,
          style: GoogleFonts.outfit(
            fontSize: 14,
            height: 1.45,
            color: Colors.grey[600],
          ),
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
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
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 0,
            ),
            child: Text(
              'Book first checkup',
              style: GoogleFonts.outfit(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
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
    final subtitle = date != null
        ? '${DateFormat('MMM d, yyyy').format(date)} • $doctor'
        : doctor;

    final diagnosis = str(record['diagnosis']);
    final prescribed = str(record['prescribed']);
    final badges = badgeList(record);

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
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: GoogleFonts.outfit(
                fontSize: 13,
                color: Colors.grey[600],
              ),
            ),
          ],
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
