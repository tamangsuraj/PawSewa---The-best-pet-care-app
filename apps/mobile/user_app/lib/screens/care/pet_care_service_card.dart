import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants.dart';
import '../../core/product_image_service.dart';

/// OYO-style full-width property card for the care listings feed.
class PetCareServiceCard extends StatelessWidget {
  const PetCareServiceCard({
    super.key,
    required this.hostel,
    required this.serviceType,
    required this.onTap,
    this.cardWidth,
  });

  final Map<String, dynamic> hostel;
  final String serviceType;
  final VoidCallback onTap;

  /// Optional fixed width (used when rendering inside a horizontal ListView on the home screen).
  /// When null the card fills its parent width (vertical feed mode).
  final double? cardWidth;

  // Keep for home screen row-height calculation.
  static double totalHeightForWidth(double w) => 260 + 4;

  static const Color _teal = Color(AppConstants.accentColor);
  static const Color _primary = Color(AppConstants.primaryColor);

  static const Map<String, IconData> _categoryIcons = {
    'Hostel': Icons.home_work_rounded,
    'Daycare': Icons.child_care_rounded,
    'Grooming': Icons.content_cut_rounded,
    'Spa': Icons.spa_rounded,
    'Training': Icons.sports_rounded,
    'Wash': Icons.water_drop_rounded,
  };

  static const Map<String, Color> _categoryColors = {
    'Hostel': Color(0xFF703418),
    'Daycare': Color(0xFF0891B2),
    'Grooming': Color(0xFF7C3AED),
    'Spa': Color(0xFF059669),
    'Training': Color(0xFFD97706),
    'Wash': Color(0xFF2563EB),
  };

  String _priceLabel() {
    switch (serviceType) {
      case 'Hostel':
        return '/night';
      case 'Daycare':
        return '/day';
      case 'Training':
        return '/course';
      default:
        return '/session';
    }
  }

  List<String> _amenityChips(Map<String, dynamic> h) {
    final raw = h['amenities'];
    if (raw is List && raw.isNotEmpty) {
      return raw.take(3).map((e) => e.toString()).toList();
    }
    switch (serviceType) {
      case 'Hostel':
        return ['24/7 Care', 'CCTV', 'Vet on call'];
      case 'Grooming':
        return ['Bath & Dry', 'Nail Trim', 'Ear Clean'];
      case 'Spa':
        return ['Massage', 'De-shedding', 'Teeth Clean'];
      case 'Daycare':
        return ['Playtime', 'Meals', 'Updates'];
      case 'Training':
        return ['Obedience', 'Certified', 'Group classes'];
      case 'Wash':
        return ['Deep Clean', 'Blow Dry', 'Cologne'];
      default:
        return [];
    }
  }

