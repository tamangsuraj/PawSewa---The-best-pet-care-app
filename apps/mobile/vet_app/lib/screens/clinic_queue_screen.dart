import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'service_task_detail_screen.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';

/// Today's assigned service requests — open task, call owner, add clinical entry (syncs to owner medical history).
class ClinicQueueScreen extends StatefulWidget {
  const ClinicQueueScreen({super.key});

  @override
  State<ClinicQueueScreen> createState() => _ClinicQueueScreenState();
}

class _ClinicQueueScreenState extends State<ClinicQueueScreen> {
  final _api = ApiClient();
  List<Map<String, dynamic>> _tasks = [];
  bool _loading = true;
  String? _error;

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
      final res = await _api.getMyServiceTasks();
      if (!mounted) {
        return;
      }
      if (res.statusCode == 200 && res.data is Map) {
        final raw = (res.data as Map)['data'];
        final out = <Map<String, dynamic>>[];
        if (raw is List) {
          for (final e in raw) {
            if (e is Map) {
              out.add(Map<String, dynamic>.from(e));
            }
          }
        }
        setState(() {
          _tasks = out;
          _loading = false;
        });
        return;
      }
      setState(() {
        _error = 'Could not load queue';
        _loading = false;
      });
    } catch (e) {
      if (kDebugMode) {
        debugPrint('ClinicQueue load error: $e');
      }
      if (mounted) {
        setState(() {
          _error = 'Network error';
          _loading = false;
        });
      }
    }
  }

  String _petId(Map<String, dynamic> task) {
    final p = task['pet'];
    if (p is Map) {
      final id = p['_id']?.toString();
      if (id != null && id.isNotEmpty) {
        return id;
      }
    }
    return '';
  }

  String _requestId(Map<String, dynamic> task) {
    return task['_id']?.toString() ?? '';
  }

  Future<void> _callOwner(String? phone) async {
    if (phone == null || phone.isEmpty) {
      return;
    }
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _showClinicalDialog(Map<String, dynamic> task) async {
    final petId = _petId(task);
    final requestId = _requestId(task);
    if (petId.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Missing pet on this task')),
        );
      }
      return;
    }

    final dxCtrl = TextEditingController();
    final rxCtrl = TextEditingController();
    final notesCtrl = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(
            'Clinical entry',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: dxCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Diagnosis *',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: rxCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Prescription / plan',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('Cancel', style: GoogleFonts.outfit()),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text('Save', style: GoogleFonts.outfit()),
            ),
          ],
        );
      },
    );

    if (ok != true || !mounted) {
      dxCtrl.dispose();
      rxCtrl.dispose();
      notesCtrl.dispose();
      return;
    }

    final diagnosis = dxCtrl.text.trim();
    final prescription = rxCtrl.text.trim();
    final notes = notesCtrl.text.trim();
    dxCtrl.dispose();
    rxCtrl.dispose();
    notesCtrl.dispose();

    if (diagnosis.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Diagnosis is required')),
        );
      }
      return;
    }

    try {
      await _api.postPetClinicalEntry(
        petId: petId,
        diagnosis: diagnosis,
        prescription: prescription.isEmpty ? null : prescription,
        notes: notes.isEmpty ? null : notes,
        serviceRequestId: requestId.isEmpty ? null : requestId,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved — owner will see this in Medical History')),
        );
      }
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString()
          : null;
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Clinic queue',
      subtitle: 'Today’s assigned visits',
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded),
          onPressed: _load,
          tooltip: 'Refresh',
        ),
      ],
      body: Stack(
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: _loading
                ? Center(child: CircularProgressIndicator(color: primary))
                : _error != null
                    ? PartnerEmptyState(
                        title: 'Couldn’t load queue',
                        body: _error!,
                        icon: Icons.wifi_off_rounded,
                        primaryAction: OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                        ),
                      )
                    : _tasks.isEmpty
                        ? const PartnerEmptyState(
                            title: 'No assigned visits',
                            body:
                                'When owners book and Admin assigns you a visit, it will appear here.',
                            icon: Icons.fact_check_rounded,
                          )
                        : RefreshIndicator(
                            color: primary,
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                              itemCount: _tasks.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (context, i) {
                                final task = _tasks[i];
                                final pet = task['pet'] is Map
                                    ? task['pet'] as Map<String, dynamic>
                                    : <String, dynamic>{};
                                final user = task['user'] is Map
                                    ? task['user'] as Map<String, dynamic>
                                    : <String, dynamic>{};
                                final petName = pet['name']?.toString() ?? 'Pet';
                                final ownerPhone = user['phone']?.toString();
                                final st = task['status']?.toString() ?? '';
                                final svc = (task['serviceType']?.toString() ?? 'Visit')
                                    .replaceAll('_', ' ')
                                    .trim();
                                final when = task['scheduledTime'] ?? task['preferredDate'];
                                String whenLine = '';
                                if (when != null) {
                                  final dt = DateTime.tryParse(when.toString());
                                  if (dt != null) {
                                    whenLine =
                                        '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                                  }
                                }

                                return InkWell(
                                  borderRadius: BorderRadius.circular(20),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute<void>(
                                        builder: (_) => ServiceTaskDetailScreen(
                                          task: Map<String, dynamic>.from(task),
                                        ),
                                      ),
                                    ).then((_) => _load());
                                  },
                                  child: Card(
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Row(
                                        children: [
                                          Container(
                                            width: 46,
                                            height: 46,
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
                                                Row(
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        petName,
                                                        maxLines: 1,
                                                        overflow: TextOverflow.ellipsis,
                                                        style: GoogleFonts.outfit(
                                                          fontSize: 15,
                                                          fontWeight: FontWeight.w800,
                                                          color: const Color(AppConstants.inkColor),
                                                        ),
                                                      ),
                                                    ),
                                                    if (st.isNotEmpty)
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(
                                                          horizontal: 10,
                                                          vertical: 6,
                                                        ),
                                                        decoration: BoxDecoration(
                                                          color: const Color(AppConstants.sandColor)
                                                              .withValues(alpha: 0.95),
                                                          borderRadius: BorderRadius.circular(999),
                                                          border: Border.all(
                                                            color: primary.withValues(alpha: 0.10),
                                                          ),
                                                        ),
                                                        child: Text(
                                                          st,
                                                          style: GoogleFonts.outfit(
                                                            fontSize: 11,
                                                            fontWeight: FontWeight.w800,
                                                            color: const Color(AppConstants.inkColor)
                                                                .withValues(alpha: 0.75),
                                                          ),
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                                const SizedBox(height: 3),
                                                Text(
                                                  svc,
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: GoogleFonts.outfit(
                                                    fontSize: 12.5,
                                                    fontWeight: FontWeight.w600,
                                                    color: const Color(AppConstants.inkColor)
                                                        .withValues(alpha: 0.62),
                                                  ),
                                                ),
                                                if (whenLine.isNotEmpty) ...[
                                                  const SizedBox(height: 3),
                                                  Text(
                                                    whenLine,
                                                    style: GoogleFonts.outfit(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w600,
                                                      color: const Color(AppConstants.inkColor)
                                                          .withValues(alpha: 0.55),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          IconButton(
                                            onPressed: () => _callOwner(ownerPhone),
                                            icon: const Icon(Icons.phone_rounded),
                                            color: primary,
                                            tooltip: 'Call owner',
                                          ),
                                          IconButton(
                                            onPressed: () => _showClinicalDialog(task),
                                            icon: const Icon(Icons.medical_information_outlined),
                                            color: primary,
                                            tooltip: 'Add clinical entry',
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
