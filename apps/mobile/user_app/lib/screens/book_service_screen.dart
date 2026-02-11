import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../core/constants.dart';

class BookServiceScreen extends StatefulWidget {
  const BookServiceScreen({super.key});

  @override
  State<BookServiceScreen> createState() => _BookServiceScreenState();
}

class _BookServiceScreenState extends State<BookServiceScreen> {
  final _apiClient = ApiClient();
  final _notesController = TextEditingController();
  final _locationController = TextEditingController();
  final _pageController = PageController();
  final MapController _mapController = MapController();

  int _currentStep = 0;
  List<dynamic> _pets = [];
  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _isConfirmingLocation = false;

  String? _selectedPetId;
  String? _selectedServiceType;
  DateTime? _selectedDate;
  String? _selectedTimeWindow;
  LatLng _mapCenter = const LatLng(27.7, 85.32);
  LatLng? _confirmedLatLng;
  String? _confirmedAddress;
  String? _geoWarning;

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

  final List<Map<String, dynamic>> _serviceTypes = [
    {
      'type': 'Appointment',
      'icon': Icons.calendar_today,
      'description': 'Schedule a consultation with our veterinarians',
      'color': Colors.blue,
    },
    {
      'type': 'Health Checkup',
      'icon': Icons.health_and_safety,
      'description': 'Comprehensive health examination for your pet',
      'color': Colors.green,
    },
    {
      'type': 'Vaccination',
      'icon': Icons.vaccines,
      'description': 'Keep your pet protected with timely vaccinations',
      'color': Colors.orange,
    },
  ];

  final List<String> _timeWindows = const [
    'Morning (9am-12pm)',
    'Afternoon (12pm-4pm)',
    'Evening (4pm-8pm)',
  ];

  @override
  void initState() {
    super.initState();
    _loadPets();
  }

