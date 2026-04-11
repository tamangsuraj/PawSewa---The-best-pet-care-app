import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/api_config.dart';
import '../../core/constants.dart';
import '../../widgets/paw_sewa_loader.dart';

class RegisterVetScreen extends StatefulWidget {
  const RegisterVetScreen({super.key});

  @override
  State<RegisterVetScreen> createState() => _RegisterVetScreenState();
}

class _RegisterVetScreenState extends State<RegisterVetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _api = ApiClient();

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _license = TextEditingController();
  final _specialization = TextEditingController();
  final _years = TextEditingController();
  final _credentials = TextEditingController();
  final _address = TextEditingController();
  final _lat = TextEditingController();
  final _lng = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();

  bool _submitting = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _license.dispose();
    _specialization.dispose();
    _years.dispose();
    _credentials.dispose();
    _address.dispose();
    _lat.dispose();
    _lng.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  String? _messageFromDio(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && d['message'] is String) return d['message'] as String;
      if (d is String && d.trim().isNotEmpty) return d;
    }
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    try {
      await _api.initialize();
      final baseUrl = await ApiConfig.getBaseUrl();

      final fd = FormData.fromMap({
        'name': _name.text.trim(),
        'email': _email.text.trim(),
        'password': _password.text,
        'phone': _phone.text.trim(),
        'licenseNumber': _license.text.trim(),
        'specialization': _specialization.text.trim(),
        'yearsOfExperience': _years.text.trim(),
        'credentials': _credentials.text.trim(),
        'clinicAddress': _address.text.trim(),
        'lat': _lat.text.trim(),
        'lng': _lng.text.trim(),
      });

      await _api.dio.post(
        // ApiClient baseUrl already includes /api/v1
        '/veterinarians/self-register',
        data: fd,
        options: Options(headers: ApiConfig.ngrokHeadersForBaseUrl(baseUrl)),
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Submitted. After admin approval, sign in with your email and password.',
            style: GoogleFonts.outfit(),
          ),
          backgroundColor: Colors.green.shade700,
          duration: const Duration(seconds: 4),
        ),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      final msg = _messageFromDio(e) ?? 'Failed to submit registration';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg, style: GoogleFonts.outfit()),
          backgroundColor: Colors.red.shade700,
          duration: const Duration(seconds: 5),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = const Color(AppConstants.primaryColor);
    final ink = const Color(AppConstants.inkColor);
    final size = MediaQuery.of(context).size;

    InputDecoration deco(String label, {String? hint}) => InputDecoration(
          labelText: label,
          hintText: hint,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        );

    return Scaffold(
      backgroundColor: const Color(0xFFF7F2EC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Join as Vet', style: GoogleFonts.outfit(color: ink, fontWeight: FontWeight.w700)),
        iconTheme: IconThemeData(color: ink),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: primary.withValues(alpha: 0.12)),
                  ),
                  child: Text(
                    'Submit your veterinarian profile for admin verification. Choose a password you will use to sign in after an administrator marks you as available for assignment.',
                    style: GoogleFonts.outfit(fontSize: 13, color: ink.withValues(alpha: 0.75)),
                  ),
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _name,
                  decoration: deco('Full name', hint: 'Dr. Full Name'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _email,
                  decoration: deco('Email'),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => (v == null || !v.contains('@')) ? 'Valid email required' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _phone,
                  decoration: deco('Phone'),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _license,
                        decoration: deco('License (NMC/VCN)', hint: 'NMC-XXXX'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _years,
                        decoration: deco('Years', hint: '5'),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _specialization,
                  decoration: deco('Specialization', hint: 'General Practice'),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _credentials,
                  decoration: deco('Credentials', hint: 'Degrees / certifications'),
                  maxLines: 3,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _address,
                  decoration: deco('Clinic/Home service address'),
                  maxLines: 2,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _lat,
                        decoration: deco('Lat', hint: '27.7172'),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _lng,
                        decoration: deco('Lng', hint: '85.3240'),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _password,
                  obscureText: _obscurePassword,
                  decoration: deco('Create password', hint: 'At least 6 characters').copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.length < 6) return 'Password must be at least 6 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _confirmPassword,
                  obscureText: _obscureConfirmPassword,
                  decoration: deco('Confirm password').copyWith(
                    suffixIcon: IconButton(
                      icon: Icon(_obscureConfirmPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                    ),
                  ),
                  validator: (v) {
                    if (v != _password.text) return 'Passwords do not match';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primary,
                      padding: EdgeInsets.symmetric(
                        vertical: (size.height * 0.018).clamp(14.0, 22.0),
                      ),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _submitting
                        ? const PawSewaLoader(width: 36, center: false)
                        : Text(
                            'Submit for verification',
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

