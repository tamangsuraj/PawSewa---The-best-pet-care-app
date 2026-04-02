import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'firebase_options.dart';
import 'core/api_client.dart';
import 'core/api_config.dart';
import 'core/constants.dart';
import 'core/storage_service.dart';
import 'services/push_notification_service.dart';
import 'screens/login_screen.dart';
import 'screens/vet_dashboard_screen.dart';

Future<void> _logHealthCheck() async {
  try {
    final baseUrl = await ApiConfig.getBaseUrl();
    final uri = Uri.parse('$baseUrl/health');
    final response = await ApiClient().dio.getUri(uri);
    final data = response.data as Map<String, dynamic>?;
    final status = data?['status'] ?? 'n/a';
    final database = data?['database'] ?? 'n/a';
    final userCount = data?['userCount'] ?? 'n/a';
    final ts = DateTime.now().toIso8601String().replaceFirst('T', ' ').substring(0, 19);
    if (kDebugMode) {
      debugPrint('[$ts] [INFO] Backend health: status=$status database=$database userCount=$userCount');
    }
  } catch (_) {
    final ts = DateTime.now().toIso8601String().replaceFirst('T', ' ').substring(0, 19);
    if (kDebugMode) {
      debugPrint('[$ts] [INFO] Backend health: unreachable');
    }
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  if (kDebugMode) {
    debugPrint('[INFO] FCM initialized for Vet App.');
    debugPrint('[SUCCESS] Firebase successfully linked to Vet App via google-services.json.');
  }
  await ApiClient().initialize();
  await PushNotificationService.instance.initialize();
  await PushNotificationService.instance.registerFcmTokenWithBackend();
  await _logHealthCheck();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(AppConstants.primaryColor),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(AppConstants.primaryColor),
          primary: const Color(AppConstants.primaryColor),
          secondary: const Color(AppConstants.accentColor),
        ),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: Color(AppConstants.primaryColor),
          foregroundColor: Colors.white,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(AppConstants.primaryColor),
            foregroundColor: Colors.white,
          ),
        ),
        textTheme: GoogleFonts.poppinsTextTheme(),
        useMaterial3: true,
      ),
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final _storage = StorageService();

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    // Wait for splash animation
    await Future.delayed(const Duration(seconds: 2));

    final isLoggedIn = await _storage.isLoggedIn();

    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => isLoggedIn 
              ? const VetDashboardScreen() 
              : const LoginScreen(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.primaryColor),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Medical Icon with Animation
            TweenAnimationBuilder(
              tween: Tween<double>(begin: 0, end: 1),
              duration: const Duration(milliseconds: 800),
              builder: (context, double value, child) {
                return Transform.scale(
                  scale: value,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.2),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.medical_services,
                      size: 60,
                      color: Color(AppConstants.primaryColor),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 24),
            
            // App Name
            Text(
              AppConstants.appName,
              style: GoogleFonts.poppins(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'PawSewa Partner',
              style: GoogleFonts.poppins(
                fontSize: 16,
                color: Colors.white.withValues(alpha: 0.9),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 40),
            
            // Loading Indicator
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
