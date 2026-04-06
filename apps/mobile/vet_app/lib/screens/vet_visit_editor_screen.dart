import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/partner_scaffold.dart';
import 'service_task_detail_screen.dart';

class VetVisitEditorScreen extends StatefulWidget {
  const VetVisitEditorScreen({super.key, required this.task});

  final Map<String, dynamic> task;

  @override
  State<VetVisitEditorScreen> createState() => _VetVisitEditorScreenState();
}

class _VetVisitEditorScreenState extends State<VetVisitEditorScreen> {
  final _api = ApiClient();
  final _picker = ImagePicker();

  late final TextEditingController _diagnosisCtrl;
  late final TextEditingController _prescribedCtrl;
  late final TextEditingController _notesCtrl;
  late final TextEditingController _weightCtrl;
  late final TextEditingController _tempCtrl;
  late final TextEditingController _hrCtrl;

  bool _saving = false;
  bool _completing = false;

  final List<_Attachment> _attachments = [];
  int? _uploadPct;

  @override
  void initState() {
    super.initState();
    _diagnosisCtrl = TextEditingController();
    _prescribedCtrl = TextEditingController();
    _notesCtrl = TextEditingController();
    _weightCtrl = TextEditingController();
    _tempCtrl = TextEditingController();
    _hrCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _diagnosisCtrl.dispose();
    _prescribedCtrl.dispose();
    _notesCtrl.dispose();
    _weightCtrl.dispose();
    _tempCtrl.dispose();
    _hrCtrl.dispose();
    super.dispose();
  }

  String _petId() {
    final p = widget.task['pet'];
    if (p is Map) return p['_id']?.toString() ?? '';
    return '';
  }

  String _requestId() => widget.task['_id']?.toString() ?? '';

  String _petName() {
    final p = widget.task['pet'];
    if (p is Map) return p['name']?.toString() ?? 'Pet';
    return 'Pet';
  }

  String _ownerName() {
    final u = widget.task['user'];
    if (u is Map) return u['name']?.toString() ?? 'Owner';
    return 'Owner';
  }

  String? _ownerPhone() {
    final u = widget.task['user'];
    if (u is Map) return u['phone']?.toString();
    return null;
  }

  String _serviceType() {
    return (widget.task['serviceType']?.toString() ?? 'Visit').replaceAll('_', ' ').trim();
  }

  String _formatVisitNotes() {
    final dx = _diagnosisCtrl.text.trim();
    final rx = _prescribedCtrl.text.trim();
    final nt = _notesCtrl.text.trim();
    final wt = _weightCtrl.text.trim();
    final tp = _tempCtrl.text.trim();
    final hr = _hrCtrl.text.trim();

    final vitals = <String>[];
    if (wt.isNotEmpty) vitals.add('Weight: $wt kg');
    if (tp.isNotEmpty) vitals.add('Temp: $tp °C');
    if (hr.isNotEmpty) vitals.add('HR: $hr bpm');

    final aUrls = _attachments.map((e) => e.url).where((u) => u.trim().isNotEmpty).toList();

    final b = StringBuffer();
    b.writeln('[PawSewa Vet Visit]');
    b.writeln('Pet: ${_petName()}');
    b.writeln('Service: ${_serviceType()}');
    if (vitals.isNotEmpty) b.writeln('Vitals: ${vitals.join(' · ')}');
    b.writeln('');
    b.writeln('Diagnosis:');
    b.writeln(dx);
    if (rx.isNotEmpty) {
      b.writeln('');
      b.writeln('Prescribed / Plan:');
      b.writeln(rx);
    }
    if (nt.isNotEmpty) {
      b.writeln('');
      b.writeln('Notes:');
      b.writeln(nt);
    }
    if (aUrls.isNotEmpty) {
      b.writeln('');
      b.writeln('Attachments:');
      for (final u in aUrls) {
        b.writeln(u);
      }
    }
    return b.toString().trim();
  }

