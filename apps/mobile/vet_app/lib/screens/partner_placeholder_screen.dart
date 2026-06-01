import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';

import '../core/constants.dart';
import '../widgets/map_pin_marker.dart';

const Color _kBrown = Color(AppConstants.primaryColor);
const Color _kCream = Color(AppConstants.secondaryColor);

/// PawSewa-themed placeholder for partner flows (brown #703418 + off-white).
class PartnerPlaceholderScreen extends StatelessWidget {
  const PartnerPlaceholderScreen({
    super.key,
    required this.title,
    required this.bodyText,
    this.showLiveMapPreview = false,
  });

  final String title;
  final String bodyText;
  final bool showLiveMapPreview;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kCream,
      appBar: AppBar(
        title: Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white)),
        backgroundColor: _kBrown,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
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
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: _kBrown,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  bodyText,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    height: 1.45,
                    color: Colors.grey.shade800,
                  ),
                ),
              ],
            ),
          ),
          if (showLiveMapPreview) ...[
            const SizedBox(height: 20),
            Text(
              'Live operations preview',
              style: GoogleFonts.outfit(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: const Color(AppConstants.inkColor),
              ),
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: SizedBox(
                height: 180,
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: const LatLng(27.7172, 85.324),
                    initialZoom: 12,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.none,
                    ),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.pawsewa.vet_app',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: const LatLng(27.72, 85.33),
                          width: 30,
                          height: 38,
                          alignment: Alignment.bottomCenter,
                          child: MapPinMarker(
                            color: const Color(AppConstants.primaryColor),
                            size: 28,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Positions sync with Admin Live Map when deliveries are active.',
              style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
        ],
      ),
    );
  }
}

/// Vet: structured medical record viewer (per-patient timeline sourced from vet visit entries).
class MedicalHistoryRecordsScreen extends StatelessWidget {
  const MedicalHistoryRecordsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kCream,
      appBar: AppBar(
        title: Text(
          'Medical history',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white),
        ),
        backgroundColor: _kBrown,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: _kBrown.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.history_edu_rounded, size: 40, color: _kBrown),
              ),
              const SizedBox(height: 20),
              Text(
                'Medical records',
                style: GoogleFonts.fraunces(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: _kBrown,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Clinical notes and visit records are logged per appointment via the Service Task detail screen.\n\nOpen a service task → tap "Add clinical entry" to attach notes and prescriptions to the patient\'s chart.',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 13.5,
                  height: 1.5,
                  color: Colors.grey.shade700,
                ),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                style: FilledButton.styleFrom(
                  backgroundColor: _kBrown,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 24),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  textStyle: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700),
                ),
                icon: const Icon(Icons.arrow_back_rounded),
                label: const Text('Go back'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
