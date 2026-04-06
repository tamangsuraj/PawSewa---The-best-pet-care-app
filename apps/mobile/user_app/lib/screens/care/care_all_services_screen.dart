import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants.dart';
import '../../widgets/premium_empty_state.dart';
import 'hostel_detail_screen.dart';
import 'pet_care_service_card.dart';

/// Full-screen list for one care category ("See All").
class CareAllServicesScreen extends StatelessWidget {
  const CareAllServicesScreen({
    super.key,
    required this.serviceType,
    required this.sectionTitle,
    required this.items,
    this.onOpenMainDrawer,
  });

  final String serviceType;
  final String sectionTitle;
  final List<Map<String, dynamic>> items;
  final VoidCallback? onOpenMainDrawer;

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
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.menu, size: 22),
          color: Colors.black87,
          onPressed: () {
            Navigator.pop(context);
            WidgetsBinding.instance.addPostFrameCallback((_) {
              onOpenMainDrawer?.call();
            });
          },
          tooltip: 'Menu',
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              sectionTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: Colors.black87,
              ),
            ),
            Text(
              'Pet Care+',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: primary,
              ),
            ),
          ],
        ),
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: items.isEmpty
          ? const PremiumEmptyState(
              title: 'Nothing here yet',
              body:
                  'This category doesn’t have listings yet. Try another category from Pet Care+.',
              icon: Icons.storefront_outlined,
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
