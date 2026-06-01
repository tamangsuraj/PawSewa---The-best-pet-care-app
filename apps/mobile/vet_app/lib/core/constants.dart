class AppConstants {
  // Default API/Socket host: lib/config/app_config.dart (ngrok + PAWSEWA_BASE_URL).
  // API Configuration
  //
  // Use the SAME host as the customer app so both hit the same backend.
  // - Physical device: your PC's LAN IP (run `ipconfig` on Windows to find it)
  // - Android emulator: use 10.0.2.2 to reach host machine's localhost
  //
  static const bool kUseEmulator = false;
  static const String _host = String.fromEnvironment(
    'API_HOST',
    defaultValue: '',
  );

  static String get baseUrl => kUseEmulator
      ? 'http://10.0.2.2:3000/api/v1'
      : (_host.isNotEmpty ? 'http://$_host:3000/api/v1' : '');

  // App Identity
  static const String appName = "PawSewa Partner";
  static const String appRole = "staff"; // Inclusive for all staff members

  // Storage Keys (Unique per app to prevent conflicts)
  static const String tokenKey = "partner_auth_token";
  static const String userKey = "partner_user_data";
  static const String partnerRoleKey = "partner_active_role";

  // Brand — deep brown + white (aligned with user_app / web)
  static const int primaryColor = 0xFF703418;
  static const int inkColor = 0xFF5C2C14;
  static const int secondaryColor = 0xFFFFFFFF;
  static const int accentColor = 0xFF9A6B45; // warm bronze secondary
  static const int accentWarmColor = 0xFFA67B5B;
  static const int sandColor = 0xFFEBE3D6;
  static const int bentoBackgroundColor = 0xFFF5EDE4;

  // Role accents — brown family (no blue/teal/violet panels)
  static const int vetAccent = primaryColor;
  static const int riderAccent = 0xFF8B5E3C;
  static const int sellerAccent = accentColor;
  static const int careAccent = accentWarmColor;

  /// Primary actions / success feedback — brand brown (not green/blue).
  static const int actionColor = primaryColor;

  /// Rider payout per completed delivery (matches customer app delivery fee).
  static const double riderDeliveryEarningNpr = 80;
}
