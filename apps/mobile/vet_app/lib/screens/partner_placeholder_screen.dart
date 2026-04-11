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
                color: Colors.black87,
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
                            color: Colors.orange.shade800,
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

/// Vet: structured medical record upload (UI shell — wire storage when backend endpoint is ready).
class MedicalHistoryRecordsScreen extends StatefulWidget {
  const MedicalHistoryRecordsScreen({super.key});

  @override
  State<MedicalHistoryRecordsScreen> createState() => _MedicalHistoryRecordsScreenState();
}

class _MedicalHistoryRecordsScreenState extends State<MedicalHistoryRecordsScreen> {
  final List<String> _demoFiles = [];

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
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Attach visit notes, lab PDFs, or photos. Records are linked to the patient chart.',
            style: GoogleFonts.outfit(fontSize: 14, height: 1.4, color: Colors.grey.shade800),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () {
              setState(() {
                _demoFiles.add('demo_record_${_demoFiles.length + 1}.pdf');
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Demo file queued. Connect cloud storage API to persist uploads.',
                    style: GoogleFonts.outfit(),
                  ),
                ),
              );
            },
            style: FilledButton.styleFrom(
              backgroundColor: _kBrown,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            ),
            icon: const Icon(Icons.upload_file_rounded),
            label: Text('Add record (demo)', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
          ),
          const SizedBox(height: 24),
          Text(
            'Queued',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 15),
          ),
          const SizedBox(height: 8),
          if (_demoFiles.isEmpty)
            Text('No files yet.', style: GoogleFonts.outfit(color: Colors.grey.shade600))
          else
            ..._demoFiles.map(
              (f) => ListTile(
                leading: const Icon(Icons.description_outlined, color: _kBrown),
                title: Text(f, style: GoogleFonts.outfit()),
              ),
            ),
        ],
      ),
    );
  }
}
