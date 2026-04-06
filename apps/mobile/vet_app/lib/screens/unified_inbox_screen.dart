import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/storage_service.dart';
import '../services/ongoing_call_service.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';
import 'notifications_screen.dart';
import 'partner_marketplace_chat_screen.dart';
import 'partner_support_chat_screen.dart';

class UnifiedInboxScreen extends StatefulWidget {
  const UnifiedInboxScreen({super.key});

  @override
  State<UnifiedInboxScreen> createState() => _UnifiedInboxScreenState();
}

class _UnifiedInboxScreenState extends State<UnifiedInboxScreen> with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  final _storage = StorageService();
  late final TabController _tabs;

  String _query = '';

  bool _loadingChats = true;
  String? _chatError;
  List<Map<String, dynamic>> _chatRows = [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
    _hydrateCache();
    _loadChats();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _hydrateCache() async {
    try {
      final raw = await _storage.getCache('partner:unified_inbox:chats');
      if (raw == null || raw.trim().isEmpty) return;
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        final list = decoded.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        if (mounted) setState(() => _chatRows = list);
      }
    } catch (_) {}
  }

  Future<void> _loadChats() async {
    setState(() {
      _loadingChats = true;
      _chatError = null;
    });
    try {
      Future<Response> safe(Future<Response> f) async {
        try {
          return await f;
        } catch (_) {
          return Response(
            requestOptions: RequestOptions(path: ''),
            data: const {'success': true, 'data': []},
          );
        }
      }

      final futures = await Future.wait<Response>([
        safe(_api.getSellerMarketplaceInbox()),
        safe(_api.getRiderMarketplaceInbox()),
        safe(_api.getCareMarketplaceInbox()),
      ]);
      final all = <Map<String, dynamic>>[];
      for (final r in futures) {
        final body = r.data;
        if (body is Map && body['success'] == true && body['data'] is List) {
          for (final e in body['data'] as List) {
            if (e is Map) all.add(Map<String, dynamic>.from(e));
          }
        }
      }
      // Normalize for display: each row must have _id, type, peer label.
      for (final row in all) {
        row['__threadType'] = (row['type']?.toString() ?? 'SELLER').toUpperCase();
      }
      all.sort((a, b) {
        final at = a['lastMessageAt']?.toString() ?? a['updatedAt']?.toString() ?? '';
        final bt = b['lastMessageAt']?.toString() ?? b['updatedAt']?.toString() ?? '';
        return bt.compareTo(at);
      });
      if (!mounted) return;
      setState(() {
        _chatRows = all;
        _loadingChats = false;
      });
      await _storage.setCache('partner:unified_inbox:chats', jsonEncode(all));
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _chatError = e.response?.data is Map
            ? (e.response!.data as Map)['message']?.toString() ?? 'Network error'
            : 'Network error';
        _loadingChats = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _chatError = '$e';
        _loadingChats = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filteredChats {
    if (_query.trim().isEmpty) return _chatRows;
    final q = _query.trim().toLowerCase();
    return _chatRows.where((r) {
      final type = r['type']?.toString().toLowerCase() ?? '';
      final customer = r['customer'];
      final partner = r['partner'];
      final lastProductName = r['lastProductName']?.toString().toLowerCase() ?? '';
      final nameA = customer is Map ? (customer['name']?.toString().toLowerCase() ?? '') : '';
      final nameB = partner is Map ? (partner['name']?.toString().toLowerCase() ?? '') : '';
      return type.contains(q) || nameA.contains(q) || nameB.contains(q) || lastProductName.contains(q);
    }).toList();
  }

  Future<void> _openConversation(Map<String, dynamic> row) async {
    final id = row['_id']?.toString();
    if (id == null || id.isEmpty) return;
    final customer = row['customer'];
    // In partner inbox lists, peer is always customer for SELLER/CARE and customer for DELIVERY too.
    final peerName = customer is Map ? (customer['name']?.toString() ?? 'Customer') : 'Customer';
    final subtitle = row['type']?.toString() == 'SELLER'
        ? (row['lastProductName']?.toString().isNotEmpty == true ? row['lastProductName']?.toString() : 'Product inquiry')
        : row['type']?.toString() == 'DELIVERY'
            ? 'Delivery chat'
            : 'Care booking';

    await _api.clearUnreadThread(conversationId: id).catchError((_) {});

    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PartnerMarketplaceChatScreen(
          conversationId: id,
          peerName: peerName,
          peerSubtitle: subtitle,
          highContrast: false,
        ),
      ),
    );
    await _loadChats();
  }

  Future<void> _markUnread(Map<String, dynamic> row) async {
    final id = row['_id']?.toString();
    if (id == null || id.isEmpty) return;
    await _api.markUnreadThread(conversationId: id, count: 1).catchError((_) {});
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Marked unread')));
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Unified inbox',
      subtitle: 'Chats, support, calls, notifications',
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: () async {
            await _loadChats();
          },
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
      body: Stack(
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: TextField(
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'Search chats, customers, products…',
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: TabBar(
                    controller: _tabs,
                    labelColor: primary,
                    indicatorColor: primary,
                    tabs: const [
                      Tab(text: 'Customer chats'),
                      Tab(text: 'Support'),
                      Tab(text: 'Calls'),
                      Tab(text: 'Notifications'),
                    ],
                  ),
                ),
                Expanded(
                  child: TabBarView(
                    controller: _tabs,
                    children: [
                      _CustomerChatsTab(
                        primary: primary,
                        loading: _loadingChats,
                        error: _chatError,
                        rows: _filteredChats,
                        onOpen: _openConversation,
                        onMarkUnread: _markUnread,
                      ),
                      const PartnerSupportChatScreen(),
                      const _CallsTab(),
                      const NotificationsScreen(),
                    ],
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

class _CustomerChatsTab extends StatelessWidget {
  const _CustomerChatsTab({
    required this.primary,
    required this.loading,
    required this.error,
    required this.rows,
    required this.onOpen,
    required this.onMarkUnread,
  });

  final Color primary;
  final bool loading;
  final String? error;
  final List<Map<String, dynamic>> rows;
  final Future<void> Function(Map<String, dynamic>) onOpen;
  final Future<void> Function(Map<String, dynamic>) onMarkUnread;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Center(child: CircularProgressIndicator(color: primary));
    }
    if (error != null) {
      return PartnerEmptyState(
        title: 'Couldn’t load inbox',
        body: error!,
        icon: Icons.wifi_off_rounded,
        primaryAction: OutlinedButton.icon(
          onPressed: null,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
        ),
      );
    }
    if (rows.isEmpty) {
      return const PartnerEmptyState(
        title: 'No chats yet',
        body: 'Seller, delivery, and care threads will show here.',
        icon: Icons.chat_bubble_outline_rounded,
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: rows.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final r = rows[i];
        final id = r['_id']?.toString() ?? '';
        final type = r['type']?.toString() ?? '';
        final cust = r['customer'];
        final name = cust is Map ? (cust['name']?.toString() ?? 'Customer') : 'Customer';
        final subtitle = type == 'SELLER'
            ? (r['lastProductName']?.toString().isNotEmpty == true ? 'About: ${r['lastProductName']}' : 'Product inquiry')
            : type == 'DELIVERY'
                ? 'Delivery'
                : type == 'CARE'
                    ? 'Care booking'
                    : type;
        return InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => onOpen(r),
          onLongPress: () => onMarkUnread(r),
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
                    child: Icon(
                      type == 'DELIVERY'
                          ? Icons.delivery_dining_rounded
                          : type == 'CARE'
                              ? Icons.pets_rounded
                              : Icons.storefront_rounded,
                      color: primary,
                    ),
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
                          style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 15),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: const Color(AppConstants.inkColor).withValues(alpha: 0.65),
                          ),
                        ),
                        if (id.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            'Long‑press → Mark unread',
                            style: GoogleFonts.outfit(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: const Color(AppConstants.inkColor).withValues(alpha: 0.45),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Icon(Icons.chevron_right_rounded, color: Colors.black.withValues(alpha: 0.35)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CallsTab extends StatelessWidget {
  const _CallsTab();

  @override
  Widget build(BuildContext context) {
    // Call history API isn't exposed yet; show a high-value “return to call” if active.
    final ongoing = OngoingCallService(); // fallback; real instance is provided via Provider in app
    final active = ongoing.active;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: [
        if (active)
          Card(
            child: ListTile(
              leading: const Icon(Icons.call_rounded, color: Colors.green),
              title: const Text('Call in progress'),
              subtitle: Text(ongoing.label ?? 'Tap to return'),
              trailing: const Icon(Icons.arrow_forward_rounded),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Return-to-call is handled by the call screen UI')),
                );
              },
            ),
          ),
        if (!active)
          const PartnerEmptyState(
            title: 'No call history yet',
            body: 'Calls will appear here once the backend exposes call history.',
            icon: Icons.call_rounded,
          ),
      ],
    );
  }
}

