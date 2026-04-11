import 'dart:async';

import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/constants.dart';
import '../services/location_service.dart';
import '../widgets/map_pin_marker.dart';
import '../widgets/swipe_action_button.dart';
import 'rider_proof_of_delivery_screen.dart';

/// Full-screen en-route view after rider taps "On the way": map, distance,
/// directions link, call customer, order total & payment info, Mark delivered.
class RiderEnRouteScreen extends StatefulWidget {
  const RiderEnRouteScreen({super.key, required this.order});

  final Map<String, dynamic> order;

  @override
  State<RiderEnRouteScreen> createState() => _RiderEnRouteScreenState();
}

class _RiderEnRouteScreenState extends State<RiderEnRouteScreen> {
  final MapController _mapController = MapController();
  final LocationService _locationService = LocationService();

  LatLng? _customerLatLng;
  LatLng? _riderLatLng;
  StreamSubscription<Position>? _positionSub;
  bool _loadingLocation = true;
  bool _isMapReady = false;
  String? _updatingOrderId;

  double? _distanceKm;
  bool _itemsExpanded = false;

  /// ETA in minutes at ~25 km/h average in city.
  int? get _etaMinutes =>
      _distanceKm != null && _distanceKm! > 0
          ? (_distanceKm! / 25 * 60).round().clamp(1, 120)
          : null;

  @override
  void initState() {
    super.initState();
    _parseCustomerLocation();
    _startLocationUpdates();
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    super.dispose();
  }

  void _parseCustomerLocation() {
    final o = widget.order;
    double? lat;
    double? lng;

    final live = o['liveLocation'] as Map<String, dynamic>?;
    if (live != null) {
      final la = live['lat'];
      final ln = live['lng'];
      if (la is num && ln is num) {
        lat = la.toDouble();
        lng = ln.toDouble();
      }
    }

    final flat = o['location'];
    if ((lat == null || lng == null) && flat is Map) {
      final la = flat['lat'];
      final ln = flat['lng'];
      if (la is num && ln is num) {
        lat = la.toDouble();
        lng = ln.toDouble();
      }
    }
    if (lat == null || lng == null) {
      final dc = o['deliveryCoordinates'];
      if (dc is Map) {
        final la = dc['lat'];
        final ln = dc['lng'];
        if (la is num && ln is num) {
          lat = la.toDouble();
          lng = ln.toDouble();
        }
      }
    }
    if (lat == null || lng == null) {
      final loc = o['deliveryLocation'];
      if (loc is Map) {
        final point = loc['point'];
        if (point is Map) {
          final coords = point['coordinates'];
          if (coords is List && coords.length >= 2) {
            lng = (coords[0] as num).toDouble();
            lat = (coords[1] as num).toDouble();
          }
        }
      }
    }
    if (lat == null || lng == null) return;
    _customerLatLng = LatLng(lat, lng);
    _scheduleMapMove(_customerLatLng!, 14);
  }

