import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import 'care_all_services_screen.dart';
import 'hostel_detail_screen.dart';
import 'pet_care_service_card.dart';
import '../../widgets/premium_empty_state.dart';
import '../../widgets/premium_shimmer.dart';

/// Pet Care+ hub (care centres, daycare, grooming, etc.).
///
/// This widget is a **root tab body** inside the customer dashboard scaffold.
/// The app bar (drawer, PawSewa title, “Pet Care+” subtitle, messages) lives on
/// the parent — do not add a duplicate [AppBar] here.
///
/// Backend serviceType -> section header (reference layout order).
const List<Map<String, String>> _sectionConfig = [
  {'type': 'Hostel', 'header': 'Care centres (boarding & stays)'},
  {'type': 'Daycare', 'header': 'Daycare Facilities'},
  {'type': 'Grooming', 'header': 'Grooming Facilities'},
  {'type': 'Spa', 'header': 'Spa Services'},
  {'type': 'Training', 'header': 'Training Centres'},
  {'type': 'Wash', 'header': 'Wash Your Puppies'},
];

class CareScreen extends StatefulWidget {
  const CareScreen({super.key, this.onOpenMainDrawer});

  /// Opens the root [PetDashboardScreen] drawer (e.g. after closing a pushed care sub-route).
  final VoidCallback? onOpenMainDrawer;

  @override
  State<CareScreen> createState() => _CareScreenState();
}

class _CareScreenState extends State<CareScreen> {
  final _apiClient = ApiClient();
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();

  Map<String, List<Map<String, dynamic>>> _hostelsByType = {};
  bool _loading = true;
  String? _error;

  /// null = all categories visible; otherwise only these serviceType keys.
  Set<String>? _filterTypes;

