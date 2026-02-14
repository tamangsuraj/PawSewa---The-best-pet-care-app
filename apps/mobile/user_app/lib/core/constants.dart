class AppConstants {
  // API base URL — backend runs on port 3000 (not 5000).
  // • Physical device: use your PC's IPv4 (same Wi‑Fi as phone). Run `ipconfig` (Windows) to find it.
  // • Android emulator: set kUseEmulator = true to use 10.0.2.2 (emulator's alias for host localhost).
  //
  // Override at runtime: flutter run --dart-define=API_HOST=192.168.1.10
  static const bool kUseEmulator =
      false; // true = Android emulator (10.0.2.2), false = physical device
  static const String _host = String.fromEnvironment(
    'API_HOST',
    defaultValue: '192.168.1.5',
  );
  static const String baseUrl = kUseEmulator
      ? "http://10.0.2.2:3000/api/v1"
      : "http://$_host:3000/api/v1";

  /// Socket.io server URL (same host as API, no path).
  static const String socketUrl = kUseEmulator
      ? "http://10.0.2.2:3000"
      : "http://$_host:3000";

  // App Identity
  static const String appName = "PawSewa";
  static const String appRole = "pet_owner";

  // Storage Keys (Unique per app to prevent conflicts)
  static const String tokenKey = "user_auth_token";
  static const String userKey = "user_data";

  // Brand Colors (2026 Bento / Modern)
  static const int primaryColor = 0xFF703418; // PawSewa Brown
  static const int secondaryColor = 0xFFFFFFFF; // Pure white
  static const int accentColor = 0xFFA67B5B; // Light Brown
  /// Cream/Sand background for Bento dashboards (#F5F5F1)
  static const int bentoBackgroundColor = 0xFFF5F5F1;

  /// User-facing status labels for service requests (My Services dashboard)
  static const Map<String, String> serviceRequestStatusLabels = {
    'pending': 'Reviewing Request',
    'assigned': 'Staff Confirmed',
    'in_progress': 'Service in Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
  };

  /// Status label for display; falls back to backend value if unknown
  static String serviceRequestStatusLabel(String status) {
    return serviceRequestStatusLabels[status] ?? status.replaceAll('_', ' ');
  }
}
