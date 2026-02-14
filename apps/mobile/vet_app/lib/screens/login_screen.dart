import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/api_client.dart';
import '../core/api_config.dart';
import '../core/storage_service.dart';
import '../core/constants.dart';
import 'vet_dashboard_screen.dart';

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
  
  bool _isLoading = false;
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

        // Role Guard: Allow all partner roles (veterinarian, shop_owner, care_service, rider)
        // Block pet_owner and admin
        final allowedRoles = ['veterinarian', 'shop_owner', 'care_service', 'rider'];
        
        if (!allowedRoles.contains(role)) {
          if (mounted) {
            String message = 'Unauthorized: This app is for PawSewa Partners only';
            
            if (role == 'pet_owner') {
              message = 'Unauthorized: Pet owners should use the PawSewa Customer App';
            } else if (role == 'admin') {
              message = 'Unauthorized: Admins should use the Admin Panel';
            }
            
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(message),
                backgroundColor: Colors.red[700],
                duration: const Duration(seconds: 4),
              ),
            );
          }
          return;
        }

        // Save token and user data
        await _storage.saveToken(token);
        await _storage.saveUser(jsonEncode(userData));

        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const VetDashboardScreen()),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Login failed';
        
        final isConnErr = e.toString().contains('connection timeout') ||
            e.toString().contains('SocketException');
        if (isConnErr) {
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
            backgroundColor: Colors.red[700],
            duration: const Duration(seconds: 6),
            action: isConnErr
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

  Future<void> _showSetServerUrlDialog() async {
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
            content: Text('Server URL saved. Try logging in again.'),
            backgroundColor: Colors.green,
          ),
        );
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
      backgroundColor: const Color(AppConstants.secondaryColor),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(horizontal: padding, vertical: padding * 1.2),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo/Icon with Medical Theme
                  Container(
                    width: logoSize,
                    height: logoSize,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(AppConstants.primaryColor),
                          const Color(AppConstants.accentColor),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(AppConstants.primaryColor).withValues(alpha: 77 / 255),
                          blurRadius: 15,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.medical_services,
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
                    'Partner Portal',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      color: const Color(AppConstants.accentColor),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: size.height * 0.04),
                  
                  // Email Field
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(
                        Icons.email,
                        color: const Color(AppConstants.primaryColor),
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: const Color(AppConstants.primaryColor).withValues(alpha: 77 / 255),
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: Color(AppConstants.primaryColor),
                          width: 2,
                        ),
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
                      prefixIcon: Icon(
                        Icons.lock,
                        color: const Color(AppConstants.primaryColor),
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility : Icons.visibility_off,
                          color: const Color(AppConstants.primaryColor),
                        ),
                        onPressed: () {
                          setState(() => _obscurePassword = !_obscurePassword);
                        },
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: const Color(AppConstants.primaryColor).withValues(alpha: 77 / 255),
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: Color(AppConstants.primaryColor),
                          width: 2,
                        ),
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
                        elevation: 3,
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
                  TextButton(
                    onPressed: _showSetServerUrlDialog,
                    child: Text(
                      "Can't connect? Set server URL",
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        color: Colors.grey,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                  SizedBox(height: size.height * 0.015),
                  
                  // Info Text
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(AppConstants.primaryColor).withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(AppConstants.primaryColor).withValues(alpha: 77 / 255),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.info_outline,
                          color: const Color(AppConstants.primaryColor),
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Welcome, Partner! Join our team of veterinarians, shop owners, care providers & delivery partners.',
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: const Color(AppConstants.accentColor),
                            ),
                          ),
                        ),
                      ],
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
