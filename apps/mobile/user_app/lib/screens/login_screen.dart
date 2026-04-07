import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/api_client.dart';
import '../core/api_config.dart';
import '../core/storage_service.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/pawsewa_brand_logo.dart';
import '../services/google_auth_service.dart';
import '../services/permission_service.dart';
import '../services/push_notification_service.dart';
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
  final _otpController = TextEditingController();
  final _apiClient = ApiClient();
  final _storage = StorageService();
  final _googleAuth = GoogleAuthService();
  final _permissionService = PermissionService();

  bool _isLoading = false;
  bool _isGoogleLoading = false;
  bool _obscurePassword = true;
  /// Password vs email OTP sign-in.
  bool _useEmailCode = false;
  bool _codeSent = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  String? _messageFromDio(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && d['message'] is String) return d['message'] as String;
    }
    return null;
  }

  Future<void> _completeCustomerLogin(Map<String, dynamic> userData) async {
    final String role = userData['role']?.toString() ?? '';
    final String token = userData['token']?.toString() ?? '';
    if (token.isEmpty) return;

    final String normalized =
        (role == 'CUSTOMER' || role == 'customer') ? 'pet_owner' : role;
    if (normalized != 'pet_owner') {
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

    await _storage.saveToken(token);
    await _storage.saveUser(jsonEncode(userData));

    if (mounted) {
      await _permissionService.requestNotificationPermission(context);
    }
    await PushNotificationService.instance.syncTokenIfLoggedIn();

    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const PetDashboardScreen()),
      );
    }
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
        final userData = Map<String, dynamic>.from(
          response.data['data'] as Map,
        );
        await _completeCustomerLogin(userData);
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = _messageFromDio(e) ?? 'Login failed';

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
        } else if (errorMessage == 'Login failed' &&
            (e.toString().contains('401') ||
                e.toString().contains('Invalid credentials'))) {
          errorMessage = 'Invalid email or password';
        } else if (errorMessage == 'Login failed' &&
            e.toString().contains('404')) {
          errorMessage = 'Server endpoint not found';
        } else if (errorMessage == 'Login failed') {
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

  Future<void> _handleSendLoginOtp() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Enter a valid email to receive a sign-in code'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      await _apiClient.initialize();
      final res = await _apiClient.sendLoginOtp(email);
      if (!mounted) return;
      if (res.data['success'] == true) {
        setState(() => _codeSent = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Check your email for a 6-digit code'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_messageFromDio(e) ?? 'Could not send code'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleVerifyLoginOtp() async {
    final email = _emailController.text.trim();
    final otp = _otpController.text.trim();
    if (email.isEmpty || otp.length != 6) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Enter the 6-digit code from your email'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      await _apiClient.initialize();
      final res = await _apiClient.verifyLoginOtp(email, otp);
      if (res.data['success'] == true && mounted) {
        final data = Map<String, dynamic>.from(res.data['data'] as Map);
        await _completeCustomerLogin(data);
      }
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_messageFromDio(e) ?? 'Invalid OTP'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
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

      final Map<String, dynamic> raw = Map<String, dynamic>.from(result);
      final String? token = raw['token']?.toString();
      final Map<String, dynamic> merged = raw['user'] is Map
          ? {
              ...Map<String, dynamic>.from(raw['user'] as Map),
              'token': ?token,
            }
          : raw;
      if (token != null) {
        await _completeCustomerLogin(merged);
      }
    } catch (e) {
      if (mounted) {
        String errorMessage =
            _messageFromDio(e) ?? 'Google Sign-In failed';

        final isConnErr = e.toString().contains('connection timeout') ||
            e.toString().contains('SocketException');
        if (isConnErr) {
          errorMessage =
              'Cannot connect to server. Tap "Reconnect" or set server URL below.';
        } else if (errorMessage == 'Google Sign-In failed') {
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
    final primary = const Color(AppConstants.primaryColor);
    final ink = const Color(AppConstants.inkColor);
    return Scaffold(
      body: EditorialCanvas(
        variant: EditorialSurfaceVariant.customer,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: padding,
                vertical: padding * 1.2,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: primary.withValues(alpha: 0.1)),
                    boxShadow: [
                      BoxShadow(
                        color: ink.withValues(alpha: 0.08),
                        blurRadius: 36,
                        offset: const Offset(0, 20),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(22),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: logoSize,
                            height: logoSize,
                            decoration: BoxDecoration(
                              color: Colors.transparent,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: primary.withValues(alpha: 0.15),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: ink.withValues(alpha: 0.06),
                                  blurRadius: 24,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            clipBehavior: Clip.antiAlias,
                            padding: EdgeInsets.all(logoSize * 0.14),
                            child: PawSewaBrandLogo(height: logoSize * 0.72),
                          ),
                  SizedBox(height: size.height * 0.025),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      AppConstants.appName,
                      style: GoogleFonts.outfit(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: const Color(AppConstants.primaryColor),
                      ),
                    ),
                  ),
                  SizedBox(height: size.height * 0.01),
                  Text(
                    'Pet Owner Portal',
                    style: GoogleFonts.fraunces(
                      fontSize: 17,
                      fontWeight: FontWeight.w500,
                      color: const Color(AppConstants.accentColor),
                    ),
                  ),
                  SizedBox(height: size.height * 0.02),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      TextButton(
                        onPressed: _isLoading
                            ? null
                            : () {
                                setState(() {
                                  _useEmailCode = false;
                                  _codeSent = false;
                                  _otpController.clear();
                                });
                              },
                        child: Text(
                          'Password',
                          style: GoogleFonts.outfit(
                            fontWeight:
                                !_useEmailCode ? FontWeight.w700 : FontWeight.w500,
                            color: !_useEmailCode
                                ? primary
                                : ink.withValues(alpha: 0.5),
                          ),
                        ),
                      ),
                      Text('·', style: GoogleFonts.outfit(color: ink.withValues(alpha: 0.35))),
                      TextButton(
                        onPressed: _isLoading
                            ? null
                            : () {
                                setState(() {
                                  _useEmailCode = true;
                                  _codeSent = false;
                                  _otpController.clear();
                                });
                              },
                        child: Text(
                          'Email code',
                          style: GoogleFonts.outfit(
                            fontWeight:
                                _useEmailCode ? FontWeight.w700 : FontWeight.w500,
                            color: _useEmailCode
                                ? primary
                                : ink.withValues(alpha: 0.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: size.height * 0.02),

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

                  if (!_useEmailCode) ...[
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
                            ? const PawSewaLoader(width: 36, center: false)
                            : Text(
                                'Login',
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ] else ...[
                    if (_codeSent) ...[
                      TextFormField(
                        controller: _otpController,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        decoration: InputDecoration(
                          labelText: '6-digit code',
                          prefixIcon: const Icon(Icons.pin),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          filled: true,
                          fillColor: Colors.white,
                          counterText: '',
                        ),
                      ),
                      SizedBox(height: size.height * 0.02),
                    ],
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading
                            ? null
                            : (_codeSent
                                ? _handleVerifyLoginOtp
                                : _handleSendLoginOtp),
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
                            ? const PawSewaLoader(width: 36, center: false)
                            : Text(
                                _codeSent ? 'Verify & sign in' : 'Send sign-in code',
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                    if (_codeSent) ...[
                      SizedBox(height: size.height * 0.012),
                      TextButton(
                        onPressed: _isLoading
                            ? null
                            : () {
                                setState(() {
                                  _codeSent = false;
                                  _otpController.clear();
                                });
                              },
                        child: Text(
                          'Use a different email',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: primary.withValues(alpha: 0.8),
                          ),
                        ),
                      ),
                    ],
                  ],
                  SizedBox(height: size.height * 0.02),

                  // Set server URL link (for connection issues)
                  TextButton(
                    onPressed: _showSetServerIpDialog,
                    child: Text(
                      "Can't connect? Set server URL",
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        color: primary.withValues(alpha: 0.75),
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
                        style: GoogleFonts.outfit(color: ink),
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
                          style: GoogleFonts.outfit(
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
                      Expanded(
                        child: Divider(
                          thickness: 1,
                          color: primary.withValues(alpha: 0.14),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'OR',
                          style: GoogleFonts.outfit(
                            color: ink.withValues(alpha: 0.45),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Divider(
                          thickness: 1,
                          color: primary.withValues(alpha: 0.14),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: size.height * 0.025),

                  // Google Sign-In Button
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _isGoogleLoading ? null : _handleGoogleSignIn,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: primary.withValues(alpha: 0.28),
                          width: 1.5,
                        ),
                        padding: EdgeInsets.symmetric(
                          vertical: (size.height * 0.018).clamp(16.0, 24.0),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        backgroundColor: Colors.white.withValues(alpha: 0.85),
                      ),
                      icon: _isGoogleLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: PawSewaLoader(width: 32, center: false),
                            )
                          : const Icon(
                              Icons.g_mobiledata,
                              size: 28,
                              color: Colors.redAccent,
                            ),
                      label: Text(
                        'Continue with Google',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: ink,
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
            ),
          ),
        ),
      ),
    );
  }
}
