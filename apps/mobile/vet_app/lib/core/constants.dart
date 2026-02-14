class AppConstants {
  // API Configuration
  //
  // Use the SAME host as the customer app so both hit the same backend.
  // - Physical device: your PC's LAN IP (run `ipconfig` on Windows to find it)
  // - Android emulator: use 10.0.2.2 to reach host machine's localhost
  //
  // Override at runtime: flutter run --dart-define=API_HOST=192.168.1.10
  static const bool kUseEmulator = false;
  static const String _host = String.fromEnvironment(
    'API_HOST',
    defaultValue: '192.168.1.5',
  );

  static const String baseUrl = kUseEmulator
      ? "http://10.0.2.2:3000/api/v1"
      : "http://$_host:3000/api/v1";

  // App Identity
  static const String appName = "PawSewa Partner";
  static const String appRole = "staff"; // Inclusive for all staff members

  // Storage Keys (Unique per app to prevent conflicts)
  static const String tokenKey = "partner_auth_token";
  static const String userKey = "partner_user_data";

  // Brand Colors - PawSewa Brown Theme (matching user app)
  static const int primaryColor = 0xFF703418; // PawSewa Brown
  static const int secondaryColor = 0xFFFDF8F5; // Bone White
  static const int accentColor = 0xFF8B4513; // Darker Brown
}
