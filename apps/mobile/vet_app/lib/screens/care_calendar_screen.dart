import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';

class CareCalendarScreen extends StatefulWidget {
  const CareCalendarScreen({super.key});

  @override
  State<CareCalendarScreen> createState() => _CareCalendarScreenState();
}

class _CareCalendarScreenState extends State<CareCalendarScreen> {
  final _api = ApiClient();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _bookings = [];
  DateTime _day = DateTime.now();
  bool _agendaMode = true;

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = DateTime(_day.year, _day.month, _day.day).subtract(const Duration(days: 7));
      final to = DateTime(_day.year, _day.month, _day.day).add(const Duration(days: 14));
      final r = await _api.getOwnerCalendar(
        from: '${from.year}-${from.month.toString().padLeft(2, '0')}-${from.day.toString().padLeft(2, '0')}',
        to: '${to.year}-${to.month.toString().padLeft(2, '0')}-${to.day.toString().padLeft(2, '0')}',
      );
      final body = r.data;
      final list = (body is Map && body['success'] == true && body['data'] is List)
          ? (body['data'] as List)
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _bookings = list;
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

  DateTime? _parseDate(dynamic v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    final s = v.toString();
    return DateTime.tryParse(s);
  }

  String _fmtDay(DateTime d) {
    const w = [
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ];
    final wd = w[(d.weekday - 1).clamp(0, 6)];
    return '$wd • ${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final selectedStart = DateTime(_day.year, _day.month, _day.day);
    final selectedEnd = selectedStart.add(const Duration(days: 1));
    final todays = _bookings.where((b) {
      final ci = _parseDate(b['checkIn'] ?? b['startDate']);
      final co = _parseDate(b['checkOut'] ?? b['endDate']);
      if (ci == null || co == null) return false;
      return ci.isBefore(selectedEnd) && co.isAfter(selectedStart);
    }).toList();
    final checkIns = todays.where((b) {
      final ci = _parseDate(b['checkIn'] ?? b['startDate']);
      return ci != null && DateTime(ci.year, ci.month, ci.day) == selectedStart;
    }).length;
    final checkOuts = todays.where((b) {
      final co = _parseDate(b['checkOut'] ?? b['endDate']);
      return co != null && DateTime(co.year, co.month, co.day) == selectedStart;
    }).length;
    final visible = _agendaMode ? _bookings : todays;

    return PartnerScaffold(
      title: 'Facility calendar',
      subtitle: 'Upcoming check‑ins and check‑outs',
      actions: [
        IconButton(
          tooltip: 'Pick day',
          onPressed: _pickDay,
          icon: const Icon(Icons.calendar_month_rounded),
        ),
        IconButton(
          tooltip: _agendaMode ? 'Day view' : 'Agenda view',
          onPressed: () => setState(() => _agendaMode = !_agendaMode),
          icon: Icon(_agendaMode ? Icons.view_day_rounded : Icons.view_agenda_rounded),
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
                        title: 'Couldn’t load calendar',
                        body: _error!,
                        icon: Icons.calendar_month_rounded,
                        primaryAction: OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                        ),
                      )
                    : _bookings.isEmpty
                        ? const PartnerEmptyState(
                            title: 'No upcoming bookings',
                            body:
                                'When customers book grooming/training stays, they’ll appear here by date.',
                            icon: Icons.event_available_rounded,
                          )
                        : RefreshIndicator(
                            color: primary,
                            onRefresh: _load,
                            child: ListView.builder(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 14, 16, 24),
                              itemCount: visible.length + 1,
                              itemBuilder: (context, i) {
                                if (i == 0) {
                                  return Card(
                                    child: ListTile(
                                      leading: Icon(Icons.today_rounded, color: primary),
                                      title: Text(_fmtDay(selectedStart)),
                                      subtitle: Text(
                                        _agendaMode
                                            ? 'Agenda range loaded · Today: ${todays.length} staying · Check-ins: $checkIns · Check-outs: $checkOuts'
                                            : 'Occupancy: ${todays.length} · Check-ins: $checkIns · Check-outs: $checkOuts',
                                      ),
                                      trailing: const Icon(Icons.edit_calendar_rounded),
                                      onTap: _pickDay,
                                    ),
                                  );
                                }

                                final b = visible[i - 1];
                                final pet = b['petId'] ?? b['pet'];
                                final user = b['userId'] ?? b['user'];
                                final petName = pet is Map
                                    ? (pet['name']?.toString() ?? 'Pet')
                                    : 'Pet';
                                final ownerName = user is Map
                                    ? (user['name']?.toString() ?? 'Owner')
                                    : 'Owner';
                                final checkIn = _parseDate(b['checkIn'] ?? b['startDate']);
                                final checkOut = _parseDate(b['checkOut'] ?? b['endDate']);
                                final serviceType =
                                    (b['serviceType'] ?? b['type'] ?? '')
                                        .toString()
                                        .replaceAll('_', ' ')
                                        .trim();
                                final dayLine = checkIn != null
                                    ? _fmtDay(checkIn)
                                    : 'Date not set';
                                final range = (checkIn != null && checkOut != null)
                                    ? '${checkIn.month}/${checkIn.day} > ${checkOut.month}/${checkOut.day}'
                                    : '';
                                final status =
                                    (b['status'] ?? 'pending').toString();

                                return Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 46,
                                          height: 46,
                                          decoration: BoxDecoration(
                                            color:
                                                primary.withValues(alpha: 0.10),
                                            borderRadius:
                                                BorderRadius.circular(16),
                                          ),
                                          child: Icon(
                                            Icons.calendar_today_rounded,
                                            color: primary,
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                '$petName • $ownerName',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .titleMedium
                                                    ?.copyWith(
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      color: const Color(
                                                          AppConstants.inkColor),
                                                    ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                dayLine,
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .bodySmall
                                                    ?.copyWith(
                                                      color: const Color(
                                                              AppConstants.inkColor)
                                                          .withValues(
                                                              alpha: 0.65),
                                                      fontWeight:
                                                          FontWeight.w600,
                                                    ),
                                              ),
                                              if (serviceType.isNotEmpty ||
                                                  range.isNotEmpty) ...[
                                                const SizedBox(height: 6),
                                                Wrap(
                                                  spacing: 8,
                                                  runSpacing: 8,
                                                  children: [
                                                    if (serviceType.isNotEmpty)
                                                      _Chip(text: serviceType),
                                                    if (range.isNotEmpty)
                                                      _Chip(text: range),
                                                    _Chip(text: status),
                                                  ],
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                      ],
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

class _Chip extends StatelessWidget {
  const _Chip({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(AppConstants.sandColor).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: primary.withValues(alpha: 0.10)),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: const Color(AppConstants.inkColor)
                  .withValues(alpha: 0.78),
            ),
      ),
    );
  }
}