  Future<void> _pickAndUpload({required bool video}) async {
    try {
      final XFile? file = video
          ? await _picker.pickVideo(source: ImageSource.gallery)
          : await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (file == null) return;

      final bytes = await file.readAsBytes();
      final name = file.name.trim().isNotEmpty ? file.name : (video ? 'video.mp4' : 'image.jpg');
      final filename = name.contains('.') ? name : (video ? '$name.mp4' : '$name.jpg');

      if (!mounted) return;
      setState(() {
        _uploadPct = 0;
      });

      final resp = await _api.uploadChatMedia(
        bytes,
        filename: filename,
        onSendProgress: (sent, total) {
          if (total <= 0) return;
          final pct = ((sent / total) * 100).clamp(0, 100).round();
          if (mounted) setState(() => _uploadPct = pct);
        },
      );
      final body = resp.data;
      String url = '';
      String mediaType = video ? 'video' : 'image';
      if (body is Map && body['success'] == true && body['data'] is Map) {
        final data = body['data'] as Map;
        url = data['url']?.toString() ?? '';
        mediaType = data['mediaType']?.toString() ?? mediaType;
      }
      if (!mounted) return;

      if (url.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Upload failed — no URL returned')),
        );
        setState(() => _uploadPct = null);
        return;
      }

      setState(() {
        _attachments.add(_Attachment(url: url, type: mediaType, label: filename));
        _uploadPct = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploadPct = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Upload failed: $e')),
      );
    }
  }

  void _applyTemplate(String key) {
    final t = key.toLowerCase();
    if (t == 'vaccination') {
      _diagnosisCtrl.text = _diagnosisCtrl.text.trim().isEmpty
          ? 'Vaccination visit. General health reviewed; no acute issues reported.'
          : _diagnosisCtrl.text;
      _prescribedCtrl.text = _prescribedCtrl.text.trim().isEmpty
          ? 'Administered vaccine as per schedule. Observe for 24h for mild fever/lethargy. Hydration advised.'
          : _prescribedCtrl.text;
      return;
    }
    if (t == 'health checkup') {
      _diagnosisCtrl.text = _diagnosisCtrl.text.trim().isEmpty
          ? 'General health check. No major abnormalities noted on exam.'
          : _diagnosisCtrl.text;
      _prescribedCtrl.text = _prescribedCtrl.text.trim().isEmpty
          ? 'Routine care advised: balanced diet, parasite prevention, and follow-up if symptoms develop.'
          : _prescribedCtrl.text;
      return;
    }
    if (t == 'appointment') {
      _diagnosisCtrl.text = _diagnosisCtrl.text.trim().isEmpty
          ? 'Consultation completed. Clinical assessment recorded below.'
          : _diagnosisCtrl.text;
    }
  }

