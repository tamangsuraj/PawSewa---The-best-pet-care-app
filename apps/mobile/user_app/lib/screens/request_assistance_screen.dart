import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../core/constants.dart';

class RequestAssistanceScreen extends StatefulWidget {
  const RequestAssistanceScreen({super.key});

  @override
  State<RequestAssistanceScreen> createState() => _RequestAssistanceScreenState();
}

class _RequestAssistanceScreenState extends State<RequestAssistanceScreen> {
  final _formKey = GlobalKey<FormState>();
  final _apiClient = ApiClient();
  final _issueController = TextEditingController();
  final _locationDetailsController = TextEditingController();

  List<dynamic> _pets = [];
  String? _selectedPetId;
  bool _isLoading = false;
  bool _loadingPets = true;

  // Map / geofencing state
  final MapController _mapController = MapController();
  LatLng _mapCenter = const LatLng(27.7, 85.32);
  LatLng? _confirmedLatLng;
  String? _confirmedAddress;
  String? _geoWarning;
  bool _isConfirmingLocation = false;

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

  @override
  void initState() {
    super.initState();
    _loadPets();
  }

  @override
  void dispose() {
    _issueController.dispose();
    _locationDetailsController.dispose();
    super.dispose();
  }

  Future<void> _loadPets() async {
    try {
      final response = await _apiClient.getPets();
      if (response.statusCode == 200) {
        setState(() {
          _pets = response.data['data'] ?? [];
          _loadingPets = false;
        });
      }
    } catch (e) {
      setState(() {
        _loadingPets = false;
      });
      _showError('Failed to load pets: $e');
    }
  }

