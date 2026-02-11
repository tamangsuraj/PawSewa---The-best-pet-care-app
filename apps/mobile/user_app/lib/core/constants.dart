class AppConstants {
  // API base URL — pick one:
  // • Physical device: your PC's LAN IP (same Wi‑Fi as phone). Example: 192.168.1.8
  // • Android emulator: use 10.0.2.2 to reach host machine's localhost
  static const bool kUseEmulator =
      false; // true = Android emulator (10.0.2.2), false = physical device
  static const String _host = "192.168.1.5"; // your PC IP (same WiFi as phone)
  static const String baseUrl = kUseEmulator
      ? "http://10.0.2.2:3000/api/v1"
      : "http://$_host:3000/api/v1";

  // App Identity
  static const String appName = "PawSewa";
  static const String appRole = "pet_owner";

  // Storage Keys (Unique per app to prevent conflicts)
  static const String tokenKey = "user_auth_token";
  static const String userKey = "user_data";

  // Brand Colors
  static const int primaryColor = 0xFF703418; // Brown
  static const int secondaryColor = 0xFFF5E6CA; // Cream
  static const int accentColor = 0xFFA67B5B; // Light Brown
}
