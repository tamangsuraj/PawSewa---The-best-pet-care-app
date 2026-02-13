import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../cart/cart_service.dart';
import '../../core/constants.dart';

/// One place result from Nominatim search.
class _PlaceResult {
  final String displayName;
  final double lat;
  final double lon;

  _PlaceResult({
    required this.displayName,
    required this.lat,
    required this.lon,
  });
}

class DeliveryPinScreen extends StatefulWidget {
  const DeliveryPinScreen({super.key});

  @override
  State<DeliveryPinScreen> createState() => _DeliveryPinScreenState();
}

class _DeliveryPinScreenState extends State<DeliveryPinScreen> {
  static const LatLng _center = LatLng(27.7172, 85.3240);
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  LatLng? _pin;
  String? _address;
  bool _loadingAddress = false;
  List<_PlaceResult> _searchResults = [];
  bool _searching = false;

  late final Dio _dio;

  @override
  void initState() {
    super.initState();
    _dio = Dio(
      BaseOptions(
        headers: const {'User-Agent': 'PawSewa Mobile App (pawsewa.app)'},
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  Future<void> _searchPlaces(String query) async {
    final q = query.trim();
    if (q.isEmpty) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final resp = await _dio.get<List>(
        'https://nominatim.openstreetmap.org/search',
        queryParameters: {'q': q, 'format': 'json', 'limit': 5},
      );
      final list = resp.data;
      if (!mounted) return;
      if (list == null || list.isEmpty) {
        setState(() {
          _searchResults = [];
          _searching = false;
        });
        return;
      }
      final results = <_PlaceResult>[];
      for (final e in list) {
        if (e is! Map) continue;
        final lat = double.tryParse(e['lat']?.toString() ?? '');
        final lon = double.tryParse(e['lon']?.toString() ?? '');
        final name = e['display_name']?.toString() ?? '';
        if (lat != null && lon != null && name.isNotEmpty) {
          results.add(_PlaceResult(displayName: name, lat: lat, lon: lon));
        }
      }
      setState(() {
        _searchResults = results;
        _searching = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _searchResults = [];
          _searching = false;
        });
      }
    }
  }

  void _onSelectPlace(_PlaceResult place) {
    _searchFocusNode.unfocus();
    setState(() {
      _pin = LatLng(place.lat, place.lon);
      _address = place.displayName;
      _searchResults = [];
      _loadingAddress = false;
    });
    _searchController.clear();
    _mapController.move(LatLng(place.lat, place.lon), 16);
  }

  Future<void> _reverseGeocode(LatLng point) async {
    setState(() {
      _loadingAddress = true;
      _address = null;
    });
    try {
      final resp = await _dio.get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {
          'format': 'jsonv2',
          'lat': point.latitude.toString(),
          'lon': point.longitude.toString(),
        },
      );
      final data = resp.data;
      final addr = data is Map ? data['display_name']?.toString() : null;
      if (mounted) {
        setState(() {
          _address = addr;
          _loadingAddress = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _address = null;
          _loadingAddress = false;
        });
      }
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
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocusNode,
              decoration: InputDecoration(
                hintText: 'Search e.g. Putalisadak, Kathmandu',
                hintStyle: GoogleFonts.poppins(color: Colors.grey),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searching
                    ? const Padding(
                        padding: EdgeInsets.all(12),
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : null,
                filled: true,
                fillColor: Colors.grey.shade100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
              ),
              style: GoogleFonts.poppins(),
              onChanged: (value) {
                if (value.trim().isEmpty) {
                  setState(() => _searchResults = []);
                  return;
                }
                Future.delayed(const Duration(milliseconds: 400), () {
                  if (mounted &&
                      _searchController.text.trim() == value.trim()) {
                    _searchPlaces(value);
                  }
                });
              },
            ),
          ),
          if (_searchResults.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              constraints: const BoxConstraints(maxHeight: 200),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _searchResults.length,
                itemBuilder: (context, index) {
                  final place = _searchResults[index];
                  return ListTile(
                    leading: Icon(
                      Icons.place,
                      color: const Color(AppConstants.primaryColor),
                    ),
                    title: Text(
                      place.displayName,
                      style: GoogleFonts.poppins(fontSize: 13),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => _onSelectPlace(place),
                  );
                },
              ),
            ),
          Expanded(
            child: FlutterMap(
              mapController: _mapController,
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
                  urlTemplate:
                      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                  subdomains: const ['a', 'b', 'c', 'd'],
                  userAgentPackageName: 'com.pawsewa.user_app',
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
                    'Tap on the map to place the delivery pin, or search above.',
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
