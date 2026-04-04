import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants.dart';

/// Reference-style service card: ~60% image, name, location, rating, price + subtitle.
class PetCareServiceCard extends StatelessWidget {
  const PetCareServiceCard({
    super.key,
    required this.hostel,
    required this.serviceType,
    required this.cardWidth,
    required this.onTap,
  });

  final Map<String, dynamic> hostel;
  final String serviceType;
  final double cardWidth;
  final VoidCallback onTap;

  static const Color _tealRating = Color(0xFF0D9488);

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
    final numPrice = price is num ? price : num.tryParse(price.toString()) ?? 0;
    final isSession = ['Grooming', 'Training', 'Wash', 'Spa', 'Daycare'].contains(serviceType);

    final cardHeight = cardWidth * 1.22;
    final imageHeight = cardHeight * 0.58;

    String priceSubtitle() {
      switch (serviceType) {
        case 'Hostel':
          return 'PER DAY';
        case 'Training':
          return '/course';
        case 'Daycare':
          return '/session';
        case 'Grooming':
        case 'Spa':
        case 'Wash':
          return 'starts at';
        default:
          return isSession ? 'starts at' : 'PER DAY';
      }
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          width: cardWidth,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.07),
                blurRadius: 20,
                offset: const Offset(0, 8),
                spreadRadius: -2,
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                child: SizedBox(
                  height: imageHeight,
                  width: cardWidth,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (imgUrl != null && imgUrl.isNotEmpty)
                        CachedNetworkImage(
                          imageUrl: imgUrl,
                          fit: BoxFit.cover,
                          memCacheWidth: (cardWidth * MediaQuery.devicePixelRatioOf(context)).round().clamp(200, 800),
                          placeholder: (context, url) => Container(
                            color: const Color(0xFFF3F4F6),
                            child: const Center(
                              child: SizedBox(
                                width: 28,
                                height: 28,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(AppConstants.primaryColor),
                                ),
                              ),
                            ),
                          ),
                          errorWidget: (context, url, err) => Container(
                            color: const Color(0xFFF3F4F6),
                            child: Icon(Icons.pets, size: 48, color: primary.withValues(alpha: 0.5)),
                          ),
                        )
                      else
                        Container(
                          color: const Color(0xFFF3F4F6),
                          child: Icon(Icons.pets, size: 48, color: primary.withValues(alpha: 0.5)),
                        ),
                      if (hostel['isVerified'] == true || hostel['isFeatured'] == true)
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
                                    style: GoogleFonts.outfit(
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
                                    style: GoogleFonts.outfit(
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
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.black87,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(Icons.location_on_outlined, size: 15, color: Colors.grey[600]),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  loc,
                                  style: GoogleFonts.outfit(
                                    fontSize: 12,
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
                    if (rating > 0) ...[
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.star_rounded, size: 18, color: Colors.amber.shade600),
                              const SizedBox(width: 2),
                              Text(
                                rating.toStringAsFixed(1),
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: _tealRating,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Rs. ${numPrice.toStringAsFixed(0)}',
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        priceSubtitle().toUpperCase(),
                        style: GoogleFonts.outfit(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.4,
                          color: Colors.grey[500],
                        ),
                      ),
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
}