  Future<void> _saveClinicalOnly() async {
    final petId = _petId();
    final requestId = _requestId();
    final diagnosis = _diagnosisCtrl.text.trim();
    if (petId.isEmpty) return;
    if (diagnosis.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Diagnosis is required')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      await _api.postPetClinicalEntry(
        petId: petId,
        diagnosis: diagnosis,
        prescription: _prescribedCtrl.text.trim().isEmpty ? null : _prescribedCtrl.text.trim(),
        notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
        serviceRequestId: requestId.isEmpty ? null : requestId,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Clinical entry saved')),
      );
    } on DioException catch (e) {
      final msg = e.response?.data is Map ? (e.response!.data as Map)['message']?.toString() : null;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg ?? 'Could not save entry')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save entry')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _completeVisit() async {
    final requestId = _requestId();
    final diagnosis = _diagnosisCtrl.text.trim();
    if (requestId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Missing service request id')),
      );
      return;
    }
    if (diagnosis.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Diagnosis is required')),
      );
      return;
    }

    final notes = _formatVisitNotes();

    setState(() => _completing = true);
    try {
      // 1) mark completed + save visitNotes (shows in owner Medical History + attachments extracted from URLs)
      await _api.updateServiceStatus(requestId: requestId, status: 'completed', visitNotes: notes);

      // 2) also add a clinical entry (bell notification + linked vet record)
      final petId = _petId();
      if (petId.isNotEmpty) {
        _api.postPetClinicalEntry(
          petId: petId,
          diagnosis: diagnosis,
          prescription: _prescribedCtrl.text.trim().isEmpty ? null : _prescribedCtrl.text.trim(),
          notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
          serviceRequestId: requestId,
        );
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Visit completed — owner medical history updated')),
      );
      Navigator.of(context).pop(true);
    } on DioException catch (e) {
      final msg = e.response?.data is Map ? (e.response!.data as Map)['message']?.toString() : null;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg ?? 'Could not complete visit')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not complete visit: $e')),
      );
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    final phone = _ownerPhone();

    return PartnerScaffold(
      title: 'Visit notes',
      subtitle: '${_petName()} · ${_ownerName()}',
      actions: [
        IconButton(
          tooltip: 'Task details',
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ServiceTaskDetailScreen(task: Map<String, dynamic>.from(widget.task)),
              ),
            );
          },
          icon: const Icon(Icons.receipt_long_rounded),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(Icons.pets_rounded, color: primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _petName(),
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: ink),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _serviceType(),
                        style: GoogleFonts.outfit(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: ink.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                if (phone != null && phone.trim().isNotEmpty)
                  IconButton(
                    tooltip: 'Call owner',
                    onPressed: () async {
                      final uri = Uri(scheme: 'tel', path: phone.trim());
                      try {
                        await launchUrl(uri);
                      } catch (_) {/* ignore */}
                    },
                    icon: const Icon(Icons.phone_rounded),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Quick templates',
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _TemplateChip(label: 'Appointment', onTap: () => _applyTemplate('Appointment')),
                _TemplateChip(label: 'Health Checkup', onTap: () => _applyTemplate('Health Checkup')),
                _TemplateChip(label: 'Vaccination', onTap: () => _applyTemplate('Vaccination')),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Vitals (optional)',
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _weightCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Weight (kg)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _tempCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Temp (°C)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _hrCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'HR (bpm)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Diagnosis *',
            child: TextField(
              controller: _diagnosisCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Write clinical assessment...',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Prescribed / Plan',
            child: TextField(
              controller: _prescribedCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Medications, diet, follow-up...',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Notes',
            child: TextField(
              controller: _notesCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Anything else (non-sensitive)',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Attachments',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_uploadPct != null) ...[
                  LinearProgressIndicator(
                    value: (_uploadPct! / 100).clamp(0, 1),
                    color: primary,
                    backgroundColor: primary.withValues(alpha: 0.10),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Uploading… $_uploadPct%',
                    style: GoogleFonts.outfit(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: ink.withValues(alpha: 0.65),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                Row(
                  children: [
                    OutlinedButton.icon(
                      onPressed: _uploadPct == null ? () => _pickAndUpload(video: false) : null,
                      icon: const Icon(Icons.photo_library_outlined),
                      label: Text('Add photo', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton.icon(
                      onPressed: _uploadPct == null ? () => _pickAndUpload(video: true) : null,
                      icon: const Icon(Icons.video_library_outlined),
                      label: Text('Add video', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                if (_attachments.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 48,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _attachments.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 10),
                      itemBuilder: (context, i) {
                        final a = _attachments[i];
                        final icon = a.type == 'video' ? Icons.play_circle_outline_rounded : Icons.image_outlined;
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(AppConstants.sandColor).withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: primary.withValues(alpha: 0.10)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(icon, size: 18, color: primary),
                              const SizedBox(width: 8),
                              SizedBox(
                                width: 160,
                                child: Text(
                                  a.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 12.5, color: ink),
                                ),
                              ),
                              const SizedBox(width: 6),
                              InkWell(
                                onTap: () => setState(() => _attachments.removeAt(i)),
                                child: Icon(Icons.close_rounded, size: 18, color: ink.withValues(alpha: 0.55)),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
                if (_attachments.isEmpty && _uploadPct == null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Tip: attach lab photos or discharge papers — the owner can open them in the full report.',
                    style: GoogleFonts.outfit(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      color: ink.withValues(alpha: 0.60),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: (_saving || _completing) ? null : _saveClinicalOnly,
                  child: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text('Save entry', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: (_saving || _completing) ? null : _completeVisit,
                  style: FilledButton.styleFrom(backgroundColor: primary),
                  child: _completing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text('Complete visit', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: primary.withValues(alpha: 0.10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
              color: ink.withValues(alpha: 0.70),
            ),
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _TemplateChip extends StatelessWidget {
  const _TemplateChip({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: primary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: primary.withValues(alpha: 0.14)),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
            color: primary,
          ),
        ),
      ),
    );
  }
}

class _Attachment {
  _Attachment({required this.url, required this.type, required this.label});
  final String url;
  final String type; // image|video|file
  final String label;
}

