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

  // Brand — Deep Brown primary (unified with customer web + user_app)
  static const int primaryColor = 0xFF703418;
  static const int inkColor = 0xFF5C2C14; // deeper type on cream
  static const int secondaryColor = 0xFFFFFFFF; // white
  static const int accentColor = 0xFF14B8A6; // bright teal CTA
  static const int accentWarmColor = 0xFF9A6B45; // warm bronze chips
  static const int sandColor = 0xFFE8DFD4;

  // Role-panel accent colors
  static const int vetAccent    = 0xFF0D9488; // teal-600 — clinical trust
  static const int riderAccent  = 0xFF2563EB; // blue-600  — movement & logistics
  static const int sellerAccent = 0xFF7C3AED; // violet-600 — commerce & premium
  static const int careAccent   = 0xFFD97706; // amber-600 — warmth & nurturing
}
