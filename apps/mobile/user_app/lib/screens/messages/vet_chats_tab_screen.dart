import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/storage_service.dart';
import '../../services/chat_unread_notify_service.dart';
import '../../services/socket_service.dart';
import 'vet_direct_chat_screen.dart';

/// Vets linked to the owner's visits, appointments, and care — chat only (no calls here).
class VetChatsTabScreen extends StatefulWidget {
  const VetChatsTabScreen({super.key});

  @override
  State<VetChatsTabScreen> createState() => _VetChatsTabScreenState();
}

class _VetChatsTabScreenState extends State<VetChatsTabScreen> {
  final _api = ApiClient();
  final _socket = SocketService.instance;

  List<Map<String, dynamic>> _vets = [];
  Map<String, bool> _vetOnline = {};
  String? _ownerId;
  bool _loading = true;
  String? _error;
  Timer? _presenceTimer;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _loadOwnerId();
    await _loadVets();
    await _socket.connect();
    _refreshPresence();
    _presenceTimer?.cancel();
    _presenceTimer = Timer.periodic(
      const Duration(seconds: 25),
      (_) => _refreshPresence(),
    );
  }

  Future<void> _loadOwnerId() async {
    final raw = await StorageService().getUser();
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      final id = m['_id'] ?? m['id'];
      if (id != null && mounted) setState(() => _ownerId = id.toString());
    } catch (_) {}
  }

  Future<void> _loadVets() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.getChatsMyVets();
      final body = res.data;
      if (body is Map && body['success'] == true) {
        final list = body['data'] as List<dynamic>? ?? [];
        if (!mounted) return;
        setState(() {
          _vets = list
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
          _loading = false;
        });
        return;
      }
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not load your vets.';
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[VetChatsTab] $e');
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not load your vets. Pull to retry.';
        });
      }
    }
  }

  void _refreshPresence() {
    final ids = _vets
        .map((v) => v['_id']?.toString())
        .whereType<String>()
        .toList();
    if (ids.isEmpty || !_socket.isConnected) return;
    _socket.queryVetPresence(ids, (map) {
      if (!mounted) return;
      setState(() {
        _vetOnline = {
          for (final e in map.entries)
            e.key: e.value == true || e.value == 'true',
        };
      });
    });
  }

  int _vetUnread(ChatUnreadNotifyService unread, String vetId) {
    final oid = _ownerId;
    if (oid == null) return 0;
    return unread.unreadByThreadKey['v:$oid:$vetId'] ?? 0;
  }

  void _openChat(Map<String, dynamic> vet) {
    final oid = _ownerId;
    if (oid == null) return;
    Navigator.of(context)
        .push<void>(
      MaterialPageRoute<void>(
        builder: (_) => VetDirectChatScreen(vet: vet, ownerId: oid),
      ),
    )
        .then((_) async {
      if (!mounted) return;
      await context.read<ChatUnreadNotifyService>().refreshFromApi();
      if (mounted) _refreshPresence();
    });
  }

  @override
  void dispose() {
    _presenceTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    const accent = Color(AppConstants.accentColor);
    final unread = context.watch<ChatUnreadNotifyService>();

    if (_loading) {
      return const Center(child: PawSewaLoader());
    }

    return RefreshIndicator(
      color: primary,
      onRefresh: () async {
        await context.read<ChatUnreadNotifyService>().refreshFromApi();
        await _loadVets();
        _refreshPresence();
      },
      child: _vets.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(24),
              children: [
                _InfoHeader(accent: accent),
                const SizedBox(height: 24),
                Text(
                  _error ??
                      'No vets linked yet.\nAfter a clinic visit, vet check-up, or home visit, your vet will appear here for follow-up chat.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(color: Colors.grey[700], height: 1.45),
                ),
              ],
            )
          : ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              itemCount: _vets.length + 1,
              itemBuilder: (context, i) {
                if (i == 0) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _InfoHeader(accent: accent),
                  );
                }
                final v = _vets[i - 1];
                final id = v['_id']?.toString() ?? '';
                final name = v['name']?.toString() ?? 'Vet';
                final display =
                    name.startsWith('Dr.') ? name : 'Dr. $name';
                final pic = v['profilePicture']?.toString();
                final clinic = v['clinicName']?.toString().trim();
                final spec = v['specialization']?.toString().trim() ??
                    v['specialty']?.toString().trim();
                final sub = clinic?.isNotEmpty == true
                    ? clinic!
                    : (spec?.isNotEmpty == true ? spec! : 'Tap to message');
                final online = _vetOnline[id] == true;
                final badge = _vetUnread(unread, id);

                return Card(
                  color: Colors.white,
                  margin: const EdgeInsets.only(bottom: 10),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(color: primary.withValues(alpha: 0.12)),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    leading: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        CircleAvatar(
                          radius: 26,
                          backgroundColor: primary.withValues(alpha: 0.12),
                          backgroundImage:
                              pic != null && pic.isNotEmpty
                                  ? NetworkImage(pic)
                                  : null,
                          child: pic == null || pic.isEmpty
                              ? Text(
                                  name.isNotEmpty
                                      ? name[0].toUpperCase()
                                      : '?',
                                  style: GoogleFonts.outfit(
                                    fontWeight: FontWeight.w700,
                                    color: primary,
                                  ),
                                )
                              : null,
                        ),
                        if (online)
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: Colors.green,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 2,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    title: Text(
                      display,
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: const Color(AppConstants.inkColor),
                      ),
                    ),
                    subtitle: Text(
                      sub,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        color: Colors.grey[700],
                      ),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (badge > 0) _UnreadBadge(count: badge),
                        const SizedBox(width: 4),
                        Icon(
                          Icons.chat_bubble_outline_rounded,
                          color: primary.withValues(alpha: 0.85),
                          size: 22,
                        ),
                      ],
                    ),
                    onTap: () => _openChat(v),
                  ),
                );
              },
            ),
    );
  }
}

class _InfoHeader extends StatelessWidget {
  const _InfoHeader({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.medical_services_outlined, color: accent, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your pet\'s visits',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: accent,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Message vets from appointments, clinic visits, and care bookings. For PawSewa support or calls, use the Support tab.',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    height: 1.4,
                    color: Colors.grey[800],
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

class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.redAccent,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        count > 99 ? '99+' : '$count',
        style: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}
