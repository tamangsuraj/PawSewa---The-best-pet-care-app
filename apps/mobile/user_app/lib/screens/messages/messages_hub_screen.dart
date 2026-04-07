import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import 'messages_screen.dart';
import 'marketplace_thread_screen.dart';

/// Inbox with Support (Customer Care), Sellers, and Delivery groupings.
class MessagesHubScreen extends StatefulWidget {
  const MessagesHubScreen({super.key});

  @override
  State<MessagesHubScreen> createState() => _MessagesHubScreenState();
}

class _MessagesHubScreenState extends State<MessagesHubScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _api = ApiClient();

  List<Map<String, dynamic>> _care = [];
  List<Map<String, dynamic>> _sellers = [];
  List<Map<String, dynamic>> _delivery = [];
  bool _loadingMp = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_onTab);
    _loadMarketplace();
  }

  void _onTab() {
    if (_tabController.indexIsChanging) return;
    setState(() {});
    if (_tabController.index != 0) {
      _loadMarketplace();
    }
  }

  Future<void> _loadMarketplace() async {
    setState(() => _loadingMp = true);
    try {
      final r = await _api.getMarketplaceInbox();
      final body = r.data;
      if (body is Map && body['success'] == true && body['data'] is Map) {
        final d = body['data'] as Map;
        final c = d['care'];
        final s = d['sellers'];
        final del = d['delivery'];
        if (!mounted) return;
        setState(() {
          _care = c is List
              ? c.map((e) => Map<String, dynamic>.from(e as Map)).toList()
              : [];
          _sellers = s is List
              ? s.map((e) => Map<String, dynamic>.from(e as Map)).toList()
              : [];
          _delivery = del is List
              ? del.map((e) => Map<String, dynamic>.from(e as Map)).toList()
              : [];
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[Inbox] marketplace load: $e');
    } finally {
      if (mounted) setState(() => _loadingMp = false);
    }
  }

  void _openSellerThread(Map<String, dynamic> row) {
    final id = row['_id']?.toString();
    if (id == null) return;
    final partner = row['partner'];
    final name = partner is Map ? (partner['name']?.toString() ?? 'Seller') : 'Seller';
    final productName = row['lastProductName']?.toString() ?? '';
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MarketplaceThreadScreen(
          conversationId: id,
          threadType: 'SELLER',
          peerName: name,
          peerSubtitle: productName.isNotEmpty ? 'Re: $productName' : null,
          productIdForFirstMessage: null,
        ),
      ),
    ).then((_) => _loadMarketplace());
  }

  void _openCareCentreThread(Map<String, dynamic> row) {
    final id = row['_id']?.toString();
    if (id == null) return;
    final partner = row['partner'];
    final name = partner is Map ? (partner['name']?.toString() ?? 'Care centre') : 'Care centre';
    final booking = row['careBooking'];
    String? sub;
    if (booking is Map) {
      final st = booking['status']?.toString() ?? '';
      sub = st.isNotEmpty ? 'Booking: $st' : 'Care booking chat';
    }
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MarketplaceThreadScreen(
          conversationId: id,
          threadType: 'CARE',
          peerName: name,
          peerSubtitle: sub,
          productIdForFirstMessage: null,
          highContrast: true,
        ),
      ),
    ).then((_) => _loadMarketplace());
  }

  void _openDeliveryThread(Map<String, dynamic> row) {
    final id = row['_id']?.toString();
    if (id == null) return;
    final partner = row['partner'];
    final name = partner is Map ? (partner['name']?.toString() ?? 'Rider') : 'Rider';
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => MarketplaceThreadScreen(
          conversationId: id,
          threadType: 'DELIVERY',
          peerName: name,
          peerSubtitle: 'Order delivery',
          productIdForFirstMessage: null,
          highContrast: true,
        ),
      ),
    ).then((_) => _loadMarketplace());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return Column(
      children: [
        Material(
          color: Colors.white,
          child: TabBar(
            controller: _tabController,
            labelColor: primary,
            unselectedLabelColor: Colors.grey,
            indicatorColor: primary,
            tabs: const [
              Tab(text: 'Support'),
              Tab(text: 'Care'),
              Tab(text: 'Sellers'),
              Tab(text: 'Delivery'),
            ],
          ),
        ),
        Expanded(
          child: IndexedStack(
            index: _tabController.index,
            children: [
              const MessagesScreen(),
              _buildCareList(primary),
              _buildSellerList(primary),
              _buildDeliveryList(primary),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCareList(Color primary) {
    if (_loadingMp) {
      return const Center(
        child: CircularProgressIndicator(color: Color(AppConstants.primaryColor)),
      );
    }
    if (_care.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No care centre chats yet.\nAfter you book Pet Care+, open chat from My Care Bookings.',
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(color: Colors.grey[700]),
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: primary,
      onRefresh: _loadMarketplace,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _care.length,
        itemBuilder: (context, i) {
          final row = _care[i];
          final partner = row['partner'];
          final name = partner is Map ? (partner['name']?.toString() ?? 'Care centre') : 'Care centre';
          final booking = row['careBooking'];
          String sub = 'Care booking';
          if (booking is Map) {
            final st = booking['status']?.toString() ?? '';
            if (st.isNotEmpty) sub = 'Status: $st';
          }
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: primary.withValues(alpha: 0.15),
                child: Icon(Icons.home_work_rounded, color: primary),
              ),
              title: Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
              subtitle: Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis),
              onTap: () => _openCareCentreThread(row),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSellerList(Color primary) {
    if (_loadingMp) {
      return const Center(
        child: CircularProgressIndicator(color: Color(AppConstants.primaryColor)),
      );
    }
    if (_sellers.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No seller chats yet.\nOpen a product and tap “Chat with Seller”.',
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(color: Colors.grey[700]),
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: primary,
      onRefresh: _loadMarketplace,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _sellers.length,
        itemBuilder: (context, i) {
          final row = _sellers[i];
          final partner = row['partner'];
          final name = partner is Map ? (partner['name']?.toString() ?? 'Seller') : 'Seller';
          final sub = row['lastProductName']?.toString() ?? '';
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: primary.withValues(alpha: 0.15),
                child: Icon(Icons.storefront, color: primary),
              ),
              title: Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
              subtitle: Text(
                sub.isNotEmpty ? sub : 'Tap to continue',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => _openSellerThread(row),
            ),
          );
        },
      ),
    );
  }

  Widget _buildDeliveryList(Color primary) {
    if (_loadingMp) {
      return const Center(
        child: CircularProgressIndicator(color: Color(AppConstants.primaryColor)),
      );
    }
    if (_delivery.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No active delivery chats.\nWhen a rider is assigned, chat from My Orders.',
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(color: Colors.grey[700]),
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: primary,
      onRefresh: _loadMarketplace,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _delivery.length,
        itemBuilder: (context, i) {
          final row = _delivery[i];
          final partner = row['partner'];
          final name = partner is Map ? (partner['name']?.toString() ?? 'Rider') : 'Rider';
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: Colors.orange.shade100,
                child: Icon(Icons.delivery_dining, color: Colors.orange.shade800),
              ),
              title: Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
              subtitle: const Text('Delivery in progress'),
              onTap: () => _openDeliveryThread(row),
            ),
          );
        },
      ),
    );
  }
}
