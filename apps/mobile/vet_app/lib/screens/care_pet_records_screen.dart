import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/partner_role.dart';
import '../core/storage_service.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';
import 'partner_marketplace_chat_screen.dart';

/// Care center "Pet records" — not placeholder: shows real incoming bookings and
/// provides practical actions (call owner, open maps, mark accepted/declined).
class CarePetRecordsScreen extends StatefulWidget {
  const CarePetRecordsScreen({super.key});

  @override
  State<CarePetRecordsScreen> createState() => _CarePetRecordsScreenState();
}

class _CarePetRecordsScreenState extends State<CarePetRecordsScreen> {
  final _api = ApiClient();
  final _storage = StorageService();
  bool _loading = true;
  bool _accessDenied = false;
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
    _gateAndLoad();
  }

  Future<void> _gateAndLoad() async {
    final raw = await _storage.getUser();
    String serverRole = '';
    if (raw != null && raw.trim().isNotEmpty) {
      try {
        final m = jsonDecode(raw);
        if (m is Map) serverRole = (m['role'] ?? '').toString();
      } catch (_) {/* ignore */}
    }
    if (!canAccessCarePetRecords(serverRole)) {
      if (mounted) {
        setState(() {
          _accessDenied = true;
          _loading = false;
        });
      }
      return;
    }
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

  Future<void> _messageOwner(String bookingId) async {
    try {
      final r = await _api.openCareMarketplaceChat(bookingId);
      final body = r.data;
      if (!mounted) return;
      if (body is Map && body['success'] == true && body['data'] is Map) {
        final conv = body['data'] as Map<String, dynamic>;
        final cid = conv['_id']?.toString();
        final customer = conv['customer'];
        final name = customer is Map ? (customer['name']?.toString() ?? 'Owner') : 'Owner';
        if (cid != null) {
          await Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => PartnerMarketplaceChatScreen(
                conversationId: cid,
                peerName: name,
                peerSubtitle: 'Care booking',
                highContrast: true,
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Chat unavailable: $e')));
    }
  }

  Future<void> _manageBooking(Map<String, dynamic> b) async {
    final id = b['_id']?.toString() ?? '';
    if (id.isEmpty) return;
    final notesCtrl = TextEditingController(text: b['facilityNotes']?.toString() ?? '');
    final labelCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final vaccineCtrl = TextEditingController(text: (b['intake'] is Map) ? ((b['intake'] as Map)['vaccination']?.toString() ?? '') : '');
    final dietCtrl = TextEditingController(text: (b['intake'] is Map) ? ((b['intake'] as Map)['diet']?.toString() ?? '') : '');
    final tempCtrl = TextEditingController(text: (b['intake'] is Map) ? ((b['intake'] as Map)['temperament']?.toString() ?? '') : '');
    final incidentTitleCtrl = TextEditingController();
    final incidentNotesCtrl = TextEditingController();
    String severity = 'low';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        final primary = Theme.of(ctx).colorScheme.primary;
        return SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 24 + MediaQuery.paddingOf(ctx).bottom),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: 12),
                Text('Booking tools', style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 14),
                TextField(
                  controller: notesCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Facility notes', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                FilledButton.tonal(
                  onPressed: () async {
                    try {
                      await _api.updateBookingFacilityNotes(id, notesCtrl.text.trim());
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Notes saved')));
                    } catch (e) {
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Failed: $e')));
                    }
                  },
                  style: FilledButton.styleFrom(backgroundColor: primary.withValues(alpha: 0.12), foregroundColor: primary),
                  child: const Text('Save notes'),
                ),
                const SizedBox(height: 18),
                Text('Extra charges', style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: labelCtrl,
                        decoration: const InputDecoration(labelText: 'Label', border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 120,
                      child: TextField(
                        controller: amountCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'NPR', border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: () async {
                    final label = labelCtrl.text.trim();
                    final amt = double.tryParse(amountCtrl.text.trim());
                    if (label.isEmpty || amt == null) return;
                    try {
                      await _api.addBookingExtraCharge(bookingId: id, label: label, amount: amt);
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Charge added')));
                      labelCtrl.clear();
                      amountCtrl.clear();
                    } catch (e) {
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Failed: $e')));
                    }
                  },
                  child: const Text('Add charge'),
                ),
                const SizedBox(height: 18),
                Text('Intake', style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                TextField(controller: vaccineCtrl, decoration: const InputDecoration(labelText: 'Vaccination', border: OutlineInputBorder())),
                const SizedBox(height: 8),
                TextField(controller: dietCtrl, decoration: const InputDecoration(labelText: 'Diet', border: OutlineInputBorder())),
                const SizedBox(height: 8),
                TextField(controller: tempCtrl, decoration: const InputDecoration(labelText: 'Temperament', border: OutlineInputBorder())),
                const SizedBox(height: 10),
                FilledButton.tonal(
                  onPressed: () async {
                    try {
                      await _api.updateBookingIntake(id, {
                        'vaccination': vaccineCtrl.text.trim(),
                        'diet': dietCtrl.text.trim(),
                        'temperament': tempCtrl.text.trim(),
                      });
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Intake saved')));
                    } catch (e) {
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Failed: $e')));
                    }
                  },
                  style: FilledButton.styleFrom(backgroundColor: primary.withValues(alpha: 0.12), foregroundColor: primary),
                  child: const Text('Save intake'),
                ),
                const SizedBox(height: 18),
                Text('Incident log', style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                TextField(controller: incidentTitleCtrl, decoration: const InputDecoration(labelText: 'Title *', border: OutlineInputBorder())),
                const SizedBox(height: 8),
                TextField(controller: incidentNotesCtrl, maxLines: 3, decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder())),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: severity,
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(value: 'medium', child: Text('Medium')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                  ],
                  onChanged: (v) => severity = v ?? 'low',
                  decoration: const InputDecoration(labelText: 'Severity', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                FilledButton.tonal(
                  onPressed: () async {
                    final t = incidentTitleCtrl.text.trim();
                    if (t.isEmpty) return;
                    try {
                      await _api.addBookingIncident(
                        bookingId: id,
                        title: t,
                        notes: incidentNotesCtrl.text.trim(),
                        severity: severity,
                      );
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Incident logged')));
                      incidentTitleCtrl.clear();
                      incidentNotesCtrl.clear();
                    } catch (e) {
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Failed: $e')));
                    }
                  },
                  style: FilledButton.styleFrom(backgroundColor: primary.withValues(alpha: 0.12), foregroundColor: primary),
                  child: const Text('Add incident'),
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  onPressed: () async {
                    try {
                      await _api.markBookingCompleted(id);
                      if (ctx.mounted) Navigator.pop(ctx);
                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Marked completed')));
                      await _load();
                    } catch (e) {
                      if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Failed: $e')));
                    }
                  },
                  icon: const Icon(Icons.check_circle_rounded),
                  label: const Text('Mark completed'),
                ),
              ],
            ),
          ),
        );
      },
    );

    notesCtrl.dispose();
    labelCtrl.dispose();
    amountCtrl.dispose();
    vaccineCtrl.dispose();
    dietCtrl.dispose();
    tempCtrl.dispose();
    incidentTitleCtrl.dispose();
    incidentNotesCtrl.dispose();
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
          onPressed: (_loading || _accessDenied) ? null : _load,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
      body: Stack(
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: _accessDenied
                ? PartnerEmptyState(
                    title: 'Care centre access only',
                    body:
                        'Pet intake and stay records are limited to care staff roles. Delivery partners use Delivery jobs; veterinarians use Clinic queue and assignments.',
                    icon: Icons.lock_outline_rounded,
                    primaryAction: OutlinedButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      child: const Text('Go back'),
                    ),
                  )
                : _loading
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
                              separatorBuilder: (_, _) =>
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
                                            OutlinedButton.icon(
                                              onPressed: () => _messageOwner(id),
                                              icon: const Icon(Icons.chat_bubble_outline_rounded),
                                              label: const Text('Message'),
                                            ),
                                            OutlinedButton.icon(
                                              onPressed: () => _manageBooking(b),
                                              icon: const Icon(Icons.tune_rounded),
                                              label: const Text('Manage'),
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

