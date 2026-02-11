import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/layout_utils.dart';

class CarePlusFlowScreen extends StatefulWidget {
  const CarePlusFlowScreen({super.key});

  @override
  State<CarePlusFlowScreen> createState() => _CarePlusFlowScreenState();
}

class _CarePlusFlowScreenState extends State<CarePlusFlowScreen> {
  final _apiClient = ApiClient();

  int _currentStep = 0;
  List<dynamic> _pets = [];
  bool _loadingPets = true;
  String? _loadError;

  String? _selectedPetId;
  String? _selectedServiceType; // Grooming, Bathing, Training
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  String? _notes;

  final LatLng _mapCenter = const LatLng(27.7172, 85.3240);
  LatLng? _selectedLatLng;
  String? _selectedAddress;

  bool _submitting = false;

  final List<Map<String, dynamic>> _services = [
    {
      'type': 'Grooming',
      'icon': Icons.cut,
      'description': 'Full body grooming, trimming & brushing',
      'price': 1500.0,
    },
    {
      'type': 'Bathing',
      'icon': Icons.water_drop,
      'description': 'Gentle bath with pet-safe shampoo',
      'price': 800.0,
    },
    {
      'type': 'Training',
      'icon': Icons.school,
      'description': 'Basic obedience and behavior training',
      'price': 2000.0,
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadPets();
  }

  Future<void> _loadPets() async {
    try {
      final resp = await _apiClient.getMyPets();
      if (resp.statusCode == 200) {
        setState(() {
          _pets = resp.data['data'] ?? [];
          _loadingPets = false;
        });
      } else {
        setState(() {
          _loadError = 'Failed to load pets (${resp.statusCode})';
          _loadingPets = false;
        });
      }
    } catch (e) {
      setState(() {
        _loadError = 'Failed to load pets: $e';
        _loadingPets = false;
      });
    }
  }

  double get _selectedPrice {
    if (_selectedServiceType == null) return 0;
    final match = _services.firstWhere(
      (s) => s['type'] == _selectedServiceType,
      orElse: () => {'price': 0.0},
    );
    return (match['price'] as num).toDouble();
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
      initialDate: now,
    );
    if (date == null) return;
    if (!mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: 10, minute: 0),
    );
    if (time == null) return;
    setState(() {
      _selectedDate = date;
      _selectedTime = time;
    });
  }

  Future<void> _submitCareRequest() async {
    if (_selectedPetId == null ||
        _selectedServiceType == null ||
        _selectedDate == null ||
        _selectedTime == null ||
        _selectedLatLng == null ||
        _selectedAddress == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please complete all steps before submitting', style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    try {
      final dt = DateTime(
        _selectedDate!.year,
        _selectedDate!.month,
        _selectedDate!.day,
        _selectedTime!.hour,
        _selectedTime!.minute,
      );
      final resp = await _apiClient.createCareRequest({
        'petId': _selectedPetId,
        'serviceType': _selectedServiceType,
        'preferredDate': dt.toIso8601String(),
        'notes': _notes?.trim(),
        'location': {
          'address': _selectedAddress,
          'coordinates': [_selectedLatLng!.longitude, _selectedLatLng!.latitude],
        },
      });

      if (resp.statusCode == 201) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Care+ request created in draft. Next, integrate payment flow.',
              style: GoogleFonts.poppins(),
            ),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true);
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Failed to create Care+ request (${resp.statusCode})',
              style: GoogleFonts.poppins(),
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to submit: $e', style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cream = const Color(AppConstants.bentoBackgroundColor);

    return Scaffold(
      backgroundColor: cream,
      appBar: AppBar(
        title: Text(
          'Care+ Service',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loadingPets
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(AppConstants.primaryColor),
              ),
            )
          : _loadError != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 64, color: Colors.red),
                        const SizedBox(height: 16),
                        Text(
                          _loadError!,
                          style: GoogleFonts.poppins(color: Colors.red),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              : Stepper(
                  currentStep: _currentStep,
                  onStepContinue: () {
                    if (_currentStep < 4) {
                      setState(() => _currentStep += 1);
                    } else {
                      _submitCareRequest();
                    }
                  },
                  onStepCancel: () {
                    if (_currentStep > 0) {
                      setState(() => _currentStep -= 1);
                    } else {
                      Navigator.of(context).pop();
                    }
                  },
                  controlsBuilder: (context, details) {
                    final isLast = _currentStep == 4;
                    return Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Row(
                        children: [
                          ElevatedButton(
                            onPressed: _submitting ? null : details.onStepContinue,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(AppConstants.primaryColor),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            ),
                            child: _submitting && isLast
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Text(
                                    isLast ? 'Submit' : 'Next',
                                    style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
                                  ),
                          ),
                          const SizedBox(width: 8),
                          if (_currentStep > 0)
                            TextButton(
                              onPressed: _submitting ? null : details.onStepCancel,
                              child: Text(
                                'Back',
                                style: GoogleFonts.poppins(
                                  color: Colors.grey[700],
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                  steps: [
                    Step(
                      title: const Text('Pet'),
                      isActive: _currentStep >= 0,
                      state: _currentStep > 0 ? StepState.complete : StepState.indexed,
                      content: _buildPetStep(),
                    ),
                    Step(
                      title: const Text('Service'),
                      isActive: _currentStep >= 1,
                      state: _currentStep > 1 ? StepState.complete : StepState.indexed,
                      content: _buildServiceStep(),
                    ),
                    Step(
                      title: const Text('Schedule'),
                      isActive: _currentStep >= 2,
                      state: _currentStep > 2 ? StepState.complete : StepState.indexed,
                      content: _buildScheduleStep(),
                    ),
                    Step(
                      title: const Text('Location'),
                      isActive: _currentStep >= 3,
                      state: _currentStep > 3 ? StepState.complete : StepState.indexed,
                      content: _buildMapStep(),
                    ),
                    Step(
                      title: const Text('Review'),
                      isActive: _currentStep >= 4,
                      state: _currentStep == 4 ? StepState.editing : StepState.indexed,
                      content: _buildReviewStep(),
                    ),
                  ],
                ),
    );
  }

  Widget _buildPetStep() {
    if (_pets.isEmpty) {
      return Text(
        'No pets found. Please add a pet first.',
        style: GoogleFonts.poppins(color: Colors.grey[700]),
      );
    }
    return SizedBox(
      height: 140,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _pets.length,
        separatorBuilder: (_, index) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final pet = _pets[index] as Map<String, dynamic>;
          final id = pet['_id']?.toString();
          final isSelected = id == _selectedPetId;
          return GestureDetector(
            onTap: () => setState(() => _selectedPetId = id),
            child: Container(
              width: 180,
              decoration: LayoutUtils.bentoCardDecoration(
                context,
                color: isSelected
                    ? const Color(AppConstants.primaryColor).withValues(alpha: 0.08)
                    : Colors.white,
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pet['name']?.toString() ?? 'Pet',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: const Color(AppConstants.accentColor),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${pet['breed'] ?? 'Unknown'} • ${pet['age'] ?? '?'} yrs',
                    style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildServiceStep() {
    return Column(
      children: _services.map((s) {
        final type = s['type'] as String;
        final isSelected = type == _selectedServiceType;
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: GestureDetector(
            onTap: () => setState(() => _selectedServiceType = type),
            child: Container(
              decoration: LayoutUtils.bentoCardDecoration(
                context,
                color: isSelected
                    ? const Color(AppConstants.primaryColor).withValues(alpha: 0.08)
                    : Colors.white,
              ),
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(AppConstants.primaryColor).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(s['icon'] as IconData, color: const Color(AppConstants.primaryColor)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          type,
                          style: GoogleFonts.poppins(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          s['description'] as String,
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    'NPR ${(s['price'] as num).toStringAsFixed(0)}',
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: const Color(AppConstants.primaryColor),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildScheduleStep() {
    final dateStr = _selectedDate == null
        ? 'Choose date & time'
        : '${DateFormat.yMMMEd().format(_selectedDate!)} • ${_selectedTime?.format(context) ?? ''}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Preferred Date & Time',
          style: GoogleFonts.poppins(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: Colors.grey[800],
          ),
        ),
        const SizedBox(height: 12),
        ListTile(
          tileColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: const Icon(Icons.calendar_today, color: Color(AppConstants.primaryColor)),
          title: Text(
            dateStr,
            style: GoogleFonts.poppins(),
          ),
          onTap: _pickDateTime,
        ),
        const SizedBox(height: 16),
        Text(
          'Notes (optional)',
          style: GoogleFonts.poppins(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Colors.grey[800],
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          maxLines: 3,
          onChanged: (v) => _notes = v,
          decoration: InputDecoration(
            hintText: 'Any special instructions for the care provider…',
            hintStyle: GoogleFonts.poppins(color: Colors.grey[500]),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMapStep() {
    final latLng = _selectedLatLng ?? _mapCenter;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Service Location',
          style: GoogleFonts.poppins(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: Colors.grey[800],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Long-press or tap on the map to set your home location for Care+ services.',
          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 220,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: FlutterMap(
              options: MapOptions(
                initialCenter: _mapCenter,
                initialZoom: 13,
                onTap: (tapPosition, point) {
                  setState(() {
                    _selectedLatLng = point;
                  });
                },
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                  subdomains: const ['a', 'b', 'c'],
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: latLng,
                      width: 40,
                      height: 40,
                      child: const Icon(
                        Icons.pets,
                        color: Color(AppConstants.primaryColor),
                        size: 32,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          _selectedAddress ??
              'Tap the map to place the pin, then we will use reverse geocoding to fetch address (TODO).',
          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[700]),
        ),
      ],
    );
  }

  Widget _buildReviewStep() {
    final pet = _pets.firstWhere(
      (p) => p['_id']?.toString() == _selectedPetId,
      orElse: () => <String, dynamic>{},
    ) as Map<String, dynamic>;

    return Container(
      decoration: LayoutUtils.bentoCardDecoration(context),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Review your Care+ booking',
            style: GoogleFonts.poppins(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          _kv('Pet', pet['name']?.toString() ?? '—'),
          _kv('Service', _selectedServiceType ?? '—'),
          _kv(
            'Date & time',
            _selectedDate == null
                ? '—'
                : '${DateFormat.yMMMEd().format(_selectedDate!)} • ${_selectedTime?.format(context) ?? ''}',
          ),
          _kv('Location', _selectedAddress ?? 'Pinned on map'),
          const Divider(height: 24),
          _kv(
            'Total',
            'NPR ${_selectedPrice.toStringAsFixed(0)}',
            bold: true,
          ),
          const SizedBox(height: 8),
          Text(
            'On next iteration, this will open Khalti / eSewa checkout and only mark as Pending Review after successful payment.',
            style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  Widget _kv(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: Colors.grey[700],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: bold ? FontWeight.w600 : FontWeight.normal,
                color: Colors.grey[900],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

