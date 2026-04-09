import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../cart/cart_service.dart';
import '../core/api_client.dart';
import '../core/product_image_service.dart';
import '../core/storage_service.dart';
import '../core/constants.dart';
import '../models/pet.dart';
import '../widgets/premium_shimmer.dart';
import 'book_service_screen.dart';
import 'request_assistance_screen.dart';
import 'shop/my_orders_screen.dart';
import 'pro_coming_soon_screen.dart';

const Color _kBrown = Color(AppConstants.primaryColor);
const Color _kTeal = Color(AppConstants.accentColor);
const Color _kCream = Color(AppConstants.secondaryColor);
const Color _kInk = Color(AppConstants.inkColor);

bool _kProAppOpenAdShownThisSession = false;

enum _PromoDestination { hostels, grooming, shop }

class _PromoBanner {
  const _PromoBanner({
    required this.title,
    required this.subtitle,
    required this.ctaLabel,
    required this.destination,
    this.bannerImageIndex = 0,
  });

  final String title;
  final String subtitle;
  final String ctaLabel;
  final _PromoDestination destination;
  /// Index into [_kBannerUrls] list.
  final int bannerImageIndex;

  bool get timothyHayFoodPromo => bannerImageIndex == 2;
}

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
  final void Function({String? categorySlug, String? categoryName})
  onOpenShopTab;
  final VoidCallback onOpenCareTab;

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _payload;
  bool _dashLoading = false;
  String? _dashError;

  static const List<_PromoBanner> _promoBanners = [
    _PromoBanner(
      title: 'PawSewa Hostel',
      subtitle: 'Luxury Pet Stays available.',
      ctaLabel: 'Book Now',
      destination: _PromoDestination.hostels,
      bannerImageIndex: 0,
    ),
    _PromoBanner(
      title: 'PawSewa Grooming',
      subtitle: 'Book a spa day for your best friend.',
      ctaLabel: 'Book Service',
      destination: _PromoDestination.grooming,
      bannerImageIndex: 1,
    ),
    _PromoBanner(
      title: 'PawSewa Shop',
      subtitle: '15% off all Timothy Hay this week.',
      ctaLabel: 'Shop Sale',
      destination: _PromoDestination.shop,
      bannerImageIndex: 2,
    ),
  ];

  // ─── Sliding promo banners (Home top) ───────────────────────────────────────
  static const _kBannerIntervalMs = 5000;
  final PageController _bannerController = PageController();
  Timer? _bannerTimer;
  int _bannerIndex = 0;

  // Shop recommendations should be driven by shop categories.
  List<Map<String, dynamic>> _shopCategories = [];
  final String _selectedShopCategorySlug = '';
  bool _catsLoading = false;
  final List<Map<String, dynamic>> _categoryProducts = [];
  final bool _categoryProductsLoading = false;

  @override
  void initState() {
    super.initState();
    debugPrint('[INFO] Initializing Home Screen sliding banners.');
    debugPrint(
      '[DEBUG] Banner auto-play interval set to ${_kBannerIntervalMs}ms.',
    );
    _startBannerAutoplay();
    debugPrint('[SUCCESS] Banners loaded for Hostels, Grooming, Shop.');
    _loadDashboard();
    _loadShopCategories();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _maybeShowProAppOpenAd();
    });
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _bannerController.dispose();
    super.dispose();
  }

  void _startBannerAutoplay() {
    _bannerTimer?.cancel();
    _bannerTimer = Timer.periodic(
      const Duration(milliseconds: _kBannerIntervalMs),
      (_) {
        if (!mounted) return;
        final next = (_bannerIndex + 1) % _promoBanners.length;
        _bannerController.animateToPage(
          next,
          duration: const Duration(milliseconds: 420),
          curve: Curves.easeInOut,
        );
      },
    );
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
            ? (e.response!.data as Map)['message']?.toString() ??
                  'Network error'
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

  Future<void> _loadShopCategories() async {
    if (mounted) {
      setState(() {
        _catsLoading = true;
      });
    }
    try {
      final resp = await _api.getCategories();
      if (!mounted) return;
      if (resp.statusCode == 200 && resp.data is Map) {
        final root = resp.data as Map;
        final raw = root['data'];
        if (raw is List) {
          final cats = <Map<String, dynamic>>[];
          for (final e in raw) {
            if (e is Map) cats.add(Map<String, dynamic>.from(e));
          }
          setState(() {
            _shopCategories = cats;
            _catsLoading = false;
          });
          return;
        }
      }
      setState(() {
        _catsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _catsLoading = false;
      });
    }
  }

  Future<void> _onPullRefresh() async {
    await widget.onRefreshPets();
    await _loadDashboard();
    await _loadShopCategories();
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
                      _buildShopSection(context),
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

  Widget _buildHero(BuildContext context) {
    final radius = BorderRadius.circular(22);
    const activeDot = _kTeal;
    final inactiveDot = Colors.grey.shade300;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: radius,
          child: AspectRatio(
            aspectRatio: 21 / 9,
            child: PageView.builder(
              controller: _bannerController,
              itemCount: _promoBanners.length,
              onPageChanged: (i) {
                setState(() {
                  _bannerIndex = i;
                });
              },
              itemBuilder: (context, i) {
                final b = _promoBanners[i];
                return _PromoBannerSlide(
                  banner: b,
                  onTap: () => _openPromoDestination(b),
                  onCta: () => _openPromoDestination(b),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_promoBanners.length, (i) {
            final isActive = i == _bannerIndex;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 240),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: isActive ? 16 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: isActive ? activeDot : inactiveDot,
                borderRadius: BorderRadius.circular(999),
              ),
            );
          }),
        ),
      ],
    );
  }

  void _openPromoDestination(_PromoBanner banner) {
    switch (banner.destination) {
      case _PromoDestination.hostels:
        widget.onOpenCareTab();
        return;
      case _PromoDestination.grooming:
        widget.onOpenCareTab();
        return;
      case _PromoDestination.shop:
        widget.onOpenShopTab();
        return;
    }
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

  Widget _buildShopSection(BuildContext context) {
    final dashProducts = _products;
    final cats = _effectiveShopCategories(dashProducts);
    final selected = _selectedShopCategorySlug;

    final selectedFromDash = selected.isEmpty
        ? dashProducts
        : dashProducts.where((p) {
            final cat = p['category'];
            final slug = cat is Map ? cat['slug']?.toString() : null;
            return slug == selected;
          }).toList();

    final showProducts = (selected.isEmpty)
        ? dashProducts.take(6).toList()
        : (selectedFromDash.isNotEmpty
              ? selectedFromDash.take(6).toList()
              : _categoryProducts.take(6).toList());

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Recommended for your pet',
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
        const SizedBox(height: 10),
        _buildCategoryStrip(
          context,
          categories: cats,
          selectedSlug: selected,
          loading: _catsLoading,
          onChanged: (slug, name) {
            widget.onOpenShopTab(
              categorySlug: slug.isEmpty ? null : slug,
              categoryName: slug.isEmpty ? null : name,
            );
          },
        ),
        const SizedBox(height: 12),
        if (_categoryProductsLoading)
          const Center(
            child: Padding(padding: EdgeInsets.all(12), child: PawSewaLoader()),
          )
        else if (showProducts.isEmpty)
          Text(
            'No products to show yet.',
            style: GoogleFonts.outfit(color: Colors.grey.shade600),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: showProducts.length.clamp(0, 6),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              // Slightly taller tiles prevent small-screen overflows.
              childAspectRatio: 0.68,
            ),
            itemBuilder: (context, i) {
              return _ProductGridCard(
                product: showProducts[i],
                onAddToCart: () async {
                  final id = showProducts[i]['_id']?.toString() ?? '';
                  final name = showProducts[i]['name']?.toString() ?? 'Item';
                  final price = (showProducts[i]['price'] is num)
                      ? (showProducts[i]['price'] as num).toDouble()
                      : double.tryParse(
                              showProducts[i]['price']?.toString() ?? '',
                            ) ??
                            0;
                  if (id.isEmpty) return;
                  if (!context.mounted) return;
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
      ],
    );
  }

  List<Map<String, dynamic>> _effectiveShopCategories(
    List<Map<String, dynamic>> dashProducts,
  ) {
    if (_shopCategories.isNotEmpty) return _shopCategories;
    final seen = <String>{};
    final out = <Map<String, dynamic>>[];
    for (final p in dashProducts) {
      final cat = p['category'];
      if (cat is! Map) continue;
      final slug = cat['slug']?.toString() ?? '';
      final name = cat['name']?.toString() ?? slug;
      if (slug.isEmpty || seen.contains(slug)) continue;
      seen.add(slug);
      out.add({'slug': slug, 'name': name});
    }
    return out;
  }

  Widget _buildCategoryStrip(
    BuildContext context, {
    required List<Map<String, dynamic>> categories,
    required String selectedSlug,
    required bool loading,
    required void Function(String slug, String name) onChanged,
  }) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    final textScaler = MediaQuery.textScalerOf(context);
    final pad = (screenWidth * 0.04).clamp(12.0, 20.0);
    final circle = (screenWidth * 0.14).clamp(48.0, 62.0);
    final itemW = (circle + 14).clamp(62.0, 92.0);
    final labelFont = (screenWidth * 0.028).clamp(9.0, 12.0);
    final labelHeight =
        textScaler.scale(labelFont * 1.25 * 2) + 6; // 2 lines + padding
    final stripHeight = (circle + 10 + labelHeight + 18).clamp(104.0, 176.0);

    final allCats = <Map<String, dynamic>>[
      {'slug': '', 'name': 'All'},
      ...categories,
    ];

    return SizedBox(
      height: stripHeight,
      child: loading && categories.isEmpty
          ? const Center(child: PawSewaLoader())
          : ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(horizontal: pad, vertical: 8),
              itemCount: allCats.length,
              separatorBuilder: (context, index) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final c = allCats[index];
                final slug = c['slug']?.toString() ?? '';
                final name = c['name']?.toString() ?? slug;
                final isActive = slug == selectedSlug;
                return GestureDetector(
                  onTap: () => onChanged(slug, name),
                  child: SizedBox(
                    width: itemW,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: circle,
                          height: circle,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isActive ? _kBrown : Colors.grey.shade300,
                              width: isActive ? 2.5 : 1,
                            ),
                          ),
                          child: ClipOval(
                            child: slug.isEmpty
                                ? Container(
                                    color: const Color(0xFFF5F0EB),
                                    child: Icon(
                                      Icons.grid_view,
                                      size: circle * 0.45,
                                      color: _kBrown,
                                    ),
                                  )
                                : ProductImageService.networkImage(
                                    ProductImageService.urlForCategory(name, slug),
                                    width: circle,
                                    height: circle,
                                  ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Expanded(
                          child: Align(
                            alignment: Alignment.topCenter,
                            child: Text(
                              name,
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(
                                fontSize: labelFont,
                                fontWeight: isActive
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: isActive
                                    ? Colors.black87
                                    : Colors.grey[700],
                                height: 1.25,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
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
                            constraints: BoxConstraints(
                              minHeight: constraints.maxHeight,
                            ),
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
                                        color: Colors.black.withValues(
                                          alpha: 0.10,
                                        ),
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
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 14,
                                        horizontal: 16,
                                      ),
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
                                          builder: (_) =>
                                              const ProComingSoonScreen(),
                                        ),
                                      );
                                    },
                                    icon: const Icon(
                                      Icons.arrow_forward_rounded,
                                    ),
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
                        border: Border.all(
                          color: Colors.black.withValues(alpha: 0.08),
                        ),
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
          decoration: BoxDecoration(color: _kTeal, shape: BoxShape.circle),
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

class _ProductGridCard extends StatelessWidget {
  const _ProductGridCard({required this.product, required this.onAddToCart});

  final Map<String, dynamic> product;
  final VoidCallback onAddToCart;

  @override
  Widget build(BuildContext context) {
    final name = product['name']?.toString() ?? '';
    final price = (product['price'] is num)
        ? (product['price'] as num).toDouble()
        : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Use Expanded instead of fixed AspectRatio+Spacer to avoid overflow in tight grid tiles.
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(14),
              ),
              child: ProductImageService.networkImage(
                ProductImageService.urlForProduct(product),
                width: double.infinity,
                height: double.infinity,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 2),
            child: Text(
              name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.15,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Text(
              'Rs. ${price.toStringAsFixed(0)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: _kBrown,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
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
                    fontWeight: FontWeight.w800,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
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

class _PromoBannerSlide extends StatelessWidget {
  const _PromoBannerSlide({
    required this.banner,
    required this.onTap,
    required this.onCta,
  });

  final _PromoBanner banner;
  final VoidCallback onTap;
  final VoidCallback onCta;

  @override
  Widget build(BuildContext context) {
    const overlayStart = Color(0x00111111);
    const overlayEnd = Color(0xB3111111);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned.fill(
              child: _HomeBannerBackground(
                imageIndex: banner.bannerImageIndex,
                timothyHayFoodPromo: banner.timothyHayFoodPromo,
              ),
            ),
            Positioned.fill(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [overlayStart, overlayEnd],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(),
                  Text(
                    banner.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    banner.subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.white.withValues(alpha: 0.92),
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 36,
                    child: FilledButton(
                      onPressed: onCta,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: _kBrown,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                        textStyle: GoogleFonts.outfit(
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                      child: Text(banner.ctaLabel),
                    ),
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

// ── Banner-specific Unsplash images (static IDs, CDN-fast, no source.unsplash redirect) ──

const List<String> _kBannerUrls = [
  // hostel slide
  'https://images.unsplash.com/photo-1591946614720-90a587da4a36?q=80&w=900',
  // grooming slide
  'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=80&w=900',
  // shop/food slide
  'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?q=80&w=900',
];

Widget _homeBannerShimmerFill() {
  return const PremiumShimmer(
    child: ColoredBox(color: Color(0xFFE8E0D8), child: SizedBox.expand()),
  );
}

class _HomeBannerBackground extends StatelessWidget {
  final int imageIndex;
  final bool timothyHayFoodPromo;

  const _HomeBannerBackground({
    required this.imageIndex,
    required this.timothyHayFoodPromo,
  });

  @override
  Widget build(BuildContext context) {
    final idx = imageIndex.clamp(0, _kBannerUrls.length - 1);
    final url = _kBannerUrls[idx];
    return ProductImageService.networkImage(
      url,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      placeholder: _homeBannerShimmerFill(),
    );
  }
}

