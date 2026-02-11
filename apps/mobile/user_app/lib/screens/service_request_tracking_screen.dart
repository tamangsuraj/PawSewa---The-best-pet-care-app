import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';

import '../core/api_client.dart';
import '../core/constants.dart';

const double _arrivalRadiusMeters = 150;
const double _metersPerMinuteDriving = 400; // rough

class ServiceRequestTrackingScreen extends StatefulWidget {
  final String requestId;
  final String? initialServiceType;

  const ServiceRequestTrackingScreen({
    super.key,
    required this.requestId,
    this.initialServiceType,
  });

  @override
  State<ServiceRequestTrackingScreen> createState() =>
      _ServiceRequestTrackingScreenState();
}

class _ServiceRequestTrackingScreenState
    extends State<ServiceRequestTrackingScreen> {
  final _apiClient = ApiClient();
  final MapController _mapController = MapController();

  LatLng? _customerLocation;
  LatLng? _staffLocation;
  String? _staffRole;
  String? _assignedStaffName;
  String? _status;
  String? _error;

  Timer? _pollTimer;
  bool _loading = true;

  double? get _distanceMeters {
    if (_customerLocation == null || _staffLocation == null) return null;
    const distance = Distance();
    return distance(_customerLocation!, _staffLocation!);
  }

  bool get _isStaffHere =>
      _distanceMeters != null && _distanceMeters! <= _arrivalRadiusMeters;

  int? get _etaMinutes {
    final d = _distanceMeters;
    if (d == null || d <= _arrivalRadiusMeters) return null;
    return (d / _metersPerMinuteDriving).ceil().clamp(1, 120);
  }

  @override
  void initState() {
    super.initState();
    _loadLiveData();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 6),
      (_) => _loadLiveData(),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadLiveData() async {
    try {
      final response = await _apiClient.getServiceRequestLive(widget.requestId);
      if (response.statusCode == 200 && mounted) {
        final data = response.data['data'] as Map<String, dynamic>;
        final sr = data['serviceRequest'] as Map<String, dynamic>;

        final loc = sr['location'] as Map<String, dynamic>?;
        LatLng? customerLoc;
        if (loc != null && loc['coordinates'] != null) {
          final coords = loc['coordinates'] as Map<String, dynamic>;
          final lat = coords['lat'] as num?;
          final lng = coords['lng'] as num?;
          if (lat != null && lng != null) {
            customerLoc = LatLng(lat.toDouble(), lng.toDouble());
          }
        }

        LatLng? staffLoc;
        String? staffRole;
        String? staffName;
        final staffLocation = data['staffLocation'] as Map<String, dynamic>?;
        if (staffLocation != null && staffLocation['coordinates'] != null) {
          final coords = staffLocation['coordinates'] as Map<String, dynamic>;
          final lat = coords['lat'] as num?;
          final lng = coords['lng'] as num?;
          if (lat != null && lng != null) {
            staffLoc = LatLng(lat.toDouble(), lng.toDouble());
          }
          staffRole = staffLocation['role'] as String?;
        }

        final assignedStaff = sr['assignedStaff'] as Map<String, dynamic>?;
        if (assignedStaff != null) {
          staffName = assignedStaff['name'] as String?;
        }

        setState(() {
          _customerLocation = customerLoc;
          _staffLocation = staffLoc;
          _staffRole = staffRole;
          _assignedStaffName = staffName;
          _status = sr['status'] as String?;
          _loading = false;
          _error = null;
        });

        if (customerLoc != null) {
          _mapController.move(customerLoc, _mapController.camera.zoom);
        }
      } else if (mounted) {
        setState(() {
          _error =
              'Failed to load tracking data (status: ${response.statusCode}).';
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load tracking data: $e';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeColor = const Color(AppConstants.primaryColor);

    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          'Track Service',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: themeColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(AppConstants.primaryColor),
              ),
            )
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error!,
                  style: GoogleFonts.poppins(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : _customerLocation == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'This request does not have a valid location.',
                  style: GoogleFonts.poppins(color: Colors.grey[700]),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : Column(
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: _customerLocation!,
                          initialZoom: 14,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            subdomains: const ['a', 'b', 'c'],
                            userAgentPackageName: 'com.pawsewa.user_app',
                          ),
                          MarkerLayer(
                            markers: [
                              // Customer pin (request location)
                              Marker(
                                point: _customerLocation!,
                                width: 36,
                                height: 36,
                                child: const Icon(
                                  Icons.location_on,
                                  color: Colors.red,
                                  size: 32,
                                ),
                              ),
                              if (_staffLocation != null)
                                Marker(
                                  point: _staffLocation!,
                                  width: 32,
                                  height: 32,
                                  child: const Icon(
                                    Icons.my_location,
                                    color: Colors.blue,
                                    size: 26,
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (_isStaffHere)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    padding: const EdgeInsets.symmetric(
                      vertical: 14,
                      horizontal: 16,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.green.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.check_circle_rounded,
                          color: Colors.green.shade700,
                          size: 28,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'I\'m here',
                            style: GoogleFonts.poppins(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Colors.green.shade800,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_status != null)
                        Text(
                          'Status: ${_status!.replaceAll('_', ' ').toUpperCase()}',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: themeColor,
                          ),
                        ),
                      const SizedBox(height: 4),
                      if (_assignedStaffName != null)
                        Text(
                          _staffRole == 'rider'
                              ? 'Rider: $_assignedStaffName'
                              : 'Veterinarian: $_assignedStaffName',
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: Colors.grey[800],
                          ),
                        ),
                      if (_etaMinutes != null && !_isStaffHere)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            'Estimated arrival: ~$_etaMinutes min',
                            style: GoogleFonts.poppins(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: themeColor,
                            ),
                          ),
                        ),
                      if (_staffLocation == null && _etaMinutes == null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            _staffRole == 'rider'
                                ? 'Waiting for rider location...'
                                : 'Vet is arriving soon. For privacy, we only show status, not live location.',
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: Colors.grey[700],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
