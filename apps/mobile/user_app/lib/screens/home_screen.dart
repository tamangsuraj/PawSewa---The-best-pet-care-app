import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../cart/cart_service.dart';
import '../core/api_client.dart';
import '../core/storage_service.dart';
import '../core/constants.dart';
import '../models/pet.dart';
import '../widgets/premium_info_chip.dart';
import 'book_service_screen.dart';
import 'request_assistance_screen.dart';
import 'shop/my_orders_screen.dart';
import 'pro_coming_soon_screen.dart';

const Color _kBrown = Color(AppConstants.primaryColor);
const Color _kTeal = Color(AppConstants.accentColor);
const Color _kCream = Color(AppConstants.secondaryColor);
const Color _kInk = Color(AppConstants.inkColor);

bool _kProAppOpenAdShownThisSession = false;

/// Unified customer home: hero, quick actions, health, shop picks, live delivery map.
/// Data from `GET /pets/home-dashboard/:petId`.
class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({
    super.key,
    required this.pets,
    required this.homePetIndex,
    required this.onHomePetIndexChanged,
    this.onShowPetDetails,
    required this.isLoadingPets,
    required this.onRefreshPets,
    required this.onOpenServicesTab,
    required this.onOpenShopTab,
    required this.onOpenCareTab,
  });

  final List<Pet> pets;
  final int homePetIndex;
  final ValueChanged<int> onHomePetIndexChanged;
  final void Function(Pet pet)? onShowPetDetails;
  final bool isLoadingPets;
  final Future<void> Function() onRefreshPets;
  final void Function(int initialTabIndex) onOpenServicesTab;
  final VoidCallback onOpenShopTab;
  final VoidCallback onOpenCareTab;

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _payload;
  bool _dashLoading = false;
  String? _dashError;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _maybeShowProAppOpenAd();
    });
  }

  Future<void> _maybeShowProAppOpenAd() async {
    if (_kProAppOpenAdShownThisSession) return;
    if (!mounted) return;
    // Only show after AuthCheck confirms a valid persisted session.
    final loggedIn = await StorageService().isLoggedIn();
    if (!mounted || !loggedIn) return;
    _kProAppOpenAdShownThisSession = true;
    showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => const _ProAppOpenAdDialog(),
    );
  }

  @override
  void didUpdateWidget(covariant CustomerHomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.homePetIndex != widget.homePetIndex ||
        oldWidget.pets.length != widget.pets.length) {
      _loadDashboard();
    }
  }

  Future<void> _loadDashboard() async {
    if (widget.pets.isEmpty) {
      if (mounted) {
        setState(() {
          _payload = null;
          _dashError = null;
          _dashLoading = false;
        });
      }
      return;
    }
    final idx = widget.homePetIndex.clamp(0, widget.pets.length - 1);
    final petId = widget.pets[idx].id;
    if (petId.isEmpty) {
      return;
    }
    if (mounted) {
      setState(() {
        _dashLoading = true;
        _dashError = null;
      });
    }
    try {
      final res = await _api.getHomeDashboard(petId);
      if (!mounted) {
        return;
      }
      if (res.statusCode == 200 && res.data is Map) {
        final root = res.data as Map;
        final data = root['data'];
        if (data is Map) {
          setState(() {
            _payload = Map<String, dynamic>.from(data);
            _dashLoading = false;
          });
          return;
        }
      }
      setState(() {
        _dashError = 'Could not load home';
        _dashLoading = false;
      });
    } on DioException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _dashError = e.response?.data is Map
            ? (e.response!.data as Map)['message']?.toString() ?? 'Network error'
            : 'Network error';
        _dashLoading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _dashError = 'Something went wrong';
        _dashLoading = false;
      });
    }
  }

  Future<void> _onPullRefresh() async {
    await widget.onRefreshPets();
    await _loadDashboard();
  }

  Pet? get _selectedPet {
    if (widget.pets.isEmpty) {
      return null;
    }
    final i = widget.homePetIndex.clamp(0, widget.pets.length - 1);
    return widget.pets[i];
  }

  void _openBookForPet() {
    final p = _selectedPet;
    Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => BookServiceScreen(initialPetId: p?.id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.sizeOf(context);
    final minH = mq.height;
    final pad = (mq.width * 0.055).clamp(12.0, 28.0);

    return RefreshIndicator(
      color: _kBrown,
      onRefresh: _onPullRefresh,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(pad, 8, pad, 100),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minWidth: constraints.maxWidth,
                minHeight: minH,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildPetSwitcher(context),
                  const SizedBox(height: 16),
                  if (widget.isLoadingPets && widget.pets.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(48),
                        child: PawSewaLoader(),
                      ),
                    )
                  else if (widget.pets.isEmpty)
                    _buildEmptyPets(context)
                  else ...[
                    _buildHero(context),
                    const SizedBox(height: 20),
                    _buildQuickRow(context),
                    const SizedBox(height: 20),
                    if (_dashLoading)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: PawSewaLoader(),
                        ),
                      )
                    else if (_dashError != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          _dashError!,
                          style: GoogleFonts.outfit(color: Colors.red.shade700),
                        ),
                      )
                    else ...[
                      _buildHealthAlert(context),
                      const SizedBox(height: 20),
                      _buildShopSection(context),
                      const SizedBox(height: 20),
                      _buildLiveMap(context),
                    ],
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildPetSwitcher(BuildContext context) {
    if (widget.pets.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: PremiumInfoChip(
          icon: Icons.pets_rounded,
          title: 'Add your first pet to personalize PawSewa',
          body:
              'Your pet profile unlocks smarter recommendations, medical history, and faster bookings.',
          action: TextButton(
            onPressed: () => widget.onOpenServicesTab(1),
            child: Text(
              'Add pet',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w800,
                color: const Color(AppConstants.primaryColor),
              ),
            ),
          ),
        ),
      );
    }
    return SizedBox(
      height: 88,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: widget.pets.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final pet = widget.pets[index];
          final selected = index == widget.homePetIndex;
          return GestureDetector(
            onTap: () {
              widget.onHomePetIndexChanged(index);
            },
            onLongPress: () {
              final cb = widget.onShowPetDetails;
              if (cb != null) {
                cb(pet);
              }
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected ? _kBrown : Colors.transparent,
                      width: 3,
                    ),
                  ),
                  child: CircleAvatar(
                    radius: 28,
                    backgroundColor: Colors.grey.shade200,
                    backgroundImage: (pet.photoUrl != null &&
                            pet.photoUrl!.startsWith('http'))
                        ? CachedNetworkImageProvider(pet.photoUrl!)
                        : null,
                    child: (pet.photoUrl == null || !pet.photoUrl!.startsWith('http'))
                        ? Icon(Icons.pets, color: Colors.grey.shade600, size: 28)
                        : null,
                  ),
                ),
                const SizedBox(height: 4),
                SizedBox(
                  width: 72,
                  child: Text(
                    pet.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      color: selected ? _kBrown : Colors.grey.shade800,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmptyPets(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          const Icon(Icons.pets, size: 56, color: _kBrown),
          const SizedBox(height: 12),
          Text(
            'Add a pet to unlock your dashboard',
            textAlign: TextAlign.center,
            style: GoogleFonts.outfit(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade900,
            ),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic>? get _banner {
    final p = _payload;
    if (p == null) {
      return null;
    }
    final b = p['banner'];
    if (b is Map) {
      return Map<String, dynamic>.from(b);
    }
    return null;
  }

  Widget _buildHero(BuildContext context) {
    final b = _banner;
    final eyebrow = b?['eyebrow']?.toString() ?? "GIVE 'EM BETTER";
    final headline = b?['headline']?.toString() ?? 'FREE HEALTH CHECKUP!';
    final cta = b?['ctaLabel']?.toString() ?? 'Book Now';
    final variant = b?['variant']?.toString() ?? 'health';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 22, 18, 22),
      decoration: BoxDecoration(
        color: _kBrown,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: _kBrown.withValues(alpha: 0.35),
            blurRadius: 16,
            offset: const Offset(0, 6),
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
                  eyebrow.toUpperCase(),
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  headline,
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 14),
                TextButton(
                  onPressed: () {
                    if (variant == 'shop') {
                      widget.onOpenShopTab();
                    } else {
                      _openBookForPet();
                    }
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    cta,
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      decoration: TextDecoration.underline,
                      decorationColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              variant == 'shop' ? Icons.shopping_bag_rounded : Icons.pets_rounded,
              size: 48,
              color: Colors.white.withValues(alpha: 0.95),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickRow(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 18, 14, 18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
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
            'Quick Services',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _quickOrb(
                context,
                label: 'Book a Vet',
                bg: const Color(0xFFFFE4EC),
                icon: Icons.calendar_month_rounded,
                iconColor: const Color(0xFFC2185B),
                onTap: _openBookForPet,
              ),
              _quickOrb(
                context,
                label: 'Care centres',
                bg: const Color(0xFFFFF3E0),
                icon: Icons.bed_rounded,
                iconColor: const Color(0xFF8D6E63),
                onTap: widget.onOpenCareTab,
              ),
              _quickOrb(
                context,
                label: 'Vaccinations',
                bg: const Color(0xFFE3F2FD),
                icon: Icons.vaccines_rounded,
                iconColor: const Color(0xFF1565C0),
                onTap: () {
                  widget.onOpenServicesTab(1);
                },
              ),
              _quickOrb(
                context,
                label: 'Orders',
                bg: const Color(0xFFE8F5E9),
                icon: Icons.receipt_long_rounded,
                iconColor: const Color(0xFF2E7D32),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => const MyOrdersScreen(),
                    ),
                  );
                },
              ),
              _quickOrb(
                context,
                label: 'Emergency',
                bg: const Color(0xFFFFEBEE),
                icon: Icons.emergency_rounded,
                iconColor: const Color(0xFFC62828),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => const RequestAssistanceScreen(),
                    ),
                  );
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _quickOrb(
    BuildContext context, {
    required String label,
    required Color bg,
    required IconData icon,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: iconColor, size: 26),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                height: 1.1,
                color: Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Map<String, dynamic>> get _healthAlerts {
    final p = _payload;
    if (p == null) {
      return [];
    }
    final raw = p['healthAlerts'];
    if (raw is! List) {
      return [];
    }
    final out = <Map<String, dynamic>>[];
    for (final e in raw) {
      if (e is Map) {
        out.add(Map<String, dynamic>.from(e));
      }
    }
    return out;
  }

  Widget _buildHealthAlert(BuildContext context) {
    final alerts = _healthAlerts;
    if (alerts.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: PremiumInfoChip(
          icon: Icons.health_and_safety_rounded,
          title: 'No health alerts',
          body: 'We’ll show reminders here when it’s time for checkups or vaccines.',
        ),
      );
    }
    Map<String, dynamic>? pick;
    for (final a in alerts) {
      if (a['severity']?.toString() == 'overdue') {
        pick = a;
        break;
      }
    }
    pick ??= alerts.first;
    final msg = pick['message']?.toString() ?? '';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFE8EE),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF5C6D4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.health_and_safety_rounded, color: Colors.red.shade700, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Urgent health alert',
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Colors.red.shade900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  msg,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    height: 1.35,
                    color: Colors.red.shade900.withValues(alpha: 0.9),
                  ),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: _openBookForPet,
                  style: TextButton.styleFrom(
                    foregroundColor: _kBrown,
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'Schedule now',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> get _products {
    final p = _payload;
    if (p == null) {
      return [];
    }
    final raw = p['recommendedProducts'];
    if (raw is! List) {
      return [];
    }
    final out = <Map<String, dynamic>>[];
    for (final e in raw) {
      if (e is Map) {
        out.add(Map<String, dynamic>.from(e));
      }
    }
    return out;
  }

  String _petLabelForTitle() {
    final pet = _selectedPet;
    if (pet == null) {
      return 'your pet';
    }
    return pet.name;
  }

  Widget _buildShopSection(BuildContext context) {
    final products = _products;
    final petName = _petLabelForTitle();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Recommended for $petName',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.black87,
                ),
              ),
            ),
            TextButton(
              onPressed: () {
                widget.onOpenShopTab();
              },
              child: Text(
                'See more >',
                style: GoogleFonts.outfit(
                  fontWeight: FontWeight.w600,
                  color: _kBrown,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (products.isEmpty)
          Text(
            'No products to show yet.',
            style: GoogleFonts.outfit(color: Colors.grey.shade600),
          )
        else
          SizedBox(
            height: 220,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, i) {
                return _ProductPickCard(
                  product: products[i],
                  onAddToCart: () async {
                    final id = products[i]['_id']?.toString() ?? '';
                    final name = products[i]['name']?.toString() ?? 'Item';
                    final price = (products[i]['price'] is num)
                        ? (products[i]['price'] as num).toDouble()
                        : double.tryParse(products[i]['price']?.toString() ?? '') ??
                            0;
                    if (id.isEmpty) {
                      return;
                    }
                    if (!context.mounted) {
                      return;
                    }
                    context.read<CartService>().addItem(
                          productId: id,
                          name: name,
                          price: price,
                        );
                    try {
                      await _api.postShopRecommendationEvent(productId: id);
                    } catch (_) {}
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            'Added to cart',
                            style: GoogleFonts.outfit(),
                          ),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
                );
              },
            ),
          ),
      ],
    );
  }

  Map<String, dynamic>? get _liveDelivery {
    final p = _payload;
    if (p == null) {
      return null;
    }
    final ld = p['liveDelivery'];
    if (ld is Map) {
      return Map<String, dynamic>.from(ld);
    }
    return null;
  }

  Widget _buildLiveMap(BuildContext context) {
    final ld = _liveDelivery;
    if (ld == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: PremiumInfoChip(
          icon: Icons.local_shipping_rounded,
          title: 'No live delivery right now',
          body: 'When you have an active shop order, rider location will appear here.',
          action: TextButton(
            onPressed: widget.onOpenShopTab,
            child: Text(
              'Shop',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w800,
                color: const Color(AppConstants.primaryColor),
              ),
            ),
          ),
        ),
      );
    }

    final centerRaw = ld['mapCenter'];
    double lat = 27.7172;
    double lng = 85.324;
    if (centerRaw is Map) {
      final cm = Map<String, dynamic>.from(centerRaw);
      lat = (cm['lat'] is num) ? (cm['lat'] as num).toDouble() : lat;
      lng = (cm['lng'] is num) ? (cm['lng'] as num).toDouble() : lng;
    }

    final pinsRaw = ld['pins'];
    final markers = <Marker>[];
    if (pinsRaw is List) {
      for (final e in pinsRaw) {
        if (e is! Map) {
          continue;
        }
        final m = Map<String, dynamic>.from(e);
        final plat = m['lat'];
        final plng = m['lng'];
        if (plat is! num || plng is! num) {
          continue;
        }
        markers.add(
          Marker(
            point: LatLng(plat.toDouble(), plng.toDouble()),
            width: 28,
            height: 28,
            child: Icon(
              Icons.delivery_dining_rounded,
              color: Colors.orange.shade800,
              size: 26,
            ),
          ),
        );
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Live delivery',
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Rider locations for your active order',
          style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade600),
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            height: 140,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: LatLng(lat, lng),
                initialZoom: 13,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.none,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.pawsewa.user_app',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: LatLng(lat, lng),
                      width: 32,
                      height: 32,
                      child: Icon(
                        Icons.home_filled,
                        color: Colors.teal.shade700,
                        size: 28,
                      ),
                    ),
                    ...markers,
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ProAppOpenAdDialog extends StatelessWidget {
  const _ProAppOpenAdDialog();

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.sizeOf(context);
    final pad = (mq.width * 0.06).clamp(16.0, 28.0);
    final maxW = (mq.width * 0.92).clamp(280.0, 520.0);

    return Dialog(
      insetPadding: EdgeInsets.symmetric(horizontal: pad, vertical: 24),
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxW),
            child: Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(26),
              child: Stack(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        return SingleChildScrollView(
                          child: ConstrainedBox(
                            constraints: BoxConstraints(minHeight: constraints.maxHeight),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(height: 8),
                                Container(
                                  width: 86,
                                  height: 86,
                                  decoration: BoxDecoration(
                                    color: _kBrown,
                                    borderRadius: BorderRadius.circular(28),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.10),
                                        blurRadius: 18,
                                        offset: const Offset(0, 10),
                                      ),
                                    ],
                                  ),
                                  child: const Icon(
                                    Icons.star_outline_rounded,
                                    color: _kCream,
                                    size: 42,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'Upgrade to PawSewa Pro',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.fraunces(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: _kBrown,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Unlock priority access, premium discounts, and faster care for your companion — all in one subscription.',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(
                                    fontSize: 13.5,
                                    height: 1.35,
                                    fontWeight: FontWeight.w500,
                                    color: _kInk.withValues(alpha: 0.72),
                                  ),
                                ),
                                const SizedBox(height: 16),
                                _FeatureRow(text: 'Priority Clinic Access'),
                                const SizedBox(height: 10),
                                _FeatureRow(text: '15% Off All Grooming'),
                                const SizedBox(height: 10),
                                _FeatureRow(text: 'Pro Support Chat Response'),
                                const SizedBox(height: 18),
                                SizedBox(
                                  width: double.infinity,
                                  child: FilledButton.icon(
                                    style: FilledButton.styleFrom(
                                      backgroundColor: _kTeal,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                      textStyle: GoogleFonts.outfit(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    onPressed: () {
                                      Navigator.of(context).pop();
                                      Navigator.of(context).push(
                                        MaterialPageRoute<void>(
                                          builder: (_) => const ProComingSoonScreen(),
                                        ),
                                      );
                                    },
                                    icon: const Icon(Icons.arrow_forward_rounded),
                                    label: const Text('Upgrade Now'),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  'CANCEL ANYTIME • NO HIDDEN FEES.',
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.6,
                                    color: _kInk.withValues(alpha: 0.55),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.black.withValues(alpha: 0.08)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 10,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: IconButton(
                        icon: Icon(Icons.close, color: Colors.grey.shade700),
                        onPressed: () => Navigator.of(context).pop(),
                        tooltip: 'Close',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: _kTeal,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded, size: 16, color: Colors.white),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.outfit(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              height: 1.25,
              color: _kInk.withValues(alpha: 0.85),
            ),
          ),
        ),
      ],
    );
  }
}

