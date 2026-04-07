import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';

/// Books a vaccination or checkup — creates `pending_admin` on the hub API.
class VetClinicBookingScreen extends StatefulWidget {
  const VetClinicBookingScreen({super.key});

  @override
  State<VetClinicBookingScreen> createState() => _VetClinicBookingScreenState();
}

class _VetClinicBookingScreenState extends State<VetClinicBookingScreen> {
  final _api = ApiClient();
  String _type = 'vaccination';
  String? _petId;
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _time = const TimeOfDay(hour: 10, minute: 0);
  final _notes = TextEditingController();
  List<Map<String, dynamic>> _pets = [];
  bool _loadingPets = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPets();
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _loadPets() async {
    setState(() {
      _loadingPets = true;
      _error = null;
    });
    try {
      final res = await _api.getMyPets();
      final data = res.data;
      final list = data is Map && data['data'] is List
          ? List<Map<String, dynamic>>.from(
              (data['data'] as List).map(
                (e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{},
              ),
            )
          : <Map<String, dynamic>>[];
      if (mounted) {
        setState(() {
          _pets = list;
          if (_petId == null && list.isNotEmpty) {
            _petId = list.first['_id']?.toString();
          }
          _loadingPets = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingPets = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null && mounted) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _time);
    if (picked != null && mounted) setState(() => _time = picked);
  }

  DateTime get _scheduled {
    return DateTime(_date.year, _date.month, _date.day, _time.hour, _time.minute);
  }

  String get _timeWindow {
    final t = _scheduled;
    return DateFormat.jm().format(t);
  }

  Future<void> _submit() async {
    if (_petId == null || _petId!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a pet first.')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await _api.createClinicAppointment({
        'petId': _petId,
        'type': _type,
        'preferredDate': _scheduled.toIso8601String(),
        'timeWindow': _timeWindow,
        if (_notes.text.trim().isNotEmpty) 'description': _notes.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Booking submitted. We’ll assign a vet soon.')),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return Scaffold(
      appBar: AppBar(
        title: Text('Vaccination & checkup', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        backgroundColor: primary,
        foregroundColor: Colors.white,
      ),
      body: _loadingPets
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!, style: GoogleFonts.outfit(color: Colors.red[700])),
                    ),
                  Text('Visit type', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'vaccination', label: Text('Vaccination'), icon: Icon(Icons.vaccines_rounded)),
                      ButtonSegment(value: 'checkup', label: Text('Checkup'), icon: Icon(Icons.medical_services_outlined)),
                    ],
                    selected: {_type},
                    onSelectionChanged: (s) => setState(() => _type = s.first),
                  ),
                  const SizedBox(height: 20),
                  Text('Pet', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  if (_pets.isEmpty)
                    Text(
                      'Add a pet under My Pets first.',
                      style: GoogleFonts.outfit(color: Colors.grey[700]),
                    )
                  else
                    DropdownButtonFormField<String>(
                      initialValue: _petId,
                      decoration: const InputDecoration(border: OutlineInputBorder()),
                      items: _pets
                          .map(
                            (p) => DropdownMenuItem(
                              value: p['_id']?.toString(),
                              child: Text(p['name']?.toString() ?? 'Pet'),
                            ),
                          )
                          .where((e) => e.value != null && e.value!.isNotEmpty)
                          .toList(),
                      onChanged: (v) => setState(() => _petId = v),
                    ),
                  const SizedBox(height: 20),
                  Text('Preferred date', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _pickDate,
                    icon: const Icon(Icons.calendar_today_rounded),
                    label: Text(DateFormat.yMMMd().format(_date), style: GoogleFonts.outfit()),
                  ),
                  const SizedBox(height: 12),
                  Text('Preferred time', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _pickTime,
                    icon: const Icon(Icons.schedule_rounded),
                    label: Text(_timeWindow, style: GoogleFonts.outfit()),
                  ),
                  const SizedBox(height: 20),
                  Text('Notes (optional)', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notes,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      hintText: 'Symptoms, vaccine name, etc.',
                    ),
                  ),
                  const SizedBox(height: 28),
                  FilledButton(
                    onPressed: _pets.isEmpty || _submitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Text('Submit booking', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
    );
  }
}
