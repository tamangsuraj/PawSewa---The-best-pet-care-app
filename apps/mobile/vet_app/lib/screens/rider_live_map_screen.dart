import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../services/location_service.dart';
import '../widgets/partner_scaffold.dart';

class RiderLiveMapScreen extends StatefulWidget {
  const RiderLiveMapScreen({super.key});

  @override
  State<RiderLiveMapScreen> createState() => _RiderLiveMapScreenState();
}

class _RiderLiveMapScreenState extends State<RiderLiveMapScreen> {
  final _api = ApiClient();
  final _loc = LocationService();
  final _map = MapController();

  bool _loading = true;
  String? _error;
  bool _sharing = true;
  LatLng? _me;
  StreamSubscription<Position>? _sub;
  Timer? _pushTimer;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _sub?.cancel();
    _pushTimer?.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final ok = await _loc.ensureLocationPermission(context);
      if (!ok || !mounted) {
        setState(() {
          _error = 'Location permission is required for the live map.';
          _loading = false;
        });
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (!mounted) return;
      _me = LatLng(pos.latitude, pos.longitude);
      _map.move(_me!, 15);

      _sub?.cancel();
      _sub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        ),
      ).listen((p) {
        if (!mounted) return;
        setState(() {
          _me = LatLng(p.latitude, p.longitude);
        });
      });

      _pushTimer?.cancel();
      _pushTimer = Timer.periodic(const Duration(seconds: 20), (_) {
        unawaited(_pushToBackend());
      });

      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not start live map: $e';
        _loading = false;
      });
    }
  }

  Future<void> _pushToBackend() async {
    if (!_sharing) return;
    final me = _me;
    if (me == null) return;
    try {
      await _api.updateMyLiveLocation(lat: me.latitude, lng: me.longitude);
    } catch (_) {
      // non-fatal, map still runs
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Live route map',
      subtitle: 'Your position updates Admin live operations',
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _init,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
      body: _loading
          ? Center(child: CircularProgressIndicator(color: primary))
          : _error != null
              ? PartnerEmptyState(
                  title: 'Live map unavailable',
                  body: _error!,
                  icon: Icons.location_off_rounded,
                  primaryAction: OutlinedButton.icon(
                    onPressed: _init,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Try again'),
                  ),
                )
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: primary.withValues(alpha: 0.10),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Icon(Icons.gps_fixed_rounded, color: primary),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _sharing ? 'Sharing location' : 'Sharing paused',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(fontWeight: FontWeight.w700),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _me == null
                                          ? 'Waiting for GPS…'
                                          : 'Lat ${_me!.latitude.toStringAsFixed(5)}, Lng ${_me!.longitude.toStringAsFixed(5)}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: const Color(AppConstants.inkColor)
                                                .withValues(alpha: 0.65),
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                              Switch(
                                value: _sharing,
                                activeThumbColor: const Color(AppConstants.accentColor),
                                onChanged: (v) async {
                                  setState(() => _sharing = v);
                                  if (v) {
                                    await _pushToBackend();
                                  }
                                },
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: primary.withValues(alpha: 0.10)),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 20,
                                  offset: const Offset(0, 12),
                                ),
                              ],
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: FlutterMap(
                              mapController: _map,
                              options: MapOptions(
                                initialCenter: _me ?? const LatLng(27.7172, 85.3240),
                                initialZoom: 15,
                                interactionOptions: const InteractionOptions(
                                  flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                                ),
                              ),
                              children: [
                                TileLayer(
                                  urlTemplate:
                                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                  userAgentPackageName: 'com.pawsewa.partner',
                                ),
                                if (_me != null)
                                  MarkerLayer(
                                    markers: [
                                      Marker(
                                        point: _me!,
                                        width: 44,
                                        height: 44,
                                        child: Container(
                                          decoration: BoxDecoration(
                                            color: const Color(AppConstants.accentColor)
                                                .withValues(alpha: 0.15),
                                            borderRadius: BorderRadius.circular(999),
                                            border: Border.all(
                                              color: const Color(AppConstants.accentColor)
                                                  .withValues(alpha: 0.55),
                                              width: 2,
                                            ),
                                          ),
                                          child: const Icon(
                                            Icons.navigation_rounded,
                                            color: Color(AppConstants.accentColor),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (kDebugMode)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        child: Text(
                          'Tip: keep this on while you have active deliveries so Admin can coordinate.',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: const Color(AppConstants.inkColor)
                                    .withValues(alpha: 0.6),
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ),
                  ],
                ),
    );
  }
}

