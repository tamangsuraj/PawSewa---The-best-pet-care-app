import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';
import 'partner_marketplace_chat_screen.dart';
import 'partner_support_chat_screen.dart';

/// Customer inquiries for shop owners (Daraz-style inbox).
class SellerInquiriesScreen extends StatefulWidget {
  const SellerInquiriesScreen({super.key});

  @override
  State<SellerInquiriesScreen> createState() => _SellerInquiriesScreenState();
}

class _SellerInquiriesScreenState extends State<SellerInquiriesScreen> {
  final _api = ApiClient();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];

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
      final r = await _api.getSellerMarketplaceInbox();
      final body = r.data;
      if (body is Map && body['success'] == true && body['data'] is List) {
        _rows = (body['data'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
    } catch (e) {
      _error = e is DioException ? '${e.response?.data ?? e.message}' : '$e';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Inquiries',
      subtitle: 'Reply fast to convert more orders',
      actions: [
        IconButton(
          icon: const Icon(Icons.support_agent_rounded),
          tooltip: 'Support',
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const PartnerSupportChatScreen(),
              ),
            );
          },
        ),
      ],
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: _loading
                ? Center(
                    child: CircularProgressIndicator(color: primary),
                  )
                : _error != null
                    ? PartnerEmptyState(
                        title: 'Couldn’t load inquiries',
                        body: _error!,
                        icon: Icons.wifi_off_rounded,
                        primaryAction: OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                        ),
                      )
                    : _rows.isEmpty
                        ? const PartnerEmptyState(
                            title: 'No messages yet',
                            body:
                                'When customers ask about products, your conversations will show here.',
                            icon: Icons.chat_bubble_outline_rounded,
                          )
                        : RefreshIndicator(
                            color: primary,
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                              itemCount: _rows.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: 10),
                              itemBuilder: (context, i) {
                                final row = _rows[i];
                                final id = row['_id']?.toString() ?? '';
                                final cust = row['customer'];
                                final name = cust is Map
                                    ? (cust['name']?.toString() ?? 'Customer')
                                    : 'Customer';
                                final product =
                                    row['lastProductName']?.toString() ?? '';
                                final last =
                                    row['lastMessage']?.toString().trim() ?? '';
                                return InkWell(
                                  borderRadius: BorderRadius.circular(20),
                                  onTap: () {
                                    Navigator.of(context)
                                        .push(
                                          MaterialPageRoute(
                                            builder: (_) =>
                                                PartnerMarketplaceChatScreen(
                                              conversationId: id,
                                              peerName: name,
                                              peerSubtitle:
                                                  product.isNotEmpty ? product : null,
                                              highContrast: false,
                                            ),
                                          ),
                                        )
                                        .then((_) => _load());
                                  },
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
                                              borderRadius:
                                                  BorderRadius.circular(16),
                                            ),
                                            child: Icon(
                                              Icons.person_rounded,
                                              color: primary,
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Row(
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        name,
                                                        maxLines: 1,
                                                        overflow:
                                                            TextOverflow.ellipsis,
                                                        style: GoogleFonts.outfit(
                                                          fontWeight:
                                                              FontWeight.w700,
                                                          fontSize: 15,
                                                        ),
                                                      ),
                                                    ),
                                                    Container(
                                                      padding:
                                                          const EdgeInsets.symmetric(
                                                        horizontal: 10,
                                                        vertical: 5,
                                                      ),
                                                      decoration: BoxDecoration(
                                                        color: const Color(
                                                                AppConstants
                                                                    .sandColor)
                                                            .withValues(alpha: 0.9),
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                                999),
                                                        border: Border.all(
                                                          color: primary.withValues(
                                                              alpha: 0.10),
                                                        ),
                                                      ),
                                                      child: Text(
                                                        'Reply',
                                                        style: GoogleFonts.outfit(
                                                          fontSize: 11,
                                                          fontWeight:
                                                              FontWeight.w700,
                                                          color: const Color(
                                                              AppConstants.inkColor),
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  product.isNotEmpty
                                                      ? 'About: $product'
                                                      : 'Product inquiry',
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: GoogleFonts.outfit(
                                                    fontSize: 12.5,
                                                    fontWeight: FontWeight.w600,
                                                    color: const Color(
                                                        AppConstants.inkColor)
                                                    .withValues(alpha: 0.72),
                                                  ),
                                                ),
                                                if (last.isNotEmpty) ...[
                                                  const SizedBox(height: 6),
                                                  Text(
                                                    last,
                                                    maxLines: 2,
                                                    overflow:
                                                        TextOverflow.ellipsis,
                                                    style: GoogleFonts.outfit(
                                                      fontSize: 12.5,
                                                      height: 1.25,
                                                      color: const Color(
                                                          AppConstants.inkColor)
                                                      .withValues(alpha: 0.60),
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
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
