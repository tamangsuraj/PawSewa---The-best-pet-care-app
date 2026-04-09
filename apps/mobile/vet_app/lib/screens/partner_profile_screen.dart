import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/storage_service.dart';
import '../services/socket_service.dart';
import 'profile_editor_screen.dart';

class PartnerProfileScreen extends StatefulWidget {
  const PartnerProfileScreen({
    super.key,
    required this.onRoleTap,
    required this.canSwitchPanel,
  });

  final VoidCallback onRoleTap;
  final bool canSwitchPanel;

  @override
  State<PartnerProfileScreen> createState() => _PartnerProfileScreenState();
}

class _PartnerProfileScreenState extends State<PartnerProfileScreen> {
  final _api = ApiClient();
  final _storage = StorageService();

  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _profile;

  @override
  void initState() {
    super.initState();
    debugPrint('[INFO] Initializing Profile view for Partner.');
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resp = await _api.getUserProfile();
      final data = resp.data;
      if (data is Map && data['data'] is Map) {
        final p = Map<String, dynamic>.from(data['data'] as Map);
        if (!mounted) return;
        setState(() {
          _profile = p;
          _loading = false;
        });
        // Keep cached user payload in sync for other screens.
        try {
          await _storage.saveUser(jsonEncode(p));
        } catch (_) {}
        debugPrint('[SUCCESS] User profile data retrieved and mapped.');
      } else {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = 'Invalid profile response';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load profile: $e';
      });
    }
  }

  String _string(dynamic v, {String fallback = '—'}) {
    final s = v?.toString().trim() ?? '';
    return s.isEmpty ? fallback : s;
  }

  String _roleLabel(dynamic role) {
    final raw = _string(role, fallback: '');
    if (raw.isEmpty) return 'Partner';
    return raw.replaceAll('_', ' ').trim();
  }

  String? _photoUrl() {
    final p = _profile;
    if (p == null) return null;
    final candidates = [
      p['profilePicture'],
      p['googlePhotoUrl'],
      p['photoUrl'],
      p['image'],
    ];
    for (final v in candidates) {
      final s = v?.toString().trim() ?? '';
      if (s.startsWith('http://') || s.startsWith('https://')) {
        return s;
      }
    }
    return null;
  }

  Future<void> _logout() async {
    debugPrint('[INFO] User initiated logout sequence.');
    try {
      SocketService.instance.disconnect();
    } catch (_) {}
    try {
      await _storage.clearAll();
    } catch (_) {}
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    const bg = Colors.white;
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    final p = _profile;

    final name = _string(p?['name'] ?? p?['fullName'], fallback: 'Partner');
    final role = _roleLabel(p?['role']);
    final email = _string(p?['email']);
    final partnerId = _string(p?['_id']);

    final totalEarnings = p?['totalEarnings'];
    final totalTasks = p?['totalTasks'] ?? p?['totalTasksCompleted'];

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: _loading
            ? const Center(child: PawSewaLoader())
            : RefreshIndicator(
                onRefresh: _loadProfile,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 18),
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Profile',
                            style: GoogleFonts.outfit(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: ink,
                            ),
                          ),
                        ),
                        if (widget.canSwitchPanel)
                          IconButton(
                            tooltip: 'Switch panel',
                            onPressed: widget.onRoleTap,
                            icon: const Icon(Icons.swap_horiz_rounded),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: primary.withValues(alpha: 0.10)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.06),
                            blurRadius: 18,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 26,
                            backgroundColor: primary.withValues(alpha: 0.10),
                            backgroundImage: _photoUrl() != null
                                ? NetworkImage(_photoUrl()!)
                                : null,
                            child: _photoUrl() == null
                                ? Icon(Icons.person_rounded, color: primary, size: 28)
                                : null,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  name,
                                  style: GoogleFonts.outfit(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: ink,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  role,
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: ink.withValues(alpha: 0.65),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.red.withValues(alpha: 0.20)),
                        ),
                        child: Text(
                          _error!,
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.red.shade700,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    _InfoTile(
                      icon: Icons.email_rounded,
                      label: 'Email',
                      value: email,
                    ),
                    _InfoTile(
                      icon: Icons.badge_rounded,
                      label: 'Partner ID',
                      value: partnerId,
                    ),
                    if (totalEarnings != null)
                      _InfoTile(
                        icon: Icons.payments_rounded,
                        label: 'Total earnings',
                        value: totalEarnings.toString(),
                      ),
                    if (totalTasks != null)
                      _InfoTile(
                        icon: Icons.task_alt_rounded,
                        label: 'Total tasks',
                        value: totalTasks.toString(),
                      ),
                    const SizedBox(height: 12),
                    _ActionTile(
                      icon: Icons.edit_rounded,
                      title: 'Edit profile',
                      subtitle: 'Clinic, payout, identity',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const ProfileEditorScreen()),
                      ),
                    ),
                    if (widget.canSwitchPanel)
                      _ActionTile(
                        icon: Icons.swap_horiz_rounded,
                        title: 'Switch panel',
                        subtitle: 'Vet / Rider / Seller / Care',
                        onTap: widget.onRoleTap,
                      ),
                    const SizedBox(height: 28),
                    SafeArea(
                      top: false,
                      child: SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: _logout,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.red,
                            side: BorderSide(color: Colors.red.withValues(alpha: 0.55)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: Text(
                            'Logout',
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: primary.withValues(alpha: 0.10)),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: primary.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: ink.withValues(alpha: 0.55),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: ink,
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

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: primary.withValues(alpha: 0.10)),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: primary.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: ink,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.outfit(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: ink.withValues(alpha: 0.60),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: ink.withValues(alpha: 0.35)),
          ],
        ),
      ),
    );
  }
}

