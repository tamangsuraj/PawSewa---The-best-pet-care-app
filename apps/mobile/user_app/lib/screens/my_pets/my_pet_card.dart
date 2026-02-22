import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/constants.dart';
import '../../models/pet.dart';

/// Single pet card for My Pets grid: image, name, breed, ID, status badge, View Profile button.
class MyPetCard extends StatelessWidget {
  final Pet pet;
  final VoidCallback onViewProfile;

  const MyPetCard({
    super.key,
    required this.pet,
    required this.onViewProfile,
  });

  static const _primary = Color(AppConstants.primaryColor);
  static const _healthyBg = Color(0xFFE0F7FA);
  static const _healthyText = Color(0xFF00838F);
  static const _attentionBg = Color(0xFFFFF3E0);
  static const _attentionText = Color(0xFFE65100);

  @override
  Widget build(BuildContext context) {
    final status = pet.displayHealthStatus;
    final isAttention = status == 'Attention' || status == 'Sick';

    return Container(
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
        border: isAttention
            ? const Border(
                left: BorderSide(color: _attentionText, width: 4),
              )
            : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Image - square-ish, flexible so card fits grid
            Expanded(
              child: AspectRatio(
                aspectRatio: 1.0,
                child: pet.photoUrl != null && pet.photoUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: pet.photoUrl!,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => Container(
                        color: const Color(0xFFF5F5F5),
                        child: const Center(
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: _primary,
                          ),
                        ),
                      ),
                      errorWidget: (_, _, _) => _buildPlaceholderImage(),
                    )
                  : _buildPlaceholderImage(),
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pet.name,
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF1A3C34),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  if (pet.breed != null && pet.breed!.isNotEmpty)
                    Text(
                      pet.breed!,
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        color: Colors.grey[600],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  if (pet.pawId != null && pet.pawId!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      'ID: #${pet.pawId}',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        color: Colors.grey[500],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 8),
                  _StatusBadge(status: status),
                ],
              ),
            ),
            // View Profile button
            Material(
              color: _primary,
              child: InkWell(
                onTap: onViewProfile,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  alignment: Alignment.center,
                  child: Text(
                    'View Profile',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderImage() {
    String emoji = '🐾';
    switch (pet.species.toLowerCase()) {
      case 'dog':
        emoji = '🐕';
        break;
      case 'cat':
        emoji = '🐈';
        break;
      case 'bird':
        emoji = '🐦';
        break;
      case 'rabbit':
        emoji = '🐰';
        break;
      default:
        break;
    }
    return Container(
      color: const Color(0xFFF5F5F5),
      child: Center(
        child: Text(emoji, style: const TextStyle(fontSize: 48)),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final isHealthy = status == 'Healthy';
    final bg = isHealthy ? MyPetCard._healthyBg : MyPetCard._attentionBg;
    final fg = isHealthy ? MyPetCard._healthyText : MyPetCard._attentionText;
    final icon = isHealthy
        ? Icon(Icons.circle, size: 8, color: fg)
        : Icon(Icons.warning_amber_rounded, size: 14, color: fg);
    final label = status == 'Sick' ? 'Sick' : (status == 'Attention' ? 'Attention' : 'Healthy');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}
