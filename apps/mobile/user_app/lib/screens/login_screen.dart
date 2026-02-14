import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/api_client.dart';
import '../core/api_config.dart';
import '../core/storage_service.dart';
import '../core/constants.dart';
import '../services/google_auth_service.dart';
import '../services/permission_service.dart';
import 'pet_dashboard_screen.dart';
import 'otp_verification_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _apiClient = ApiClient();
  final _storage = StorageService();
  final _googleAuth = GoogleAuthService();
  final _permissionService = PermissionService();

  bool _isLoading = false;
  bool _isGoogleLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final response = await _apiClient.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      if (response.data['success'] == true) {
        final userData = response.data['data'];
        final String role = userData['role'];
        final String token = userData['token'];

        // Role Guard: Only allow pet_owner
        if (role != 'pet_owner') {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Unauthorized: This app is for Pet Owners only'),
                backgroundColor: Colors.red,
                duration: Duration(seconds: 4),
              ),
            );
          }
          return;
        }

        // Save token and user data
        await _storage.saveToken(token);
        await _storage.saveUser(jsonEncode(userData));

        // Request notification permission
        if (mounted) {
          await _permissionService.requestNotificationPermission(context);
        }

        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const PetDashboardScreen()),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Login failed';

        // Check if error is about unverified email
        if (e.toString().contains('verify your email') ||
            e.toString().contains('403')) {
          // Redirect to OTP verification screen
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => OTPVerificationScreen(
                email: _emailController.text.trim(),
                name: '', // We don't have the name here, but it's okay
              ),
            ),
          );
          return;
        }

        // Provide helpful error messages
        final isConnectionError = e.toString().contains('connection timeout') ||
            e.toString().contains('SocketException') ||
            e.toString().contains('connectionError');
        if (isConnectionError) {
          errorMessage =
              'Cannot connect to server. Tap "Reconnect" or set server URL below.';
        } else if (e.toString().contains('401') ||
            e.toString().contains('Invalid credentials')) {
          errorMessage = 'Invalid email or password';
        } else if (e.toString().contains('404')) {
          errorMessage = 'Server endpoint not found';
        } else {
          errorMessage = 'Error: ${e.toString()}';
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 6),
            action: isConnectionError
                ? SnackBarAction(
                    label: 'Reconnect',
                    textColor: Colors.white,
                    onPressed: () => _handleLogin(),
                  )
                : null,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _showSetServerIpDialog() async {
    final currentHost = await ApiConfig.getHost();
    final controller = TextEditingController(text: currentHost);

    if (!mounted) return;
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Set server URL'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Local network (same Wi‑Fi): Enter your PC\'s IP from ipconfig.\n\n'
                'Anywhere (ngrok): Run npm run tunnel in backend, then paste the https://xxx.ngrok-free.app URL.',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: const InputDecoration(
                  labelText: 'IP or ngrok URL (e.g. 192.168.1.5 or https://xxx.ngrok-free.app)',
                  border: OutlineInputBorder(),
                  hintText: '192.168.1.5',
                ),
                keyboardType: TextInputType.url,
                autofocus: true,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (saved == true && mounted) {
      await ApiConfig.setHost(controller.text);
      await _apiClient.reinitialize();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Server IP saved. Try logging in again.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() => _isGoogleLoading = true);

    try {
      final result = await _googleAuth.signInWithGoogle();

      if (result == null) {
        // User cancelled
        return;
      }

      final String token = result['token'];
      final userData = result['user'];
      final String role = userData['role'];

      // Role Guard: Only allow pet_owner
      if (role != 'pet_owner') {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Unauthorized: This app is for Pet Owners only'),
              backgroundColor: Colors.red,
              duration: Duration(seconds: 4),
            ),
          );
        }
        return;
      }

      // Save token and user data
      await _storage.saveToken(token);
      await _storage.saveUser(jsonEncode(userData));

      // Request notification permission
      if (mounted) {
        await _permissionService.requestNotificationPermission(context);
      }

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const PetDashboardScreen()),
        );
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Google Sign-In failed';

        final isConnErr = e.toString().contains('connection timeout') ||
            e.toString().contains('SocketException');
        if (isConnErr) {
          errorMessage =
              'Cannot connect to server. Tap "Reconnect" or set server URL below.';
        } else {
          errorMessage = 'Error: ${e.toString()}';
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 6),
            action: isConnErr
                ? SnackBarAction(
                    label: 'Reconnect',
                    textColor: Colors.white,
                    onPressed: () => _handleGoogleSignIn(),
                  )
                : null,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isGoogleLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final shortest = size.width < size.height ? size.width : size.height;
    final padding = (size.width * 0.06).clamp(16.0, 28.0);
    final logoSize = (shortest * 0.22).clamp(72.0, 120.0);
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: padding,
              vertical: padding * 1.2,
            ),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: logoSize,
                    height: logoSize,
                    decoration: const BoxDecoration(
                      color: Color(AppConstants.primaryColor),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.pets,
                      size: logoSize * 0.5,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: size.height * 0.025),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      AppConstants.appName,
                      style: GoogleFonts.poppins(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: const Color(AppConstants.primaryColor),
                      ),
                    ),
                  ),
                  SizedBox(height: size.height * 0.01),
                  Text(
                    'Pet Owner Portal',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      color: const Color(AppConstants.accentColor),
                    ),
                  ),
                  SizedBox(height: size.height * 0.04),

                  // Email Field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'Email',
                      prefixIcon: const Icon(Icons.email),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your email';
                      }
                      if (!value.contains('@')) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  SizedBox(height: size.height * 0.02),

                  // Password Field
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility
                              : Icons.visibility_off,
                        ),
                        onPressed: () {
                          setState(() => _obscurePassword = !_obscurePassword);
                        },
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      return null;
                    },
                  ),
                  SizedBox(height: size.height * 0.03),

                  // Login Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(AppConstants.primaryColor),
                        padding: EdgeInsets.symmetric(
                          vertical: (size.height * 0.018).clamp(16.0, 24.0),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Text(
                              'Login',
                              style: GoogleFonts.poppins(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                  SizedBox(height: size.height * 0.02),

                  // Set server URL link (for connection issues)
                  TextButton(
                    onPressed: _showSetServerIpDialog,
                    child: Text(
                      "Can't connect? Set server URL",
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        color: Colors.grey,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                  SizedBox(height: size.height * 0.01),

                  // Register Link
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        'Don\'t have an account? ',
                        style: GoogleFonts.poppins(color: Colors.black87),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(
                              builder: (_) => const RegisterScreen(),
                            ),
                          );
                        },
                        child: Text(
                          'Sign Up',
                          style: GoogleFonts.poppins(
                            color: const Color(AppConstants.primaryColor),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: size.height * 0.035),

                  // Divider
                  Row(
                    children: [
                      const Expanded(child: Divider(thickness: 1)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'OR',
                          style: GoogleFonts.poppins(
                            color: Colors.grey,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const Expanded(child: Divider(thickness: 1)),
                    ],
                  ),
                  SizedBox(height: size.height * 0.025),

                  // Google Sign-In Button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _isGoogleLoading ? null : _handleGoogleSignIn,
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.grey, width: 1.5),
                        padding: EdgeInsets.symmetric(
                          vertical: (size.height * 0.018).clamp(16.0, 24.0),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        backgroundColor: Colors.white,
                      ),
                      icon: _isGoogleLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(
                              Icons.g_mobiledata,
                              size: 28,
                              color: Colors.redAccent,
                            ),
                      label: Text(
                        'Continue with Google',
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
