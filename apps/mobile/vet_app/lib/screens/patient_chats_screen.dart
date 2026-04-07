import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'vet_direct_owner_chat_screen.dart';
import '../widgets/partner_scaffold.dart';

/// Inbox: pet owners the vet has treated (shared history) — opens 1:1 vet–owner chat.
class PatientChatsScreen extends StatefulWidget {
  const PatientChatsScreen({super.key});

  @override
  State<PatientChatsScreen> createState() => _PatientChatsScreenState();
}

class _PatientChatsScreenState extends State<PatientChatsScreen> {
  final _api = ApiClient();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _owners = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.getChatsMyPatients();
      final body = res.data;
      if (body is! Map || body['success'] != true) {
        throw Exception('Unable to load patient chats');
      }
      final list = body['data'] as List<dynamic>? ?? [];
      if (!mounted) return;
      setState(() {
        _owners = list
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _loading = false;
      });
    } on DioException catch (e) {
      final d = e.response?.data;
      _error = d is Map && d['message'] is String
          ? d['message'] as String
          : 'Could not load list.';
      setState(() => _loading = false);
    } catch (e) {
      _error = e.toString();
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Patient chats',
      subtitle: 'Owners you’ve treated (1:1)',
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
      body: _loading
          ? Center(child: const PawSewaLoader())
          : _error != null
              ? PartnerEmptyState(
                  title: 'Couldn’t load chats',
                  body: _error!,
                  icon: Icons.wifi_off_rounded,
                  primaryAction: OutlinedButton.icon(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Retry'),
                  ),
                )
              : _owners.isEmpty
                  ? const PartnerEmptyState(
                      title: 'No chats yet',
                      body:
                          'Chats unlock after completing a visit or saving visit notes for an owner’s pet.',
                      icon: Icons.chat_bubble_outline_rounded,
                    )
                  : RefreshIndicator(
                      color: primary,
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                        itemCount: _owners.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final o = _owners[i];
                          final id = o['_id']?.toString() ?? '';
                          final name = o['name']?.toString() ?? 'Pet owner';
                          final pic = o['profilePicture']?.toString();
                          return InkWell(
                            borderRadius: BorderRadius.circular(20),
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => VetDirectOwnerChatScreen(
                                    owner: o,
                                    ownerId: id,
                                  ),
                                ),
                              );
                            },
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 22,
                                      backgroundColor: primary.withValues(alpha: 0.12),
                                      backgroundImage: pic != null && pic.isNotEmpty
                                          ? NetworkImage(pic)
                                          : null,
                                      child: pic == null || pic.isEmpty
                                          ? Text(
                                              name.isNotEmpty
                                                  ? name[0].toUpperCase()
                                                  : '?',
                                              style: TextStyle(
                                                color: primary,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            )
                                          : null,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: GoogleFonts.outfit(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 15,
                                              color: const Color(AppConstants.inkColor),
                                            ),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            'Open chat · send updates, prescriptions, follow‑ups',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: GoogleFonts.outfit(
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w600,
                                              color: const Color(AppConstants.inkColor)
                                                  .withValues(alpha: 0.62),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Icon(
                                      Icons.chevron_right_rounded,
                                      color: const Color(AppConstants.inkColor)
                                          .withValues(alpha: 0.45),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
