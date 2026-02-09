class AppConstants {
  // API Configuration for Physical Device
  // Use your computer's local IP address (192.168.1.8)
  // For emulator, use: 10.0.2.2
  static const String baseUrl = "http://192.168.1.8:3000/api/v1";
  
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
