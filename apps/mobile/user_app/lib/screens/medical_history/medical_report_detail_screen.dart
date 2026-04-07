import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/constants.dart';

/// Full clinical report for one service-request / visit row from [MedicalHistoryScreen].
class MedicalReportDetailScreen extends StatelessWidget {
  const MedicalReportDetailScreen({
    super.key,
    required this.petName,
    required this.record,
  });

  final String petName;
  final Map<String, dynamic> record;

  static const Color _primary = Color(AppConstants.primaryColor);
  static const Color _bg = Color(0xFFF8F9FA);
  static const Color _labelGray = Color(0xFF9CA3AF);

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

  Future<void> _openUrl(BuildContext context, String url) async {
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      return;
    }
    final uri = Uri.tryParse(trimmed);
    if (uri == null) {
      return;
    }
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open link')),
        );
      }
    }
  }

  bool _looksLikeImageUrl(String url) {
    final u = url.toLowerCase();
    return u.endsWith('.png') ||
        u.endsWith('.jpg') ||
        u.endsWith('.jpeg') ||
        u.endsWith('.webp') ||
        u.endsWith('.gif');
  }

  @override
  Widget build(BuildContext context) {
    final title = _str(record['title']).isEmpty ? 'Veterinary visit' : _str(record['title']);
    final appt = _str(record['appointmentNumber']);
    final doctor = _str(record['doctorName']);
    final date = _parseDate(record['date']);
    final dateLine = date != null
        ? '${DateFormat('MMM d, yyyy').format(date)} • $doctor'
        : doctor;

    final diagnosis = _str(record['diagnosis']);
    final prescribed = _str(record['prescribed']);
    final internalNotes = _str(record['internalNotes']);

    final vitals = record['vitals'];
    double? weightKg;
    double? temp;
    int? hr;
    if (vitals is Map) {
      final w = vitals['weightKg'];
      if (w is num) {
        weightKg = w.toDouble();
      }
      final t = vitals['temperatureC'];
      if (t is num) {
        temp = t.toDouble();
      }
      final h = vitals['heartRateBpm'];
      if (h is num) {
        hr = h.round();
      }
    }

    final attachments = <Map<String, dynamic>>[];
    final rawAtt = record['attachments'];
    if (rawAtt is List) {
      for (final e in rawAtt) {
        if (e is Map) {
          attachments.add(Map<String, dynamic>.from(e));
        }
      }
    }

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
          'Full report',
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: _primary,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              petName,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: _primary,
                      height: 1.2,
                    ),
                  ),
                ),
                if (appt.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Text(
                    'APPOINTMENT NO:\n#$appt',
                    textAlign: TextAlign.right,
                    style: GoogleFonts.outfit(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: _labelGray,
                      height: 1.35,
                      letterSpacing: 0.4,
                    ),
                  ),
                ],
              ],
            ),
            if (dateLine.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                dateLine,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  color: Colors.grey[600],
                ),
              ),
            ],
            const SizedBox(height: 24),
            _sectionLabel('DIAGNOSIS'),
            const SizedBox(height: 8),
            Text(
              diagnosis.isEmpty ? '—' : diagnosis,
              style: GoogleFonts.outfit(
                fontSize: 15,
                height: 1.45,
                color: const Color(0xFF374151),
              ),
            ),
            const SizedBox(height: 22),
            _sectionLabel('PRESCRIBED'),
            const SizedBox(height: 8),
            Text(
              prescribed.isEmpty ? '—' : prescribed,
              style: GoogleFonts.outfit(
                fontSize: 15,
                height: 1.45,
                color: const Color(0xFF374151),
              ),
            ),
            const SizedBox(height: 24),
            _sectionLabel('VITALS'),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _vitalCell(
                      'Weight',
                      weightKg != null ? '${weightKg.toStringAsFixed(1)} kg' : '—',
                    ),
                  ),
                  Expanded(
                    child: _vitalCell(
                      'Temperature',
                      temp != null ? '${temp.toStringAsFixed(1)} °C' : '—',
                    ),
                  ),
                  Expanded(
                    child: _vitalCell(
                      'Heart rate',
                      hr != null ? '$hr bpm' : '—',
                    ),
                  ),
                ],
              ),
            ),
            if (attachments.isNotEmpty) ...[
              const SizedBox(height: 24),
              _sectionLabel('ATTACHMENTS'),
              const SizedBox(height: 12),
              SizedBox(
                height: 112,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: attachments.length,
                  separatorBuilder: (context, index) => const SizedBox(width: 12),
                  itemBuilder: (context, index) {
                    final a = attachments[index];
                    final url = _str(a['url']);
                    final label = _str(a['label']);
                    if (url.isEmpty) {
                      return const SizedBox(width: 0);
                    }
                    return _AttachmentTile(
                      url: url,
                      label: label,
                      looksLikeImageUrl: _looksLikeImageUrl,
                      onOpen: () => _openUrl(context, url),
                    );
                  },
                ),
              ),
            ],
            if (internalNotes.isNotEmpty) ...[
              const SizedBox(height: 24),
              _sectionLabel('INTERNAL NOTES'),
              const SizedBox(height: 8),
              Text(
                internalNotes,
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  height: 1.45,
                  color: const Color(0xFF374151),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.outfit(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.2,
        color: _labelGray,
      ),
    );
  }

  Widget _vitalCell(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.outfit(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: _labelGray,
            letterSpacing: 0.6,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF1F2937),
          ),
        ),
      ],
    );
  }
}

