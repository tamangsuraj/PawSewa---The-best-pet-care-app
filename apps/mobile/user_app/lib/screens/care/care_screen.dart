import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import 'hostel_detail_screen.dart';

const List<Map<String, String>> _categories = [
  {'id': 'Hostel', 'label': 'Pet Hostel'},
  {'id': 'Grooming', 'label': 'Grooming'},
  {'id': 'Spa', 'label': 'Spa'},
  {'id': 'Training', 'label': 'Training'},
  {'id': 'Wash', 'label': 'Washing'},
  {'id': 'Daycare', 'label': 'Day Care'},
];

class CareScreen extends StatefulWidget {
  const CareScreen({super.key});

  @override
  State<CareScreen> createState() => _CareScreenState();
}

class _CareScreenState extends State<CareScreen> {
  final _apiClient = ApiClient();
  String _selectedCategory = 'Hostel';
  Map<String, List<Map<String, dynamic>>> _hostelsByType = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadHostels();
  }

  Future<void> _loadHostels() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final all = <String, List<Map<String, dynamic>>>{};
      for (final c in _categories) {
        final id = c['id']!;
        final resp = await _apiClient.getHostels(serviceType: id);
        if (resp.data is Map && resp.data['data'] is List) {
          all[id] = List<Map<String, dynamic>>.from(
            (resp.data['data'] as List).map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}),
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

  Widget _buildHostelSection(String serviceType, List<Map<String, dynamic>> hostels) {
    const primary = Color(AppConstants.primaryColor);
    final label = _categories.firstWhere(
      (c) => c['id'] == serviceType,
      orElse: () => {'id': serviceType, 'label': serviceType},
    )['label']!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Book a $label',
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF2D2D2D),
                ),
              ),
              Text(
                'See All',
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: primary,
                ),
              ),
            ],
          ),
        ),
        if (hostels.isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Text(
                'No $label services available yet.',
                style: GoogleFonts.poppins(color: Colors.grey[600]),
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: hostels.length,
            itemBuilder: (context, i) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _HostelCard(
                  hostel: hostels[i],
                  serviceType: serviceType,
                  onTap: () => _openHostel(hostels[i]),
                ),
              );
            },
          ),
        const SizedBox(height: 16),
      ],
    );
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
            opacity: CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, 0.05),
                end: Offset.zero,
              ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
              child: child,
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);

    return RefreshIndicator(
      onRefresh: _loadHostels,
      color: primary,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Service grid (Hostels, Grooming, Spa, Training, Washing)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Services',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF2D2D2D),
                    ),
                  ),
                  const SizedBox(height: 12),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 3,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.1,
                    children: _categories.map((c) {
                      final id = c['id']!;
                      final label = c['label']!;
                      final isSelected = _selectedCategory == id;
                      return Material(
                        color: isSelected ? primary : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          onTap: () => setState(() => _selectedCategory = id),
                          borderRadius: BorderRadius.circular(12),
                          child: Center(
                            child: Text(
                              label,
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isSelected ? Colors.white : Colors.grey[700],
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Search bar
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.search, size: 20, color: Colors.grey[600]),
                              const SizedBox(width: 10),
                              Text(
                                'Search services nearby...',
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: primary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.tune, color: Colors.white, size: 22),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          // Categories bar
          SliverToBoxAdapter(
            child: SizedBox(
              height: 44,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _categories.length,
                itemBuilder: (context, i) {
                  final c = _categories[i];
                  final id = c['id']!;
                  final label = c['label']!;
                  final isSelected = _selectedCategory == id;
                  return Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: Material(
                      color: isSelected ? primary : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(22),
                      child: InkWell(
                        onTap: () {
                          setState(() => _selectedCategory = id);
                        },
                        borderRadius: BorderRadius.circular(22),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                          child: Text(
                            label,
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isSelected ? Colors.white : Colors.grey[700],
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 16)),
          if (_error != null)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: Column(
                    children: [
                      Text(_error!, style: GoogleFonts.poppins(color: Colors.grey[700])),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: _loadHostels,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else if (_loading)
            const SliverFillRemaining(
              child: Center(
                child: CircularProgressIndicator(color: Color(AppConstants.primaryColor)),
              ),
            )
          else
            SliverToBoxAdapter(
              child: _buildHostelSection(_selectedCategory, _hostelsByType[_selectedCategory] ?? []),
            ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }
}

/// Large vertical card: Image 70%, Title/Location middle, Price/Rating bottom (OYO-style)
class _HostelCard extends StatelessWidget {
  final Map<String, dynamic> hostel;
  final String serviceType;
  final VoidCallback onTap;

  const _HostelCard({
    required this.hostel,
    required this.serviceType,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final images = hostel['images'] is List ? hostel['images'] as List : <dynamic>[];
    final imgUrl = images.isNotEmpty && images[0] != null ? images[0].toString() : null;
    final name = hostel['name']?.toString() ?? 'Care Service';
    final loc = hostel['location'] is Map && hostel['location']['address'] != null
        ? hostel['location']['address'].toString()
        : 'Nepal';
    final rating = (hostel['rating'] ?? 0.0) is num
        ? (hostel['rating'] as num).toDouble()
        : 0.0;
    final price = hostel['pricePerNight'] ?? hostel['pricePerSession'] ?? 0;
    final isSession = ['Grooming', 'Training', 'Wash', 'Spa'].contains(serviceType);

    return GestureDetector(
      onTap: onTap,
      child: Container(
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
          mainAxisSize: MainAxisSize.min,
          children: [
            // Image: top 70% of card (high-quality hero)
            SizedBox(
              height: 200,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                    child: imgUrl != null && imgUrl.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: imgUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => Container(
                          color: Colors.grey[200],
                          child: const Center(
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(AppConstants.primaryColor)),
                          ),
                        ),
                        errorWidget: (_, _, _) => Container(
                          color: Colors.grey[200],
                          child: const Icon(Icons.pets, size: 48, color: Color(AppConstants.primaryColor)),
                        ),
                      )
                    : Container(
                        color: Colors.grey[200],
                        child: const Icon(Icons.pets, size: 48, color: Color(AppConstants.primaryColor)),
                      ),
                  ),
                  // Verified & Premium badges
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Row(
                      children: [
                        if (hostel['isVerified'] == true)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.green.shade600,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'Verified',
                              style: GoogleFonts.poppins(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        if (hostel['isFeatured'] == true) ...[
                          if (hostel['isVerified'] == true) const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'Premium',
                              style: GoogleFonts.poppins(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Title & Location: middle
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF2D2D2D),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.location_on_outlined, size: 16, color: Colors.grey[600]),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          loc,
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: Colors.grey[600],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Price & Rating: bottom
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (rating > 0)
                    Row(
                      children: [
                        Icon(Icons.star, size: 18, color: primary),
                        const SizedBox(width: 4),
                        Text(
                          rating.toStringAsFixed(1),
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: primary,
                          ),
                        ),
                      ],
                    )
                  else
                    const SizedBox.shrink(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Rs. ${price.toStringAsFixed(0)}',
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: primary,
                        ),
                      ),
                      Text(
                        isSession ? 'starts at' : 'PER DAY',
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          color: Colors.grey[500],
                        ),
                      ),
                    ],
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
