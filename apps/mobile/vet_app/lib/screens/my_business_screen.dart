import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../services/socket_service.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';
import 'partner_marketplace_chat_screen.dart';
import 'payment_webview_screen.dart';

class MyBusinessScreen extends StatefulWidget {
  const MyBusinessScreen({super.key});

  @override
  State<MyBusinessScreen> createState() => _MyBusinessScreenState();
}

class _MyBusinessScreenState extends State<MyBusinessScreen>
    with SingleTickerProviderStateMixin {
  final _apiClient = ApiClient();
  late TabController _tabController;

  bool _loadingSubscription = true;
  bool _loadingHostels = true;
  bool _loadingBookings = true;
  Map<String, dynamic>? _subscriptionData;
  List<dynamic> _hostels = [];
  List<dynamic> _bookings = [];
  String? _error;

  void _onCareBookingSocket(String event, Map<String, dynamic> payload) {
    if (event != 'care_booking:assigned' && event != 'care_booking:update') {
      return;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Care booking update — refreshing list')),
    );
    _loadBookings();
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadSubscription();
    _loadHostels();
    _loadBookings();
    SocketService.instance.connect();
    SocketService.instance.addCareBookingListener(_onCareBookingSocket);
  }

  @override
  void dispose() {
    SocketService.instance.removeCareBookingListener(_onCareBookingSocket);
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadSubscription() async {
    setState(() {
      _loadingSubscription = true;
      _error = null;
    });
    try {
      final resp = await _apiClient.getMySubscription();
      if (resp.statusCode == 200) {
        setState(() {
          _subscriptionData = resp.data['data'];
          _loadingSubscription = false;
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Load subscription: $e');
      setState(() {
        _loadingSubscription = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _loadHostels() async {
    setState(() => _loadingHostels = true);
    try {
      final resp = await _apiClient.getMyHostels();
      if (resp.statusCode == 200) {
        setState(() {
          _hostels = resp.data['data'] ?? [];
          _loadingHostels = false;
        });
      } else {
        setState(() => _loadingHostels = false);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Load hostels: $e');
      setState(() => _loadingHostels = false);
    }
  }

  Future<void> _loadBookings() async {
    setState(() => _loadingBookings = true);
    try {
      final resp = await _apiClient.getIncomingBookings();
      if (resp.statusCode == 200) {
        setState(() {
          _bookings = resp.data['data'] ?? [];
          _loadingBookings = false;
        });
      } else {
        setState(() => _loadingBookings = false);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Load bookings: $e');
      setState(() => _loadingBookings = false);
    }
  }

  Future<void> _toggleAvailability(Map<String, dynamic> hostel) async {
    final id = hostel['_id']?.toString();
    if (id == null) return;
    try {
      await _apiClient.toggleHostelAvailability(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Availability updated')),
        );
        _loadHostels();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  Future<void> _respondToBooking(String bookingId, bool accept) async {
    try {
      await _apiClient.respondToBooking(bookingId, accept: accept);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(accept ? 'Booking confirmed' : 'Booking declined')),
        );
        _loadBookings();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    }
  }

  Future<void> _notifyCheckIn(String bookingId) async {
    try {
      await _apiClient.patchCareBookingCheckIn(bookingId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Marked as checked in')),
        );
        _loadBookings();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  Future<void> _completeCareBooking(String bookingId) async {
    try {
      await _apiClient.markBookingCompleted(bookingId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Booking completed')),
        );
        _loadBookings();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  Future<void> _openCareChatForBooking(Map<String, dynamic> b) async {
    final id = b['_id']?.toString();
    if (id == null) return;
    try {
      final r = await _apiClient.openCareMarketplaceChat(id);
      final body = r.data;
      if (body is! Map || body['success'] != true) return;
      final conv = body['data'];
      if (conv is! Map) return;
      final cid = conv['_id']?.toString();
      if (cid == null || !mounted) return;
      final user = b['userId'];
      final peer = user is Map ? (user['name']?.toString() ?? 'Customer') : 'Customer';
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => PartnerMarketplaceChatScreen(
            conversationId: cid,
            peerName: peer,
            peerSubtitle: 'Care booking',
          ),
        ),
      );
      _loadBookings();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  Future<void> _openPickupOnMap(Map<String, dynamic> b) async {
    final pa = b['pickupAddress'];
    if (pa is! Map) return;
    final pt = pa['point'];
    if (pt is! Map) return;
    final coords = pt['coordinates'];
    if (coords is! List || coords.length < 2) return;
    final lng = (coords[0] as num).toDouble();
    final lat = (coords[1] as num).toDouble();
    final uri = Uri.parse('https://www.openstreetmap.org/?mlat=$lat&mlon=$lng#map=17/$lat/$lng');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _paySubscription(String plan, String billingCycle) async {
    try {
      final resp = await _apiClient.initiateSubscriptionPayment(
        plan: plan,
        billingCycle: billingCycle,
      );
      if (resp.statusCode == 200) {
        final url = resp.data['data']?['paymentUrl']?.toString();
        final successUrl =
            resp.data['data']?['successUrl']?.toString() ?? 'payment-success';
        if (url != null && url.isNotEmpty && mounted) {
          // Use an in-app WebView so we can inject the Ngrok bypass header and
          // intercept the success/failure callback URL without opening the browser.
          final paid = await Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder: (_) => PaymentWebViewScreen(
                paymentUrl: url,
                successUrl: successUrl,
                title: 'Subscribe — $plan',
              ),
            ),
          );
          if (paid == true && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Subscription activated!')),
            );
            // Refresh the subscription status to reflect the new plan.
            _loadSubscription();
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment failed: ${e.toString()}')),
        );
      }
    }
  }

  static const _primary = Color(AppConstants.primaryColor);

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return PartnerScaffold(
      title: 'Care Center',
      subtitle: 'Billing, services, and bookings',
      actions: [
        IconButton(
          tooltip: 'Support',
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Support chat is in the top bar on Home')),
            );
          },
          icon: const Icon(Icons.support_agent_rounded),
        ),
      ],
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: primary.withValues(alpha: 0.12),
                      ),
                    ),
                    child: TabBar(
                      controller: _tabController,
                      indicator: BoxDecoration(
                        color: primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      dividerColor: Colors.transparent,
                      labelColor: const Color(AppConstants.inkColor),
                      unselectedLabelColor:
                          const Color(AppConstants.inkColor).withValues(alpha: 0.6),
                      labelStyle: GoogleFonts.outfit(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                      unselectedLabelStyle: GoogleFonts.outfit(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                      tabs: const [
                        Tab(text: 'Billing'),
                        Tab(text: 'My Services'),
                        Tab(text: 'Incoming'),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildBillingTab(),
                      _buildServicesTab(),
                      _buildBookingsTab(),
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

  Widget _buildBillingTab() {
    if (_loadingSubscription) {
      return const Center(child: PawSewaLoader());
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null && _error!.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Text(_error!, style: GoogleFonts.outfit(fontSize: 13, color: Colors.red.shade800)),
            ),
          _buildBillingContent(),
        ],
      ),
    );
  }

  Widget _buildBillingContent() {
    final isActive = _subscriptionData?['isActive'] == true;
    final sub = _subscriptionData?['subscription'] as Map<String, dynamic>?;
    final planConfig = _subscriptionData?['planConfig'] as Map<String, dynamic>?;
    final validUntil = sub?['validUntil']?.toString();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      isActive ? Icons.check_circle : Icons.info_outline,
                      color: isActive ? Colors.green : Colors.orange,
                      size: 28,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        isActive ? 'Active Subscription' : 'No active subscription',
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey[900],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                if (validUntil != null && validUntil.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Valid until: ${DateTime.tryParse(validUntil)?.toString().split(' ').first ?? validUntil}',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: Colors.grey[600],
                      ),
                    ),
                  ),
                if (planConfig != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Plan: ${planConfig['name'] ?? sub?['plan'] ?? 'Basic'} · ${planConfig['maxListings'] == -1 ? 'Unlimited' : planConfig['maxListings']} listings',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: Colors.grey[600],
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Select a plan',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.grey[800],
            ),
          ),
          const SizedBox(height: 12),
          _buildPlanCard('Basic', 500, 5000, 5, 15),
          const SizedBox(height: 12),
          _buildPlanCard('Premium', 1500, 15000, -1, 5),
        ],
      );
  }

  Widget _buildPlanCard(
    String name,
    int monthlyPrice,
    int yearlyPrice,
    int maxListings,
    int feePercent,
  ) {
    final isBasic = name == 'Basic';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: _primary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            maxListings == -1
                ? 'Unlimited listings · Featured · 5% platform fee'
                : '$maxListings listings · Max 3 photos · $feePercent% platform fee',
            style: GoogleFonts.outfit(
              fontSize: 13,
              color: Colors.grey[600],
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _paySubscription(
                    isBasic ? 'basic' : 'premium',
                    'monthly',
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _primary,
                    side: BorderSide(color: _primary),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text('Rs. $monthlyPrice/mo'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _paySubscription(
                    isBasic ? 'basic' : 'premium',
                    'yearly',
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text('Rs. $yearlyPrice/yr'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildServicesTab() {
    if (_loadingHostels) {
      return const Center(child: PawSewaLoader());
    }
    if (_hostels.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.store_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No services yet',
              style: GoogleFonts.outfit(
                fontSize: 16,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: _hostels.length,
      itemBuilder: (context, i) {
        final h = _hostels[i] as Map<String, dynamic>;
        final name = h['name']?.toString() ?? 'Service';
        final serviceType = h['serviceType']?.toString() ?? 'Hostel';
        final isAvailable = h['isAvailable'] != false;
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[900],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      serviceType,
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: Colors.grey[600],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: isAvailable
                            ? Colors.green.withValues(alpha: 0.12)
                            : Colors.orange.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        isAvailable ? 'Available' : 'Unavailable',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isAvailable
                              ? Colors.green[800]
                              : Colors.orange[800],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Switch(
                value: isAvailable,
                onChanged: (_) => _toggleAvailability(h),
                activeTrackColor: _primary.withValues(alpha: 0.5),
                activeThumbColor: _primary,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBookingsTab() {
    if (_loadingBookings) {
      return const Center(child: PawSewaLoader());
    }
    if (_bookings.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.event_busy, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No incoming bookings',
              style: GoogleFonts.outfit(
                fontSize: 16,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: _bookings.length,
      itemBuilder: (context, i) {
        final b = _bookings[i] as Map<String, dynamic>;
        final pet = b['petId'] as Map<String, dynamic>? ?? {};
        final user = b['userId'] as Map<String, dynamic>? ?? {};
        final hostel = b['hostelId'] as Map<String, dynamic>? ?? {};
        final petName = pet['name']?.toString() ?? 'Pet';
        final ownerName = user['name']?.toString() ?? 'Owner';
        final hostelName = hostel['name']?.toString() ?? 'Service';
        final status = b['status']?.toString() ?? 'pending';
        final canRespond = ['awaiting_approval', 'pending', 'paid'].contains(status);
        final canCheckIn = status == 'confirmed' || status == 'accepted';
        final canComplete = status == 'checked_in';
        final checkIn = b['checkIn']?.toString();
        final nights = b['nights'];
        final total = b['totalAmount'];
        final logistics = (b['logisticsType'] ?? '').toString();
        final pickup = b['pickupAddress'];
        String? pickupAddr;
        bool hasPickupCoords = false;
        if (pickup is Map) {
          pickupAddr = pickup['address']?.toString();
          final pt = pickup['point'];
          if (pt is Map && pt['coordinates'] is List && (pt['coordinates'] as List).length >= 2) {
            hasPickupCoords = true;
          }
        }
        final bid = b['_id']?.toString() ?? '';

        return Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.fromLTRB(16, 16, 48, 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          petName,
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey[900],
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: _primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: _primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Owner: $ownerName · $hostelName',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      color: Colors.grey[600],
                    ),
                  ),
                  if (logistics == 'pickup' && pickupAddr != null && pickupAddr.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        'Pickup: $pickupAddr',
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[800]),
                      ),
                    ),
                  if (checkIn != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        'Check-in: ${DateTime.tryParse(checkIn)?.toString().split(' ').first ?? checkIn} · $nights night(s)',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                  if (total != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        'Rs. $total',
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _primary,
                        ),
                      ),
                    ),
                  if (hasPickupCoords)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: TextButton.icon(
                        onPressed: () => _openPickupOnMap(b),
                        icon: const Icon(Icons.map_rounded, size: 18),
                        label: const Text('View on map'),
                      ),
                    ),
                  if (canRespond) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _respondToBooking(bid, false),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.red,
                              side: const BorderSide(color: Colors.red),
                            ),
                            child: const Text('Decline'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => _respondToBooking(bid, true),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Accept'),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (canCheckIn) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: bid.isEmpty ? null : () => _notifyCheckIn(bid),
                        icon: const Icon(Icons.pets_rounded),
                        label: const Text('Notify arrival (check-in)'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _primary,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ),
                  ],
                  if (canComplete) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: bid.isEmpty ? null : () => _completeCareBooking(bid),
                        child: const Text('Mark completed'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: Material(
                color: _primary.withValues(alpha: 0.12),
                shape: const CircleBorder(),
                child: IconButton(
                  tooltip: 'Message customer',
                  icon: Icon(Icons.chat_bubble_rounded, color: _primary),
                  onPressed: bid.isEmpty ? null : () => _openCareChatForBooking(b),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
