import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/vet_visit_status_apply.dart';
import '../core/vet_visit_swipe_flow.dart';
import '../services/location_service.dart';
import '../widgets/map_pin_marker.dart';
import '../widgets/swipe_action_button.dart';

/// After accepting a home visit (like rider → en-route map): map at customer pin,
/// then visit summary, then swipe-only completion.
class VetVisitFlowScreen extends StatefulWidget {
  const VetVisitFlowScreen({super.key, required this.initialTask});

  final Map<String, dynamic> initialTask;

  static Map<String, dynamic> mergeFromResponse(
    Map<String, dynamic> task,
    Response res,
  ) {
    if (res.data is Map && (res.data as Map)['data'] is Map) {
      return Map<String, dynamic>.from((res.data as Map)['data'] as Map);
    }
    return Map<String, dynamic>.from(task);
  }

  @override
  State<VetVisitFlowScreen> createState() => _VetVisitFlowScreenState();
}

class _VetVisitFlowScreenState extends State<VetVisitFlowScreen> {
  final _api = ApiClient();
  final _mapController = MapController();
  final _locationService = LocationService();

  late Map<String, dynamic> _task;
  LatLng? _customer;
  LatLng? _vet;
  StreamSubscription<Position>? _posSub;
  bool _mapReady = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _task = Map<String, dynamic>.from(widget.initialTask);
    _parseCustomer();
    _startVetLocation();
  }

  @override
  void dispose() {
    _posSub?.cancel();
    super.dispose();
  }

  void _parseCustomer() {
    final t = _task;
    final live = t['liveLocation'] as Map<String, dynamic>?;
    if (live != null) {
      final la = live['lat'] as num?;
      final ln = live['lng'] as num?;
      if (la != null && ln != null) {
        _customer = LatLng(la.toDouble(), ln.toDouble());
      }
    }
    final lat = t['latitude'] as num?;
    final lng = t['longitude'] as num?;
    if (_customer == null && lat != null && lng != null) {
      _customer = LatLng(lat.toDouble(), lng.toDouble());
    }
    if (_customer == null) {
      final loc = t['location'] as Map<String, dynamic>?;
      if (loc != null && loc['coordinates'] != null) {
        final coords = loc['coordinates'] as Map<String, dynamic>;
        final la = coords['lat'] as num?;
        final ln = coords['lng'] as num?;
        if (la != null && ln != null) {
          _customer = LatLng(la.toDouble(), ln.toDouble());
        }
      }
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _customer == null) return;
      if (_mapReady) _mapController.move(_customer!, 14);
    });
  }

  Future<void> _startVetLocation() async {
    try {
      final ok = await _locationService.ensureLocationPermission(context);
      if (!ok || !mounted) return;
      _posSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 15,
        ),
      ).listen((pos) {
        if (!mounted) return;
        setState(() => _vet = LatLng(pos.latitude, pos.longitude));
      });
    } catch (_) {}
  }

  Future<void> _openDirections() async {
    final c = _customer;
    String? addr;
    final loc = _task['location'];
    if (loc is Map) addr = loc['address']?.toString();
    final String dest;
    if (c != null) {
      dest = '${c.latitude},${c.longitude}';
    } else if (addr != null && addr.trim().isNotEmpty) {
      dest = Uri.encodeComponent(addr.trim());
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No destination for directions')),
        );
      }
      return;
    }
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$dest&travelmode=driving',
    );
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open Maps')),
        );
      }
    }
  }

  Future<void> _callOwner() async {
    final u = _task['user'] as Map<String, dynamic>?;
    final phone = u?['phone']?.toString();
    if (phone == null || phone.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No phone on file for this owner')),
        );
      }
      return;
    }
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _applyNext() async {
    final step = nextVetVisitSwipeStep(_task);
    if (step == null) {
      if (mounted) Navigator.pop(context, false);
      return;
    }
    final id = _task['_id']?.toString();
    if (id == null || id.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await applyVetServiceRequestStatus(
        _api,
        requestId: id,
        nextStatus: step.nextStatus,
        currentStatus: _task['status']?.toString(),
      );
      if (!mounted) return;
      if (res.statusCode != 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not update (${res.statusCode})')),
        );
        return;
      }
      final merged = VetVisitFlowScreen.mergeFromResponse(_task, res);
      setState(() {
        _task = merged;
        _busy = false;
      });
      if (step.nextStatus == 'completed' && mounted) {
        Navigator.pop(context, merged);
      }
    } on DioException catch (e) {
      if (!mounted) return;
      final body = e.response?.data;
      var msg = 'Could not update';
      if (body is Map && body['message'] is String) msg = body['message'] as String;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _sumRow(String k, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              k,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
          ),
          Expanded(child: Text(v, style: GoogleFonts.outfit(fontSize: 13))),
        ],
      ),
    );
  }

  bool get _showVisitSummary {
    final s = _task['status']?.toString() ?? '';
    return s == 'en_route' || s == 'arrived' || s == 'in_progress';
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    const accent = Color(AppConstants.accentColor);
    const success = Color(0xFF2E7D32);
    final pet = _task['pet'] is Map ? _task['pet'] as Map<String, dynamic> : null;
    final petName = pet?['name']?.toString() ?? 'Pet';
    final user = _task['user'] is Map ? _task['user'] as Map<String, dynamic> : null;
    final ownerName = user?['name']?.toString() ?? 'Owner';
    final svc = (_task['serviceType']?.toString() ?? 'Visit').replaceAll('_', ' ');
    final tw = _task['timeWindow']?.toString();
    String? addr;
    final loc = _task['location'];
    if (loc is Map) addr = loc['address']?.toString();
    final pm = _task['paymentMethod']?.toString();
    final ps = _task['paymentStatus']?.toString();
    final step = nextVetVisitSwipeStep(_task);
    final hasPoint = _customer != null;

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: hasPoint
                ? FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: _customer!,
                      initialZoom: 14,
                      interactionOptions: const InteractionOptions(
                        flags: InteractiveFlag.all,
                      ),
                      onMapReady: () {
                        if (!mounted) return;
                        setState(() => _mapReady = true);
                        _mapController.move(_customer!, 14);
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
                            point: _customer!,
                            width: 44,
                            height: 55,
                            alignment: Alignment.bottomCenter,
                            child: const MapPinMarker(
                              color: Color(AppConstants.accentColor),
                              size: 40,
                            ),
                          ),
                          if (_vet != null)
                            Marker(
                              point: _vet!,
                              width: 38,
                              height: 48,
                              alignment: Alignment.bottomCenter,
                              child: const MapPinMarker(
                                color: Color(AppConstants.primaryColor),
                                size: 34,
                              ),
                            ),
                        ],
                      ),
                    ],
                  )
                : Container(
                    color: Colors.grey.shade300,
                    alignment: Alignment.center,
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      addr != null && addr.isNotEmpty
                          ? 'No map pin — use Directions for:\n$addr'
                          : 'Location not pinned on map.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ),
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 8,
            left: 8,
            child: Material(
              color: Colors.white,
              shape: const CircleBorder(),
              elevation: 4,
              child: IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.pop(context, false),
              ),
            ),
          ),
          DraggableScrollableSheet(
            initialChildSize: _showVisitSummary ? 0.52 : 0.36,
            minChildSize: 0.28,
            maxChildSize: 0.92,
            builder: (context, scroll) {
              return Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 12,
                      offset: Offset(0, -4),
                    ),
                  ],
                ),
                child: ListView(
                  controller: scroll,
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      petName,
                      style: GoogleFonts.outfit(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      '$svc · $ownerName',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: Colors.grey.shade700,
                      ),
                    ),
                    if (tw != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        tw,
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _openDirections,
                            icon: const Icon(Icons.directions_rounded, size: 20),
                            label: const Text('Directions'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _callOwner,
                            icon: const Icon(Icons.phone_rounded, size: 20),
                            label: const Text('Call'),
                            style: FilledButton.styleFrom(
                              backgroundColor: primary,
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (_showVisitSummary) ...[
                      const SizedBox(height: 18),
                      Text(
                        'Visit summary',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: accent,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _sumRow('Pet', petName),
                      _sumRow('Service', svc),
                      if (tw != null) _sumRow('Time window', tw),
                      if (addr != null && addr.isNotEmpty) _sumRow('Address', addr),
                      if (pm != null) _sumRow('Payment', '$pm (${ps ?? '—'})'),
                      const SizedBox(height: 8),
                      Text(
                        'Confirm details with the owner before completing the visit.',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: Colors.grey.shade700,
                          height: 1.35,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    if (step != null)
                      SwipeActionButton(
                        label: step.label,
                        backgroundColor:
                            step.nextStatus == 'completed' ? success : primary,
                        disabled: _busy,
                        loading: _busy,
                        onSwiped: () => unawaited(_applyNext()),
                      )
                    else
                      Text(
                        'No further actions from here.',
                        style: GoogleFonts.outfit(color: Colors.grey.shade600),
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
