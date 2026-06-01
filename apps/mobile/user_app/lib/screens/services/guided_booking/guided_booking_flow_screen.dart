import 'dart:math' show max;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/api_client.dart';
import '../../../core/constants.dart';
import '../../../core/dog_vaccination_schedule.dart';
import '../../../screens/messages/messages_screen.dart';
import '../../../screens/support/contact_us_screen.dart';
import '../../../services/geocoding_service.dart';
import '../../../widgets/map_pin_marker.dart';
import '../../../widgets/paw_sewa_loader.dart';

const Color _kBrown = Color(AppConstants.primaryColor);

enum _BookingStep {
  service,
  details,
  purpose,
  pet,
  vaccines,
  visit,
  pricing,
  review,
  success,
}

class GuidedBookingFlowScreen extends StatefulWidget {
  const GuidedBookingFlowScreen({super.key, this.initialPetId});

  final String? initialPetId;

  @override
  State<GuidedBookingFlowScreen> createState() => _GuidedBookingFlowScreenState();
}

class _GuidedBookingFlowScreenState extends State<GuidedBookingFlowScreen> {
  final _api = ApiClient();
  final _geocoding = GeocodingService();
  final _page = PageController();
  final _mapController = MapController();

  final _notesController = TextEditingController();
  final _addressDetailsController = TextEditingController();

  bool _loadingPets = true;
  String? _petsError;
  List<dynamic> _pets = [];

  _BookingStep _step = _BookingStep.service;

  // Selections
  String? _selectedServiceType;
  String? _selectedPurposeId;
  String? _selectedPetId;
  DateTime? _selectedDate;
  String? _selectedTimeWindow;
  final Set<String> _symptoms = {};
  final Set<String> _selectedVaccines = {};

  static const int _consultationFee = 400;
  static const int _homeVisitCharge = 250;
  static const int _rabiesPrice = 600;
  static const int _dhppilPrice = 800;
  static const int _cvPrice = 500;

  static const List<_VaccineItem> _vaccineCatalog = [
    _VaccineItem(
      id: 'rabies',
      name: 'Rabies (ARV)',
      description: 'Protects against rabies (life‑threatening viral infection).',
      dueAtDays: 90,
      price: _rabiesPrice,
    ),
    _VaccineItem(
      id: 'dhppil',
      name: 'DHPPi+L',
      description:
          'Distemper, Hepatitis, Parvovirus, Parainfluenza, Leptospirosis.',
      dueAtDays: 45,
      price: _dhppilPrice,
    ),
    _VaccineItem(
      id: 'cv',
      name: 'CV (Canine Corona)',
      description: 'Protects against canine coronavirus.',
      dueAtDays: 60,
      price: _cvPrice,
    ),
  ];

  LatLng _mapCenter = const LatLng(27.7, 85.32);
  LatLng? _confirmedLatLng;
  String? _confirmedAddress;
  String? _geoWarning;
  bool _gpsFetching = false;
  bool _confirmingLocation = false;
  DateTime? _serviceLiveGpsAt;

  bool _submitting = false;

  // Kathmandu bounds (kept identical to BookServiceScreen to avoid behavior changes)
  static const double _minLat = 27.55;
  static const double _maxLat = 27.82;
  static const double _minLng = 85.18;
  static const double _maxLng = 85.55;

  bool get _isInsideKathmandu {
    final LatLng pos = _confirmedLatLng ?? _mapCenter;
    final lat = pos.latitude;
    final lng = pos.longitude;
    return lat >= _minLat && lat <= _maxLat && lng >= _minLng && lng <= _maxLng;
  }

  static const List<String> _timeWindows = [
    'Morning (9am-12pm)',
    'Afternoon (12pm-4pm)',
    'Evening (4pm-8pm)',
  ];

  static const List<_ServiceItem> _services = [
    _ServiceItem(
      id: 'home_visit',
      title: 'Home Visit by Vet',
      subtitle: 'A verified vet at your doorstep, with guidance you can trust.',
      icon: Icons.home_rounded,
      helperTag: 'Most booked',
      serviceType: 'Home Visit by Vet',
    ),
    _ServiceItem(
      id: 'vaccinations',
      title: 'Vaccinations',
      subtitle: 'Stay protected with timely vaccines & reminders.',
      icon: Icons.vaccines_rounded,
      helperTag: 'Prevention',
      serviceType: 'Vaccination',
    ),
    _ServiceItem(
      id: 'emergency',
      title: 'Emergency Care',
      subtitle: 'Fast help for urgent symptoms — we’ll guide you instantly.',
      icon: Icons.emergency_rounded,
      helperTag: 'Urgent',
      serviceType: 'Emergency Care',
      isEmergency: true,
    ),
    _ServiceItem(
      id: 'nutrition',
      title: 'Nutrition Consultation',
      subtitle: 'Diet plans and guidance tailored to your pet.',
      icon: Icons.restaurant_rounded,
      helperTag: 'Wellness',
      serviceType: 'Nutrition Consultation',
    ),
    _ServiceItem(
      id: 'online',
      title: 'Online Consultation',
      subtitle: 'Talk to a vet from anywhere — ideal for quick concerns.',
      icon: Icons.video_call_rounded,
      helperTag: 'Remote',
      serviceType: 'Online Consultation',
    ),
  ];

  static const List<_PurposeItem> _purposes = [
    _PurposeItem(
      id: 'vaccination',
      title: 'Vaccination',
      subtitle: 'Shots, boosters, vaccine schedule',
      icon: Icons.vaccines_rounded,
      recommendedForServices: {'vaccinations'},
    ),
    _PurposeItem(
      id: 'checkup',
      title: 'General Checkup',
      subtitle: 'Wellness, weight, routine assessment',
      icon: Icons.medical_services_rounded,
      recommendedForServices: {'home_visit', 'online'},
    ),
    _PurposeItem(
      id: 'symptoms',
      title: 'Sick Pet / Symptoms',
      subtitle: 'Fever, vomiting, not eating, cough',
      icon: Icons.sick_rounded,
      recommendedForServices: {'home_visit', 'online'},
    ),
    _PurposeItem(
      id: 'emergency',
      title: 'Emergency',
      subtitle: 'Urgent symptoms, immediate support',
      icon: Icons.emergency_rounded,
      recommendedForServices: {'emergency'},
      isEmergency: true,
    ),
    _PurposeItem(
      id: 'nutrition',
      title: 'Nutrition & Diet',
      subtitle: 'Food plan, allergies, weight goals',
      icon: Icons.restaurant_rounded,
      recommendedForServices: {'nutrition'},
    ),
    _PurposeItem(
      id: 'behavior',
      title: 'Behavioral Issue',
      subtitle: 'Anxiety, aggression, training support',
      icon: Icons.psychology_rounded,
      recommendedForServices: {'home_visit', 'online'},
    ),
    _PurposeItem(
      id: 'other',
      title: 'Other Concern',
      subtitle: 'Tell us what’s worrying you',
      icon: Icons.help_outline_rounded,
      recommendedForServices: {'home_visit', 'online', 'nutrition', 'vaccinations'},
    ),
    _PurposeItem(
      id: 'procedure',
      title: 'Surgery / Procedure',
      subtitle: 'Spaying, castration, and other procedures',
      icon: Icons.local_hospital_rounded,
      recommendedForServices: {'home_visit'},
    ),
  ];

