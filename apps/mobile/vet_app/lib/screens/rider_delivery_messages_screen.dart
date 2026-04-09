import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../services/socket_service.dart';
import 'partner_marketplace_chat_screen.dart';

/// Rider-only delivery marketplace threads (real-time list refresh via Socket.io).
class RiderDeliveryMessagesScreen extends StatefulWidget {
  const RiderDeliveryMessagesScreen({super.key});

  @override
  State<RiderDeliveryMessagesScreen> createState() =>
      _RiderDeliveryMessagesScreenState();
}

class _RiderDeliveryMessagesScreenState extends State<RiderDeliveryMessagesScreen> {
  final _api = ApiClient();
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  String? _error;

  void _onMarketplaceMessage(Map<String, dynamic> _) {
    if (!mounted) return;
    unawaited(_load(silent: true));
  }

  @override
  void initState() {
    super.initState();
    _load();
    SocketService.instance.connect();
    SocketService.instance.addMarketplaceMessageListener(_onMarketplaceMessage);
    SocketService.instance.addNewMessageListener(_onMarketplaceMessage);
  }

  @override
  void dispose() {
    SocketService.instance.removeMarketplaceMessageListener(_onMarketplaceMessage);
    SocketService.instance.removeNewMessageListener(_onMarketplaceMessage);
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final r = await _api.getRiderMarketplaceInbox();
      final body = r.data;
      final list = <Map<String, dynamic>>[];
      if (body is Map && body['success'] == true && body['data'] is List) {
        for (final e in body['data'] as List) {
          if (e is Map) list.add(Map<String, dynamic>.from(e));
        }
      }
      list.sort((a, b) {
        final at = a['lastMessageAt']?.toString() ?? a['updatedAt']?.toString() ?? '';
        final bt = b['lastMessageAt']?.toString() ?? b['updatedAt']?.toString() ?? '';
        return bt.compareTo(at);
      });
      if (!mounted) return;
      setState(() {
        _rows = list;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is DioException && e.response?.data is Map
            ? (e.response!.data as Map)['message']?.toString() ?? 'Failed to load'
            : 'Failed to load messages';
      });
    }
  }

  Future<void> _openThread(Map<String, dynamic> row) async {
    final id = row['_id']?.toString();
    if (id == null || id.isEmpty) return;
    final customer = row['customer'];
    final peerName =
        customer is Map ? (customer['name']?.toString() ?? 'Customer') : 'Customer';
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PartnerMarketplaceChatScreen(
          conversationId: id,
          peerName: peerName,
          peerSubtitle: 'Order progress',
        ),
      ),
    );
    if (mounted) await _load(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    const accent = Color(AppConstants.accentColor);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        title: Text(
          'Order messages',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 18),
        ),
      ),
      body: RefreshIndicator(
        color: primary,
        onRefresh: () => _load(silent: true),
        child: _loading
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                children: const [
                  SizedBox(height: 120),
                  Center(child: PawSewaLoader()),
                ],
              )
            : _error != null
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.all(24),
                    children: [
                      Text(
                        _error!,
                        style: GoogleFonts.outfit(
                          color: Colors.red[800],
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => _load(),
                        child: Text('Retry', style: GoogleFonts.outfit(color: primary)),
                      ),
                    ],
                  )
                : _rows.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics(),
                        ),
                        padding: const EdgeInsets.all(32),
                        children: [
                          Icon(Icons.chat_bubble_outline, size: 56, color: Colors.grey[400]),
                          const SizedBox(height: 16),
                          Text(
                            'No delivery threads yet',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[700],
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        physics: const BouncingScrollPhysics(
                          parent: AlwaysScrollableScrollPhysics(),
                        ),
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                        itemCount: _rows.length,
                        itemBuilder: (context, i) {
                          final row = _rows[i];
                          final customer = row['customer'];
                          final name = customer is Map
                              ? (customer['name']?.toString() ?? 'Customer')
                              : 'Customer';
                          final last = row['lastMessagePreview']?.toString() ??
                              row['lastMessage']?.toString() ??
                              '';
                          return Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: ListTile(
                              onTap: () => _openThread(row),
                              leading: CircleAvatar(
                                backgroundColor: accent.withValues(alpha: 0.2),
                                child: Icon(Icons.local_shipping_rounded, color: accent),
                              ),
                              title: Text(
                                name,
                                style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                              ),
                              subtitle: last.isNotEmpty
                                  ? Text(
                                      last,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(fontSize: 13),
                                    )
                                  : null,
                              trailing: const Icon(Icons.chevron_right_rounded),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}

