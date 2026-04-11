class AppConstants {
  // Default API/Socket host: see lib/config/app_config.dart (ngrok + PAWSEWA_BASE_URL).
  // API base URL — backend runs on port 3000 (not 5000).
  // • Physical device: use your PC's IPv4 (same Wi‑Fi as phone). Run `ipconfig` (Windows) to find it.
  // • Android emulator: set kUseEmulator = true to use 10.0.2.2 (emulator's alias for host localhost).
  //
  // Prefer lib/config/app_config.dart + ApiConfig; this mirrors compile-time API_HOST only.
  static const bool kUseEmulator =
      false; // true = Android emulator (10.0.2.2), false = physical device
  static const String _host = String.fromEnvironment(
    'API_HOST',
    defaultValue: '',
  );
  static String get baseUrl => kUseEmulator
      ? 'http://10.0.2.2:3000/api/v1'
      : (_host.isNotEmpty ? 'http://$_host:3000/api/v1' : '');

  /// Socket.io server URL (same host as API, no path).
  static String get socketUrl => kUseEmulator
      ? 'http://10.0.2.2:3000'
      : (_host.isNotEmpty ? 'http://$_host:3000' : '');

  // App Identity
  static const String appName = "PawSewa";
  static const String appRole = "pet_owner";

  // Storage Keys (Unique per app to prevent conflicts)
  static const String tokenKey = "user_auth_token";
  static const String userKey = "user_data";

  // Brand — Deep Brown primary (unified across web + mobile)
  static const int primaryColor = 0xFF703418;
  static const int inkColor = 0xFF5C2C14; // darker brown for body type
  static const int secondaryColor = 0xFFFAF6F0; // cream surface
  static const int accentColor = 0xFF0D9488; // care teal
  static const int accentWarmColor = 0xFFA67B5B; // warm tan chips / legacy accents
  static const int sandColor = 0xFFEBE3D6;
  /// Dashboard / bento canvas
  static const int bentoBackgroundColor = 0xFFF5EDE4;

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