  @override
  void initState() {
    super.initState();
    _loadPets();
  }

  @override
  void dispose() {
    _page.dispose();
    _notesController.dispose();
    _addressDetailsController.dispose();
    super.dispose();
  }

  Future<void> _loadPets() async {
    setState(() {
      _loadingPets = true;
      _petsError = null;
    });
    try {
      final res = await _api.getMyPets();
      final list = (res.statusCode == 200 && res.data is Map) ? (res.data['data'] as List? ?? []) : [];
      if (!mounted) return;
      setState(() {
        _pets = list;
        _loadingPets = false;
        if (widget.initialPetId != null && widget.initialPetId!.isNotEmpty) {
          final hasPet = list.any((p) => (p['_id'] ?? p['id'])?.toString() == widget.initialPetId);
          if (hasPet) {
            _selectedPetId = widget.initialPetId;
          }
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingPets = false;
        _petsError = 'Could not load pets. Please try again.';
      });
    }
  }

  void _goTo(_BookingStep step) {
    final idx = _stepIndex(step);
    setState(() => _step = step);
    _page.animateToPage(
      idx,
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  int _stepIndex(_BookingStep s) {
    // success is a terminal screen
    switch (s) {
      case _BookingStep.service:
        return 0;
      case _BookingStep.details:
        return 1;
      case _BookingStep.purpose:
        return 2;
      case _BookingStep.pet:
        return 3;
      case _BookingStep.vaccines:
        return 4;
      case _BookingStep.visit:
        return 5;
      case _BookingStep.pricing:
        return 6;
      case _BookingStep.review:
        return 7;
      case _BookingStep.success:
        return 8;
    }
  }

  _ServiceItem? get _service =>
      _services.where((s) => s.serviceType == _selectedServiceType).cast<_ServiceItem?>().firstOrNull;

  _PurposeItem? get _purpose =>
      _purposes.where((p) => p.id == _selectedPurposeId).cast<_PurposeItem?>().firstOrNull;

  Map<String, dynamic>? get _selectedPet {
    final id = _selectedPetId;
    if (id == null) return null;
    for (final p in _pets) {
      if (p is Map) {
        final pid = (p['_id'] ?? p['id'])?.toString();
        if (pid == id) return Map<String, dynamic>.from(p);
      }
    }
    return null;
  }

  bool get _isEmergencyFlow {
    final s = _service;
    final p = _purpose;
    return (s?.isEmergency ?? false) || (p?.isEmergency ?? false);
  }

  List<_StepDot> _dots() {
    // Keep a compact top indicator like the reference: Service → Purpose → Pet → Details → Pricing → Confirm
    final all = [
      _StepDot('Service', _BookingStep.service),
      _StepDot('Purpose', _BookingStep.purpose),
      _StepDot('Pet', _BookingStep.pet),
      _StepDot('Details', _BookingStep.visit),
      _StepDot('Pricing', _BookingStep.pricing),
      _StepDot('Confirm', _BookingStep.review),
    ];
    return all;
  }

  /// API enum: Appointment | Health Checkup | Vaccination
  String _serviceTypeForApi() {
    if (_selectedServiceType == 'Vaccination' || _selectedPurposeId == 'vaccination') {
      return 'Vaccination';
    }
    switch (_selectedServiceType) {
      case 'Nutrition Consultation':
        return 'Health Checkup';
      case 'Appointment':
      case 'Health Checkup':
      case 'Vaccination':
        return _selectedServiceType!;
      default:
        return 'Appointment';
    }
  }

  bool _canContinueFrom(_BookingStep step) {
    switch (step) {
      case _BookingStep.service:
        return _selectedServiceType != null;
      case _BookingStep.details:
        return true;
      case _BookingStep.purpose:
        return _selectedPurposeId != null;
      case _BookingStep.pet:
        return _selectedPetId != null;
      case _BookingStep.vaccines:
        return _selectedVaccines.isNotEmpty;
      case _BookingStep.visit:
        if (_selectedDate == null || _selectedTimeWindow == null) return false;
        if (_gpsFetching || _confirmingLocation) return false;
        if (_confirmedLatLng == null || (_confirmedAddress ?? '').trim().isEmpty) return false;
        if (!_isInsideKathmandu) return false;
        return true;
      case _BookingStep.pricing:
        return true;
      case _BookingStep.review:
        return !_submitting;
      case _BookingStep.success:
        return true;
    }
  }

  _BookingStep? _next(_BookingStep step) {
    if (_isEmergencyFlow) {
      // Emergency: skip service details + pricing, go fast.
      switch (step) {
        case _BookingStep.service:
          return _BookingStep.purpose;
        case _BookingStep.details:
          return _BookingStep.purpose;
        case _BookingStep.purpose:
          return _BookingStep.pet;
        case _BookingStep.pet:
          return _BookingStep.visit;
        case _BookingStep.vaccines:
          return _BookingStep.visit;
        case _BookingStep.visit:
          return _BookingStep.review;
        case _BookingStep.pricing:
          return _BookingStep.review;
        case _BookingStep.review:
          return _BookingStep.success;
        case _BookingStep.success:
          return null;
      }
    }

    final wantsVaccines =
        _selectedServiceType == 'Vaccination' || _selectedPurposeId == 'vaccination';

    switch (step) {
      case _BookingStep.service:
        return _selectedServiceType == 'Vaccination'
            ? _BookingStep.pet
            : _BookingStep.details;
      case _BookingStep.details:
        return _BookingStep.purpose;
      case _BookingStep.purpose:
        return _BookingStep.pet;
      case _BookingStep.pet:
        return wantsVaccines ? _BookingStep.vaccines : _BookingStep.visit;
      case _BookingStep.vaccines:
        return _BookingStep.visit;
      case _BookingStep.visit:
        return _BookingStep.pricing;
      case _BookingStep.pricing:
        return _BookingStep.review;
      case _BookingStep.review:
        return _BookingStep.success;
      case _BookingStep.success:
        return null;
    }
  }

  _BookingStep? _prev(_BookingStep step) {
    if (_isEmergencyFlow) {
      switch (step) {
        case _BookingStep.service:
          return null;
        case _BookingStep.details:
          return _BookingStep.service;
        case _BookingStep.purpose:
          return _BookingStep.service;
        case _BookingStep.pet:
          return _BookingStep.purpose;
        case _BookingStep.vaccines:
          return _BookingStep.pet;
        case _BookingStep.visit:
          return _BookingStep.pet;
        case _BookingStep.pricing:
          return _BookingStep.visit;
        case _BookingStep.review:
          return _BookingStep.pricing;
        case _BookingStep.success:
          return null;
      }
    }

    final wantsVaccines =
        _selectedServiceType == 'Vaccination' || _selectedPurposeId == 'vaccination';

    switch (step) {
      case _BookingStep.service:
        return null;
      case _BookingStep.details:
        return _BookingStep.service;
      case _BookingStep.purpose:
        return _BookingStep.details;
      case _BookingStep.pet:
        return _selectedServiceType == 'Vaccination'
            ? _BookingStep.service
            : _BookingStep.purpose;
      case _BookingStep.vaccines:
        return _BookingStep.pet;
      case _BookingStep.visit:
        return wantsVaccines ? _BookingStep.vaccines : _BookingStep.pet;
      case _BookingStep.pricing:
        return _BookingStep.visit;
      case _BookingStep.review:
        return _BookingStep.pricing;
      case _BookingStep.success:
        return null;
    }
  }

  Future<void> _useDeviceGpsForServiceLocation() async {
    if (_gpsFetching) return;
    setState(() => _gpsFetching = true);
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        if (mounted) _snack('Location services are disabled.');
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        if (mounted) _snack('Location permission is required for current location.');
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final p = LatLng(pos.latitude, pos.longitude);
      _mapController.move(p, 15);
      final address = await _geocoding.reverse(lat: p.latitude, lng: p.longitude);
      if (!mounted) return;
      final resolvedAddress = (address != null && address.trim().isNotEmpty)
          ? address.trim()
          : '${p.latitude.toStringAsFixed(5)}, ${p.longitude.toStringAsFixed(5)}';
      final insideKathmandu = p.latitude >= _minLat &&
          p.latitude <= _maxLat &&
          p.longitude >= _minLng &&
          p.longitude <= _maxLng;
      setState(() {
        _mapCenter = p;
        _confirmedLatLng = p;
        _confirmedAddress = resolvedAddress;
        _geoWarning = insideKathmandu
            ? null
            : 'Service restricted to Kathmandu Valley. Please move the pin inside the boundary.';
        _serviceLiveGpsAt = DateTime.now().toUtc();
      });
    } catch (e) {
      if (mounted) _snack('Could not get location.');
    } finally {
      if (mounted) setState(() => _gpsFetching = false);
    }
  }

  Future<void> _confirmLocation() async {
    setState(() {
      _confirmingLocation = true;
      _geoWarning = null;
    });
    try {
      final p = _mapCenter;
      final address = await _geocoding.reverse(lat: p.latitude, lng: p.longitude);
      if (!mounted) return;
      final resolved = (address != null && address.trim().isNotEmpty)
          ? address.trim()
          : '${p.latitude.toStringAsFixed(5)}, ${p.longitude.toStringAsFixed(5)}';
      final insideKathmandu = p.latitude >= _minLat &&
          p.latitude <= _maxLat &&
          p.longitude >= _minLng &&
          p.longitude <= _maxLng;
      setState(() {
        _confirmedLatLng = p;
        _confirmedAddress = resolved;
        _serviceLiveGpsAt = null;
        _geoWarning = insideKathmandu
            ? null
            : 'Service restricted to Kathmandu Valley. Please move the pin inside the boundary.';
      });
    } catch (_) {
      if (mounted) _snack('Failed to confirm location.');
    } finally {
      if (mounted) setState(() => _confirmingLocation = false);
    }
  }

  Future<void> _submit() async {
    if (_selectedPetId == null ||
        _selectedServiceType == null ||
        _selectedDate == null ||
        _selectedTimeWindow == null) {
      _snack('Please complete all steps before submitting.');
      return;
    }
    if (_confirmedLatLng == null || (_confirmedAddress ?? '').trim().isEmpty) {
      _snack('Please confirm your location on the map.');
      return;
    }
    if (!_isInsideKathmandu) {
      _snack('Service is restricted to Kathmandu Valley.');
      return;
    }

    setState(() => _submitting = true);
    try {
      final extraLocationDetails = _addressDetailsController.text.trim();
      final combinedAddress = extraLocationDetails.isEmpty
          ? _confirmedAddress!.trim()
          : '${_confirmedAddress!.trim()}\nDetails: $extraLocationDetails';

      final purposeLine = _purpose == null ? '' : 'Purpose: ${_purpose!.title}';
      final symptomLine = _symptoms.isEmpty ? '' : 'Symptoms: ${_symptoms.join(', ')}';
      final vaccineLine = _selectedVaccines.isEmpty
          ? ''
          : 'Vaccines: ${_selectedVaccines.join(', ')}';
      final userNotes = _notesController.text.trim();
      final apiServiceType = _serviceTypeForApi();
      final displayService = _selectedServiceType?.trim();
      final notesParts = [
        if (displayService != null &&
            displayService.isNotEmpty &&
            displayService != apiServiceType)
          'Service requested: $displayService',
        if (purposeLine.isNotEmpty) purposeLine,
        if (symptomLine.isNotEmpty) symptomLine,
        if (vaccineLine.isNotEmpty) vaccineLine,
        if (userNotes.isNotEmpty) userNotes,
      ];

      final payload = <String, dynamic>{
        'petId': _selectedPetId,
        'serviceType': apiServiceType,
        'preferredDate': DateFormat('yyyy-MM-dd').format(_selectedDate!),
        'timeWindow': _selectedTimeWindow,
        // Keep default matching previous flow (do not change payment plumbing here)
        'paymentMethod': 'online',
        'notes': notesParts.isEmpty ? null : notesParts.join('\n'),
        'location': {
          'address': combinedAddress,
          'coordinates': {
            'lat': _confirmedLatLng!.latitude,
            'lng': _confirmedLatLng!.longitude,
          },
        },
      };
      if (_serviceLiveGpsAt != null) {
        payload['liveLocation'] = {
          'lat': _confirmedLatLng!.latitude,
          'lng': _confirmedLatLng!.longitude,
          'timestamp': _serviceLiveGpsAt!.toIso8601String(),
        };
      }

      final response = await _api.createServiceRequest(payload);
      if (!mounted) return;

      if (response.statusCode == 201) {
        _goTo(_BookingStep.success);
      } else {
        final data = response.data;
        final message = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Failed to submit request.';
        _snack(message);
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      final message = (data is Map && data['message'] != null)
          ? data['message'].toString()
          : (e.message ?? 'Failed to submit request.');
      _snack(message);
    } catch (_) {
      _snack('Failed to submit request.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.outfit()),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bg = Colors.white;
    final canBack = _prev(_step) != null && _step != _BookingStep.success;
    final next = _next(_step);
    final nextEnabled = _canContinueFrom(_step);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.white,
        foregroundColor: Colors.black87,
        title: Text(
          _step == _BookingStep.success ? 'Booking confirmed' : 'Services',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: Colors.black87),
        ),
        leading: canBack
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () {
                  final p = _prev(_step);
                  if (p != null) _goTo(p);
                },
              )
            : null,
        actions: [
          if (_step != _BookingStep.success)
            IconButton(
              tooltip: 'Support',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const ContactUsScreen()),
                );
              },
              icon: const Icon(Icons.support_agent_rounded),
            ),
        ],
      ),
      body: Column(
        children: [
          if (_step != _BookingStep.success) _BookingStepper(dots: _dots(), active: _step),
          Expanded(
            child: PageView(
              controller: _page,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _ServicesHome(
                  services: _services,
                  onSelect: (s) {
                    setState(() {
                      _selectedServiceType = s.serviceType;
                      // If user picked Emergency service, auto-set emergency purpose suggestion
                      if (s.isEmergency) _selectedPurposeId = 'emergency';
                      if (s.serviceType == 'Vaccination') {
                        _selectedPurposeId = 'vaccination';
                        _selectedVaccines.clear();
                      }
                    });
                    if (s.serviceType == 'Vaccination') {
                      _goTo(_BookingStep.pet);
                    } else {
                      _goTo(_isEmergencyFlow ? _BookingStep.purpose : _BookingStep.details);
                    }
                  },
                  onOpenChat: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const MessagesScreen()),
                    );
                  },
                  onOpenSupport: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const ContactUsScreen()),
                    );
                  },
                ),
                _ServiceDetails(service: _service),
                _PurposeSelection(
                  serviceId: _services.firstWhere(
                    (s) => s.serviceType == _selectedServiceType,
                    orElse: () => _services.first,
                  ).id,
                  selectedPurposeId: _selectedPurposeId,
                  purposes: _purposes,
                  onSelect: (p) {
                    setState(() {
                      _selectedPurposeId = p.id;
                      if (p.isEmergency) {
                        _selectedServiceType = 'Emergency Care';
                      }
                      if (p.id == 'vaccination') {
                        _selectedServiceType = 'Vaccination';
                        _selectedVaccines.clear();
                      }
                    });
                  },
                ),
                _PetSelection(
                  loading: _loadingPets,
                  error: _petsError,
                  pets: _pets,
                  selectedPetId: _selectedPetId,
                  onRetry: _loadPets,
                  onSelect: (id) => setState(() => _selectedPetId = id),
                ),
                _VaccineSelection(
                  pet: _selectedPet,
                  selectedIds: _selectedVaccines,
                  onToggle: (id) {
                    setState(() {
                      if (_selectedVaccines.contains(id)) {
                        _selectedVaccines.remove(id);
                      } else {
                        _selectedVaccines.add(id);
                      }
                    });
                  },
                  items: _vaccineCatalog,
                  consultationFee: _consultationFee,
                  visitCharge: _homeVisitCharge,
                ),
                _VisitDetails(
                  emergency: _isEmergencyFlow,
                  selectedDate: _selectedDate,
                  selectedTimeWindow: _selectedTimeWindow,
                  timeWindows: _timeWindows,
                  onPickDate: (d) => setState(() => _selectedDate = d),
                  onPickTimeWindow: (w) => setState(() => _selectedTimeWindow = w),
                  symptoms: _symptoms,
                  showSymptoms: _selectedPurposeId == 'symptoms' || _isEmergencyFlow,
                  onToggleSymptom: (s) {
                    setState(() {
                      if (_symptoms.contains(s)) {
                        _symptoms.remove(s);
                      } else {
                        _symptoms.add(s);
                      }
                    });
                  },
                  notesController: _notesController,
                  addressDetailsController: _addressDetailsController,
                  mapController: _mapController,
                  mapCenter: _mapCenter,
                  confirmedLatLng: _confirmedLatLng,
                  confirmedAddress: _confirmedAddress,
                  geoWarning: _geoWarning,
                  gpsFetching: _gpsFetching,
                  confirmingLocation: _confirmingLocation,
                  isInsideKathmandu: _isInsideKathmandu,
                  onMapMoved: (center, byGesture) {
                    setState(() {
                      _mapCenter = center;
                      if (byGesture) _serviceLiveGpsAt = null;
                    });
                  },
                  onUseGps: _useDeviceGpsForServiceLocation,
                  onConfirmLocation: _confirmLocation,
                ),
                _PricingScreen(
                  serviceType: _selectedServiceType,
                  purpose: _purpose,
                  emergency: _isEmergencyFlow,
                  selectedVaccines: _selectedVaccines.toList(),
                  vaccineCatalog: _vaccineCatalog,
                  consultationFee: _consultationFee,
                  visitCharge: _homeVisitCharge,
                ),
                _ReviewScreen(
                  serviceType: _selectedServiceType,
                  purpose: _purpose,
                  pet: _selectedPet,
                  date: _selectedDate,
                  timeWindow: _selectedTimeWindow,
                  address: _confirmedAddress,
                  addressDetails: _addressDetailsController.text.trim(),
                  notes: _notesController.text.trim(),
                  symptoms: _symptoms.toList(),
                  emergency: _isEmergencyFlow,
                ),
                _SuccessScreen(
                  onDone: () => Navigator.of(context).pop(true),
                  onSupport: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const ContactUsScreen()),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: _step == _BookingStep.success
          ? null
          : SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 18,
                      offset: const Offset(0, -6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: canBack
                            ? () {
                                final p = _prev(_step);
                                if (p != null) _goTo(p);
                              }
                            : null,
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: Colors.grey.shade300),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Text('Back', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: (!nextEnabled || _submitting)
                            ? null
                            : () async {
                                if (_step == _BookingStep.review) {
                                  await _submit();
                                } else {
                                  final n = next;
                                  if (n != null) _goTo(n);
                                }
                              },
                        style: FilledButton.styleFrom(
                          backgroundColor: _kBrown,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: _submitting && _step == _BookingStep.review
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: PawSewaLoader(width: 36, center: false),
                              )
                            : Text(
                                _step == _BookingStep.review ? 'Confirm booking' : 'Continue',
                                style: GoogleFonts.outfit(
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
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

class _BookingStepper extends StatelessWidget {
  const _BookingStepper({required this.dots, required this.active});

  final List<_StepDot> dots;
  final _BookingStep active;

  int _activeIndex() {
    final idx = dots.indexWhere((d) => d.step == active);
    if (idx >= 0) return idx;
    // Map internal screens to closest dot
    if (active == _BookingStep.details) return 0;
    if (active == _BookingStep.visit) return 3;
    return max(0, dots.length - 1);
  }

  @override
  Widget build(BuildContext context) {
    final a = _activeIndex();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
      child: Row(
        children: List.generate(dots.length, (i) {
          final isDone = i < a;
          final isActive = i == a;
          final c = isDone || isActive ? _kBrown : Colors.grey.shade300;
          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 2,
                        color: i == 0 ? Colors.transparent : c.withValues(alpha: 0.85),
                      ),
                    ),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: c,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: isDone
                            ? const Icon(Icons.check_rounded, color: Colors.white, size: 18)
                            : Text(
                                '${i + 1}',
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                    Expanded(
                      child: Container(
                        height: 2,
                        color: i == dots.length - 1 ? Colors.transparent : c.withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  dots[i].label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    color: isActive ? _kBrown : Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _ServicesHome extends StatelessWidget {
  const _ServicesHome({
    required this.services,
    required this.onSelect,
    required this.onOpenChat,
    required this.onOpenSupport,
  });

  final List<_ServiceItem> services;
  final void Function(_ServiceItem) onSelect;
  final VoidCallback onOpenChat;
  final VoidCallback onOpenSupport;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
      children: [
        _WelcomeHero(
          onChat: onOpenChat,
          onSupport: onOpenSupport,
        ),
        const SizedBox(height: 16),
        Text(
          'Popular Services',
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 10),
        ...services.map((s) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _ServiceCard(service: s, onTap: () => onSelect(s)),
            )),
        const SizedBox(height: 6),
        _SupportCard(onChat: onOpenChat, onSupport: onOpenSupport),
        const SizedBox(height: 80),
      ],
    );
  }
}

class _WelcomeHero extends StatelessWidget {
  const _WelcomeHero({required this.onChat, required this.onSupport});

  final VoidCallback onChat;
  final VoidCallback onSupport;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF9F4),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hello, Pet Parent!',
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'How can we help your pet today?',
                  style: GoogleFonts.domine(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: const Color(AppConstants.accentColor),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'A guided, purpose-first experience — so you feel confident before you book.',
                  style: GoogleFonts.outfit(
                    fontSize: 12.5,
                    height: 1.35,
                    color: Colors.grey.shade700,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _MiniAction(
                      icon: Icons.chat_bubble_rounded,
                      label: 'Chat support',
                      onTap: onChat,
                    ),
                    _MiniAction(
                      icon: Icons.support_agent_rounded,
                      label: 'Consultation help',
                      onTap: onSupport,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              color: _kBrown.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(22),
            ),
            child: const Icon(Icons.pets_rounded, color: _kBrown, size: 40),
          ),
        ],
      ),
    );
  }
}

class _MiniAction extends StatelessWidget {
  const _MiniAction({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: _kBrown),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: _kBrown,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.service, required this.onTap});

  final _ServiceItem service;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tagColor = service.isEmergency ? const Color(0xFFB71C1C) : _kBrown;
    return Material(
      color: Colors.white,
      elevation: 0,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 16,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: _kBrown.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(service.icon, color: _kBrown),
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
                            service.title,
                            style: GoogleFonts.outfit(
                              fontSize: 15.5,
                              fontWeight: FontWeight.w800,
                              color: const Color(AppConstants.accentColor),
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: tagColor.withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            service.helperTag,
                            style: GoogleFonts.outfit(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              color: tagColor,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      service.subtitle,
                      style: GoogleFonts.outfit(
                        fontSize: 12.5,
                        height: 1.3,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey.shade700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Colors.grey.shade500),
            ],
          ),
        ),
      ),
    );
  }
}

