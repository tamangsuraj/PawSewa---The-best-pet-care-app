import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Same driving-directions flow as [RiderDeliveryOrdersScreen._navigateToDeliveryAddress]:
/// opens Google Maps with `dir` API and `travelmode=driving`.
Future<void> openGoogleMapsDrivingDirections({
  required BuildContext context,
  double? lat,
  double? lng,
  String? address,
}) async {
  String destination;
  if (lat != null && lng != null) {
    destination = '$lat,$lng';
  } else if (address != null && address.trim().isNotEmpty) {
    destination = Uri.encodeComponent(address.trim());
  } else {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Location not available for directions.'),
          backgroundColor: Colors.red,
        ),
      );
    }
    return;
  }

  final uri = Uri.parse(
    'https://www.google.com/maps/dir/?api=1&destination=$destination&travelmode=driving',
  );
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open Google Maps. Check device settings.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}