  void _scheduleMapMove(LatLng center, double zoom) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!_isMapReady) return;
      // ignore: avoid_print
      print('[DEBUG] MapController accessed. Verification: Widget Rendered = True.');
      try {
        _mapController.move(center, zoom);
      } catch (_) {
        // Map may still be initializing; ignore to avoid red screen.
      }
    });
  }

  void _scheduleFitBounds(LatLngBounds bounds) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!_isMapReady) return;
      // ignore: avoid_print
      print('[DEBUG] MapController accessed. Verification: Widget Rendered = True.');
      try {
        _mapController.fitCamera(
          CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(48)),
        );
      } catch (_) {}
    });
  }

  Future<void> _startLocationUpdates() async {
    final hasPermission = await _locationService.ensureLocationPermission(
      context,
    );
    if (!hasPermission || !mounted) {
      setState(() => _loadingLocation = false);
      return;
    }
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      if (mounted) {
        setState(() {
          _riderLatLng = LatLng(pos.latitude, pos.longitude);
          _updateDistance();
          _loadingLocation = false;
        });
        _fitBoundsIfPossible();
      }

      _positionSub =
          Geolocator.getPositionStream(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 20,
            ),
          ).listen((pos) {
            if (!mounted) return;
            setState(() {
              _riderLatLng = LatLng(pos.latitude, pos.longitude);
              _updateDistance();
            });
          });
    } catch (_) {
      if (mounted) setState(() => _loadingLocation = false);
    }
  }

  void _updateDistance() {
    if (_riderLatLng != null && _customerLatLng != null) {
      const distance = Distance();
      _distanceKm = distance.as(
        LengthUnit.Kilometer,
        _riderLatLng!,
        _customerLatLng!,
      );
    }
  }

  void _fitBoundsIfPossible() {
    if (_customerLatLng == null || _riderLatLng == null) return;
    final bounds = LatLngBounds.fromPoints([_customerLatLng!, _riderLatLng!]);
    _scheduleFitBounds(bounds);
  }

  Future<void> _openDirections() async {
    if (_customerLatLng == null) return;
    final lat = _customerLatLng!.latitude;
    final lng = _customerLatLng!.longitude;
    final url = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _copyAddress() async {
    final address = _deliveryAddress;
    if (address == null || address.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: address));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Address copied', style: GoogleFonts.outfit()),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  String? get _deliveryAddress =>
      (widget.order['deliveryLocation'] is Map
          ? (widget.order['deliveryLocation'] as Map)['address']
          : null)
          ?.toString();

  Future<void> _shareAddress() async {
    final address = _deliveryAddress;
    if (address == null || address.isEmpty) return;
    String text = address;
    if (_customerLatLng != null) {
      final lat = _customerLatLng!.latitude;
      final lng = _customerLatLng!.longitude;
      text += '\n\nhttps://www.google.com/maps?q=$lat,$lng';
    }
    await Share.share(text, subject: 'Delivery address');
  }

  Future<void> _callCustomer() async {
    final user = widget.order['user'];
    if (user is! Map) return;
    final phone = user['phone']?.toString().trim();
    if (phone == null || phone.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Customer phone not available')),
        );
      }
      return;
    }
    final tel = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(tel)) {
      await launchUrl(tel);
    }
  }

  Future<void> _markDelivered() async {
    final id = widget.order['_id']?.toString();
    if (id == null) return;
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => RiderProofOfDeliveryScreen(order: Map<String, dynamic>.from(widget.order)),
      ),
    );
    if (ok == true && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  String _paymentSummary() {
    final paid = widget.order['paymentStatus']?.toString() == 'paid';
    final method = widget.order['paymentMethod']?.toString();
    final total = (widget.order['totalAmount'] as num?)?.toDouble() ?? 0;
    if (paid) {
      if (method == 'khalti') {
        return 'Paid via Khalti · NPR ${total.toStringAsFixed(0)}';
      }
      return 'Paid (online) · NPR ${total.toStringAsFixed(0)}';
    }
    return 'Cash on delivery · NPR ${total.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    const accent = Color(AppConstants.accentColor);
    const successGreen = Color(0xFF00C853);
    final order = widget.order;
    final id = order['_id']?.toString() ?? '';
    final shortId = id.length >= 6 ? id.substring(id.length - 6) : id;
    final user = order['user'] is Map ? order['user'] as Map : null;
    final customerName = user?['name']?.toString() ?? 'Customer';
    final address =
        (order['deliveryLocation'] is Map
                ? (order['deliveryLocation'] as Map)['address']
                : null)
            ?.toString() ??
        '';
    final total = (order['totalAmount'] as num?)?.toDouble() ?? 0;
    final hasCustomerPoint = _customerLatLng != null;

    return Scaffold(
      body: Stack(
        children: [
          // Map
          if (hasCustomerPoint)
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _customerLatLng!,
                initialZoom: 14,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all,
                ),
                onMapReady: () {
                  if (!mounted) return;
                  setState(() => _isMapReady = true);
                  final c = _customerLatLng;
                  if (c != null) _scheduleMapMove(c, 14);
                  _fitBoundsIfPossible();
                },
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
                      point: _customerLatLng!,
                      width: 44,
                      height: 55,
                      alignment: Alignment.bottomCenter,
                      child: const MapPinMarker(
                        color: primary,
                        size: 40,
                      ),
                    ),
                    if (_riderLatLng != null)
                      Marker(
                        point: _riderLatLng!,
                        width: 38,
                        height: 48,
                        alignment: Alignment.bottomCenter,
                        child: const MapPinMarker(
                          color: Color(AppConstants.accentColor),
                          size: 34,
                        ),
                      ),
                  ],
                ),
              ],
            )
          else
            const ColoredBox(
              color: Colors.grey,
              child: Center(child: Text('Loading Map...')),
            ),

          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_ios_new_rounded),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white,
                      shadowColor: Colors.black26,
                      elevation: 2,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'En route · #$shortId',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Fit-map FAB: recenter map on both markers
          if (hasCustomerPoint && _riderLatLng != null)
            Positioned(
              right: 16,
              bottom: 280,
              child: SafeArea(
                child: Material(
                  elevation: 2,
                  borderRadius: BorderRadius.circular(12),
                  color: Colors.white,
                  child: InkWell(
                    onTap: _fitBoundsIfPossible,
                    borderRadius: BorderRadius.circular(12),
                    child: const Padding(
                      padding: EdgeInsets.all(12),
                      child: Icon(
                        Icons.fit_screen_rounded,
                        size: 24,
                        color: Color(AppConstants.primaryColor),
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // Google Maps deep-link FAB (customer navigation)
          if (hasCustomerPoint)
            Positioned(
              left: 16,
              bottom: 280,
              child: SafeArea(
                child: FloatingActionButton(
                  heroTag: 'rider_google_maps',
                  backgroundColor: accent,
                  foregroundColor: Colors.white,
                  elevation: 2,
                  onPressed: _openDirections,
                  child: const Icon(Icons.map_rounded),
                ),
              ),
            ),

          // Bottom card: customer, address, distance, payment, actions
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? Colors.grey.shade900 : Colors.white,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.1),
                    blurRadius: 16,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        customerName,
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (address.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                address,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  color: isDark ? Colors.white70 : Colors.grey[700],
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            IconButton(
                              onPressed: _copyAddress,
                              icon: const Icon(Icons.copy_rounded, size: 20),
                              tooltip: 'Copy address',
                              style: IconButton.styleFrom(
                                padding: const EdgeInsets.all(4),
                                minimumSize: const Size(36, 36),
                              ),
                            ),
                            IconButton(
                              onPressed: _shareAddress,
                              icon: const Icon(Icons.share_rounded, size: 20),
                              tooltip: 'Share address',
                              style: IconButton.styleFrom(
                                padding: const EdgeInsets.all(4),
                                minimumSize: const Size(36, 36),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (widget.order['deliveryNotes'] != null &&
                          widget.order['deliveryNotes'].toString().trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: primary.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: primary.withValues(alpha: 0.2),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.note_rounded,
                                size: 18,
                                color: primary,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  widget.order['deliveryNotes'].toString().trim(),
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    color: isDark ? Colors.white : Colors.black87,
                                  ),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      // Amount & payment
                      Row(
                        children: [
                          Icon(
                            Icons.receipt_long_rounded,
                            size: 18,
                            color: primary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Total NPR ${total.toStringAsFixed(0)}',
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              widget.order['paymentStatus'] == 'paid'
                                  ? 'Paid'
                                  : 'COD',
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: primary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _paymentSummary(),
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: isDark ? Colors.white70 : Colors.grey[600],
                        ),
                      ),
                      if (_distanceKm != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(
                              Icons.straighten_rounded,
                              size: 18,
                              color: Colors.grey[600],
                            ),
                            const SizedBox(width: 8),
                            Text(
                              _distanceKm! < 1
                                  ? '${(_distanceKm! * 1000).toStringAsFixed(0)} m away'
                                  : '${_distanceKm!.toStringAsFixed(1)} km away',
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: isDark ? Colors.white : Colors.black87,
                              ),
                            ),
                            if (_etaMinutes != null) ...[
                              const SizedBox(width: 16),
                              Icon(
                                Icons.schedule_rounded,
                                size: 18,
                                color: Colors.grey[600],
                              ),
                              const SizedBox(width: 6),
                              Text(
                                '~$_etaMinutes min',
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: primary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ] else if (_loadingLocation)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 16,
                                height: 16,
                                child: PawSewaLoader(width: 32, center: false),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Getting distance…',
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  color: isDark ? Colors.white70 : Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 12),
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () =>
                              setState(() => _itemsExpanded = !_itemsExpanded),
                          borderRadius: BorderRadius.circular(10),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                vertical: 8, horizontal: 4),
                            child: Row(
                              children: [
                                Icon(
                                  _itemsExpanded
                                      ? Icons.expand_less_rounded
                                      : Icons.expand_more_rounded,
                                  size: 22,
                                  color: primary,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _itemsExpanded
                                      ? 'Hide items'
                                      : 'View items (${(widget.order['items'] is List ? (widget.order['items'] as List).length : 0)})',
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (_itemsExpanded &&
                          widget.order['items'] is List) ...[
                        const SizedBox(height: 6),
                        ...((widget.order['items'] as List).map((e) {
                          final name = (e is Map ? e['name'] : null) ?? 'Item';
                          final qty = (e is Map ? e['quantity'] : null) ?? 1;
                          final price = (e is Map ? e['price'] : null) as num?;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(
                              children: [
                                const SizedBox(width: 28),
                                Expanded(
                                  child: Text(
                                    '$name × $qty',
                                    style: GoogleFonts.outfit(
                                      fontSize: 13,
                                      color: Colors.grey[800],
                                    ),
                                  ),
                                ),
                                if (price != null)
                                  Text(
                                    'NPR ${(price * qty).toStringAsFixed(0)}',
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey[700],
                                    ),
                                  ),
                              ],
                            ),
                          );
                        })),
                        const SizedBox(height: 8),
                      ],
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _openDirections,
                              icon: const Icon(
                                Icons.directions_rounded,
                                size: 20,
                              ),
                              label: const Text('Directions'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: primary,
                                side: BorderSide(color: primary),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _callCustomer,
                              icon: const Icon(Icons.phone_rounded, size: 20),
                              label: const Text('Call customer'),
                              style: FilledButton.styleFrom(
                                backgroundColor: primary,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SwipeActionButton(
                        disabled: _updatingOrderId != null,
                        backgroundColor: successGreen,
                        label: 'Swipe to Complete',
                        loading: _updatingOrderId != null,
                        onSwiped: _markDelivered,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
