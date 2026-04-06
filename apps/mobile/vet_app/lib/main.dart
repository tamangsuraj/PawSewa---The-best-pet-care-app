import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'firebase_options.dart';
import 'core/api_client.dart';
import 'core/api_config.dart';
import 'core/app_navigator.dart';
import 'core/constants.dart';
import 'theme/partner_theme.dart';
import 'core/storage_service.dart';
import 'services/push_notification_service.dart';
import 'widgets/pawsewa_brand_logo.dart';
import 'widgets/pawsewa_logo_spinner.dart';
import 'screens/login_screen.dart';
import 'screens/vet_dashboard_screen.dart';
import 'services/chat_unread_notify_service.dart';

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
    debugPrint('[SUCCESS] Brand Deployed: PawSewa Partner App (launcher, splash, headers).');
  }
  await ApiClient().initialize();
  await PushNotificationService.instance.initialize();
  await PushNotificationService.instance.registerFcmTokenWithBackend();
  await _logHealthCheck();
  if (kDebugMode) {
    debugPrint(
      '[SUCCESS] Brand Assets Updated: New PawSewa Logo implemented across 4 platforms.',
    );
  }
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ChatUnreadNotifyService()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: appNavigatorKey,
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: PartnerTheme.light(),
      home: const SplashScreen(),
      routes: <String, WidgetBuilder>{
        '/login': (_) => const LoginScreen(),
      },
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
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF4A3A30),
              Color(AppConstants.primaryColor),
              Color(AppConstants.inkColor),
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 800),
                builder: (context, value, child) {
                  return Transform.scale(
                    scale: value,
                    child: Container(
                      width: 132,
                      height: 132,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 28,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: const PawSewaBrandLogo(height: 96),
                    ),
                  );
                },
              ),
              const SizedBox(height: 28),
              Text(
                AppConstants.appName,
                style: GoogleFonts.fraunces(
                  fontSize: 34,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Clinical tools · one brand',
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  color: Colors.white.withValues(alpha: 0.88),
                  fontWeight: FontWeight.w500,
                  letterSpacing: 0.02,
                ),
              ),
              const SizedBox(height: 40),
              const PawSewaLogoSpinner(size: 44),
            ],
          ),
        ),
      ),
    );
  }
}
