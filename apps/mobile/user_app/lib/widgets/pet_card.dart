import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/pet.dart';
import '../core/constants.dart';

class PetCard extends StatelessWidget {
  final Pet pet;
  final VoidCallback? onTap;

  const PetCard({
    super.key,
    required this.pet,
    this.onTap,
  });

  IconData _getGenderIcon() {
    return pet.gender == 'Male' ? Icons.male : Icons.female;
  }

  Color _getGenderColor() {
    return pet.gender == 'Male' 
        ? Colors.blue 
        : Colors.pink;
  }

  String _getSpeciesEmoji() {
    switch (pet.species) {
      case 'Dog':
        return '🐕';
      case 'Cat':
        return '🐈';
      case 'Bird':
        return '🐦';
      case 'Rabbit':
        return '🐰';
      case 'Hamster':
        return '🐹';
      case 'Fish':
        return '🐠';
      default:
        return '🐾';
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(12),
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
        child: Row(
          children: [
            // Pet Image
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: const Color(AppConstants.secondaryColor),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(AppConstants.primaryColor).withValues(alpha: 0.2),
                  width: 2,
                ),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: pet.photoUrl != null && pet.photoUrl!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: pet.photoUrl!,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => const Center(
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        errorWidget: (context, url, error) => Center(
                          child: Text(
                            _getSpeciesEmoji(),
                            style: const TextStyle(fontSize: 40),
                          ),
                        ),
                      )
                    : Center(
                        child: Text(
                          _getSpeciesEmoji(),
                          style: const TextStyle(fontSize: 40),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 16),

            // Pet Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Name and Gender
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          pet.name,
                          style: GoogleFonts.poppins(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: const Color(AppConstants.accentColor),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: _getGenderColor().withValues(alpha: 26 / 255),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          _getGenderIcon(),
                          size: 18,
                          color: _getGenderColor(),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),

                  // Digital PawID badge (small)
                  if (pet.pawId != null && pet.pawId!.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7EC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: const Color(AppConstants.primaryColor),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        'ID: ${pet.pawId}',
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: const Color(AppConstants.primaryColor),
                        ),
                      ),
                    ),

                  // Breed
                  if (pet.breed != null && pet.breed!.isNotEmpty)
                    Text(
                      pet.breed!,
                      style: GoogleFonts.poppins(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  const SizedBox(height: 8),

                  // Species and Age
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(AppConstants.primaryColor)
                              .withValues(alpha: 26 / 255),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          pet.species,
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: const Color(AppConstants.primaryColor),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      if (pet.age != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey[200],
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '${pet.age} ${pet.age == 1 ? 'year' : 'years'}',
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: Colors.grey[700],
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            // Arrow Icon
            Icon(
              Icons.arrow_forward_ios,
              size: 16,
              color: Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }
}
