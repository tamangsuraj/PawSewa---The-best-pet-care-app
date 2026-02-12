import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

/// Centralized geo-location + permission flow for the vet app.
///
/// Before opening the delivery map or starting live tracking,
/// call [LocationService.ensureLocationPermission] to:
/// - Check Location services (GPS) are enabled
/// - Request runtime permission if needed
/// - Handle "permanently denied" by showing a friendly dialog that
///   links the user to the OS app settings
///
/// This avoids crashes and keeps UX consistent across the app.
class LocationService {
  static final LocationService _instance = LocationService._internal();
  factory LocationService() => _instance;
  LocationService._internal();

  /// Returns true if we can safely access location APIs.
  /// Returns false if the user declined and we should not proceed.
  Future<bool> ensureLocationPermission(BuildContext context) async {
    // Check if location services (GPS) are enabled on the device
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (!context.mounted) return false;
      await _showGpsDialog(context);
      return false;
    }

    // Check current permission state
    var permission = await Geolocator.checkPermission();

    // First-time or previously denied (but not permanently)
    if (permission == LocationPermission.denied) {
      // Give the user context before the system dialog shows
      if (!context.mounted) return false;
      final shouldRequest = await _showPermissionRationaleDialog(context);
      if (!shouldRequest) return false;

      permission = await Geolocator.requestPermission();
    }

    // Permanently denied or still denied after request
    if (permission == LocationPermission.deniedForever ||
        permission == LocationPermission.denied) {
      if (!context.mounted) return false;
      await _showSettingsDialog(context);
      return false;
    }

    // All good (whileInUse / always)
    return true;
  }

  Future<void> _showGpsDialog(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Location Services Disabled'),
          content: const Text(
            'To show the customer on the map and update your live route, '
            'please enable GPS / Location Services on your device.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  Future<bool> _showPermissionRationaleDialog(BuildContext context) async {
    final result = await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) {
            return AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              title: const Text('Location Permission Required'),
              content: const Text(
                'PawSewa uses your location to:\n'
                '• Show the customer pin and your live position on the map\n'
                '• Help owners track your arrival\n'
                '• Improve routing inside Kathmandu Valley\n\n'
                'Without location access, you can still view task details '
                'but live tracking will be disabled.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(false),
                  child: const Text('Not Now'),
                ),
                ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(true),
                  child: const Text('Allow Location'),
                ),
              ],
            );
          },
        ) ??
        false;

    return result;
  }

  /// Shown when the user has permanently denied location permission.
  /// Offers a direct link to the system app settings.
  Future<void> _showSettingsDialog(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: const Text('Permission Required'),
          content: const Text(
            'Location permission is permanently denied for PawSewa Partner. '
            'To enable live tracking and navigation, please open App Settings '
            'and allow Location access.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                openAppSettings();
              },
              child: const Text('Open Settings'),
            ),
          ],
        );
      },
    );
  }
}

