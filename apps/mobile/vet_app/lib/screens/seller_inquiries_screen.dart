import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'partner_marketplace_chat_screen.dart';

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
    const primary = Color(AppConstants.primaryColor);
    return Scaffold(
      appBar: AppBar(
        title: Text('Customer Inquiries', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: primary))
          : _error != null
          ? Center(child: Text(_error!, textAlign: TextAlign.center))
          : _rows.isEmpty
          ? Center(
              child: Text(
                'No inquiries yet.',
                style: GoogleFonts.poppins(color: Colors.grey[600]),
              ),
            )
          : RefreshIndicator(
              color: primary,
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: _rows.length,
                itemBuilder: (context, i) {
                  final row = _rows[i];
                  final id = row['_id']?.toString() ?? '';
                  final cust = row['customer'];
                  final name = cust is Map ? (cust['name']?.toString() ?? 'Customer') : 'Customer';
                  final product = row['lastProductName']?.toString() ?? '';
                  return Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: primary.withValues(alpha: 0.12),
                        child: const Icon(Icons.person, color: primary),
                      ),
                      title: Text(name, style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        product.isNotEmpty ? 'About: $product' : 'Tap to reply',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => PartnerMarketplaceChatScreen(
                              conversationId: id,
                              peerName: name,
                              peerSubtitle: product.isNotEmpty ? product : null,
                              highContrast: false,
                            ),
                          ),
                        ).then((_) => _load());
                      },
                    ),
                  );
                },
              ),
            ),
    );
  }
}
