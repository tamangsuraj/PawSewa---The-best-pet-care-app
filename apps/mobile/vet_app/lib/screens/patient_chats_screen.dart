import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'vet_direct_owner_chat_screen.dart';

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
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Patient Chats',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _load,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _owners.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          'No patient chats yet. Chats unlock after you complete a visit or add visit notes for an owner\'s pet.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.outfit(color: Colors.grey[700]),
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _owners.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final o = _owners[i];
                          final id = o['_id']?.toString() ?? '';
                          final name = o['name']?.toString() ?? 'Pet owner';
                          final pic = o['profilePicture']?.toString();
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: const Color(
                                AppConstants.primaryColor,
                              ).withValues(alpha: 0.12),
                              backgroundImage: pic != null && pic.isNotEmpty
                                  ? NetworkImage(pic)
                                  : null,
                              child: pic == null || pic.isEmpty
                                  ? Text(
                                      name.isNotEmpty
                                          ? name[0].toUpperCase()
                                          : '?',
                                      style: const TextStyle(
                                        color: Color(AppConstants.primaryColor),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    )
                                  : null,
                            ),
                            title: Text(
                              name,
                              style: GoogleFonts.outfit(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Text(
                              'Tap to open chat',
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: Colors.grey[600],
                              ),
                            ),
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
                          );
                        },
                      ),
                    ),
    );
  }
}
