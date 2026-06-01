import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/constants.dart';
import 'hostel_detail_screen.dart';
import 'pet_care_service_card.dart';

/// Full-screen list for one care category ("See All").
class CareAllServicesScreen extends StatefulWidget {
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

  @override
  State<CareAllServicesScreen> createState() => _CareAllServicesScreenState();
}

class _CareAllServicesScreenState extends State<CareAllServicesScreen> {
  final _searchCtrl = TextEditingController();

  static const _primary = Color(AppConstants.primaryColor);

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return widget.items;
    return widget.items.where((h) {
      final name = (h['name'] ?? '').toString().toLowerCase();
      final addr = h['location'] is Map
          ? (h['location']['address'] ?? '').toString().toLowerCase()
          : '';
      return name.contains(q) || addr.contains(q);
    }).toList();
  }

  void _openDetail(Map<String, dynamic> hostel) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (c, a, b) => HostelDetailScreen(
          hostel: hostel,
          onBooked: () {
            if (!context.mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Booking confirmed!', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                backgroundColor: const Color(AppConstants.accentColor),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            );
          },
        ),
        transitionsBuilder: (c, anim, b, child) => FadeTransition(
          opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
          child: child,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: const Color(0xFFF8F7F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.sectionTitle,
              style: GoogleFonts.outfit(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Colors.black87,
              ),
            ),
            Text(
              '${widget.items.length} place${widget.items.length == 1 ? '' : 's'}',
              style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[500]),
            ),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(58),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: TextField(
                controller: _searchCtrl,
                onChanged: (_) => setState(() {}),
                style: GoogleFonts.outfit(fontSize: 14, color: Colors.black87),
                decoration: InputDecoration(
                  hintText: 'Search ${widget.sectionTitle.toLowerCase()}…',
                  hintStyle: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[400]),
                  prefixIcon: Icon(Icons.search_rounded, color: Colors.grey[500], size: 20),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(
                          icon: Icon(Icons.clear_rounded, size: 18, color: Colors.grey[400]),
                          onPressed: () => setState(() => _searchCtrl.clear()),
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),
        ),
      ),
      body: filtered.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: _primary.withValues(alpha: 0.07),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(Icons.search_off_rounded, size: 36, color: _primary),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _searchCtrl.text.isNotEmpty
                          ? 'No results for "${_searchCtrl.text}"'
                          : 'No listings yet',
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.black87,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    if (_searchCtrl.text.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      TextButton(
                        onPressed: () => setState(() => _searchCtrl.clear()),
                        child: Text(
                          'Clear search',
                          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: _primary),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.only(top: 8, bottom: 40),
              itemCount: filtered.length,
              itemBuilder: (_, i) {
                final item = filtered[i];
                final hostelData = Map<String, dynamic>.from(item);
                if (!hostelData.containsKey('serviceType')) {
                  hostelData['serviceType'] = widget.serviceType;
                }
                return PetCareServiceCard(
                  hostel: item,
                  serviceType: widget.serviceType,
                  onTap: () => _openDetail(hostelData),
                );
              },
            ),
    );
  }
}
