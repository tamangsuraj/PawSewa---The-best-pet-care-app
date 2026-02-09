import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../core/api_client.dart';
import '../core/storage_service.dart';
import '../core/constants.dart';
import 'package:http/http.dart' as http;

class ProfileEditorScreen extends StatefulWidget {
  const ProfileEditorScreen({super.key});

  @override
  State<ProfileEditorScreen> createState() => _ProfileEditorScreenState();
}

class _ProfileEditorScreenState extends State<ProfileEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _apiClient = ApiClient();
  final _storage = StorageService();
  final _imagePicker = ImagePicker();

  // Controllers
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _bioController = TextEditingController();

  // State
  bool _isLoading = false;
  String? _profilePictureUrl;
  File? _selectedImage;
  String? _selectedSpecialty;

  final List<String> _specialties = [
    'General Practitioner',
    'Surgeon',
    'Dentist',
    'Dermatologist',
    'Cardiologist',
    'Ophthalmologist',
    'Orthopedic',
    'Emergency Care',
  ];

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _loadUserData() async {
    try {
      final response = await _apiClient.getUserProfile();
      if (response.statusCode == 200) {
        final data = response.data['data'];
        setState(() {
          _nameController.text = data['name'] ?? '';
          _phoneController.text = data['phone'] ?? '';
          _bioController.text = data['bio'] ?? '';
          _selectedSpecialty = data['specialty'] ?? data['specialization'];
          _profilePictureUrl = data['profilePicture'];
        });
      }
    } catch (e) {
      print('Error loading profile: $e');
    }
  }

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );

      if (image != null) {
        setState(() {
          _selectedImage = File(image.path);
        });
      }
    } catch (e) {
      _showError('Failed to pick image: $e');
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
        final responseData = await response.stream.bytesToString();
        final jsonData = jsonDecode(responseData);
        return jsonData['secure_url'];
      }
    } catch (e) {
      print('Cloudinary upload error: $e');
    }
    return null;
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // Upload image if selected
      String? imageUrl = _profilePictureUrl;
      if (_selectedImage != null) {
        imageUrl = await _uploadToCloudinary(_selectedImage!);
        if (imageUrl == null) {
          _showError('Failed to upload profile picture');
          setState(() {
            _isLoading = false;
          });
          return;
        }
      }

      // Prepare data (REMOVED: clinicName, clinicAddress, workingHours - Admin only)
      final data = {
        'name': _nameController.text.trim(),
        'phone': _phoneController.text.trim(),
        'bio': _bioController.text.trim(),
        'specialty': _selectedSpecialty,
        'profilePicture': imageUrl,
      };

      final response = await _apiClient.updateStaffProfile(data);

      if (response.statusCode == 200) {
        final isComplete = response.data['data']['isProfileComplete'] ?? false;

        // Update stored user data
        final userDataString = await _storage.getUser();
        if (userDataString != null) {
          final userData = jsonDecode(userDataString);
          userData['name'] = _nameController.text.trim();
          userData['phone'] = _phoneController.text.trim();
          userData['isProfileComplete'] = isComplete;
          await _storage.saveUser(jsonEncode(userData));
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                isComplete ? '✅ Profile Verified & Public!' : 'Profile updated successfully',
                style: GoogleFonts.poppins(),
              ),
              backgroundColor: isComplete ? Colors.green : const Color(AppConstants.primaryColor),
              duration: const Duration(seconds: 3),
            ),
          );
          Navigator.pop(context, true);
        }
      }
    } catch (e) {
      _showError('Failed to save profile: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showError(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message, style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          'Edit Partner Profile',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Profile Picture
              Center(
                child: GestureDetector(
                  onTap: _pickImage,
                  child: Stack(
                    children: [
                      CircleAvatar(
                        radius: 60,
                        backgroundColor: const Color(AppConstants.primaryColor).withOpacity(0.1),
                        backgroundImage: _selectedImage != null
                            ? FileImage(_selectedImage!)
                            : (_profilePictureUrl != null ? NetworkImage(_profilePictureUrl!) : null) as ImageProvider?,
                        child: _selectedImage == null && _profilePictureUrl == null
                            ? const Icon(Icons.person, size: 60, color: Color(AppConstants.primaryColor))
                            : null,
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: const BoxDecoration(
                            color: Color(AppConstants.primaryColor),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.camera_alt, color: Colors.white, size: 20),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),

              // Name
              _buildTextField(
                controller: _nameController,
                label: 'Full Name',
                icon: Icons.person,
                validator: (value) => value?.isEmpty ?? true ? 'Name is required' : null,
              ),
              const SizedBox(height: 16),

              // Phone
              _buildTextField(
                controller: _phoneController,
                label: 'Phone Number',
                icon: Icons.phone,
                keyboardType: TextInputType.phone,
                validator: (value) => value?.isEmpty ?? true ? 'Phone is required' : null,
              ),
              const SizedBox(height: 16),

              // Specialty Dropdown
              _buildDropdown(),
              const SizedBox(height: 16),

              // Bio
              _buildTextField(
                controller: _bioController,
                label: 'Partner Bio',
                icon: Icons.description,
                maxLines: 5,
                maxLength: 500,
                validator: (value) => value?.isEmpty ?? true ? 'Bio is required' : null,
              ),
              const SizedBox(height: 32),

              // Info Note
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(AppConstants.primaryColor).withOpacity(0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(AppConstants.primaryColor).withOpacity(0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: const Color(AppConstants.primaryColor),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Working hours and location details are managed by the Admin team.',
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: const Color(AppConstants.accentColor),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // Save Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _saveProfile,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(AppConstants.primaryColor),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          'Save Profile',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int maxLines = 1,
    int? maxLength,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      maxLength: maxLength,
      keyboardType: keyboardType,
      validator: validator,
      style: GoogleFonts.poppins(),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.poppins(),
        prefixIcon: Icon(icon, color: const Color(AppConstants.primaryColor)),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(AppConstants.primaryColor), width: 2),
        ),
      ),
    );
  }

  Widget _buildDropdown() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: DropdownButtonFormField<String>(
        value: _selectedSpecialty,
        decoration: InputDecoration(
          labelText: 'Specialty',
          labelStyle: GoogleFonts.poppins(),
          prefixIcon: const Icon(Icons.medical_services, color: Color(AppConstants.primaryColor)),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
        ),
        items: _specialties.map((specialty) {
          return DropdownMenuItem(
            value: specialty,
            child: Text(specialty, style: GoogleFonts.poppins()),
          );
        }).toList(),
        onChanged: (value) {
          setState(() {
            _selectedSpecialty = value;
          });
        },
        validator: (value) => value == null ? 'Specialty is required' : null,
      ),
    );
  }
}
