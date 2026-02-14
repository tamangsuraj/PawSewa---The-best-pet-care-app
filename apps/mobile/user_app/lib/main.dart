import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/api_client.dart';
import 'core/storage_service.dart';
import 'core/constants.dart';
import 'services/socket_service.dart';
import 'screens/login_screen.dart';
import 'screens/pet_dashboard_screen.dart';
import 'cart/cart_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiClient().initialize();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CartService()),
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
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: const Color(AppConstants.primaryColor),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.pets, size: 60, color: Colors.white),
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
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(
                Color(AppConstants.primaryColor),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