  @override
  Widget build(BuildContext context) {
    final images = hostel['images'] is List ? hostel['images'] as List : <dynamic>[];
    final imgUrl = images.isNotEmpty && images[0] != null && images[0].toString().trim().isNotEmpty
        ? images[0].toString()
        : null;
    final name = hostel['name']?.toString() ?? 'Care Service';
    final loc = hostel['location'] is Map && hostel['location']['address'] != null
        ? hostel['location']['address'].toString()
        : 'Kathmandu, Nepal';
    final rating = (hostel['rating'] ?? 0.0) is num ? (hostel['rating'] as num).toDouble() : 0.0;
    final reviewCount = (hostel['reviewCount'] ?? 0) as int;
    final price = hostel['pricePerNight'] ?? hostel['pricePerSession'] ?? 0;
    final numPrice = price is num ? price : num.tryParse(price.toString()) ?? 0;
    final isVerified = hostel['isVerified'] == true;
    final isFeatured = hostel['isFeatured'] == true;
    final catColor = _categoryColors[serviceType] ?? _primary;
    final catIcon = _categoryIcons[serviceType] ?? Icons.pets;
    final chips = _amenityChips(hostel);

    Widget card = GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Image ──────────────────────────────────────────────────────
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
              child: SizedBox(
                height: 190,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Property image
                    imgUrl != null
                        ? CachedNetworkImage(
                            imageUrl: imgUrl,
                            httpHeaders: const {'ngrok-skip-browser-warning': 'true'},
                            fit: BoxFit.cover,
                            placeholder: (c, url) => Container(color: const Color(0xFFF3EDE7)),
                            errorWidget: (c, url, err) => _CategoryFallback(
                              serviceType: serviceType,
                              icon: catIcon,
                              color: catColor,
                            ),
                          )
                        : _CategoryFallback(
                            serviceType: serviceType,
                            icon: catIcon,
                            color: catColor,
                          ),

                    // Gradient overlay (bottom)
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            stops: const [0.55, 1.0],
                            colors: [
                              Colors.transparent,
                              Colors.black.withValues(alpha: 0.45),
                            ],
                          ),
                        ),
                      ),
                    ),

                    // Top-right: rating badge
                    if (rating > 0)
                      Positioned(
                        top: 10,
                        right: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _teal,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.star_rounded, color: Colors.white, size: 13),
                              const SizedBox(width: 3),
                              Text(
                                rating.toStringAsFixed(1),
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                              if (reviewCount > 0) ...[
                                const SizedBox(width: 3),
                                Text(
                                  '($reviewCount)',
                                  style: GoogleFonts.outfit(
                                    fontSize: 10,
                                    color: Colors.white.withValues(alpha: 0.85),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),

                    // Top-left: verified / featured badges
                    if (isVerified || isFeatured)
                      Positioned(
                        top: 10,
                        left: 10,
                        child: Row(
                          children: [
                            if (isVerified)
                              _Badge(label: '✓ Verified', color: const Color(0xFF16A34A)),
                            if (isVerified && isFeatured) const SizedBox(width: 6),
                            if (isFeatured)
                              _Badge(label: '★ Premium', color: catColor),
                          ],
                        ),
                      ),

                    // Bottom-left: category type pill
                    Positioned(
                      bottom: 10,
                      left: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(catIcon, color: Colors.white, size: 12),
                            const SizedBox(width: 5),
                            Text(
                              serviceType,
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // ── Card body ─────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Name row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF1A1A1A),
                            height: 1.2,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 12),
                      // Price
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'Rs. ${numPrice.toStringAsFixed(0)}',
                            style: GoogleFonts.outfit(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: _primary,
                            ),
                          ),
                          Text(
                            _priceLabel(),
                            style: GoogleFonts.outfit(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: Colors.grey[500],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),

                  // Location
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded, size: 14, color: Colors.grey[500]),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          loc,
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: Colors.grey[500],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),

                  // Amenity chips
                  if (chips.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: chips
                          .map(
                            (chip) => Container(
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                              decoration: BoxDecoration(
                                color: catColor.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: catColor.withValues(alpha: 0.18),
                                ),
                              ),
                              child: Text(
                                chip,
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: catColor,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );

    // When a fixed width is provided (home screen horizontal strip), constrain and remove
    // the symmetric horizontal margin so it fits cleanly inside the ListView.
    if (cardWidth != null) {
      card = SizedBox(
        width: cardWidth,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.07),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                  child: SizedBox(
                    height: cardWidth! * 0.56,
                    width: cardWidth,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        imgUrl != null
                            ? CachedNetworkImage(
                                imageUrl: imgUrl,
                                httpHeaders: const {'ngrok-skip-browser-warning': 'true'},
                                fit: BoxFit.cover,
                                placeholder: (c, url) => Container(color: const Color(0xFFF3EDE7)),
                                errorWidget: (c, url, err) => _CategoryFallback(
                                  serviceType: serviceType,
                                  icon: catIcon,
                                  color: catColor,
                                ),
                              )
                            : _CategoryFallback(serviceType: serviceType, icon: catIcon, color: catColor),
                        Positioned.fill(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                stops: const [0.55, 1.0],
                                colors: [Colors.transparent, Colors.black.withValues(alpha: 0.4)],
                              ),
                            ),
                          ),
                        ),
                        if (rating > 0)
                          Positioned(
                            top: 8,
                            right: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                              decoration: BoxDecoration(color: _teal, borderRadius: BorderRadius.circular(20)),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.star_rounded, color: Colors.white, size: 11),
                                  const SizedBox(width: 3),
                                  Text(
                                    rating.toStringAsFixed(1),
                                    style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF1A1A1A)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.location_on_rounded, size: 12, color: Colors.grey[500]),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              loc,
                              style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey[500]),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(
                            'Rs. ${numPrice.toStringAsFixed(0)}',
                            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: _primary),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _priceLabel(),
                            style: GoogleFonts.outfit(fontSize: 10, color: Colors.grey[500]),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return card;
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: GoogleFonts.outfit(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
    );
  }
}

class _CategoryFallback extends StatelessWidget {
  const _CategoryFallback({
    required this.serviceType,
    required this.icon,
    required this.color,
  });
  final String serviceType;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final url = ProductImageService.urlForCareService(serviceType);
    return url.isNotEmpty
        ? CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            placeholder: (c, url) => _Placeholder(color: color, icon: icon),
            errorWidget: (c, url, err) => _Placeholder(color: color, icon: icon),
          )
        : _Placeholder(color: color, icon: icon);
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.color, required this.icon});
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color.withValues(alpha: 0.08),
      child: Center(
        child: Icon(icon, size: 52, color: color.withValues(alpha: 0.35)),
      ),
    );
  }
}
