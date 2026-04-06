import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'service_task_detail_screen.dart';

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
    const brown = Color(AppConstants.primaryColor);
    const cream = Color(AppConstants.secondaryColor);

    return Scaffold(
      backgroundColor: cream,
      appBar: AppBar(
        title: Text(
          'Clinic queue',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white),
        ),
        backgroundColor: brown,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _load,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: brown))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, style: GoogleFonts.outfit()),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _load,
                          style: FilledButton.styleFrom(backgroundColor: brown),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _tasks.isEmpty
                  ? Center(
                      child: Text(
                        'No assigned visits yet.',
                        style: GoogleFonts.outfit(fontSize: 16, color: Colors.grey.shade700),
                      ),
                    )
                  : RefreshIndicator(
                      color: brown,
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _tasks.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
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
                          final svc = task['serviceType']?.toString() ?? 'Visit';
                          final when =
                              task['scheduledTime'] ?? task['preferredDate'];
                          String whenLine = '';
                          if (when != null) {
                            final dt = DateTime.tryParse(when.toString());
                            if (dt != null) {
                              whenLine =
                                  '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
                            }
                          }

                          return Material(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            elevation: 0.5,
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          petName,
                                          style: GoogleFonts.outfit(
                                            fontSize: 17,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: brown.withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          st,
                                          style: GoogleFonts.outfit(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: brown,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    svc,
                                    style: GoogleFonts.outfit(
                                      fontSize: 13,
                                      color: Colors.grey.shade700,
                                    ),
                                  ),
                                  if (whenLine.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      whenLine,
                                      style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        color: Colors.grey.shade600,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: () {
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute<void>(
                                                builder: (_) => ServiceTaskDetailScreen(
                                                  task: Map<String, dynamic>.from(task),
                                                ),
                                              ),
                                            ).then((_) => _load());
                                          },
                                          icon: const Icon(Icons.map_rounded, size: 18),
                                          label: Text(
                                            'Task',
                                            style: GoogleFonts.outfit(fontSize: 13),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      IconButton(
                                        onPressed: () => _callOwner(ownerPhone),
                                        icon: const Icon(Icons.phone_rounded),
                                        color: brown,
                                        tooltip: 'Call owner',
                                      ),
                                      IconButton(
                                        onPressed: () => _showClinicalDialog(task),
                                        icon: const Icon(Icons.medical_information_outlined),
                                        color: brown,
                                        tooltip: 'Add clinical entry',
                                      ),
                                    ],
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
