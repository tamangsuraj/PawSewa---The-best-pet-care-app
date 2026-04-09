class AppConstants {
  // Live API base: [ApiConfig] / [AppConfig] (PAWSEWA_BASE_URL, BASE_URL, or LAN host).
  // For Khalti callbacks on a device, prefer a public tunnel (ngrok) via dart-define or host override.
  //
  // Legacy string (avoid for new code; use ApiClient / ApiConfig.getBaseUrl()).
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
  static const String partnerRoleKey = "partner_active_role";

  // Brand — Deep Brown primary (unified with customer web + user_app)
  static const int primaryColor = 0xFF703418;
  static const int inkColor = 0xFF5C2C14; // deeper type on cream
  static const int secondaryColor = 0xFFF5F0EA; // warm bone
  static const int accentColor = 0xFF14B8A6; // bright teal CTA
  static const int accentWarmColor = 0xFF9A6B45; // warm bronze chips
  static const int sandColor = 0xFFE8DFD4;
}