class _ProductPickCard extends StatelessWidget {
  const _ProductPickCard({
    required this.product,
    required this.onAddToCart,
  });

  final Map<String, dynamic> product;
  final VoidCallback onAddToCart;

  @override
  Widget build(BuildContext context) {
    final name = product['name']?.toString() ?? '';
    final price = (product['price'] is num)
        ? (product['price'] as num).toDouble()
        : 0.0;
    final img = product['image']?.toString() ?? '';

    return Container(
      width: 150,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            child: AspectRatio(
              aspectRatio: 1.05,
              child: img.startsWith('http')
                  ? CachedNetworkImage(
                      imageUrl: img,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(color: Colors.grey.shade200),
                      errorWidget: (context, url, err) => Container(
                        color: Colors.grey.shade200,
                        child: const Icon(Icons.image_not_supported_outlined),
                      ),
                    )
                  : Container(
                      color: Colors.grey.shade200,
                      child: const Icon(Icons.shopping_bag_outlined),
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
            child: Text(
              name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.2,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              'Rs. ${price.toStringAsFixed(0)}',
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: _kBrown,
              ),
            ),
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.all(8),
            child: SizedBox(
              height: 32,
              child: FilledButton(
                onPressed: onAddToCart,
                style: FilledButton.styleFrom(
                  backgroundColor: _kBrown,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.zero,
                  textStyle: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                child: const Text('Add to Cart'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
