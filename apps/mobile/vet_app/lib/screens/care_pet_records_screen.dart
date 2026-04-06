import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';

/// Care center "Pet records" — not placeholder: shows real incoming bookings and
/// provides practical actions (call owner, open maps, mark accepted/declined).
class CarePetRecordsScreen extends StatefulWidget {
  const CarePetRecordsScreen({super.key});

  @override
  State<CarePetRecordsScreen> createState() => _CarePetRecordsScreenState();
}

class _CarePetRecordsScreenState extends State<CarePetRecordsScreen> {
  final _api = ApiClient();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _bookings = [];
  String? _busyId;

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await _api.getIncomingBookings();
      final body = r.data;
      final list = (body is Map && body['success'] == true && body['data'] is List)
          ? (body['data'] as List)
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _bookings = list;
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.response?.data is Map
            ? (e.response!.data as Map)['message']?.toString() ?? 'Network error'
            : 'Network error';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _call(String? phone) async {
    if (phone == null || phone.trim().isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone.trim());
    await launchUrl(uri);
  }

  Future<void> _openMaps(Map<String, dynamic> booking) async {
    final loc = booking['location'];
    double? lat;
    double? lng;
    if (loc is Map && loc['coordinates'] is Map) {
      final c = loc['coordinates'] as Map;
      final la = c['lat'];
      final ln = c['lng'];
      lat = (la is num) ? la.toDouble() : double.tryParse('$la');
      lng = (ln is num) ? ln.toDouble() : double.tryParse('$ln');
    }
    final addr = booking['address_string']?.toString();
    final uri = (lat != null && lng != null)
        ? Uri.parse(
            'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
          )
        : (addr != null && addr.trim().isNotEmpty)
            ? Uri.parse(
                'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(addr.trim())}',
              )
            : null;
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _respond(String bookingId, bool accept) async {
    setState(() => _busyId = bookingId);
    try {
      await _api.respondToBooking(bookingId, accept: accept);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(accept ? 'Booking accepted' : 'Booking declined'),
        ),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Action failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Pet records',
      subtitle: 'Incoming guests and owner details',
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
      body: Stack(
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: _loading
                ? Center(child: CircularProgressIndicator(color: primary))
                : _error != null
                    ? PartnerEmptyState(
                        title: 'Couldn’t load records',
                        body: _error!,
                        icon: Icons.folder_off_rounded,
                        primaryAction: OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                        ),
                      )
                    : _bookings.isEmpty
                        ? const PartnerEmptyState(
                            title: 'No bookings yet',
                            body:
                                'When customers book your care services, their pets will appear here with details.',
                            icon: Icons.pets_rounded,
                          )
                        : RefreshIndicator(
                            color: primary,
                            onRefresh: _load,
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 14, 16, 24),
                              itemCount: _bookings.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (context, i) {
                                final b = _bookings[i];
                                final id = b['_id']?.toString() ?? '';
                                final pet = b['pet'];
                                final user = b['user'];
                                final petName = pet is Map
                                    ? (pet['name']?.toString() ?? 'Pet')
                                    : 'Pet';
                                final ownerName = user is Map
                                    ? (user['name']?.toString() ?? 'Owner')
                                    : 'Owner';
                                final phone = user is Map
                                    ? (user['phone']?.toString())
                                    : null;
                                final status =
                                    (b['status'] ?? 'pending').toString();
                                final busy = _busyId == id;

                                return Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              width: 46,
                                              height: 46,
                                              decoration: BoxDecoration(
                                                color: primary.withValues(
                                                    alpha: 0.10),
                                                borderRadius:
                                                    BorderRadius.circular(16),
                                              ),
                                              child: Icon(Icons.pets_rounded,
                                                  color: primary),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    '$petName • $ownerName',
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .titleMedium
                                                        ?.copyWith(
                                                          fontWeight:
                                                              FontWeight.w800,
                                                          color: const Color(
                                                              AppConstants
                                                                  .inkColor),
                                                        ),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    'Status: $status',
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .bodySmall
                                                        ?.copyWith(
                                                          fontWeight:
                                                              FontWeight.w700,
                                                          color: const Color(
                                                                  AppConstants
                                                                      .inkColor)
                                                              .withValues(
                                                                  alpha: 0.65),
                                                        ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 12),
                                        Wrap(
                                          spacing: 10,
                                          runSpacing: 10,
                                          children: [
                                            OutlinedButton.icon(
                                              onPressed: phone == null || phone.isEmpty
                                                  ? null
                                                  : () => _call(phone),
                                              icon:
                                                  const Icon(Icons.call_rounded),
                                              label: const Text('Call'),
                                            ),
                                            OutlinedButton.icon(
                                              onPressed: () => _openMaps(b),
                                              icon: const Icon(
                                                  Icons.map_rounded),
                                              label: const Text('Maps'),
                                            ),
                                            if (status == 'pending') ...[
                                              FilledButton.icon(
                                                onPressed: busy
                                                    ? null
                                                    : () => _respond(id, true),
                                                icon: busy
                                                    ? const SizedBox(
                                                        width: 16,
                                                        height: 16,
                                                        child:
                                                            CircularProgressIndicator(
                                                          strokeWidth: 2,
                                                          color: Colors.white,
                                                        ),
                                                      )
                                                    : const Icon(
                                                        Icons.check_rounded),
                                                label:
                                                    const Text('Accept'),
                                                style:
                                                    FilledButton.styleFrom(
                                                  backgroundColor: const Color(
                                                      AppConstants.accentColor),
                                                  foregroundColor:
                                                      Colors.white,
                                                ),
                                              ),
                                              OutlinedButton.icon(
                                                onPressed: busy
                                                    ? null
                                                    : () => _respond(id, false),
                                                icon: const Icon(
                                                    Icons.close_rounded),
                                                label:
                                                    const Text('Decline'),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