  @override
  void dispose() {
    _notesController.dispose();
    _locationController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadPets() async {
    try {
      final response = await _apiClient.getMyPets();
      if (response.statusCode == 200) {
        if (!mounted) return;
        setState(() {
          _pets = response.data['data'] ?? [];
          _isLoading = false;
        });
      } else {
        if (!mounted) return;
        setState(() => _isLoading = false);
        _showError('Failed to load pets (status: ${response.statusCode}).');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError('Failed to load pets: $e');
    }
  }

  Future<void> _submitRequest() async {
    if (_selectedPetId == null ||
        _selectedServiceType == null ||
        _selectedDate == null ||
        _selectedTimeWindow == null) {
      _showError('Please complete all steps before submitting.');
      return;
    }

    if (_confirmedLatLng == null ||
        _confirmedAddress == null ||
        _confirmedAddress!.isEmpty) {
      _showError('Please confirm your location on the map.');
      return;
    }

    if (!_isInsideKathmandu) {
      _showError('Service is restricted to Kathmandu Valley.');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final extraLocationDetails = _locationController.text.trim();
      final combinedAddress = extraLocationDetails.isEmpty
          ? _confirmedAddress!
          : '${_confirmedAddress!}\nDetails: $extraLocationDetails';

      final response = await _apiClient.createServiceRequest({
        'petId': _selectedPetId,
        'serviceType': _selectedServiceType,
        'preferredDate': DateFormat('yyyy-MM-dd').format(_selectedDate!),
        'timeWindow': _selectedTimeWindow,
        'notes': _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
        'location': {
          'address': combinedAddress,
          'coordinates': {
            'lat': _confirmedLatLng!.latitude,
            'lng': _confirmedLatLng!.longitude,
          },
        },
      });

      if (response.statusCode == 201) {
        if (!mounted) return;
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.green.shade100,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.check_circle,
                    color: Colors.green.shade700,
                    size: 32,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Request Submitted!',
                    style: TextStyle(fontSize: 20),
                  ),
                ),
              ],
            ),
            content: Text(
              'Your service request has been submitted and is now in Pending Review. You will be notified once a partner is assigned.',
              style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[700]),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop(); // Close dialog
                  Navigator.of(context).pop(); // Go back
                },
                child: Text(
                  'OK',
                  style: GoogleFonts.poppins(
                    color: const Color(AppConstants.primaryColor),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        );
      } else {
        // Show server message when present (e.g. "A request for this pet is already under review for this date.")
        final data = response.data;
        final String message = (data is Map && data['message'] != null)
            ? data['message'].toString()
            : 'Failed to submit request (status: ${response.statusCode}).';
        _showError(message);
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      final String message = (data is Map && data['message'] != null)
          ? data['message'].toString()
          : (e.message ?? 'Failed to submit request.');
      _showError(message);
    } catch (e) {
      _showError('Failed to submit request: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.poppins()),
        backgroundColor: Colors.red,
      ),
    );
  }

  Future<void> _confirmLocation() async {
    setState(() {
      _isConfirmingLocation = true;
      _geoWarning = null;
    });

    try {
      final dio = Dio(
        BaseOptions(
          baseUrl: 'https://nominatim.openstreetmap.org',
          headers: const {
            // IMPORTANT: keep a real app identifier for Nominatim
            'User-Agent': 'PawSewa Mobile App (pawsewa.app)',
          },
        ),
      );

      final response = await dio.get(
        '/reverse',
        queryParameters: {
          'format': 'jsonv2',
          'lat': _mapCenter.latitude.toString(),
          'lon': _mapCenter.longitude.toString(),
        },
      );

      final data = response.data as Map<String, dynamic>;
      final address = (data['display_name'] as String?) ?? 'Unknown address';

      final lat = _mapCenter.latitude;
      final lng = _mapCenter.longitude;
      final insideKathmandu =
          lat >= _minLat && lat <= _maxLat && lng >= _minLng && lng <= _maxLng;

      setState(() {
        _confirmedLatLng = _mapCenter;
        _confirmedAddress = address;
        _geoWarning = insideKathmandu
            ? null
            : 'Service restricted to Kathmandu Valley. Please move the pin inside the boundary.';
      });
    } catch (e) {
      _showError('Failed to confirm location: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isConfirmingLocation = false;
        });
      } else {
        _isConfirmingLocation = false;
      }
    }
  }

  void _goToStep(int step) {
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeInOut,
    );
  }

  Widget _buildStepIndicator() {
    const labels = ['Pet', 'Service', 'Details'];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: List.generate(labels.length, (i) {
          final isActive = i == _currentStep;
          final isCompleted = i < _currentStep;
          final color = isActive || isCompleted
              ? const Color(AppConstants.primaryColor)
              : Colors.grey.shade400;

          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 2,
                        color: i == 0 ? Colors.transparent : color,
                      ),
                    ),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          '${i + 1}',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: Container(
                        height: 2,
                        color: i == labels.length - 1
                            ? Colors.transparent
                            : color,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  labels[i],
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                    color: isActive
                        ? const Color(AppConstants.primaryColor)
                        : Colors.grey[700],
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildPetStep() {
    if (_pets.isEmpty) {
      return Center(
        child: Text(
          'No pets found. Please add a pet first.',
          textAlign: TextAlign.center,
          style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[700]),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _pets.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final pet = _pets[index] as Map<String, dynamic>;
        final id = (pet['_id'] ?? pet['id'] ?? '').toString();
        final name = (pet['name'] ?? 'Unnamed').toString();
        final breed = (pet['breed'] ?? '').toString();
        final isSelected = _selectedPetId == id;

        return InkWell(
          onTap: () {
            setState(() => _selectedPetId = id);
            _goToStep(1);
          },
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected
                    ? const Color(AppConstants.primaryColor)
                    : Colors.grey.shade300,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(
                      AppConstants.primaryColor,
                    ).withValues(alpha: 26 / 255),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.pets,
                    color: Color(AppConstants.primaryColor),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey[900],
                        ),
                      ),
                      if (breed.isNotEmpty)
                        Text(
                          breed,
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: Colors.grey[700],
                          ),
                        ),
                    ],
                  ),
                ),
                Icon(
                  isSelected
                      ? Icons.check_circle
                      : Icons.radio_button_unchecked,
                  color: isSelected
                      ? const Color(AppConstants.primaryColor)
                      : Colors.grey.shade400,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildServiceTypeStep() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _serviceTypes.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final item = _serviceTypes[index];
        final type = item['type'] as String;
        final icon = item['icon'] as IconData;
        final description = item['description'] as String;
        final color = item['color'] as Color;
        final isSelected = _selectedServiceType == type;

        return InkWell(
          onTap: () {
            setState(() => _selectedServiceType = type);
            _goToStep(2);
          },
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected
                    ? const Color(AppConstants.primaryColor)
                    : Colors.grey.shade300,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 31 / 255),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        type,
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey[900],
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        description,
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: Colors.grey[700],
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  isSelected
                      ? Icons.check_circle
                      : Icons.radio_button_unchecked,
                  color: isSelected
                      ? const Color(AppConstants.primaryColor)
                      : Colors.grey.shade400,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailsStep() {
    final dateLabel = _selectedDate == null
        ? 'Select date'
        : DateFormat('MMM d, yyyy').format(_selectedDate!);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Preferred date',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          InkWell(
            onTap: () async {
              final now = DateTime.now();
              final picked = await showDatePicker(
                context: context,
                initialDate: _selectedDate ?? now,
                firstDate: now,
                lastDate: now.add(const Duration(days: 90)),
                builder: (context, child) {
                  return Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: ColorScheme.fromSeed(
                        seedColor: const Color(AppConstants.primaryColor),
                      ),
                    ),
                    child: child!,
                  );
                },
              );
              if (picked != null) {
                setState(() => _selectedDate = picked);
              }
            },
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.calendar_today,
                    color: Color(AppConstants.primaryColor),
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      dateLabel,
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        color: Colors.grey[900],
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.grey),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Time window',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          LayoutBuilder(
            builder: (context, constraints) {
              return DropdownMenu<String>(
                width: constraints.maxWidth,
                initialSelection: _selectedTimeWindow,
                onSelected: (v) => setState(() => _selectedTimeWindow = v),
                dropdownMenuEntries: _timeWindows
                    .map((t) => DropdownMenuEntry<String>(value: t, label: t))
                    .toList(),
                inputDecorationTheme: InputDecorationTheme(
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Service location (Kathmandu Valley)',
                style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
              ),
              if (!_isInsideKathmandu)
                Row(
                  children: [
                    const Icon(Icons.info_outline, size: 16, color: Colors.red),
                    const SizedBox(width: 4),
                    Text(
                      'Kathmandu only',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        color: Colors.red,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 260,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: _mapCenter,
                      initialZoom: 13,
                      onPositionChanged: (position, hasGesture) {
                        final center = position.center;
                        setState(() {
                          _mapCenter = center;
                        });
                      },
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        subdomains: const ['a', 'b', 'c'],
                        userAgentPackageName: 'com.pawsewa.user_app',
                      ),
                      if (_confirmedLatLng != null)
                        MarkerLayer(
                          markers: [
                            Marker(
                              point: _confirmedLatLng!,
                              width: 30,
                              height: 30,
                              child: const Icon(
                                Icons.location_on,
                                color: Color(AppConstants.primaryColor),
                                size: 30,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                  // Fixed center pin
                  IgnorePointer(
                    child: Center(
                      child: Transform.translate(
                        offset: const Offset(0, -18),
                        child: Icon(
                          Icons.location_on,
                          color: const Color(AppConstants.primaryColor),
                          size: 34,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pan the map to move the pin, then confirm to lock the address.',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        color: Colors.grey[800],
                      ),
                    ),
                    if (_confirmedAddress != null &&
                        _confirmedAddress!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Selected: $_confirmedAddress',
                          style: GoogleFonts.poppins(
                            fontSize: 11,
                            color: Colors.grey[900],
                          ),
                        ),
                      ),
                    if (_geoWarning != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          _geoWarning!,
                          style: GoogleFonts.poppins(
                            fontSize: 11,
                            color: Colors.red[700],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: _isConfirmingLocation ? null : _confirmLocation,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AppConstants.primaryColor),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: _isConfirmingLocation
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check),
                label: Text(
                  'Confirm location',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Extra location details (optional)',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _locationController,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              hintText: 'Apartment, landmark, entrance instructions...',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              prefixIcon: const Icon(
                Icons.location_on,
                color: Color(AppConstants.primaryColor),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Notes (optional)',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _notesController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Any additional details for the partner',
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
            ),
          ),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    final isLast = _currentStep == 2;
    final canGoBack = _currentStep > 0;

    bool canContinue() {
      if (_currentStep == 0) return _selectedPetId != null;
      if (_currentStep == 1) return _selectedServiceType != null;
      if (_currentStep == 2) {
        // Require confirmed location inside Kathmandu for final submission
        if (_isConfirmingLocation) return false;
        if (_confirmedLatLng == null ||
            _confirmedAddress == null ||
            _confirmedAddress!.isEmpty) {
          return false;
        }
        if (!_isInsideKathmandu) return false;
      }
      return true;
    }

    final nextEnabled = canContinue();

    return SafeArea(
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
                onPressed: canGoBack ? () => _goToStep(_currentStep - 1) : null,
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.grey.shade300),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Back',
                  style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: (!nextEnabled || _isSubmitting)
                    ? null
                    : () {
                        if (isLast) {
                          _submitRequest();
                        } else {
                          _goToStep(_currentStep + 1);
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AppConstants.primaryColor),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        isLast ? 'Submit' : 'Next',
                        style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          'Book Service',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(AppConstants.primaryColor),
              ),
            )
          : Column(
              children: [
                _buildStepIndicator(),
                Expanded(
                  child: PageView(
                    controller: _pageController,
                    physics: const NeverScrollableScrollPhysics(),
                    onPageChanged: (i) => setState(() => _currentStep = i),
                    children: [
                      _buildPetStep(),
                      _buildServiceTypeStep(),
                      _buildDetailsStep(),
                    ],
                  ),
                ),
              ],
            ),
      bottomNavigationBar: _isLoading ? null : _buildBottomBar(),
    );
  }
}
