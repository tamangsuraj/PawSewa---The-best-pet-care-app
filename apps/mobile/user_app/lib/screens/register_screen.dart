import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'dart:convert';
import '../core/api_client.dart';
import '../core/api_config.dart';
import '../core/storage_service.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/pawsewa_brand_logo.dart';
import '../services/google_auth_service.dart';
import '../services/permission_service.dart';
import '../services/push_notification_service.dart';
import 'otp_verification_screen.dart';
import 'login_screen.dart';
import 'pet_dashboard_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _apiClient = ApiClient();
  final _storage = StorageService();
  final _googleAuth = GoogleAuthService();
  final _permissionService = PermissionService();

  bool _isLoading = false;
  bool _isGoogleLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _phoneController.dispose();
    super.dispose();
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
                'Local: Enter PC IP from ipconfig.\n\n'
                'Anywhere: Run npm run tunnel, paste the ngrok URL.',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: const InputDecoration(
                  labelText: 'IP or ngrok URL',
                  border: OutlineInputBorder(),
                  hintText: '192.168.1.5 or https://xxx.ngrok-free.app',
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
            content: Text('Server IP saved. Try again.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    // Check if passwords match
    if (_passwordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Passwords do not match'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await _apiClient.register({
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'phone': _phoneController.text.trim(),
        'role': 'pet_owner', // Force pet_owner role
      });

      if (response.data['success'] == true) {
        if (mounted) {
          // Navigate to OTP verification screen
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => OTPVerificationScreen(
                email: _emailController.text.trim(),
                name: _nameController.text.trim(),
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Registration failed';

        final isConnErr = e.toString().contains('connection timeout') ||
            e.toString().contains('SocketException');
        if (isConnErr) {
          errorMessage =
              'Cannot connect to server. Tap "Reconnect" or set server URL below.';
        } else if (e.toString().contains('409') ||
            e.toString().contains('already exists')) {
          errorMessage = 'Email already registered. Please login instead.';
        } else if (e.toString().contains('400')) {
          errorMessage = 'Invalid registration data. Please check all fields.';
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
                    onPressed: () => _handleRegister(),
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

  Future<void> _handleGoogleSignIn() async {
    setState(() => _isGoogleLoading = true);

    try {
      final result = await _googleAuth.signInWithGoogle();

      if (result == null) {
        return;
      }

      final Map<String, dynamic> raw = Map<String, dynamic>.from(result);
      final String? token = raw['token']?.toString();
      final Map<String, dynamic> merged = raw['user'] is Map
          ? {
              ...Map<String, dynamic>.from(raw['user'] as Map),
              if (token != null && token.isNotEmpty) 'token': token,
            }
          : raw;

      if (token == null || token.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not complete sign-in. Please try again.'),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      final rawRole = merged['role']?.toString() ?? '';
      final role = (rawRole == 'CUSTOMER' || rawRole == 'customer')
          ? 'pet_owner'
          : rawRole;

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

      await _storage.saveToken(token);
      await _storage.saveUser(jsonEncode(merged));

      if (mounted) {
        await _permissionService.requestNotificationPermission(context);
      }
      await PushNotificationService.instance.syncTokenIfLoggedIn();

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const PetDashboardScreen()),
        );
      }
    } on PlatformException catch (e) {
      if (e.code != GoogleSignIn.kSignInCanceledError && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message ?? 'Google Sign-In was interrupted.'),
            backgroundColor: Colors.red,
          ),
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
    final logoSize = (shortest * 0.2).clamp(72.0, 100.0);
    final primary = const Color(AppConstants.primaryColor);
    final ink = const Color(AppConstants.inkColor);
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          EditorialCanvas(
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
                          SizedBox(height: size.height * 0.02),

                  // App Name
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
                    'Create Your Account',
                    style: GoogleFonts.fraunces(
                      fontSize: 17,
                      fontWeight: FontWeight.w500,
                      color: const Color(AppConstants.accentColor),
                    ),
                  ),
                  SizedBox(height: size.height * 0.03),

                  // Name Field
                  TextFormField(
                    controller: _nameController,
                    keyboardType: TextInputType.name,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      labelText: 'Full Name',
                      prefixIcon: const Icon(Icons.person),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your name';
                      }
                      if (value.length < 2) {
                        return 'Name must be at least 2 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

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
                      if (!value.contains('@') || !value.contains('.')) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Phone Field (Optional)
                  TextFormField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: 'Phone (Optional)',
                      prefixIcon: const Icon(Icons.phone),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      hintText: '9876543210',
                    ),
                    validator: (value) {
                      if (value != null && value.isNotEmpty) {
                        final cleanPhone = value.replaceAll(
                          RegExp(r'[\s\-\(\)]'),
                          '',
                        );
                        if (cleanPhone.length != 10 ||
                            !RegExp(r'^\d+$').hasMatch(cleanPhone)) {
                          return 'Phone must be 10 digits';
                        }
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

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
                        return 'Please enter a password';
                      }
                      if (value.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Confirm Password Field
                  TextFormField(
                    controller: _confirmPasswordController,
                    obscureText: _obscureConfirmPassword,
                    decoration: InputDecoration(
                      labelText: 'Confirm Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureConfirmPassword
                              ? Icons.visibility
                              : Icons.visibility_off,
                        ),
                        onPressed: () {
                          setState(
                            () => _obscureConfirmPassword =
                                !_obscureConfirmPassword,
                          );
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
                        return 'Please confirm your password';
                      }
                      if (value != _passwordController.text) {
                        return 'Passwords do not match';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
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
                  const SizedBox(height: 16),

                  // Register Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleRegister,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(AppConstants.primaryColor),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isLoading
                          ? const PawSewaLoader(width: 36, center: false)
                          : Text(
                              'Create Account',
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Login Link
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Already have an account? ',
                        style: GoogleFonts.outfit(color: ink),
                      ),
                      GestureDetector(
                        onTap: () {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(
                              builder: (_) => const LoginScreen(),
                            ),
                          );
                        },
                        child: Text(
                          'Login',
                          style: GoogleFonts.outfit(
                            color: const Color(AppConstants.primaryColor),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

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
                  const SizedBox(height: 24),

                  // Google Sign-In Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: OutlinedButton.icon(
                      onPressed: _isGoogleLoading ? null : _handleGoogleSignIn,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: primary.withValues(alpha: 0.28),
                          width: 1.5,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        backgroundColor: Colors.white.withValues(alpha: 0.85),
                      ),
                      icon: SizedBox(
                        width: 28,
                        height: 28,
                        child: _isGoogleLoading
                            ? const SizedBox.shrink()
                            : const Icon(
                                Icons.g_mobiledata,
                                size: 28,
                                color: Colors.redAccent,
                              ),
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
          if (_isGoogleLoading)
            Positioned.fill(
              child: AbsorbPointer(
                child: Material(
                  color: Colors.white.withValues(alpha: 0.82),
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const PawSewaLoader(),
                          const SizedBox(height: 20),
                          Text(
                            'Complete sign-in in the Google window…',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              color: ink.withValues(alpha: 0.75),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