class _SupportCard extends StatelessWidget {
  const _SupportCard({required this.onChat, required this.onSupport});
  final VoidCallback onChat;
  final VoidCallback onSupport;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: _kBrown.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.support_agent_rounded, color: _kBrown, size: 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Need Consultation?',
                  style: GoogleFonts.domine(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: const Color(AppConstants.accentColor),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Not sure what your pet needs? Connect with our customer support and get connected with vets for free.',
                  style: GoogleFonts.outfit(
                    fontSize: 12.5,
                    height: 1.35,
                    color: Colors.grey.shade700,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: onSupport,
                      style: FilledButton.styleFrom(
                        backgroundColor: _kBrown,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      icon: const Icon(Icons.call_rounded, size: 18, color: Colors.white),
                      label: Text(
                        'Connect Now',
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: onChat,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _kBrown,
                        side: BorderSide(color: _kBrown.withValues(alpha: 0.6)),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      icon: const Icon(Icons.chat_bubble_rounded, size: 18),
                      label: Text(
                        'Chat Support',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 12.5),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceDetails extends StatelessWidget {
  const _ServiceDetails({required this.service});

  final _ServiceItem? service;

  @override
  Widget build(BuildContext context) {
    final s = service;
    if (s == null) {
      return Center(
        child: Text('Select a service to continue.', style: GoogleFonts.outfit()),
      );
    }

    final includes = <String>[
      'Health checkup & vital assessment',
      'Diagnosis & treatment guidance',
      'Prescription & care advice',
      'Follow-up support',
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFDF9F4),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
          ),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: _kBrown.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(s.icon, color: _kBrown, size: 30),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.title,
                      style: GoogleFonts.domine(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: const Color(AppConstants.accentColor),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      s.subtitle,
                      style: GoogleFonts.outfit(
                        fontSize: 12.5,
                        height: 1.35,
                        color: Colors.grey.shade700,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'What’s included?',
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 10),
        ...includes.map((t) => _BulletRow(text: t)),
        const SizedBox(height: 16),
        Text(
          'Why choose PawSewa',
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 10),
        _TrustGrid(items: const [
          _TrustItem(Icons.verified_rounded, 'Verified vets'),
          _TrustItem(Icons.home_work_rounded, 'Home convenience'),
          _TrustItem(Icons.shield_rounded, 'Trusted support'),
          _TrustItem(Icons.timer_rounded, 'Fast assistance'),
        ]),
        const SizedBox(height: 24),
      ],
    );
  }
}

class _BulletRow extends StatelessWidget {
  const _BulletRow({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: _kBrown.withValues(alpha: 0.10),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded, size: 16, color: _kBrown),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.outfit(
                fontSize: 13,
                color: Colors.grey.shade800,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TrustGrid extends StatelessWidget {
  const _TrustGrid({required this.items});
  final List<_TrustItem> items;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.3,
      children: [
        for (final it in items)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: _kBrown.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(it.icon, color: _kBrown, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    it.label,
                    style: GoogleFonts.outfit(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.grey.shade800,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _PurposeSelection extends StatelessWidget {
  const _PurposeSelection({
    required this.serviceId,
    required this.selectedPurposeId,
    required this.purposes,
    required this.onSelect,
  });

  final String serviceId;
  final String? selectedPurposeId;
  final List<_PurposeItem> purposes;
  final void Function(_PurposeItem) onSelect;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          'What does your pet need today?',
          style: GoogleFonts.domine(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'This helps us match you with the right care.',
          style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 14),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.05,
          children: [
            for (final p in purposes)
              _PurposeCard(
                item: p,
                selected: p.id == selectedPurposeId,
                recommended: p.recommendedForServices.contains(serviceId),
                onTap: () => onSelect(p),
              ),
          ],
        ),
        const SizedBox(height: 80),
      ],
    );
  }
}

class _PurposeCard extends StatelessWidget {
  const _PurposeCard({
    required this.item,
    required this.selected,
    required this.recommended,
    required this.onTap,
  });

  final _PurposeItem item;
  final bool selected;
  final bool recommended;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final border = selected ? _kBrown : _kBrown.withValues(alpha: 0.10);
    final bg = selected ? _kBrown.withValues(alpha: 0.06) : Colors.white;
    final tagColor = item.isEmergency ? const Color(0xFFB71C1C) : _kBrown;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: border, width: selected ? 1.6 : 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 14,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: _kBrown.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(item.icon, color: _kBrown),
                  ),
                  const Spacer(),
                  if (recommended)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: tagColor.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        item.isEmergency ? 'URGENT' : 'Recommended',
                        style: GoogleFonts.outfit(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: tagColor,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                item.title,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: const Color(AppConstants.accentColor),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                item.subtitle,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  height: 1.25,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey.shade700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PetSelection extends StatelessWidget {
  const _PetSelection({
    required this.loading,
    required this.error,
    required this.pets,
    required this.selectedPetId,
    required this.onRetry,
    required this.onSelect,
  });

  final bool loading;
  final String? error;
  final List<dynamic> pets;
  final String? selectedPetId;
  final VoidCallback onRetry;
  final void Function(String id) onSelect;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: PawSewaLoader());
    }
    if (error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(error!, textAlign: TextAlign.center, style: GoogleFonts.outfit()),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: onRetry,
                style: FilledButton.styleFrom(backgroundColor: _kBrown),
                child: Text('Retry', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      );
    }
    if (pets.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No pets found. Please add a pet first.',
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade700),
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          'Select Pet',
          style: GoogleFonts.domine(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Choose who this visit is for.',
          style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 14),
        ...pets.map((raw) {
          if (raw is! Map) return const SizedBox.shrink();
          final pet = Map<String, dynamic>.from(raw);
          final id = (pet['_id'] ?? pet['id'] ?? '').toString();
          final name = (pet['name'] ?? 'Pet').toString();
          final breed = (pet['breed'] ?? '').toString();
          final age = (pet['age'] ?? pet['ageYears'] ?? '').toString();
          final gender = (pet['gender'] ?? '').toString();
          final photo = (pet['photoUrl'] ?? pet['imageUrl'] ?? '').toString();
          final selected = id == selectedPetId;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _PetCard(
              id: id,
              name: name,
              breed: breed,
              age: age,
              gender: gender,
              photoUrl: photo,
              selected: selected,
              onTap: () => onSelect(id),
            ),
          );
        }),
        const SizedBox(height: 80),
      ],
    );
  }
}

class _PetCard extends StatelessWidget {
  const _PetCard({
    required this.id,
    required this.name,
    required this.breed,
    required this.age,
    required this.gender,
    required this.photoUrl,
    required this.selected,
    required this.onTap,
  });

