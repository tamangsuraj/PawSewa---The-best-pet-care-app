import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants.dart';
import '../../models/pet.dart';
import '../../widgets/paw_sewa_loader.dart';
import '../add_pet_screen.dart';
import '../book_service_screen.dart';
import '../my_pets/my_pets_screen.dart';

const Color _kBrown = Color(AppConstants.primaryColor);
const Color _kTeal = Color(AppConstants.accentColor);
const Color _kCream = Color(AppConstants.secondaryColor);
const Color _kInk = Color(AppConstants.inkColor);

/// Customer home: scroll-safe layout, banner carousel, pets rail, bento grid.
/// Top app bar is provided by [PetDashboardScreen] (logo + profile); this widget has no [Scaffold] app bar.
class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({
    super.key,
    required this.pets,
    required this.homePetIndex,
    required this.onHomePetIndexChanged,
    required this.isLoadingPets,
    required this.onRefreshPets,
    required this.onOpenServicesTab,
    required this.onOpenShopTab,
    required this.onOpenCareTab,
  });

  final List<Pet> pets;
  final int homePetIndex;
  final ValueChanged<int> onHomePetIndexChanged;
  final bool isLoadingPets;
  final Future<void> Function() onRefreshPets;
  final void Function(int initialTabIndex) onOpenServicesTab;
  final VoidCallback onOpenShopTab;
  final VoidCallback onOpenCareTab;

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  static const double _kPad = 16;

  final PageController _bannerController = PageController(viewportFraction: 0.92);
  Timer? _bannerTimer;
  int _bannerIndex = 0;

  bool _bannersLoading = true;
  bool _recommendedLoading = true;
  List<_BannerCardModel> _banners = const [];
  List<_RecommendedCategoryModel> _recommended = const [];

  @override
  void initState() {
    super.initState();
    debugPrint('[INFO] CustomerHomeScreen initialized.');
    _loadHomeContent();
    _startBannerAutoScroll();
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _bannerController.dispose();
    super.dispose();
  }

  Future<void> _loadHomeContent() async {
    setState(() {
      _bannersLoading = true;
      _recommendedLoading = true;
    });

    await Future<void>.delayed(const Duration(milliseconds: 550));
    if (!mounted) return;

    setState(() {
      _banners = const [
        _BannerCardModel(
          titleTop: 'GIVE THEM BETTER',
          titleMain: 'UPGRADE TO PAWSEWA PRO',
          cta: 'Book now',
          useTealAccent: false,
        ),
        _BannerCardModel(
          titleTop: 'LIMITED TIME',
          titleMain: 'FREE HEALTH CHECKUP',
          cta: 'Book now',
          useTealAccent: true,
        ),
        _BannerCardModel(
          titleTop: 'NEW ARRIVALS',
          titleMain: 'SHOP PET ESSENTIALS',
          cta: 'Shop now',
          useTealAccent: false,
        ),
      ];
      _bannersLoading = false;
    });

    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    setState(() {
      _recommended = const [
        _RecommendedCategoryModel(
          title: 'Pet Food',
          imageUrl:
              'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=600&q=60',
        ),
        _RecommendedCategoryModel(
          title: 'Medicines',
          imageUrl:
              'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=60',
        ),
        _RecommendedCategoryModel(
          title: 'Grooming',
          imageUrl:
              'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=600&q=60',
        ),
        _RecommendedCategoryModel(
          title: 'Accessories',
          imageUrl:
              'https://images.unsplash.com/photo-1558944351-1a8b6a7f10a1?auto=format&fit=crop&w=600&q=60',
        ),
      ];
      _recommendedLoading = false;
    });
  }

  void _startBannerAutoScroll() {
    _bannerTimer?.cancel();
    _bannerTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted) return;
      if (_banners.isEmpty) return;
      final next = (_bannerIndex + 1) % _banners.length;
      _bannerController.animateToPage(
        next,
        duration: const Duration(milliseconds: 520),
        curve: Curves.easeOutCubic,
      );
    });
  }

  Future<void> _onPullRefresh() async {
    await widget.onRefreshPets();
    if (mounted) {
      await _loadHomeContent();
    }
  }

  Pet? get _selectedPet {
    if (widget.pets.isEmpty) return null;
    final i = widget.homePetIndex.clamp(0, widget.pets.length - 1);
    return widget.pets[i];
  }

  void _openMyPets() {
    Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => const MyPetsScreen()),
    );
  }

  void _openAddPet() {
    Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => const AddPetScreen()),
    );
  }

  void _bookNow() {
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
    final surface = Color(AppConstants.secondaryColor);

    return ColoredBox(
      color: surface,
      child: RefreshIndicator(
        color: _kBrown,
        onRefresh: _onPullRefresh,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(_kPad, 8, _kPad, 96),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _BannerCarousel(
                loading: _bannersLoading,
                banners: _banners,
                controller: _bannerController,
                activeIndex: _bannerIndex,
                onIndexChanged: (i) => setState(() => _bannerIndex = i),
                onCta: () {
                  final b = _banners[_bannerIndex.clamp(0, _banners.length - 1)];
                  if (b.cta.toLowerCase().contains('shop')) {
                    widget.onOpenShopTab();
                    return;
                  }
                  _bookNow();
                },
              ),
              const SizedBox(height: 18),
              _SectionHeader(
                title: 'My Pets',
                actionText: 'See all >',
                onAction: _openMyPets,
              ),
              const SizedBox(height: 10),
              _MyPetsRail(
                pets: widget.pets,
                selectedIndex: widget.homePetIndex.clamp(
                  0,
                  widget.pets.isEmpty ? 0 : widget.pets.length - 1,
                ),
                isLoadingPets: widget.isLoadingPets,
                onAddPet: _openAddPet,
                onSelect: (idx) {
                  widget.onHomePetIndexChanged(idx);
                },
              ),
              const SizedBox(height: 20),
              const _SectionHeader(title: 'Quick Services'),
              const SizedBox(height: 10),
              _QuickServicesGrid(
                onBookVet: _bookNow,
                onHostel: widget.onOpenCareTab,
                onVaccinations: () => widget.onOpenServicesTab(2),
                onAppointments: () => widget.onOpenServicesTab(0),
                onClinics: () => widget.onOpenServicesTab(3),
              ),
              const SizedBox(height: 20),
              _SectionHeader(
                title: 'Recommended for you',
                actionText: 'See more >',
                onAction: widget.onOpenShopTab,
              ),
              const SizedBox(height: 12),
              _RecommendedGrid(
                loading: _recommendedLoading,
                items: _recommended,
                onTap: widget.onOpenShopTab,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    this.actionText,
    this.onAction,
  });

  final String title;
  final String? actionText;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final titleStyle = GoogleFonts.outfit(
      fontSize: 18,
      fontWeight: FontWeight.w800,
      color: _kInk,
    );
    final actionStyle = GoogleFonts.outfit(
      fontSize: 13,
      fontWeight: FontWeight.w700,
      color: _kInk.withValues(alpha: 0.65),
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            title,
            style: titleStyle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (actionText != null && onAction != null)
          Flexible(
            child: InkWell(
              onTap: onAction,
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                child: Text(
                  actionText!,
                  style: actionStyle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _BannerCarousel extends StatelessWidget {
  const _BannerCarousel({
    required this.loading,
    required this.banners,
    required this.controller,
    required this.activeIndex,
    required this.onIndexChanged,
    required this.onCta,
  });

  final bool loading;
  final List<_BannerCardModel> banners;
  final PageController controller;
  final int activeIndex;
  final ValueChanged<int> onIndexChanged;
  final VoidCallback onCta;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const SizedBox(
        height: 168,
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.all(Radius.circular(24)),
          child: Center(child: PawSewaLoader(width: 120)),
        ),
      );
    }

    return Column(
      children: [
        SizedBox(
          height: 168,
          child: PageView.builder(
            controller: controller,
            itemCount: banners.length,
            onPageChanged: onIndexChanged,
            itemBuilder: (context, i) {
              final b = banners[i];
              return Padding(
                padding: const EdgeInsets.only(right: 10),
                child: _BannerCard(model: b, onCta: onCta),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
        _Dots(count: banners.length, active: activeIndex),
      ],
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.active});
  final int count;
  final int active;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final isActive = i == active;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          height: 8,
          width: isActive ? 18 : 8,
          decoration: BoxDecoration(
            color: isActive ? _kBrown : _kBrown.withValues(alpha: 0.20),
            borderRadius: BorderRadius.circular(999),
          ),
        );
      }),
    );
  }
}

class _BannerCard extends StatelessWidget {
  const _BannerCard({required this.model, required this.onCta});
  final _BannerCardModel model;
  final VoidCallback onCta;

  @override
  Widget build(BuildContext context) {
    final bg = model.useTealAccent
        ? _kTeal
        : _kBrown;
    final top = GoogleFonts.outfit(
      fontSize: 12,
      fontWeight: FontWeight.w700,
      color: Colors.white.withValues(alpha: 0.88),
      letterSpacing: 0.7,
    );
    final main = GoogleFonts.outfit(
      fontSize: 19,
      fontWeight: FontWeight.w900,
      color: Colors.white,
      height: 1.05,
    );
    final cta = GoogleFonts.outfit(
      fontSize: 13,
      fontWeight: FontWeight.w800,
      color: Colors.white,
    );

    return Material(
      type: MaterialType.card,
      color: bg,
      elevation: 1.5,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onCta,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(model.titleTop, style: top, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text(
                      model.titleMain,
                      style: main,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.18),
                        ),
                      ),
                      child: Text(model.cta, style: cta, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Image.asset(
                  'assets/brand/image_607767.png',
                  width: 80,
                  height: 80,
                  fit: BoxFit.cover,
                  filterQuality: FilterQuality.high,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MyPetsRail extends StatelessWidget {
  const _MyPetsRail({
    required this.pets,
    required this.selectedIndex,
    required this.isLoadingPets,
    required this.onAddPet,
    required this.onSelect,
  });

  final List<Pet> pets;
  final int selectedIndex;
  final bool isLoadingPets;
  final VoidCallback onAddPet;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    if (isLoadingPets && pets.isEmpty) {
      return const SizedBox(
        height: 132,
        child: Center(child: PawSewaLoader(width: 110)),
      );
    }

    return SizedBox(
      height: 132,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: pets.length + 1,
        separatorBuilder: (context, index) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          if (i == 0) return _AddPetCard(onTap: onAddPet);
          final pet = pets[i - 1];
          final isSelected = (i - 1) == selectedIndex;
          return _PetMiniCard(
            pet: pet,
            selected: isSelected,
            onTap: () => onSelect(i - 1),
          );
        },
      ),
    );
  }
}

class _AddPetCard extends StatelessWidget {
  const _AddPetCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = GoogleFonts.outfit(
      fontSize: 13,
      fontWeight: FontWeight.w800,
      color: _kInk,
    );
    return SizedBox(
      width: 120,
      child: Material(
        type: MaterialType.card,
        color: Colors.white,
        elevation: 1,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: CustomPaint(
            painter: _DashedRRectPainter(
              color: _kBrown.withValues(alpha: 0.45),
              strokeWidth: 1.6,
              radius: 20,
            ),
            child: Padding(
              padding: const EdgeInsets.all(1.6),
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18.4),
                  color: Colors.white,
                ),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: _kBrown.withValues(alpha: 0.10),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.add_rounded,
                          color: _kBrown,
                          size: 26,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text('Add Pet', style: label),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DashedRRectPainter extends CustomPainter {
  _DashedRRectPainter({
    required this.color,
    required this.strokeWidth,
    required this.radius,
  });

  final Color color;
  final double strokeWidth;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(
      Rect.fromLTWH(strokeWidth / 2, strokeWidth / 2, size.width - strokeWidth, size.height - strokeWidth),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(r);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        const dash = 6.0;
        const gap = 4.0;
        final end = (d + dash).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(d, end), paint);
        d = end + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRectPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.radius != radius;
  }
}

class _PetMiniCard extends StatelessWidget {
  const _PetMiniCard({
    required this.pet,
    required this.selected,
    required this.onTap,
  });

  final Pet pet;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final nameStyle = GoogleFonts.outfit(
      fontSize: 14,
      fontWeight: FontWeight.w900,
      color: _kInk,
    );
    final subStyle = GoogleFonts.outfit(
      fontSize: 12,
      fontWeight: FontWeight.w600,
      color: _kInk.withValues(alpha: 0.65),
    );

    return SizedBox(
      width: 160,
      child: Material(
        type: MaterialType.card,
        color: Colors.white,
        elevation: 1,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                _PetAvatar(pet: pet, ring: selected),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        pet.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: nameStyle,
                      ),
                      const SizedBox(height: 4),
                      Text('Profile ready', style: subStyle, maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PetAvatar extends StatelessWidget {
  const _PetAvatar({required this.pet, required this.ring});
  final Pet pet;
  final bool ring;

  @override
  Widget build(BuildContext context) {
    final border = ring ? _kTeal : Colors.transparent;
    final url = (pet.photoUrl ?? '').trim();
    final fallback = CircleAvatar(
      radius: 24,
      backgroundColor: _kCream.withValues(alpha: 0.7),
      child: Text(
        (pet.name.isNotEmpty ? pet.name[0] : 'P').toUpperCase(),
        style: GoogleFonts.outfit(
          fontWeight: FontWeight.w900,
          color: _kBrown,
        ),
      ),
    );

    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: border, width: 2),
      ),
      child: ClipOval(
        child: url.isEmpty
            ? fallback
            : CachedNetworkImage(
                imageUrl: url,
                width: 48,
                height: 48,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(
                  width: 48,
                  height: 48,
                  color: _kCream.withValues(alpha: 0.6),
                  child: const Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
                errorWidget: (context, url, error) => fallback,
              ),
      ),
    );
  }
}

class _QuickServicesGrid extends StatelessWidget {
  const _QuickServicesGrid({
    required this.onBookVet,
    required this.onHostel,
    required this.onVaccinations,
    required this.onAppointments,
    required this.onClinics,
  });

  final VoidCallback onBookVet;
  final VoidCallback onHostel;
  final VoidCallback onVaccinations;
  final VoidCallback onAppointments;
  final VoidCallback onClinics;

  @override
  Widget build(BuildContext context) {
    final items = [
      _QuickServiceItem(
        label: 'Book a\nVet',
        icon: Icons.calendar_month_rounded,
        bg: const Color(0xFFFFE4EC),
        fg: const Color(0xFFB31145),
        onTap: onBookVet,
      ),
      _QuickServiceItem(
        label: 'Hostel',
        icon: Icons.bed_rounded,
        bg: const Color(0xFFFFF1D8),
        fg: const Color(0xFFB26A00),
        onTap: onHostel,
      ),
      _QuickServiceItem(
        label: 'Vaccinations',
        icon: Icons.vaccines_rounded,
        bg: const Color(0xFFE6F5FF),
        fg: const Color(0xFF0E6BA8),
        onTap: onVaccinations,
      ),
      _QuickServiceItem(
        label: 'Appointments',
        icon: Icons.assignment_rounded,
        bg: const Color(0xFFEAF9EE),
        fg: const Color(0xFF1B7F3A),
        onTap: onAppointments,
      ),
      _QuickServiceItem(
        label: 'Clinics',
        icon: Icons.local_hospital_rounded,
        bg: const Color(0xFFFFECE6),
        fg: const Color(0xFFB33D1A),
        onTap: onClinics,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final crossAxisCount = w < 320
            ? 3
            : w < 380
                ? 4
                : 5;
        const crossSpacing = 8.0;
        const mainSpacing = 10.0;
        final totalCrossGaps = crossSpacing * (crossAxisCount - 1);
        final cellW = (w - totalCrossGaps) / crossAxisCount;
        const minMainExtent = 92.0;
        final ratio = math.max(0.58, math.min(0.92, cellW / minMainExtent));

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            mainAxisSpacing: mainSpacing,
            crossAxisSpacing: crossSpacing,
            childAspectRatio: ratio,
          ),
          itemBuilder: (context, i) => items[i],
        );
      },
    );
  }
}

class _QuickServiceItem extends StatelessWidget {
  const _QuickServiceItem({
    required this.label,
    required this.icon,
    required this.bg,
    required this.fg,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textStyle = GoogleFonts.outfit(
      fontSize: 10.5,
      fontWeight: FontWeight.w800,
      color: _kInk.withValues(alpha: 0.88),
      height: 1.1,
    );
    return Material(
      type: MaterialType.card,
      elevation: 0.8,
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: bg,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: fg, size: 22),
              ),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  style: textStyle,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecommendedGrid extends StatelessWidget {
  const _RecommendedGrid({
    required this.loading,
    required this.items,
    required this.onTap,
  });

  final bool loading;
  final List<_RecommendedCategoryModel> items;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const SizedBox(
        height: 140,
        child: Center(child: PawSewaLoader(width: 110)),
      );
    }

    final textStyle = GoogleFonts.outfit(
      fontSize: 12.5,
      fontWeight: FontWeight.w800,
      color: _kInk.withValues(alpha: 0.82),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final crossAxisCount = w < 340
            ? 2
            : w < 420
                ? 3
                : 4;
        const crossSpacing = 10.0;
        const mainSpacing = 14.0;
        final totalCrossGaps = crossSpacing * (crossAxisCount - 1);
        final cellW = (w - totalCrossGaps) / crossAxisCount;
        const minMainExtent = 106.0;
        final ratio = math.max(0.62, math.min(0.95, cellW / minMainExtent));

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: items.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            mainAxisSpacing: mainSpacing,
            crossAxisSpacing: crossSpacing,
            childAspectRatio: ratio,
          ),
          itemBuilder: (context, i) {
            final it = items[i];
            return Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onTap,
                borderRadius: BorderRadius.circular(18),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Material(
                      type: MaterialType.card,
                      elevation: 0.8,
                      color: Colors.white,
                      shape: const CircleBorder(),
                      child: ClipOval(
                        child: CachedNetworkImage(
                          imageUrl: it.imageUrl,
                          width: 62,
                          height: 62,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(
                            width: 62,
                            height: 62,
                            color: _kCream.withValues(alpha: 0.7),
                          ),
                          errorWidget: (context, url, error) => Container(
                            width: 62,
                            height: 62,
                            color: _kCream.withValues(alpha: 0.7),
                            child: const Icon(Icons.pets_rounded, color: _kBrown),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      it.title,
                      style: textStyle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _BannerCardModel {
  const _BannerCardModel({
    required this.titleTop,
    required this.titleMain,
    required this.cta,
    this.useTealAccent = false,
  });

  final String titleTop;
  final String titleMain;
  final String cta;
  final bool useTealAccent;
}

class _RecommendedCategoryModel {
  const _RecommendedCategoryModel({
    required this.title,
    required this.imageUrl,
  });

  final String title;
  final String imageUrl;
}
