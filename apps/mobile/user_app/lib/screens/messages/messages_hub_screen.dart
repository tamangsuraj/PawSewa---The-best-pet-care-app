import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../services/chat_unread_notify_service.dart';
import 'messages_screen.dart';
import 'marketplace_thread_screen.dart';
import 'vet_chats_tab_screen.dart';

/// Inbox: Support (Customer Care), Vets (visit follow-up chat), Care, Sellers, Delivery.
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
  bool _appliedInitialTab = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _tabController.addListener(_onTab);
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrapHub());
  }

  Future<void> _bootstrapHub() async {
    await context.read<ChatUnreadNotifyService>().refreshFromApi();
    await _loadMarketplace();
    if (!mounted || _appliedInitialTab) return;
    final sections = context.read<ChatUnreadNotifyService>().sectionUnread;
    final idx = sections.tabIndexWithUnread();
    if (idx != 0) {
      _tabController.index = idx;
    }
    _appliedInitialTab = true;
    if (mounted) setState(() {});
  }

  void _onTab() {
    if (_tabController.indexIsChanging) return;
    setState(() {});
    _loadMarketplace();
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

  int _rowUnread(Map<String, dynamic> row, ChatUnreadNotifyService unread) {
    final fromApi = row['unreadCount'];
    if (fromApi != null) {
      final n = int.tryParse('$fromApi');
      if (n != null && n > 0) return n;
    }
    final id = row['_id']?.toString();
    if (id == null) return 0;
    return unread.unreadForConversation(id);
  }

  Widget _tabLabel(String label, int count) {
    final text = Text(
      label,
      style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 13),
    );
    if (count <= 0) return text;
    return Badge(
      label: Text(count > 99 ? '99+' : '$count'),
      backgroundColor: Colors.redAccent,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: text,
      ),
    );
  }

  Widget? _listTileBadge(int count) {
    if (count <= 0) return null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.redAccent,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        count > 99 ? '99+' : '$count',
        style: GoogleFonts.outfit(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }

  String? _peerUserIdFromRow(Map<String, dynamic> row) {
    final partner = row['partner'];
    if (partner is Map) {
      final id = partner['_id'] ?? partner['id'];
      if (id != null) return id.toString();
    }
    return null;
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
          peerUserId: _peerUserIdFromRow(row),
        ),
      ),
    ).then((_) async {
      if (!mounted) return;
      await context.read<ChatUnreadNotifyService>().refreshFromApi();
      if (!mounted) return;
      await _loadMarketplace();
    });
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
          peerUserId: _peerUserIdFromRow(row),
        ),
      ),
    ).then((_) async {
      if (!mounted) return;
      await context.read<ChatUnreadNotifyService>().refreshFromApi();
      if (!mounted) return;
      await _loadMarketplace();
    });
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
          peerUserId: _peerUserIdFromRow(row),
        ),
      ),
    ).then((_) async {
      if (!mounted) return;
      await context.read<ChatUnreadNotifyService>().refreshFromApi();
      if (!mounted) return;
      await _loadMarketplace();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final unread = context.watch<ChatUnreadNotifyService>();
    final sections = unread.sectionUnread;

    return Column(
      children: [
        Material(
          color: Colors.white,
          child: TabBar(
            controller: _tabController,
            labelColor: primary,
            unselectedLabelColor: Colors.grey,
            indicatorColor: primary,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(child: _tabLabel('Support', sections.support)),
              Tab(child: _tabLabel('Vets', sections.vets)),
              Tab(child: _tabLabel('Care', sections.care)),
              Tab(child: _tabLabel('Sellers', sections.sellers)),
              Tab(child: _tabLabel('Delivery', sections.delivery)),
            ],
          ),
        ),
        Expanded(
          child: IndexedStack(
            index: _tabController.index,
            children: [
              const MessagesScreen(),
              const VetChatsTabScreen(),
              _buildCareList(primary, unread),
              _buildSellerList(primary, unread),
              _buildDeliveryList(primary, unread),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCareList(Color primary, ChatUnreadNotifyService unread) {
    if (_loadingMp) {
      return const Center(
        child: PawSewaLoader(),
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
      onRefresh: () async {
        await unread.refreshFromApi();
        await _loadMarketplace();
      },
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
          final badge = _rowUnread(row, unread);
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: primary.withValues(alpha: 0.15),
                child: Icon(Icons.home_work_rounded, color: primary),
              ),
              title: Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
              subtitle: Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis),
              trailing: _listTileBadge(badge),
              onTap: () => _openCareCentreThread(row),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSellerList(Color primary, ChatUnreadNotifyService unread) {
    if (_loadingMp) {
      return const Center(
        child: PawSewaLoader(),
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
      onRefresh: () async {
        await unread.refreshFromApi();
        await _loadMarketplace();
      },
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _sellers.length,
        itemBuilder: (context, i) {
          final row = _sellers[i];
          final partner = row['partner'];
          final name = partner is Map ? (partner['name']?.toString() ?? 'Seller') : 'Seller';
          final sub = row['lastProductName']?.toString() ?? '';
          final badge = _rowUnread(row, unread);
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
              trailing: _listTileBadge(badge),
              onTap: () => _openSellerThread(row),
            ),
          );
        },
      ),
    );
  }

  Widget _buildDeliveryList(Color primary, ChatUnreadNotifyService unread) {
    if (_loadingMp) {
      return const Center(
        child: PawSewaLoader(),
      );
    }
    if (_delivery.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            sectionsDeliveryHint(unread.sectionUnread.delivery),
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(color: Colors.grey[700]),
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: primary,
      onRefresh: () async {
        await unread.refreshFromApi();
        await _loadMarketplace();
      },
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _delivery.length,
        itemBuilder: (context, i) {
          final row = _delivery[i];
          final partner = row['partner'];
          final name = partner is Map ? (partner['name']?.toString() ?? 'Rider') : 'Rider';
          final badge = _rowUnread(row, unread);
          return Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: primary.withValues(alpha: 0.12),
                child: Icon(Icons.delivery_dining, color: primary),
              ),
              title: Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
              subtitle: const Text('Delivery in progress'),
              trailing: _listTileBadge(badge),
              onTap: () => _openDeliveryThread(row),
            ),
          );
        },
      ),
    );
  }

  String sectionsDeliveryHint(int deliveryUnread) {
    if (deliveryUnread > 0) {
      return 'You have $deliveryUnread unread delivery message${deliveryUnread == 1 ? '' : 's'}.\nPull to refresh — if nothing appears, open the chat from My Orders.';
    }
    return 'No active delivery chats.\nWhen a rider is assigned, chat from My Orders.';
  }
}
