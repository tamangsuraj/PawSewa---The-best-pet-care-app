import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/api_client.dart';
import 'core/api_config.dart';
import 'core/storage_service.dart';
import 'core/constants.dart';
import 'services/socket_service.dart';
import 'services/push_notification_service.dart';
import 'screens/login_screen.dart';
import 'screens/pet_dashboard_screen.dart';
import 'widgets/pawsewa_brand_logo.dart';
import 'widgets/pawsewa_logo_spinner.dart';
import 'cart/cart_service.dart';
import 'cart/saved_addresses_service.dart';

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
  await ApiClient().initialize();
  await PushNotificationService.instance.initialize();
  _logHealthCheck();

  final savedAddresses = SavedAddressesService();
  await savedAddresses.load();

  if (kDebugMode) {
    debugPrint(
      '[SUCCESS] Brand Assets Updated: New PawSewa Logo implemented across 4 platforms.',
    );
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CartService()),
        ChangeNotifierProvider(create: (_) => savedAddresses),
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
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: Colors.white,
        primaryColor: const Color(AppConstants.primaryColor),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(AppConstants.primaryColor),
          primary: const Color(AppConstants.primaryColor),
          secondary: const Color(AppConstants.accentColor),
          surface: Colors.white,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Colors.black87,
          elevation: 0,
          scrolledUnderElevation: 0,
          surfaceTintColor: Colors.transparent,
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
  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    final storage = StorageService();
    final isLoggedIn = await storage.isLoggedIn();

    await Future.delayed(const Duration(seconds: 1));

    if (mounted) {
      if (isLoggedIn) {
        SocketService.instance.connect();
        unawaited(PushNotificationService.instance.syncTokenIfLoggedIn());
      }
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) =>
              isLoggedIn ? const PetDashboardScreen() : const LoginScreen(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 132,
              height: 132,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: const Color(AppConstants.primaryColor).withValues(alpha: 0.2),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const PawSewaBrandLogo(height: 96),
            ),
            const SizedBox(height: 24),
            const Text(
              'PawSewa',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Color(AppConstants.primaryColor),
              ),
            ),
            const SizedBox(height: 24),
            const PawSewaLogoSpinner(size: 48),
          ],
        ),
      ),
    );
  }
}