  @override
  void initState() {
    super.initState();
    _loadHostels();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  Future<void> _loadHostels() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final all = <String, List<Map<String, dynamic>>>{};
      for (final c in _sectionConfig) {
        final id = c['type']!;
        final resp = await _apiClient.getHostels(serviceType: id);
        if (resp.data is Map && resp.data['data'] is List) {
          all[id] = List<Map<String, dynamic>>.from(
            (resp.data['data'] as List).map(
              (e) =>
                  e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{},
            ),
          );
        } else {
          all[id] = [];
        }
      }
      if (mounted) {
        setState(() {
          _hostelsByType = all;
          _loading = false;
        });
        if (kDebugMode) {
          debugPrint(
            '[SUCCESS] Services UI transformed: Reference matching design applied. Functionality preserved.',
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not load care services. Please try again.';
        });
      }
    }
  }

  List<Map<String, dynamic>> _filteredForSection(
    String serviceType,
    List<Map<String, dynamic>> raw,
  ) {
    var list = List<Map<String, dynamic>>.from(raw);
    if (_filterTypes != null && !_filterTypes!.contains(serviceType)) {
      return [];
    }
    final q = _searchController.text.trim().toLowerCase();
    if (q.isEmpty) return list;
    return list.where((h) {
      final name = (h['name'] ?? '').toString().toLowerCase();
      String addr = '';
      if (h['location'] is Map && h['location']['address'] != null) {
        addr = h['location']['address'].toString().toLowerCase();
      }
      return name.contains(q) || addr.contains(q);
    }).toList();
  }

  void _openHostel(Map<String, dynamic> hostel) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (_, _, _) => HostelDetailScreen(
          hostel: hostel,
          onBooked: () {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Booking successful!')),
              );
            }
          },
        ),
        transitionsBuilder: (_, animation, _, child) {
          return FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            ),
            child: SlideTransition(
              position:
                  Tween<Offset>(
                    begin: const Offset(0, 0.05),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(
                      parent: animation,
                      curve: Curves.easeOutCubic,
                    ),
                  ),
              child: child,
            ),
          );
        },
      ),
    );
  }

  void _openSeeAll(
    String serviceType,
    String header,
    List<Map<String, dynamic>> fullList,
  ) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CareAllServicesScreen(
          serviceType: serviceType,
          sectionTitle: header,
          items: List<Map<String, dynamic>>.from(fullList),
          onOpenMainDrawer: widget.onOpenMainDrawer,
        ),
      ),
    );
  }

  void _showFilterSheet() {
    const primary = Color(AppConstants.primaryColor);
    final allTypes = {for (final c in _sectionConfig) c['type']!};
    var working = Set<String>.from(_filterTypes ?? allTypes);

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModal) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Filter categories',
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Choose which sections to show on Pet Care+.',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _sectionConfig.map((c) {
                        final type = c['type']!;
                        final label = c['header']!;
                        final on = working.contains(type);
                        return FilterChip(
                          label: Text(
                            label,
                            style: GoogleFonts.outfit(fontSize: 12),
                          ),
                          selected: on,
                          onSelected: (sel) {
                            setModal(() {
                              if (sel) {
                                working.add(type);
                              } else {
                                working.remove(type);
                              }
                            });
                          },
                          selectedColor: primary.withValues(alpha: 0.2),
                          checkmarkColor: primary,
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: () {
                        if (working.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Select at least one category.'),
                            ),
                          );
                          return;
                        }
                        setState(() {
                          _filterTypes = working.length == allTypes.length
                              ? null
                              : Set<String>.from(working);
                        });
                        Navigator.pop(ctx);
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: primary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text(
                        'Apply',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() => _filterTypes = null);
                        Navigator.pop(ctx);
                      },
                      child: Text(
                        'Reset — show all',
                        style: GoogleFonts.outfit(
                          color: primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
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

  Widget _buildSearchRow() {
    const primary = Color(AppConstants.primaryColor);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: TextField(
            controller: _searchController,
            focusNode: _searchFocus,
            onChanged: (_) => setState(() {}),
            style: GoogleFonts.outfit(fontSize: 14, color: Colors.black87),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Search services nearby...',
              hintStyle: GoogleFonts.outfit(
                fontSize: 14,
                color: Colors.grey[500],
              ),
              prefixIcon: Icon(
                Icons.search_rounded,
                color: Colors.grey[600],
                size: 22,
              ),
              filled: true,
              fillColor: const Color(0xFFF3F4F6),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 14,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Material(
          color: primary,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: _showFilterSheet,
            child: const SizedBox(
              width: 48,
              height: 48,
              child: Icon(Icons.tune_rounded, color: Colors.white, size: 22),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSection(
    String serviceType,
    String header,
    List<Map<String, dynamic>> source,
  ) {
    if (_filterTypes != null && !_filterTypes!.contains(serviceType)) {
      return const SizedBox.shrink();
    }
    const primary = Color(AppConstants.primaryColor);
    final filtered = _filteredForSection(serviceType, source);
    final width = MediaQuery.sizeOf(context).width;
    final sidePad = 20.0;
    final fullCardW = width - sidePad * 2;

    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    header,
                    style: GoogleFonts.outfit(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      color: primary,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: source.isEmpty
                      ? null
                      : () => _openSeeAll(serviceType, header, source),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'See All',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: primary.withValues(alpha: 0.10)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: primary.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        Icons.search_off_rounded,
                        color: primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        source.isEmpty
                            ? 'No listings in this category yet.'
                            : 'No services match your search.',
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: const Color(
                            AppConstants.inkColor,
                          ).withValues(alpha: 0.70),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            SizedBox(
              height: fullCardW * 1.22 + 4,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: filtered.length,
                separatorBuilder: (context, i) => const SizedBox(width: 14),
                itemBuilder: (context, i) {
                  final item = filtered[i];
                  final isFirstHostelFeatured =
                      serviceType == 'Hostel' && i == 0;
                  final cardW = isFirstHostelFeatured ? fullCardW : 272.0;
                  return PetCareServiceCard(
                    hostel: item,
                    serviceType: serviceType,
                    cardWidth: cardW,
                    onTap: () => _openHostel(item),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);

    return ColoredBox(
      color: const Color(0xFFF8F9FA),
      child: RefreshIndicator(
        onRefresh: _loadHostels,
        color: primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: _buildSearchRow(),
              ),
            ),
            if (_error != null)
              SliverToBoxAdapter(
                child: PremiumEmptyState(
                  title: 'Couldn’t load care centers',
                  body: _error!,
                  icon: Icons.wifi_off_rounded,
                  primaryAction: FilledButton.icon(
                    onPressed: _loadHostels,
                    style: FilledButton.styleFrom(backgroundColor: primary),
                    icon: const Icon(
                      Icons.refresh_rounded,
                      color: Colors.white,
                    ),
                    label: Text(
                      'Retry',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              )
            else if (_loading)
              SliverFillRemaining(
                child: PremiumShimmer(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                    children: const [
                      SkeletonBox(height: 16, width: 220, radius: 10),
                      SizedBox(height: 12),
                      SkeletonListTile(),
                      SkeletonListTile(),
                      SkeletonBox(height: 16, width: 260, radius: 10),
                      SizedBox(height: 12),
                      SkeletonListTile(),
                    ],
                  ),
                ),
              )
            else
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final c in _sectionConfig)
                      _buildSection(
                        c['type']!,
                        c['header']!,
                        _hostelsByType[c['type']!] ?? [],
                      ),
                    const SizedBox(height: 88),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
