import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/constants.dart';
import 'care_booking_screen.dart';
import 'grooming_booking_screen.dart';

final _groomingServices = [
  ('Bath & Blow Dry', LucideIcons.droplets),
  ('Full Haircut', LucideIcons.scissors),
  ('Nail Trimming', LucideIcons.hand),
  ('Ear Cleaning', LucideIcons.ear),
  ('Sanitary Trim', LucideIcons.droplet),
];

List<Map<String, dynamic>> _getStaffList(String serviceType, Map<String, dynamic> h) {
  if (serviceType != 'Grooming' && serviceType != 'Spa') return [];
  final staff = h['staff'];
  if (staff is List && staff.isNotEmpty) {
    return staff.map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}).toList();
  }
  final owner = h['ownerId'];
  if (owner is Map && owner['name'] != null) {
    return [{'name': owner['name'].toString(), 'experienceYears': 3}];
  }
  return [{'name': 'Lead Groomer', 'experienceYears': 5}];
}

class HostelDetailScreen extends StatefulWidget {
  final Map<String, dynamic> hostel;
  final VoidCallback? onBooked;

  const HostelDetailScreen({
    super.key,
    required this.hostel,
    this.onBooked,
  });

  @override
  State<HostelDetailScreen> createState() => _HostelDetailScreenState();
}

class _HostelDetailScreenState extends State<HostelDetailScreen> {
  int _selectedImageIndex = 0;

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final h = widget.hostel;
    final images = h['images'] is List ? h['images'] as List : <dynamic>[];
    final displayImages = images
        .where((e) => e != null && e.toString().trim().isNotEmpty)
        .map((e) => e.toString())
        .toList();
    if (displayImages.isEmpty) displayImages.add('');

