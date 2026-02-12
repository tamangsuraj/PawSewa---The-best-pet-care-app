import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/constants.dart';
import '../services/location_service.dart';

class ServiceTaskDetailScreen extends StatefulWidget {
  final Map<String, dynamic> task;

  const ServiceTaskDetailScreen({super.key, required this.task});

  @override
  State<ServiceTaskDetailScreen> createState() => _ServiceTaskDetailScreenState();
}

class _ServiceTaskDetailScreenState extends State<ServiceTaskDetailScreen> {
  final MapController _mapController = MapController();

  LatLng? _customerLocation;
  LatLng? _vetLocation;
  StreamSubscription<Position>? _positionSub;
  final LocationService _locationService = LocationService();

  @override
  void initState() {
    super.initState();
    _initLocations();
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    super.dispose();
  }

  Future<void> _initLocations() async {
    final loc = widget.task['location'] as Map<String, dynamic>?;
    if (loc != null && loc['coordinates'] != null) {
      final coords = loc['coordinates'] as Map<String, dynamic>;
      final lat = coords['lat'] as num?;
      final lng = coords['lng'] as num?;
      if (lat != null && lng != null) {
        _customerLocation = LatLng(lat.toDouble(), lng.toDouble());
      }
    }

    try {
      final hasPermission = await _locationService.ensureLocationPermission(context);
      if (!hasPermission) {
        return;
      }

      _positionSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      ).listen((pos) {
        setState(() {
          _vetLocation = LatLng(pos.latitude, pos.longitude);
        });
      });
    } catch (_) {
      // Ignore location errors in detail view
    }

    if (mounted && _customerLocation != null) {
      _mapController.move(_customerLocation!, 14);
      setState(() {});
    }
  }

  Future<void> _callOwner(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeColor = const Color(AppConstants.primaryColor);
    final pet = widget.task['pet'] as Map<String, dynamic>?;
    final owner = widget.task['user'] as Map<String, dynamic>?;

    final medicalHistory = (pet?['medicalHistory'] as List?)?.cast<dynamic>() ?? const [];

    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          'Task Details',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: Colors.white),
        ),
        backgroundColor: themeColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildCard(
              title: 'Pet Profile',
              child: Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: themeColor.withValues(alpha: 26 / 255),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.pets, color: Colors.white, size: 32),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          pet?['name'] ?? 'Unknown Pet',
                          style: GoogleFonts.poppins(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: const Color(AppConstants.accentColor),
                          ),
                        ),
                        const SizedBox(height: 4),
                        if (pet?['pawId'] != null &&
                            (pet?['pawId'] as String).isNotEmpty)
                          Container(
                            margin: const EdgeInsets.only(bottom: 4),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF7EC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: themeColor,
                                width: 1.2,
                              ),
                            ),
                            child: Text(
                              'ID: ${pet?['pawId']}',
                              style: GoogleFonts.poppins(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: themeColor,
                              ),
                            ),
                          ),
                        Text(
                          [
                            pet?['species'] ?? 'Unknown species',
                            pet?['breed'] ?? 'Unknown breed',
                            '${pet?['age'] ?? '?'} yrs',
                          ].join(' • '),
                          style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[700]),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildCard(
              title: 'Medical History',
              child: medicalHistory.isEmpty
                  ? Text(
                      'No past visit notes yet. This visit will create the first record.',
                      style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[700]),
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final entry in medicalHistory.reversed.take(5))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              '• $entry',
                              style:
                                  GoogleFonts.poppins(fontSize: 13, color: Colors.grey[800]),
                            ),
                          ),
                      ],
                    ),
            ),
            const SizedBox(height: 16),
            _buildCard(
              title: 'Owner',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.person, size: 18, color: Color(AppConstants.primaryColor)),
                      const SizedBox(width: 8),
                      Text(
                        owner?['name'] ?? 'Unknown Owner',
                        style: GoogleFonts.poppins(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (owner?['phone'] != null)
                    Row(
                      children: [
                        ElevatedButton.icon(
                          onPressed: () => _callOwner(owner!['phone'] as String),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: themeColor,
                          ),
                          icon: const Icon(Icons.phone, color: Colors.white, size: 18),
                          label: Text(
                            'Call Owner',
                            style: GoogleFonts.poppins(color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildCard(
              title: 'Execution Map',
              child: SizedBox(
                height: 260,
                child: _customerLocation == null
                    ? Center(
                        child: Text(
                          'No valid customer coordinates for this task.',
                          style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[700]),
                        ),
                      )
                    : ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: FlutterMap(
                          mapController: _mapController,
                          options: MapOptions(
                            initialCenter: _customerLocation!,
                            initialZoom: 14,
                          ),
                          children: [
                            TileLayer(
                              urlTemplate:
                                  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                              subdomains: const ['a', 'b', 'c'],
                              userAgentPackageName: 'com.pawsewa.partner_app',
                            ),
                            MarkerLayer(
                              markers: [
                                Marker(
                                  point: _customerLocation!,
                                  width: 40,
                                  height: 40,
                                  child: const Icon(
                                    Icons.home_filled,
                                    color: Color(AppConstants.primaryColor),
                                    size: 34,
                                  ),
                                ),
                                if (_vetLocation != null)
                                  Marker(
                                    point: _vetLocation!,
                                    width: 36,
                                    height: 36,
                                    child: const Icon(
                                      Icons.medical_services,
                                      color: Color(AppConstants.primaryColor),
                                      size: 30,
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.poppins(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: const Color(AppConstants.accentColor),
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