  final String id;
  final String name;
  final String breed;
  final String age;
  final String gender;
  final String photoUrl;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? _kBrown : _kBrown.withValues(alpha: 0.10),
              width: selected ? 1.6 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 14,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            children: [
              _PetAvatar(url: photoUrl, fallbackText: name.isNotEmpty ? name[0].toUpperCase() : '?'),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: const Color(AppConstants.accentColor),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        if (breed.isNotEmpty) breed,
                        if (age.isNotEmpty) '${age}y',
                        if (gender.isNotEmpty) gender,
                      ].join(' • '),
                      style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Icon(
                selected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                color: selected ? _kBrown : Colors.grey.shade400,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PetAvatar extends StatelessWidget {
  const _PetAvatar({required this.url, required this.fallbackText});
  final String url;
  final String fallbackText;

  @override
  Widget build(BuildContext context) {
    final u = url.trim();
    if (u.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: CachedNetworkImage(
          imageUrl: u,
          width: 52,
          height: 52,
          fit: BoxFit.cover,
          placeholder: (context, _) => _fallback(),
          errorWidget: (context, _, error) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() {
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        color: _kBrown.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Text(
          fallbackText,
          style: GoogleFonts.outfit(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: _kBrown,
          ),
        ),
      ),
    );
  }
}

class _VisitDetails extends StatelessWidget {
  const _VisitDetails({
    required this.emergency,
    required this.selectedDate,
    required this.selectedTimeWindow,
    required this.timeWindows,
    required this.onPickDate,
    required this.onPickTimeWindow,
    required this.symptoms,
    required this.showSymptoms,
    required this.onToggleSymptom,
    required this.notesController,
    required this.addressDetailsController,
    required this.mapController,
    required this.mapCenter,
    required this.confirmedLatLng,
    required this.confirmedAddress,
    required this.geoWarning,
    required this.gpsFetching,
    required this.confirmingLocation,
    required this.isInsideKathmandu,
    required this.onMapMoved,
    required this.onUseGps,
    required this.onConfirmLocation,
  });

  final bool emergency;
  final DateTime? selectedDate;
  final String? selectedTimeWindow;
  final List<String> timeWindows;
  final void Function(DateTime) onPickDate;
  final void Function(String?) onPickTimeWindow;

  final Set<String> symptoms;
  final bool showSymptoms;
  final void Function(String) onToggleSymptom;

  final TextEditingController notesController;
  final TextEditingController addressDetailsController;

  final MapController mapController;
  final LatLng mapCenter;
  final LatLng? confirmedLatLng;
  final String? confirmedAddress;
  final String? geoWarning;
  final bool gpsFetching;
  final bool confirmingLocation;
  final bool isInsideKathmandu;
  final void Function(LatLng center, bool byGesture) onMapMoved;
  final VoidCallback onUseGps;
  final VoidCallback onConfirmLocation;

  @override
  Widget build(BuildContext context) {
    final dateLabel = selectedDate == null ? 'Select date' : DateFormat('MMM d, yyyy').format(selectedDate!);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          emergency ? 'Urgent visit details' : 'Visit Details',
          style: GoogleFonts.domine(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          emergency
              ? 'Share a few details — we’ll prioritize faster help.'
              : 'Pick your preferred time and confirm your address.',
          style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 14),
        _FormCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Preferred date', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              InkWell(
                onTap: () async {
                  final now = DateTime.now();
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: selectedDate ?? now,
                    firstDate: now,
                    lastDate: now.add(const Duration(days: 90)),
                    builder: (context, child) {
                      return Theme(
                        data: Theme.of(context).copyWith(
                          colorScheme: ColorScheme.fromSeed(seedColor: _kBrown),
                        ),
                        child: child!,
                      );
                    },
                  );
                  if (picked != null) onPickDate(picked);
                },
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today_rounded, size: 18, color: _kBrown),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(dateLabel, style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: Colors.grey),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text('Preferred time', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              LayoutBuilder(
                builder: (context, constraints) {
                  return DropdownMenu<String>(
                    width: constraints.maxWidth,
                    initialSelection: selectedTimeWindow,
                    onSelected: onPickTimeWindow,
                    dropdownMenuEntries: timeWindows
                        .map((t) => DropdownMenuEntry<String>(value: t, label: t))
                        .toList(),
                    inputDecorationTheme: InputDecorationTheme(
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
        if (showSymptoms) ...[
          const SizedBox(height: 14),
          _FormCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Quick symptoms', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: const [
                    'Fever',
                    'Vomiting',
                    'Not Eating',
                    'Limping',
                    'Coughing',
                  ].map((s) {
                    final selected = symptoms.contains(s);
                    return FilterChip(
                      label: Text(s),
                      selected: selected,
                      onSelected: (_) => onToggleSymptom(s),
                      selectedColor: _kBrown.withValues(alpha: 0.18),
                      checkmarkColor: _kBrown,
                      labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 12),
                      side: BorderSide(color: _kBrown.withValues(alpha: 0.18)),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 14),
        _FormCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Address (Kathmandu Valley)', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                  if (!isInsideKathmandu)
                    Text(
                      'Kathmandu only',
                      style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.red.shade700),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 240,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Stack(
                    children: [
                      FlutterMap(
                        mapController: mapController,
                        options: MapOptions(
                          initialCenter: mapCenter,
                          initialZoom: 13,
                          onPositionChanged: (pos, hasGesture) {
                            onMapMoved(pos.center, hasGesture);
                          },
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            subdomains: const ['a', 'b', 'c'],
                            userAgentPackageName: 'com.pawsewa.user_app',
                          ),
                          if (confirmedLatLng != null)
                            MarkerLayer(
                              markers: [
                                Marker(
                                  point: confirmedLatLng!,
                                  width: 30,
                                  height: 38,
                                  alignment: Alignment.bottomCenter,
                                  child: const MapPinMarker(
                                    color: _kBrown,
                                    size: 30,
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                      IgnorePointer(
                        child: Center(
                          child: Transform.translate(
                            offset: const Offset(0, -22),
                            child: const MapPinMarker(color: _kBrown, size: 34),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: gpsFetching ? null : onUseGps,
                      icon: gpsFetching
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: PawSewaLoader(width: 32, center: false),
                            )
                          : const Icon(Icons.my_location_rounded),
                      label: Text(
                        gpsFetching ? 'Getting location…' : 'Use current location',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 12.5),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _kBrown,
                        side: BorderSide(color: _kBrown.withValues(alpha: 0.6)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  FilledButton.icon(
                    onPressed: confirmingLocation ? null : onConfirmLocation,
                    style: FilledButton.styleFrom(
                      backgroundColor: _kBrown,
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: confirmingLocation
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: PawSewaLoader(width: 36, center: false),
                          )
                        : const Icon(Icons.check_rounded, size: 18, color: Colors.white),
                    label: Text('Confirm', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                confirmedAddress != null && confirmedAddress!.trim().isNotEmpty
                    ? 'Selected: ${confirmedAddress!.trim()}'
                    : 'Pan the map to move the pin, then confirm the address.',
                style: GoogleFonts.outfit(fontSize: 11.5, color: Colors.grey.shade700, height: 1.35),
              ),
              if (geoWarning != null) ...[
                const SizedBox(height: 4),
                Text(
                  geoWarning!,
                  style: GoogleFonts.outfit(fontSize: 11.5, color: Colors.red.shade700, height: 1.35),
                ),
              ],
              const SizedBox(height: 14),
              Text('Extra location details (optional)', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              TextField(
                controller: addressDetailsController,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  hintText: 'Apartment, landmark, entrance instructions…',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  prefixIcon: const Icon(Icons.location_on_rounded, color: _kBrown),
                ),
              ),
              const SizedBox(height: 14),
              Text('Notes (optional)', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              TextField(
                controller: notesController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Any details that help the vet prepare…',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 80),
      ],
    );
  }
}

class _FormCard extends StatelessWidget {
  const _FormCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 16,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _PricingScreen extends StatelessWidget {
  const _PricingScreen({
    required this.serviceType,
    required this.purpose,
    required this.emergency,
    required this.selectedVaccines,
    required this.vaccineCatalog,
    required this.consultationFee,
    required this.visitCharge,
  });

  final String? serviceType;
  final _PurposeItem? purpose;
  final bool emergency;
  final List<String> selectedVaccines;
  final List<_VaccineItem> vaccineCatalog;
  final int consultationFee;
  final int visitCharge;

  @override
  Widget build(BuildContext context) {
    // UI-only estimate. Backend pricing is unchanged; this is contextual presentation.
    final consult = emergency ? max(consultationFee, 600) : consultationFee;
    final visit = (serviceType ?? '').toLowerCase().contains('online')
        ? 0
        : (emergency ? max(visitCharge, 350) : visitCharge);

    final selected = vaccineCatalog.where((v) => selectedVaccines.contains(v.id)).toList();
    final vaccineTotal = selected.fold<int>(0, (sum, v) => sum + v.price);
    final discount = 0;
    final total = consult + visit + vaccineTotal - discount;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          'Transparent pricing',
          style: GoogleFonts.domine(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'A clear breakdown before you confirm.',
          style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 14),
        _FormCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Service Summary',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 14),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: _kBrown.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Estimate',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 10.5, color: _kBrown),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _priceRow('Consultation fee', consult),
              if (selected.isNotEmpty) ...[
                for (final v in selected) _priceRow(v.name, v.price),
              ] else if (purpose?.id == 'vaccination') ...[
                _priceRow('Selected vaccines', 0, subtle: true),
              ],
              if (visit > 0) _priceRow('Visit charge', visit),
              if (discount > 0) _priceRow('Discount', -discount, highlight: true),
              const Divider(height: 24),
              _priceRow('Total', total, bold: true),
              const SizedBox(height: 8),
              Text(
                'Final charges may vary based on your pet’s needs and vet guidance.',
                style: GoogleFonts.outfit(fontSize: 11.5, color: Colors.grey.shade700, height: 1.35),
              ),
            ],
          ),
        ),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _priceRow(String label, int amount, {bool bold = false, bool highlight = false, bool subtle = false}) {
    final c = highlight
        ? const Color(0xFF2E7D32)
        : subtle
            ? Colors.grey.shade600
            : Colors.grey.shade900;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: Colors.grey.shade700,
              ),
            ),
          ),
          Text(
            amount == 0 && subtle ? 'Varies' : 'Rs. ${amount.abs()}${amount < 0 ? ' off' : ''}',
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: bold ? FontWeight.w900 : FontWeight.w800,
              color: bold ? _kBrown : c,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewScreen extends StatelessWidget {
  const _ReviewScreen({
    required this.serviceType,
    required this.purpose,
    required this.pet,
    required this.date,
    required this.timeWindow,
    required this.address,
    required this.addressDetails,
    required this.notes,
    required this.symptoms,
    required this.emergency,
  });

  final String? serviceType;
  final _PurposeItem? purpose;
  final Map<String, dynamic>? pet;
  final DateTime? date;
  final String? timeWindow;
  final String? address;
  final String addressDetails;
  final String notes;
  final List<String> symptoms;
  final bool emergency;

  @override
  Widget build(BuildContext context) {
    final dateLine = date == null ? '—' : DateFormat('MMM d, yyyy').format(date!);
    final addressLine = (address ?? '').trim().isEmpty ? '—' : (address ?? '').trim();
    final details = addressDetails.isEmpty ? null : addressDetails;
    final petName = pet?['name']?.toString() ?? '—';
    final service = serviceType ?? '—';
    final purposeLine = purpose?.title ?? '—';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          'Review your booking',
          style: GoogleFonts.domine(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          emergency
              ? 'We’ll prioritize urgent help as soon as you confirm.'
              : 'Please confirm everything looks right.',
          style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 14),
        _FormCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _kv('Service', service, bold: true),
              _kv('Purpose', purposeLine),
              _kv('Pet', petName),
              _kv('Date', dateLine),
              _kv('Time', timeWindow ?? '—'),
              _kv('Address', addressLine),
              if (details != null) _kv('Address details', details),
              if (symptoms.isNotEmpty) _kv('Symptoms', symptoms.join(', ')),
              if (notes.trim().isNotEmpty) _kv('Notes', notes.trim()),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFDF9F4),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: _kBrown.withValues(alpha: 0.10)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _kBrown.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(emergency ? Icons.emergency_rounded : Icons.verified_rounded, color: _kBrown),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  emergency
                      ? 'Emergency bookings are prioritized. If your pet’s condition worsens, contact support immediately.'
                      : 'Verified vets and caring support — you’ll get updates as soon as a vet is assigned.',
                  style: GoogleFonts.outfit(fontSize: 12.5, height: 1.35, color: Colors.grey.shade800, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _kv(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.grey.shade700, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.outfit(
                fontSize: 12.5,
                height: 1.35,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
                color: Colors.grey.shade900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SuccessScreen extends StatelessWidget {
  const _SuccessScreen({required this.onDone, required this.onSupport});
  final VoidCallback onDone;
  final VoidCallback onSupport;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 92,
              height: 92,
              decoration: BoxDecoration(
                color: const Color(0xFF2E7D32).withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded, color: Color(0xFF2E7D32), size: 54),
            ),
            const SizedBox(height: 18),
            Text(
              'Booking Confirmed!',
              style: GoogleFonts.domine(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: const Color(AppConstants.accentColor),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'We’ll notify you once a vet is assigned and on the way.',
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(fontSize: 13, height: 1.4, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onSupport,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kBrown,
                      side: BorderSide(color: _kBrown.withValues(alpha: 0.6)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text('Need help?', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: onDone,
                    style: FilledButton.styleFrom(
                      backgroundColor: _kBrown,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text('View appointments', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _VaccineSelection extends StatelessWidget {
  const _VaccineSelection({
    required this.pet,
    required this.selectedIds,
    required this.onToggle,
    required this.items,
    required this.consultationFee,
    required this.visitCharge,
  });

  final Map<String, dynamic>? pet;
  final Set<String> selectedIds;
  final void Function(String id) onToggle;
  final List<_VaccineItem> items;
  final int consultationFee;
  final int visitCharge;

  DateTime? _parseDob() {
    final raw = pet?['dob'];
    if (raw == null) return null;
    if (raw is DateTime) return raw;
    return DateTime.tryParse(raw.toString());
  }

  int? _ageDays(DateTime today) {
    final dob = _parseDob();
    if (dob == null) return null;
    final d0 = DateTime(dob.year, dob.month, dob.day);
    final t0 = DateTime(today.year, today.month, today.day);
    return t0.difference(d0).inDays;
  }

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final petName = (pet?['name'] ?? 'your pet').toString();
    final ageDays = _ageDays(today);
    final selected = items.where((v) => selectedIds.contains(v.id)).toList();
    final vaccineTotal = selected.fold<int>(0, (sum, v) => sum + v.price);
    final total = consultationFee + visitCharge + vaccineTotal;

    ({String text, _EligibilityState state, bool enabled}) eligibilityFor(_VaccineItem v) {
      if (ageDays == null) {
        return (text: 'Add date of birth for eligibility', state: _EligibilityState.info, enabled: true);
      }
      final dueIn = v.dueAtDays - ageDays;
      if (dueIn > 0) {
        // Not yet eligible – do not allow selecting this vaccine.
        return (
          text: 'Eligible ${DogVaccinationSchedule.humanizeDueDeltaDays(dueIn)}',
          state: _EligibilityState.notEligible,
          enabled: false
        );
      }
      if (dueIn == 0) {
        return (text: 'Eligible today', state: _EligibilityState.dueToday, enabled: true);
      }
      final overdue = -dueIn;
      if (overdue <= 0) {
        return (text: 'Eligible now', state: _EligibilityState.eligible, enabled: true);
      }
      return (
        text: 'Overdue by ${DogVaccinationSchedule.humanizeOverdueDays(overdue)}',
        state: _EligibilityState.overdue,
        enabled: true
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          'Recommended vaccines',
          style: GoogleFonts.domine(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(AppConstants.accentColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Select what $petName needs — pricing updates as you choose.',
          style: GoogleFonts.outfit(
            fontSize: 12.5,
            color: Colors.grey.shade700,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 14),
        for (final v in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _VaccineSelectCard(
              item: v,
              selected: selectedIds.contains(v.id),
              eligibility: eligibilityFor(v),
              onTap: () {
                final e = eligibilityFor(v);
                if (!e.enabled) return;
                onToggle(v.id);
              },
            ),
          ),
        const SizedBox(height: 10),
        _FormCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Pricing summary',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 14),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: _kBrown.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Estimate',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 10.5, color: _kBrown),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _MiniPriceRow('Consultation fee', consultationFee),
              _MiniPriceRow('Home visit charge', visitCharge),
              if (selected.isEmpty)
                Text(
                  'Choose at least one vaccine to see the total.',
                  style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.grey.shade700),
                )
              else ...[
                const SizedBox(height: 8),
                for (final s in selected) _MiniPriceRow(s.name, s.price),
                const Divider(height: 22),
                _MiniPriceRow('Total', total, bold: true),
              ],
              const SizedBox(height: 8),
              Text(
                'Final vaccine selection can be confirmed by the vet after assessment.',
                style: GoogleFonts.outfit(fontSize: 11.5, color: Colors.grey.shade700, height: 1.35),
              ),
            ],
          ),
        ),
        const SizedBox(height: 80),
      ],
    );
  }
}

class _MiniPriceRow extends StatelessWidget {
  const _MiniPriceRow(this.label, this.amount, {this.bold = false});
  final String label;
  final int amount;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 12.5,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w600,
                color: Colors.grey.shade700,
              ),
            ),
          ),
          Text(
            'Rs. $amount',
            style: GoogleFonts.outfit(
              fontSize: 12.5,
              fontWeight: bold ? FontWeight.w900 : FontWeight.w800,
              color: bold ? _kBrown : Colors.grey.shade900,
            ),
          ),
        ],
      ),
    );
  }
}

class _VaccineSelectCard extends StatelessWidget {
  const _VaccineSelectCard({
    required this.item,
    required this.selected,
    required this.eligibility,
    required this.onTap,
  });

  final _VaccineItem item;
  final bool selected;
  final ({String text, _EligibilityState state, bool enabled}) eligibility;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    Color chipBg;
    Color chipFg;
    switch (eligibility.state) {
      case _EligibilityState.notEligible:
        chipBg = Colors.grey.shade200;
        chipFg = Colors.grey.shade700;
        break;
      case _EligibilityState.dueToday:
        chipBg = const Color(0xFFFFF8E1);
        chipFg = const Color(0xFF8D6E63);
        break;
      case _EligibilityState.overdue:
        chipBg = const Color(0xFFFFEBEE);
        chipFg = const Color(0xFFB71C1C);
        break;
      case _EligibilityState.eligible:
        chipBg = _kBrown.withValues(alpha: 0.12);
        chipFg = _kBrown;
        break;
      case _EligibilityState.info:
        chipBg = _kBrown.withValues(alpha: 0.10);
        chipFg = _kBrown;
        break;
    }

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? _kBrown : _kBrown.withValues(alpha: 0.12),
              width: selected ? 1.6 : 1,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _kBrown.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.vaccines_rounded, color: _kBrown),
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
                            item.name,
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: const Color(AppConstants.accentColor),
                            ),
                          ),
                        ),
                        Text(
                          'Rs. ${item.price}',
                          style: GoogleFonts.outfit(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w900,
                            color: _kBrown,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      item.description,
                      style: GoogleFonts.outfit(
                        fontSize: 12.5,
                        height: 1.3,
                        color: Colors.grey.shade700,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: chipBg,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            eligibility.text,
                            style: GoogleFonts.outfit(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              color: chipFg,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Icon(
                          selected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                          color: selected
                              ? _kBrown
                              : (eligibility.enabled ? Colors.grey.shade400 : Colors.grey.shade300),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum _EligibilityState { notEligible, eligible, dueToday, overdue, info }

class _VaccineItem {
  const _VaccineItem({
    required this.id,
    required this.name,
    required this.description,
    required this.dueAtDays,
    required this.price,
  });

  final String id;
  final String name;
  final String description;
  final int dueAtDays;
  final int price;
}

class _ServiceItem {
  const _ServiceItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.helperTag,
    required this.serviceType,
    this.isEmergency = false,
  });

  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final String helperTag;
  final String serviceType;
  final bool isEmergency;
}

class _PurposeItem {
  const _PurposeItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.recommendedForServices,
    this.isEmergency = false,
  });

  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final Set<String> recommendedForServices;
  final bool isEmergency;
}

class _TrustItem {
  const _TrustItem(this.icon, this.label);
  final IconData icon;
  final String label;
}

class _StepDot {
  const _StepDot(this.label, this.step);
  final String label;
  final _BookingStep step;
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