    final desc = h['description']?.toString() ?? 'Quality care for your pet.';
    final price = (h['pricePerNight'] ?? h['pricePerSession'] ?? 0) as num;
    final serviceType = h['serviceType']?.toString() ?? 'Hostel';
    final isSession = ['Grooming', 'Training', 'Wash', 'Spa'].contains(serviceType);
    final amenities = h['amenities'] is List ? h['amenities'] as List : <dynamic>[];
    final schedule = h['schedule'] is List ? h['schedule'] as List : <dynamic>[];
    final rating = (h['rating'] ?? 0.0) is num ? (h['rating'] as num).toDouble() : 0.0;
    final reviewCount = (h['reviewCount'] ?? 0) as int;
    final address = h['location'] is Map && h['location']['address'] != null
        ? h['location']['address'].toString()
        : '';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(AppConstants.primaryColor)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          '$serviceType Details',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.bold,
            fontSize: 18,
            color: primary,
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Hero image carousel
            AspectRatio(
              aspectRatio: 4 / 3,
              child: displayImages[0].isEmpty
                  ? Container(
                      color: Colors.grey[200],
                      child: const Center(child: Icon(Icons.pets, size: 64, color: Color(AppConstants.primaryColor))),
                    )
                  : Stack(
                      children: [
                        PageView.builder(
                          itemCount: displayImages.length,
                          onPageChanged: (i) => setState(() => _selectedImageIndex = i),
                          itemBuilder: (_, i) => CachedNetworkImage(
                            imageUrl: displayImages[i],
                            fit: BoxFit.cover,
                            placeholder: (_, _) => const Center(child: CircularProgressIndicator(color: Color(AppConstants.primaryColor))),
                            errorWidget: (_, _, _) => const Icon(Icons.pets, size: 64, color: Color(AppConstants.primaryColor)),
                          ),
                        ),
                        if (displayImages.length > 1)
                          Positioned(
                            bottom: 12,
                            left: 16,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${_selectedImageIndex + 1} / ${displayImages.length}',
                                style: GoogleFonts.poppins(color: Colors.white, fontSize: 12),
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
            if (displayImages.length > 1)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    displayImages.length,
                    (i) => Container(
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _selectedImageIndex == i ? primary : Colors.grey[300],
                      ),
                    ),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // About - different title for grooming/spa
                  Text(
                    isSession ? 'Professional Spa & Hygiene' : 'A Safe Home Away From Home',
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: primary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    desc,
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: Colors.grey[700],
                      height: 1.5,
                    ),
                  ),
                  if (isSession && (serviceType == 'Grooming' || serviceType == 'Spa')) ...[
                    const SizedBox(height: 20),
                    Text(
                      'Included Services',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _IncludedServicesGrid(),
                  ],
                  if (_getStaffList(serviceType, h).isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text(
                      'Our Groomers',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _GroomersRow(staff: _getStaffList(serviceType, h), owner: h['ownerId']),
                  ],
                  if (amenities.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text(
                      'Amenities',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: amenities
                          .take(8)
                          .map((a) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  a.toString(),
                                  style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[800]),
                                ),
                              ))
                          .toList(),
                    ),
                  ],
                  if (schedule.isNotEmpty && serviceType == 'Hostel') ...[
                    const SizedBox(height: 20),
                    Text(
                      'Hostel Schedule',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: primary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.grey[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey[200]!),
                      ),
                      child: Column(
                        children: schedule
                            .take(6)
                            .map((s) {
                              final m = s is Map ? Map<String, dynamic>.from(s) : <String, dynamic>{};
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    SizedBox(
                                      width: 70,
                                      child: Text(
                                        m['time']?.toString() ?? '',
                                        style: GoogleFonts.poppins(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.grey[800],
                                        ),
                                      ),
                                    ),
                                    Text(
                                      m['activity']?.toString() ?? '',
                                      style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[600]),
                                    ),
                                  ],
                                ),
                              );
                            })
                            .toList(),
                      ),
                    ),
                  ],
                  if (address.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text(
                      'Location',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: primary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.location_on, size: 18, color: primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            address,
                            style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[700]),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (rating > 0 || reviewCount > 0) ...[
                    const SizedBox(height: 20),
                    Text(
                      'Reviews',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: primary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.star, size: 18, color: primary),
                        const SizedBox(width: 4),
                        Text(
                          '${rating.toStringAsFixed(1)} ($reviewCount+ reviews)',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey[800],
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 12,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Row(
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Rs. ${price.toStringAsFixed(0)}',
                    style: GoogleFonts.poppins(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: primary,
                    ),
                  ),
                  Text(
                    isSession ? 'per session' : 'per night',
                    style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    final isGroomingFlow = serviceType == 'Grooming' || serviceType == 'Spa' || serviceType == 'Training' || serviceType == 'Wash';
                    Navigator.push(
                      context,
                      PageRouteBuilder(
                        pageBuilder: (_, _, _) => isGroomingFlow
                            ? GroomingBookingScreen(
                                hostel: widget.hostel,
                                onBooked: () {
                                  Navigator.popUntil(context, (r) => r.isFirst);
                                  widget.onBooked?.call();
                                },
                              )
                            : CareBookingScreen(
                                hostel: widget.hostel,
                                onBooked: () {
                                  Navigator.popUntil(context, (r) => r.isFirst);
                                  widget.onBooked?.call();
                                },
                              ),
                        transitionsBuilder: (_, animation, _, child) {
                          return SlideTransition(
                            position: Tween<Offset>(
                              begin: const Offset(0, 1),
                              end: Offset.zero,
                            ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
                            child: child,
                          );
                        },
                      ),
                    );
                  },
                  icon: const Icon(Icons.calendar_today, size: 18),
                  label: const Text('Book Now'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IncludedServicesGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: _groomingServices.map((e) {
        final (label, icon) = e;
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[200]!),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 20, color: primary),
              ),
              const SizedBox(width: 10),
              Text(
                label.toUpperCase(),
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[800],
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _GroomersRow extends StatelessWidget {
  final List<Map<String, dynamic>> staff;
  final dynamic owner;

  const _GroomersRow({required this.staff, this.owner});

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: staff.map((s) {
          final name = s['name']?.toString() ?? 'Groomer';
          final exp = (s['experienceYears'] ?? 0) as int;
          return Container(
            width: 140,
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: primary.withValues(alpha: 0.15),
                  backgroundImage: s['photoUrl'] != null && s['photoUrl'].toString().isNotEmpty
                      ? NetworkImage(s['photoUrl'].toString())
                      : null,
                  child: s['photoUrl'] == null || s['photoUrl'].toString().isEmpty
                      ? Text(
                          name.isNotEmpty ? name[0].toUpperCase() : '?',
                          style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.bold, color: primary),
                        )
                      : null,
                ),
                const SizedBox(height: 8),
                Text(
                  name,
                  style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '$exp+ Years Exp',
                  style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
