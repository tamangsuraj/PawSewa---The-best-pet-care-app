import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api_client.dart';
import '../core/api_config.dart';
import '../core/constants.dart';
import '../core/storage_service.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/premium_empty_state.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  static const _prefsKeyNotifSound = 'pref_notif_sound';
  static const _prefsKeyNotifMarketing = 'pref_notif_marketing';

  final _api = ApiClient();

  String _userName = 'Pet Owner';
  String? _userEmail;
  String? _host;
  bool _notifSound = true;
  bool _notifMarketing = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final host = await ApiConfig.getHost();
    final userRaw = await StorageService().getUser();
    String name = 'Pet Owner';
    String? email;
    if (userRaw != null && userRaw.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(userRaw);
        if (decoded is Map) {
          name = decoded['name']?.toString() ?? name;
          email = decoded['email']?.toString();
        }
      } catch (_) {}
    }

    if (!mounted) return;
    setState(() {
      _userName = name;
      _userEmail = email;
      _host = host;
      _notifSound = prefs.getBool(_prefsKeyNotifSound) ?? true;
      _notifMarketing = prefs.getBool(_prefsKeyNotifMarketing) ?? false;
      _loading = false;
    });
  }

  Future<void> _togglePref(String key, bool v) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, v);
  }

  Future<void> _editServer() async {
    final current = await ApiConfig.getHost();
    if (!mounted) return;
    final controller = TextEditingController(text: current);
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text('Server & connection', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Host or URL',
              hintText: '192.168.1.5 OR https://xxxx.ngrok-free.app',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('Cancel', style: GoogleFonts.outfit()),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(AppConstants.primaryColor),
              ),
              child: Text('Save', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
            ),
          ],
        );
      },
    );
    if (saved != true) {
      controller.dispose();
      return;
    }
    final input = controller.text.trim();
    if (input.isEmpty) {
      controller.dispose();
      return;
    }
    try {
      // Validate connection before persisting (prevents "Failed host lookup" loops).
      final probeUrl = input.startsWith('http://') || input.startsWith('https://')
          ? (input.endsWith('/') ? '${input}api/v1/health' : '$input/api/v1/health')
          : 'http://$input:3000/api/v1/health';
      final r = await ApiClient().dio.getUri(Uri.parse(probeUrl));
      if (r.statusCode != 200) {
        throw Exception('Health check failed (${r.statusCode})');
      }

      await ApiConfig.setHost(controller.text);
      await ApiClient().initialize(); // re-init base URL + headers
      if (!mounted) return;
      setState(() => _host = controller.text.trim());
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Server updated')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not connect. Check the URL/IP and try again. ($e)')),
      );
    } finally {
      controller.dispose();
    }
  }

  Future<void> _resetServer() async {
    await ApiConfig.clearOverride();
    await ApiClient().initialize();
    await _load();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Reverted to default server')),
    );
  }

  Future<void> _logout() async {
    await StorageService().clearAll();
    if (!mounted) return;
    Navigator.of(context).popUntil((r) => r.isFirst);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Signed out')),
    );
  }

  Future<void> _requestDataExport() async {
    // No dedicated endpoint yet: route via Customer Care (already persists in Atlas).
    try {
      final mine = await _api.getCustomerCareMine();
      final body = mine.data;
      final data =
          (body is Map && body['success'] == true) ? body['data'] : null;
      final convId = (data is Map ? data['_id'] : null)?.toString();
      if (convId == null || convId.isEmpty) throw Exception('Support unavailable');
      await _api.postCustomerCareMessage(
        convId,
        '[DATA EXPORT REQUEST]\nPlease export my account data (profile, pets, orders, requests).',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request sent to Customer Care')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not send request. Try again.')),
      );
    }
  }

  Future<void> _requestAccountDelete() async {
    // No dedicated endpoint yet: route via Customer Care (auditable in Atlas).
    try {
      final mine = await _api.getCustomerCareMine();
      final body = mine.data;
      final data =
          (body is Map && body['success'] == true) ? body['data'] : null;
      final convId = (data is Map ? data['_id'] : null)?.toString();
      if (convId == null || convId.isEmpty) throw Exception('Support unavailable');
      await _api.postCustomerCareMessage(
        convId,
        '[ACCOUNT DELETE REQUEST]\nPlease delete my PawSewa account. I understand this action is irreversible.',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request sent to Customer Care')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not send request. Try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const brown = Color(AppConstants.primaryColor);
    const cream = Color(AppConstants.secondaryColor);
    final ink = const Color(AppConstants.inkColor);

    return Scaffold(
      backgroundColor: cream,
      appBar: AppBar(
        backgroundColor: brown,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Settings',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white),
        ),
      ),
      body: SafeArea(
        child: Stack(
          children: [
            const EditorialBodyBackdrop(),
            Positioned.fill(
              child: _loading
                  ? const PremiumEmptyState(
                      title: 'Loading settings',
                      body: 'Preparing your preferences…',
                      icon: Icons.tune_rounded,
                    )
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                      children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Container(
                                width: 46,
                                height: 46,
                                decoration: BoxDecoration(
                                  color: brown.withValues(alpha: 0.10),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Icon(Icons.person_rounded, color: brown),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _userName,
                                      style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                        color: ink,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _userEmail ?? 'Signed in',
                                      style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 12.5,
                                        color: ink.withValues(alpha: 0.65),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                        _Section(
                        title: 'Notifications',
                        children: [
                          _SwitchTile(
                            title: 'Sound',
                            subtitle: 'Play a chime for new chat messages',
                            value: _notifSound,
                            onChanged: (v) {
                              setState(() => _notifSound = v);
                              _togglePref(_prefsKeyNotifSound, v);
                            },
                          ),
                          _SwitchTile(
                            title: 'Marketing updates',
                            subtitle: 'Occasional offers and product news',
                            value: _notifMarketing,
                            onChanged: (v) {
                              setState(() => _notifMarketing = v);
                              _togglePref(_prefsKeyNotifMarketing, v);
                            },
                          ),
                        ],
                      ),

                      const SizedBox(height: 12),
                        _Section(
                        title: 'Connection',
                        children: [
                          _ActionTile(
                            icon: Icons.settings_ethernet_rounded,
                            title: 'Server & base URL',
                            subtitle: _host == null || _host!.isEmpty
                                ? 'Default'
                                : _host!,
                            onTap: _editServer,
                          ),
                          _ActionTile(
                            icon: Icons.restart_alt_rounded,
                            title: 'Reset to default server',
                            subtitle: 'Use the app default (LAN or dart-define/ngrok)',
                            onTap: _resetServer,
                          ),
                        ],
                      ),

                      const SizedBox(height: 12),
                        _Section(
                        title: 'Privacy & legal',
                        children: const [
                          _StaticTile(
                            icon: Icons.privacy_tip_outlined,
                            title: 'Privacy policy',
                            subtitle: 'How your data is handled',
                          ),
                          _StaticTile(
                            icon: Icons.description_outlined,
                            title: 'Terms of service',
                            subtitle: 'Usage and service terms',
                          ),
                        ],
                      ),

                      const SizedBox(height: 12),
                        _Section(
                        title: 'Account',
                        children: [
                          _ActionTile(
                            icon: Icons.download_rounded,
                            title: 'Export my data',
                            subtitle: 'Sends a request to Customer Care',
                            onTap: _requestDataExport,
                          ),
                          _ActionTile(
                            icon: Icons.delete_forever_rounded,
                            title: 'Delete account',
                            subtitle: 'Sends a request to Customer Care',
                            destructive: true,
                            onTap: _requestAccountDelete,
                          ),
                          _ActionTile(
                            icon: Icons.logout_rounded,
                            title: 'Sign out',
                            subtitle: 'Remove your session from this device',
                            destructive: true,
                            onTap: _logout,
                          ),
                        ],
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final ink = const Color(AppConstants.inkColor);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: GoogleFonts.fraunces(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: ink,
              ),
            ),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _SwitchTile extends StatelessWidget {
  const _SwitchTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    const ink = Color(AppConstants.inkColor);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFFDFCFB),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(AppConstants.primaryColor).withValues(alpha: 0.10)),
        ),
        child: ListTile(
          title: Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: ink)),
          subtitle: Text(subtitle, style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: ink.withValues(alpha: 0.65))),
          trailing: Switch(
            value: value,
            activeThumbColor: const Color(AppConstants.accentColor),
            onChanged: onChanged,
          ),
        ),
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
    this.destructive = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    const ink = Color(AppConstants.inkColor);
    const primary = Color(AppConstants.primaryColor);
    final c = destructive ? Colors.red.shade700 : primary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: const Color(0xFFFDFCFB),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: c.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(icon, color: c),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5,
                          color: destructive ? c : ink,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w600,
                          fontSize: 12.5,
                          color: ink.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.chevron_right_rounded, color: ink.withValues(alpha: 0.35)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StaticTile extends StatelessWidget {
  const _StaticTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    const ink = Color(AppConstants.inkColor);
    const primary = Color(AppConstants.primaryColor);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFFDFCFB),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: primary.withValues(alpha: 0.10)),
        ),
        child: ListTile(
          leading: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: primary.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: primary),
          ),
          title: Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: ink)),
          subtitle: Text(subtitle, style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: ink.withValues(alpha: 0.65))),
        ),
      ),
    );
  }
}