class _AttachmentTile extends StatelessWidget {
  const _AttachmentTile({
    required this.url,
    required this.label,
    required this.looksLikeImageUrl,
    required this.onOpen,
  });

  final String url;
  final String label;
  final bool Function(String) looksLikeImageUrl;
  final VoidCallback onOpen;

  static const Color _primary = Color(AppConstants.primaryColor);

  String _ext(String u) {
    final lowered = u.toLowerCase();
    final q = lowered.indexOf('?');
    final cleaned = q >= 0 ? lowered.substring(0, q) : lowered;
    final dot = cleaned.lastIndexOf('.');
    if (dot < 0 || dot == cleaned.length - 1) return '';
    final ext = cleaned.substring(dot + 1);
    if (ext.length > 6) return '';
    return ext;
  }

  @override
  Widget build(BuildContext context) {
    final isImage = looksLikeImageUrl(url);
    final ext = _ext(url);
    final badgeText = isImage ? 'IMAGE' : (ext.isNotEmpty ? ext.toUpperCase() : 'FILE');

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: SizedBox(
          width: 168,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: isImage
                          ? CachedNetworkImage(
                              imageUrl: url,
                              fit: BoxFit.cover,
                              placeholder: (context, _) => const Center(
                                child: SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: PawSewaLoader(width: 32, center: false),
                                ),
                              ),
                              errorWidget: (context, url, _) => Container(
                                color: const Color(0xFFF3F4F6),
                                child: Icon(Icons.insert_drive_file_rounded, color: Colors.grey[500], size: 36),
                              ),
                            )
                          : Container(
                              color: const Color(0xFFF3F4F6),
                              child: Icon(Icons.description_outlined, color: Colors.grey[700], size: 34),
                            ),
                    ),
                    Positioned(
                      left: 10,
                      top: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.92),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: _primary.withValues(alpha: 0.14)),
                        ),
                        child: Text(
                          badgeText,
                          style: GoogleFonts.outfit(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.25,
                            color: _primary,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.92),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _primary.withValues(alpha: 0.14)),
                        ),
                        child: Icon(Icons.open_in_new_rounded, color: _primary.withValues(alpha: 0.9), size: 18),
                      ),
                    ),
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Colors.black.withValues(alpha: 0.10),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Text(
                  label.trim().isEmpty ? 'Open attachment' : label.trim(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111827),
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
