import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../cart/cart_service.dart';
import '../../core/constants.dart';

class DeliveryPinScreen extends StatefulWidget {
  const DeliveryPinScreen({super.key});

  @override
  State<DeliveryPinScreen> createState() => _DeliveryPinScreenState();
}

class _DeliveryPinScreenState extends State<DeliveryPinScreen> {
  final LatLng _center = const LatLng(27.7172, 85.3240);
  LatLng? _pin;
  String? _address;
  bool _loadingAddress = false;

  Future<void> _reverseGeocode(LatLng point) async {
    setState(() {
      _loadingAddress = true;
      _address = null;
    });
    try {
      final url = Uri.https('nominatim.openstreetmap.org', '/reverse', {
        'format': 'jsonv2',
        'lat': point.latitude.toString(),
        'lon': point.longitude.toString(),
      }).toString();

      final resp = await Dio().get(
        url,
        options: Options(
          headers: {'User-Agent': 'PawSewa Mobile App (pawsewa.app)'},
        ),
      );
      _address = resp.data['display_name']?.toString();
    } catch (_) {
      _address = null;
    } finally {
      if (mounted) setState(() => _loadingAddress = false);
    }
  }

  void _onConfirm() {
    if (_pin == null || _address == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please place the pin and wait for address.',
            style: GoogleFonts.poppins(),
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    context.read<CartService>().setDeliveryLocation(
          lat: _pin!.latitude,
          lng: _pin!.longitude,
          address: _address!,
        );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final pin = _pin ?? _center;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Select Delivery Location',
          style: GoogleFonts.poppins(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
      ),
      body: Column(
        children: [
          Expanded(
            child: FlutterMap(
              options: MapOptions(
                initialCenter: _center,
                initialZoom: 14,
                onTap: (tap, point) {
                  setState(() => _pin = point);
                  _reverseGeocode(point);
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
                      point: pin,
                      width: 40,
                      height: 40,
                      child: const Icon(
                        Icons.location_on,
                        color: Color(AppConstants.primaryColor),
                        size: 36,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_loadingAddress)
                  Text('Fetching address…', style: GoogleFonts.poppins())
                else if (_address != null)
                  Text(
                    _address!,
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      color: Colors.grey[800],
                    ),
                  )
                else
                  Text(
                    'Tap on the map to place the delivery pin.',
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      color: Colors.grey[600],
                    ),
                  ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _onConfirm,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(AppConstants.primaryColor),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(
                      'Use this location',
                      style: GoogleFonts.poppins(),
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

