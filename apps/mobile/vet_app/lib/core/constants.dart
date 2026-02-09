class AppConstants {
  // API Configuration for Physical Device
  // Use your computer's local IP address (192.168.1.8)
  // For emulator, use: 10.0.2.2
  static const String baseUrl = "http://192.168.1.8:3000/api/v1";
  
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