  Future<void> _confirmLocation() async {
    setState(() {
      _isConfirmingLocation = true;
      _geoWarning = null;
    });

    try {
      final lat = _mapCenter.latitude;
      final lng = _mapCenter.longitude;

      final dio = Dio();
      final response = await dio.get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {
          'format': 'jsonv2',
          'lat': lat,
          'lon': lng,
        },
        options: Options(
          headers: const {
            'User-Agent': 'PawSewa Mobile App (pawsewa.app)',
          },
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        final displayName = response.data['display_name'] as String?;
        setState(() {
          _confirmedLatLng = LatLng(lat, lng);
          _confirmedAddress = displayName ?? 'Pinned location ($lat, $lng)';
          if (!_isInsideKathmandu) {
            _geoWarning =
                'This location appears to be outside Kathmandu Valley. Emergency service may not be available.';
          } else {
            _geoWarning = null;
          }
        });
      } else {
        _showError('Failed to confirm location. Please try again.');
      }
    } catch (e) {
      _showError('Failed to confirm location: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isConfirmingLocation = false;
        });
      }
    }
  }

  Future<void> _submitRequest() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_selectedPetId == null) {
      _showError('Please select a pet');
      return;
    }

    if (_confirmedLatLng == null || _confirmedAddress == null || _confirmedAddress!.isEmpty) {
      _showError('Please confirm your location on the map.');
      return;
    }

    if (!_isInsideKathmandu) {
      _showError('Emergency assistance is currently limited to Kathmandu Valley.');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final extraLocationDetails = _locationDetailsController.text.trim();
      final combinedAddress = extraLocationDetails.isEmpty
          ? _confirmedAddress!
          : '${_confirmedAddress!}\nDetails: $extraLocationDetails';

      final response = await _apiClient.createCase({
        'petId': _selectedPetId,
        'issueDescription': _issueController.text.trim(),
        'location': {
          'address': combinedAddress,
          'coordinates': {
            'lat': _confirmedLatLng!.latitude,
            'lng': _confirmedLatLng!.longitude,
          },
        },
      });

      if (response.statusCode == 201) {
        if (mounted) {
          // Show success dialog
          showDialog(
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
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Case submitted! Our team is assigning the best available Veterinarian to you.',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: Colors.grey[700],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(AppConstants.primaryColor), width: 2),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          color: Color(AppConstants.primaryColor),
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'You will be notified once a veterinarian is assigned.',
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: Colors.grey[800],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.of(context).pop(); // Close dialog
                    Navigator.of(context).pop(); // Go back to dashboard
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
        }
      }
    } catch (e) {
      _showError('Failed to submit request: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message, style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          'Request Assistance',
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
          : _pets.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.pets, size: 64, color: Colors.grey),
                      const SizedBox(height: 16),
                      Text(
                        'No pets registered',
                        style: GoogleFonts.poppins(
                          fontSize: 18,
                          color: Colors.grey[600],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Please add a pet first',
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
                  ),
                )
              : Form(
                  key: _formKey,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Info Card
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(AppConstants.primaryColor), width: 2),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.info_outline, color: const Color(AppConstants.primaryColor)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'Our team will assign the best available veterinarian to your case.',
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    color: Colors.grey[800],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Select Pet
                        Text(
                          'Select Pet',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: const Color(AppConstants.accentColor),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedPetId,
                            decoration: InputDecoration(
                              prefixIcon: const Icon(
                                Icons.pets,
                                color: Color(AppConstants.primaryColor),
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                                borderSide: BorderSide.none,
                              ),
                              filled: true,
                              fillColor: Colors.white,
                            ),
                            hint: Text(
                              'Choose your pet',
                              style: GoogleFonts.poppins(),
                            ),
                            items: _pets.map((pet) {
                              return DropdownMenuItem<String>(
                                value: pet['_id'],
                                child: Row(
                                  children: [
                                    if (pet['image'] != null)
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: Image.network(
                                          pet['image'],
                                          width: 32,
                                          height: 32,
                                          fit: BoxFit.cover,
                                        ),
                                      )
                                    else
                                      Container(
                                        width: 32,
                                        height: 32,
                                        decoration: BoxDecoration(
                                          color: const Color(AppConstants.primaryColor)
                                              .withValues(alpha: 26 / 255),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: const Icon(
                                          Icons.pets,
                                          size: 20,
                                          color: Color(AppConstants.primaryColor),
                                        ),
                                      ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            pet['name'] ?? 'Unknown',
                                            style: GoogleFonts.poppins(
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                          Text(
                                            '${pet['breed']} • ${pet['age']} years',
                                            style: GoogleFonts.poppins(
                                              fontSize: 12,
                                              color: Colors.grey[600],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                            onChanged: (value) {
                              setState(() {
                                _selectedPetId = value;
                              });
                            },
                            validator: (value) =>
                                value == null ? 'Please select a pet' : null,
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Issue Description
                        Text(
                          'Describe the Issue',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: const Color(AppConstants.accentColor),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _issueController,
                          maxLines: 5,
                          maxLength: 1000,
                          style: GoogleFonts.poppins(),
                          decoration: InputDecoration(
                            hintText: 'Describe what\'s wrong with your pet...',
                            hintStyle: GoogleFonts.poppins(color: Colors.grey[400]),
                            prefixIcon: const Padding(
                              padding: EdgeInsets.only(bottom: 80),
                              child: Icon(
                                Icons.description,
                                color: Color(AppConstants.primaryColor),
                              ),
                            ),
                            filled: true,
                            fillColor: Colors.white,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please describe the issue';
                            }
                            if (value.trim().length < 10) {
                              return 'Please provide more details (at least 10 characters)';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 24),

                        // Location with map pin + extra details
                        Text(
                          'Your Location (Kathmandu Valley)',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: const Color(AppConstants.accentColor),
                          ),
                        ),
                        const SizedBox(height: 12),
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
                                    onPositionChanged: (pos, hasGesture) {
                                      final center = pos.center;
                                      setState(() {
                                        _mapCenter = center;
                                      });
                                    },
                                  ),
                                  children: [
                                    TileLayer(
                                      urlTemplate:
                                          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
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
                              onPressed:
                                  _isConfirmingLocation ? null : _confirmLocation,
                              style: ElevatedButton.styleFrom(
                                backgroundColor:
                                    const Color(AppConstants.primaryColor),
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
                                'Confirm',
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
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey[800],
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _locationDetailsController,
                          maxLines: 2,
                          style: GoogleFonts.poppins(),
                          decoration: InputDecoration(
                            hintText: 'Apartment, landmark, entrance instructions...',
                            hintStyle: GoogleFonts.poppins(color: Colors.grey[400]),
                            prefixIcon: const Icon(
                              Icons.notes,
                              color: Color(AppConstants.primaryColor),
                            ),
                            filled: true,
                            fillColor: Colors.white,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                        const SizedBox(height: 32),

                        // Submit Button
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _submitRequest,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(AppConstants.primaryColor),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: _isLoading
                                ? const CircularProgressIndicator(color: Colors.white)
                                : Text(
                                    'Request Assistance',
                                    style: GoogleFonts.poppins(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
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
