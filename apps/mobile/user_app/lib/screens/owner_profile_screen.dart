import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/storage_service.dart';

/// Edit customer profile (Mongo `users` / pawsewa_chat.users): name, phone, photo.
class OwnerProfileScreen extends StatefulWidget {
  const OwnerProfileScreen({super.key});

  @override
  State<OwnerProfileScreen> createState() => _OwnerProfileScreenState();
}

class _OwnerProfileScreenState extends State<OwnerProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _api = ApiClient();
  final _storage = StorageService();
  final _imagePicker = ImagePicker();

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  bool _loading = false;
  bool _saving = false;
  String? _profilePictureUrl;
  File? _selectedImage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
    });
    try {
      final response = await _api.getUserProfile();
      if (response.statusCode == 200 && response.data is Map) {
        final root = response.data as Map;
        final data = root['data'];
        if (data is Map) {
          final m = Map<String, dynamic>.from(data);
          if (mounted) {
            setState(() {
              _nameController.text = m['name']?.toString() ?? '';
              _phoneController.text = m['phone']?.toString() ?? '';
              _profilePictureUrl = m['profilePicture']?.toString();
            });
          }
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[OwnerProfile] load error: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<String?> _uploadToCloudinary(File imageFile) async {
    try {
      final url = Uri.parse('https://api.cloudinary.com/v1_1/dhivjgzgz/image/upload');
      final request = http.MultipartRequest('POST', url);
      request.fields['upload_preset'] = 'pawsewa_profiles';
      request.files.add(await http.MultipartFile.fromPath('file', imageFile.path));
      final response = await request.send();
      if (response.statusCode == 200) {
        final body = await response.stream.bytesToString();
        final jsonData = jsonDecode(body) as Map<String, dynamic>;
        return jsonData['secure_url']?.toString();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[OwnerProfile] Cloudinary: $e');
      }
    }
    return null;
  }

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );
      if (image != null && mounted) {
        setState(() {
          _selectedImage = File(image.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not pick image: $e')),
        );
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() {
      _saving = true;
    });
    try {
      String? imageUrl = _profilePictureUrl;
      if (_selectedImage != null) {
        imageUrl = await _uploadToCloudinary(_selectedImage!);
        if (imageUrl == null) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Failed to upload profile photo')),
            );
          }
          return;
        }
      }

      final payload = <String, dynamic>{
        'name': _nameController.text.trim(),
        'phone': _phoneController.text.trim(),
      };
      if (imageUrl != null && imageUrl.isNotEmpty) {
        payload['profilePicture'] = imageUrl;
      }

      final response = await _api.updateProfile(payload);
      if (response.statusCode != 200 || response.data is! Map) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not save profile')),
          );
        }
        return;
      }

      final root = response.data as Map;
      final data = root['data'];
      if (data is Map) {
        final m = Map<String, dynamic>.from(data);
        final newToken = m['token']?.toString();
        if (newToken != null && newToken.isNotEmpty) {
          await _storage.saveToken(newToken);
        }
        final raw = await _storage.getUser();
        if (raw != null && raw.isNotEmpty) {
          try {
            final u = jsonDecode(raw);
            if (u is Map) {
              final um = Map<String, dynamic>.from(u);
              um['name'] = m['name'] ?? um['name'];
              um['phone'] = m['phone'] ?? um['phone'];
              if (m['profilePicture'] != null) {
                um['profilePicture'] = m['profilePicture'];
              }
              await _storage.saveUser(jsonEncode(um));
            }
          } catch (_) {}
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Profile updated', style: GoogleFonts.outfit()),
            backgroundColor: const Color(AppConstants.primaryColor),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const brown = Color(AppConstants.primaryColor);
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          'Edit profile',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white),
        ),
        backgroundColor: brown,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: brown))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          CircleAvatar(
                            radius: 52,
                            backgroundColor: Colors.grey.shade200,
                            backgroundImage: _selectedImage != null
                                ? FileImage(_selectedImage!)
                                : (_profilePictureUrl != null &&
                                          _profilePictureUrl!.startsWith('http'))
                                      ? NetworkImage(_profilePictureUrl!)
                                      : null,
                            child: _selectedImage == null &&
                                    (_profilePictureUrl == null ||
                                        !_profilePictureUrl!.startsWith('http'))
                                ? Icon(Icons.person_rounded, size: 48, color: Colors.grey.shade500)
                                : null,
                          ),
                          Material(
                            color: brown,
                            shape: const CircleBorder(),
                            child: IconButton(
                              icon: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 20),
                              onPressed: _pickImage,
                              tooltip: 'Change photo',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _nameController,
                      decoration: InputDecoration(
                        labelText: 'Name',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      style: GoogleFonts.outfit(),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'Enter your name';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _phoneController,
                      decoration: InputDecoration(
                        labelText: 'Phone',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      style: GoogleFonts.outfit(),
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 28),
                    FilledButton(
                      onPressed: _saving ? null : _save,
                      style: FilledButton.styleFrom(
                        backgroundColor: brown,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _saving
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text('Save', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
