import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../cart/cart_service.dart';
import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../services/geocoding_service.dart';
import '../../widgets/editorial_canvas.dart';
import '../../widgets/map_pin_marker.dart';

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
  /// When true, pops with the address string (for appointments). When false, sets CartService (shop checkout).
  final bool returnAddress;
  /// When true (and returnAddress==true), pops with `{ lat, lng, address }` map.
  final bool returnLocationPayload;

  const DeliveryPinScreen({
    super.key,
    this.returnAddress = false,
    this.returnLocationPayload = false,
  });

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
  List<Map<String, dynamic>> _saved = [];
  bool _loadingSaved = false;
  DateTime? _lastReverseAt;
  bool _gpsResolving = false;
  bool _pinFromDeviceGps = false;

  late final Dio _dio;
  final _geo = GeocodingService();

  @override
  void initState() {
    super.initState();
    _dio = Dio(
      BaseOptions(
        headers: const {'User-Agent': 'PawSewa Mobile App (pawsewa.app)'},
      ),
    );
    _loadSavedAddresses();
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
      _pinFromDeviceGps = false;
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
      final addr = await _geo.reverse(lat: point.latitude, lng: point.longitude);
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

  Future<void> _loadSavedAddresses() async {
    setState(() => _loadingSaved = true);
    try {
      final r = await ApiClient().getMySavedAddresses();
      final body = r.data;
      final list = <Map<String, dynamic>>[];
      if (body is Map && body['success'] == true && body['data'] is List) {
        for (final e in body['data'] as List) {
          if (e is Map) list.add(Map<String, dynamic>.from(e));
        }
      }
      if (!mounted) return;
      setState(() {
        _saved = list;
        _loadingSaved = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingSaved = false);
    }
  }

  Future<void> _pinMyLocation() async {
    if (_gpsResolving) return;
    setState(() => _gpsResolving = true);
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location services are disabled.')),
          );
        }
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permission is required to pin your location.')),
          );
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final p = LatLng(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() {
        _pin = p;
        _pinFromDeviceGps = true;
      });
      _mapController.move(p, 16);
      await _reverseGeocode(p);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not get location: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _gpsResolving = false);
    }
  }

  void _onMapMove(MapCamera cam) {
    final center = cam.center;
    setState(() {
      _pin = center;
      _pinFromDeviceGps = false;
    });
    // Debounce reverse-geocoding so dragging feels smooth.
    final now = DateTime.now();
    final last = _lastReverseAt;
    if (last != null && now.difference(last).inMilliseconds < 700) return;
    _lastReverseAt = now;
    _reverseGeocode(center);
  }

  void _onConfirm() {
    if (_pin == null || _address == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please place the pin and wait for address.',
            style: GoogleFonts.outfit(),
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    if (widget.returnAddress) {
      if (widget.returnLocationPayload) {
        Navigator.of(context).pop({
          'lat': _pin!.latitude,
          'lng': _pin!.longitude,
          'address': _address!,
          if (_pinFromDeviceGps)
            'liveLocation': {
              'lat': _pin!.latitude,
              'lng': _pin!.longitude,
              'timestamp': DateTime.now().toUtc().toIso8601String(),
            },
        });
      } else {
        Navigator.of(context).pop(_address);
      }
      return;
    }
    context.read<CartService>().setDeliveryLocation(
      lat: _pin!.latitude,
      lng: _pin!.longitude,
      address: _address!,
      liveLocationCapturedAt:
          _pinFromDeviceGps ? DateTime.now().toUtc() : null,
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final pin = _pin ?? _center;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text(
          widget.returnAddress ? 'Select Location' : 'Select Delivery Location',
          style: GoogleFonts.outfit(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
      ),
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: Column(
              children: [
                Flexible(
                  flex: 0,
                  fit: FlexFit.loose,
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_loadingSaved == false && _saved.isNotEmpty)
                          SizedBox(
                            height: 54,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                              scrollDirection: Axis.horizontal,
                              itemCount: _saved.length,
                              separatorBuilder: (_, _) => const SizedBox(width: 10),
                              itemBuilder: (context, i) {
                                final a = _saved[i];
                                final label = a['label']?.toString() ?? 'Saved';
                                final street = a['street']?.toString() ?? '';
                                final landmark = a['landmark']?.toString() ?? '';
                                final lat = (a['lat'] as num?)?.toDouble();
                                final lng = (a['lng'] as num?)?.toDouble();
                                final addr = [street, landmark]
                                    .where((s) => s.trim().isNotEmpty)
                                    .join(' • ');
                                return ActionChip(
                                  label: Text(
                                    label,
                                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                                  ),
                                  avatar: const Icon(
                                    Icons.bookmark_rounded,
                                    size: 18,
                                    color: Color(AppConstants.primaryColor),
                                  ),
                                  onPressed: (lat != null && lng != null)
                                      ? () {
                                          final p = LatLng(lat, lng);
                                          setState(() {
                                            _pin = p;
                                            _address = addr.isNotEmpty ? addr : _address;
                                            _pinFromDeviceGps = false;
                                          });
                                          _mapController.move(p, 16);
                                          _reverseGeocode(p);
                                        }
                                      : null,
                                );
                              },
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _searchController,
                                  focusNode: _searchFocusNode,
                                  decoration: InputDecoration(
                                    hintText: 'Search e.g. Putalisadak, Kathmandu',
                                    hintStyle: GoogleFonts.outfit(color: Colors.grey),
                                    prefixIcon: const Icon(Icons.search),
                                    suffixIcon: _searching
                                        ? const Padding(
                                            padding: EdgeInsets.all(12),
                                            child: SizedBox(
                                              width: 20,
                                              height: 20,
                                              child: PawSewaLoader(width: 32, center: false),
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
                                  style: GoogleFonts.outfit(),
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
                              const SizedBox(width: 8),
                              Material(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(12),
                                child: IconButton(
                                  tooltip: 'Use current location',
                                  onPressed: _gpsResolving ? null : _pinMyLocation,
                                  icon: _gpsResolving
                                      ? const SizedBox(
                                          width: 22,
                                          height: 22,
                                          child: PawSewaLoader(width: 28, center: false),
                                        )
                                      : const Icon(Icons.my_location),
                                  color: const Color(AppConstants.primaryColor),
                                ),
                              ),
                            ],
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
                                    style: GoogleFonts.outfit(fontSize: 13),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  onTap: () => _onSelectPlace(place),
                                );
                              },
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: _center,
                      initialZoom: 14,
                      onPositionChanged: (pos, hasGesture) {
                        if (hasGesture) {
                          _onMapMove(pos);
                        }
                      },
                      onTap: (tap, point) {
                        setState(() {
                          _pin = point;
                          _pinFromDeviceGps = false;
                        });
                        _mapController.move(point, _mapController.camera.zoom);
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
                            height: 50,
                            alignment: Alignment.bottomCenter,
                            child: const MapPinMarker(
                              color: Color(AppConstants.primaryColor),
                              size: 40,
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
                        Text('Fetching address…', style: GoogleFonts.outfit())
                      else if (_address != null)
                        Text(
                          _address!,
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: Colors.grey[800],
                          ),
                        )
                      else
                        Text(
                          'Drag the map under the pin, tap on map, or use My Location.',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: Colors.grey[600],
                          ),
                        ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: (_gpsResolving ||
                                  _loadingAddress ||
                                  _address == null)
                              ? null
                              : _onConfirm,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(AppConstants.primaryColor),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            'Use this location',
                            style: GoogleFonts.outfit(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_gpsResolving) ...[
            Positioned.fill(
              child: ModalBarrier(
                dismissible: false,
                color: Colors.black.withValues(alpha: 0.45),
              ),
            ),
            const Center(
              child: PawSewaLoader(width: 140),
            ),
          ],
        ],
      ),
    );
  }
}
