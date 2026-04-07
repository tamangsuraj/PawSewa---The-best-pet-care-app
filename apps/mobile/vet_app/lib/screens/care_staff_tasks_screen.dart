import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';

class CareStaffTasksScreen extends StatefulWidget {
  const CareStaffTasksScreen({super.key});

  @override
  State<CareStaffTasksScreen> createState() => _CareStaffTasksScreenState();
}

class _CareStaffTasksScreenState extends State<CareStaffTasksScreen> {
  final _api = ApiClient();
  bool _loading = true;
  String? _error;
  DateTime _day = DateTime.now();
  List<Map<String, dynamic>> _tasks = [];

  String _dateKey(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final dd = d.day.toString().padLeft(2, '0');
    return '$y-$m-$dd';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await _api.getCareStaffTasks(date: _dateKey(_day));
      final body = r.data;
      List<Map<String, dynamic>> tasks = [];
      if (body is Map && body['success'] == true && body['data'] is Map) {
        final d = body['data'] as Map;
        final raw = d['tasks'];
        if (raw is List) {
          tasks = raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        }
      }
      if (!mounted) return;
      setState(() {
        _tasks = tasks;
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.response?.data is Map
            ? (e.response!.data as Map)['message']?.toString() ?? 'Network error'
            : 'Network error';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    try {
      await _api.putCareStaffTasks(
        date: _dateKey(_day),
        tasks: _tasks,
      );
    } catch (_) {
      // silent; UI already updated
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _pickDay() async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDate: _day,
    );
    if (picked == null) return;
    setState(() => _day = picked);
    await _load();
  }

  Future<void> _addTask() async {
    final titleCtrl = TextEditingController();
    String category = 'general';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add task'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(labelText: 'Task title', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: category,
              items: const [
                DropdownMenuItem(value: 'cleaning', child: Text('Cleaning')),
                DropdownMenuItem(value: 'walks', child: Text('Walk schedule')),
                DropdownMenuItem(value: 'grooming', child: Text('Grooming')),
                DropdownMenuItem(value: 'general', child: Text('General')),
              ],
              onChanged: (v) => category = v ?? 'general',
              decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add')),
        ],
      ),
    );
    final title = titleCtrl.text.trim();
    titleCtrl.dispose();
    if (ok != true || title.isEmpty) return;
    setState(() {
      _tasks = [
        ..._tasks,
        {'category': category, 'title': title, 'done': false},
      ];
    });
    await _save();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Staff tasks',
      subtitle: 'Cleaning, walks, grooming — simple checklists',
      actions: [
        IconButton(
          tooltip: 'Pick date',
          onPressed: _pickDay,
          icon: const Icon(Icons.calendar_month_rounded),
        ),
        IconButton(
          tooltip: 'Refresh',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
      body: Stack(
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: _loading
                ? Center(child: const PawSewaLoader())
                : _error != null
                    ? PartnerEmptyState(
                        title: 'Couldn’t load tasks',
                        body: _error!,
                        icon: Icons.checklist_rounded,
                        primaryAction: OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 90),
                        children: [
                          Card(
                            child: ListTile(
                              leading: Icon(Icons.today_rounded, color: primary),
                              title: const Text('Day'),
                              subtitle: Text(_dateKey(_day)),
                              trailing: const Icon(Icons.edit_calendar_rounded),
                              onTap: _pickDay,
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (_tasks.isEmpty)
                            const PartnerEmptyState(
                              title: 'No tasks',
                              body: 'Add a checklist item for your staff.',
                              icon: Icons.checklist_rounded,
                            )
                          else
                            ..._tasks.asMap().entries.map((entry) {
                              final i = entry.key;
                              final t = entry.value;
                              final title = t['title']?.toString() ?? 'Task';
                              final done = t['done'] == true;
                              final cat = (t['category']?.toString() ?? 'general').toUpperCase();
                              return Card(
                                child: CheckboxListTile(
                                  value: done,
                                  onChanged: (v) async {
                                    setState(() {
                                      _tasks[i] = {...t, 'done': v == true};
                                    });
                                    await _save();
                                  },
                                  title: Text(title),
                                  subtitle: Text(cat, style: const TextStyle(color: Color(AppConstants.inkColor))),
                                  controlAffinity: ListTileControlAffinity.leading,
                                ),
                              );
                            }),
                        ],
                      ),
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: FilledButton.icon(
              onPressed: _addTask,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add task'),
            ),
          ),
        ],
      ),
    );
  }
}

