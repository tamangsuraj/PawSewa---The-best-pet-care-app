import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/api_client.dart';
import 'core/api_config.dart';
import 'core/storage_service.dart';
import 'core/constants.dart';
import 'theme/pawsewa_theme.dart';
import 'services/socket_service.dart';
import 'services/chat_unread_notify_service.dart';
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
    debugPrint('[SUCCESS] Brand Deployed: PawSewa User App (launcher, splash, Customer Care avatar).');
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CartService()),
        ChangeNotifierProvider(create: (_) => savedAddresses),
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
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: PawsewaTheme.light(),
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
      backgroundColor: const Color(AppConstants.secondaryColor),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFFDF9F4),
              Color(AppConstants.secondaryColor),
              Color(0xFFF0E6DA),
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 132,
                height: 132,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.transparent,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(AppConstants.primaryColor).withValues(alpha: 0.12),
                      blurRadius: 28,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: const PawSewaBrandLogo(height: 96),
              ),
              const SizedBox(height: 24),
              Text(
                'PawSewa',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                      fontSize: 34,
                      fontWeight: FontWeight.w600,
                      color: const Color(AppConstants.inkColor),
                    ),
              ),
              const SizedBox(height: 24),
              const PawSewaLogoSpinner(size: 48),
            ],
          ),
        ),
      ),
    );
  }
}
