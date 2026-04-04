import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants.dart';
import 'hostel_detail_screen.dart';
import 'pet_care_service_card.dart';

/// Full-screen list for one care category ("See All").
class CareAllServicesScreen extends StatelessWidget {
  const CareAllServicesScreen({
    super.key,
    required this.serviceType,
    required this.sectionTitle,
    required this.items,
  });

  final String serviceType;
  final String sectionTitle;
  final List<Map<String, dynamic>> items;

  void _openDetail(BuildContext context, Map<String, dynamic> hostel) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => HostelDetailScreen(
          hostel: hostel,
          onBooked: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Booking successful!')),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final w = MediaQuery.sizeOf(context).width - 40;
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          sectionTitle,
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            fontSize: 17,
            color: primary,
          ),
        ),
        centerTitle: true,
      ),
      body: items.isEmpty
          ? Center(
              child: Text(
                'No services in this category yet.',
                style: GoogleFonts.poppins(color: Colors.grey[600]),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              itemCount: items.length,
              separatorBuilder: (context, i) => const SizedBox(height: 20),
              itemBuilder: (context, i) {
                return PetCareServiceCard(
                  hostel: items[i],
                  serviceType: serviceType,
                  cardWidth: w,
                  onTap: () => _openDetail(context, items[i]),
                );
              },
            ),
    );
  }
}
