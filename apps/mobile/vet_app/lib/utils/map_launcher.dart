import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';

double? _toDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

/// Resolves pinned coordinates from case rows, service requests, hostels, or GeoJSON payloads.
PinnedCoords? parsePinnedCoordinates(Map<String, dynamic>? data) {
  if (data == null) return null;
  final flatLat = _toDouble(data['latitude']);
  final flatLng = _toDouble(data['longitude']);
  if (flatLat != null &&
      flatLng != null &&
      flatLat.isFinite &&
      flatLng.isFinite) {
    return PinnedCoords(flatLat, flatLng);
  }
  final loc = data['location'];
  if (loc is Map) {
    final m = Map<String, dynamic>.from(loc);
    final c = m['coordinates'];
    if (c is Map) {
      final cm = Map<String, dynamic>.from(c);
      final la = _toDouble(cm['lat']);
      final ln = _toDouble(cm['lng']);
      if (la != null &&
          ln != null &&
          la.isFinite &&
          ln.isFinite) {
        return PinnedCoords(la, ln);
      }
    }
    if (m['type'] == 'Point' && m['coordinates'] is List) {
      final arr = m['coordinates'] as List<dynamic>;
      if (arr.length >= 2) {
        final ln = _toDouble(arr[0]);
        final la = _toDouble(arr[1]);
        if (la != null &&
            ln != null &&
            la.isFinite &&
            ln.isFinite) {
          return PinnedCoords(la, ln);
        }
      }
    }
  }
  return null;
}

class PinnedCoords {
  final double latitude;
  final double longitude;

  const PinnedCoords(this.latitude, this.longitude);
}

bool _coordsInvalid(double lat, double lng) {
  if (!lat.isFinite || !lng.isFinite) return true;
  if (lat.abs() < 1e-9 && lng.abs() < 1e-9) return true;
  return false;
}

/// Opens the platform map app at [latitude], [longitude].
Future<void> openMap(
  BuildContext context, {
  required double latitude,
  required double longitude,
  String label = 'PawSewa',
}) async {
  if (_coordsInvalid(latitude, longitude)) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Location coordinates not available for this case.',
            style: GoogleFonts.outfit(),
          ),
        ),
      );
    }
    return;
  }

  debugPrint('[INFO] Attempting to launch external Map application.');

  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => Center(
      child: Card(
        elevation: 8,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: const Padding(
          padding: EdgeInsets.all(28),
          child: PawSewaLoader(width: 120),
        ),
      ),
    ),
  );

  await Future<void>.delayed(const Duration(milliseconds: 120));

  var launched = false;
  final httpsFallback = Uri.parse(
    'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent('$latitude,$longitude')}',
  );

  try {
    if (defaultTargetPlatform == TargetPlatform.android) {
      final q = Uri.encodeComponent('$latitude,$longitude($label)');
      final geo = Uri.parse('geo:$latitude,$longitude?q=$q');
      launched = await launchUrl(geo, mode: LaunchMode.externalApplication);
      if (!launched) {
        launched = await launchUrl(
          httpsFallback,
          mode: LaunchMode.externalApplication,
        );
      }
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      final gMaps = Uri.parse('comgooglemaps://?q=$latitude,$longitude&zoom=16');
      launched = await launchUrl(gMaps, mode: LaunchMode.externalApplication);
      if (!launched) {
        final apple = Uri.parse(
          'https://maps.apple.com/?ll=$latitude,$longitude&q=${Uri.encodeComponent(label)}',
        );
        launched = await launchUrl(apple, mode: LaunchMode.externalApplication);
      }
      if (!launched) {
        launched = await launchUrl(
          httpsFallback,
          mode: LaunchMode.externalApplication,
        );
      }
    } else {
      launched = await launchUrl(
        httpsFallback,
        mode: LaunchMode.externalApplication,
      );
    }

    if (launched) {
      debugPrint(
        '[SUCCESS] Map launched for coordinates: $latitude, $longitude.',
      );
    } else {
      debugPrint(
        '[ERROR] Could not launch Map: URL scheme not supported.',
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Could not open Maps. Please try again.',
              style: GoogleFonts.outfit(),
            ),
          ),
        );
      }
    }
  } catch (e, st) {
    debugPrint('[ERROR] Could not launch Map: URL scheme not supported.');
    if (kDebugMode) {
      debugPrint('$e\n$st');
    }
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Could not open Maps. Please try again.',
            style: GoogleFonts.outfit(),
          ),
        ),
      );
    }
  } finally {
    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop();
    }
  }
}
