import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'add_pet_screen.dart';

class RequestAssistanceScreen extends StatefulWidget {
  const RequestAssistanceScreen({super.key});

  @override
  State<RequestAssistanceScreen> createState() =>
      _RequestAssistanceScreenState();
}

class _RequestAssistanceScreenState extends State<RequestAssistanceScreen> {
  final _formKey = GlobalKey<FormState>();
  final _apiClient = ApiClient();
  final _issueController = TextEditingController();
  final _locationController = TextEditingController();

  List<dynamic> _pets = [];
  String? _selectedPetId;
  bool _isLoading = false;
  bool _loadingPets = true;
  String? _loadError;

  static const int _issueMaxLength = 1000;

  void _onIssueChanged() => setState(() {});

  @override
  void initState() {
    super.initState();
    _loadPets();
    _issueController.addListener(_onIssueChanged);
  }

  @override
  void dispose() {
    _issueController.removeListener(_onIssueChanged);
    _issueController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  Future<void> _loadPets() async {
    if (mounted) {
      setState(() {
        _loadingPets = true;
        _loadError = null;
      });
    }
    try {
      final response = await _apiClient.getPets();
      final data = response.data is Map ? response.data as Map : const {};
      if (mounted) {
        setState(() {
          _loadingPets = false;
          _loadError = null;
          final raw = response.statusCode == 200 ? data['data'] : null;
          _pets = raw is List ? List<dynamic>.from(raw) : [];
          if (response.statusCode != 200) {
            _loadError =
                data['message']?.toString() ??
                'Could not load pets (${response.statusCode})';
          }
        });
      }
    } catch (e) {
      final msg = e is DioException && e.response?.data is Map
          ? (e.response!.data['message'] as String?)
          : null;
      if (mounted) {
        setState(() {
          _loadingPets = false;
          _pets = [];
          _loadError =
              msg ??
              'Could not load pets. Check your connection and try again.';
        });
      }
    }
  }

  Future<void> _submitRequest() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedPetId == null) {
      _showError('Please select a pet');
      return;
    }
    final location = _locationController.text.trim();
    if (location.isEmpty) {
      _showError('Please enter your location');
      return;
    }
    final issue = _issueController.text.trim();
    if (issue.length < 10) {
      _showError('Please provide more details (at least 10 characters)');
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await _apiClient.createCase({
        'petId': _selectedPetId,
        'issueDescription': issue,
        'location': location,
      });

      if (response.statusCode == 201 && mounted) {
        await showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.green.shade100,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.check_circle,
                    color: Colors.green.shade700,
                    size: 32,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Request Submitted!',
                    style: TextStyle(fontSize: 20),
                  ),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Case submitted! Our team is assigning the best available Veterinarian to you. You\'ll be notified once a vet is assigned and they will contact you shortly.',
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    color: Colors.grey[700],
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(AppConstants.primaryColor).withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: const Color(AppConstants.primaryColor),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.info_outline,
                        color: Color(AppConstants.primaryColor),
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'You will be notified once a veterinarian is assigned. This case will appear in My Requests and in the admin Live Cases.',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: Colors.grey[800],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).pop();
                },
                child: Text(
                  'OK',
                  style: GoogleFonts.poppins(
                    color: const Color(AppConstants.primaryColor),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      String message = 'Failed to submit request. Please try again.';
      if (e is DioException && e.response?.data is Map) {
        final msg = e.response!.data['message'];
        if (msg != null && msg.toString().isNotEmpty) {
          message = msg.toString();
        }
      }
      _showError(message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
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
    final beige = const Color(AppConstants.bentoBackgroundColor);
    final brown = const Color(AppConstants.accentColor);

    return Scaffold(
      backgroundColor: beige,
      appBar: AppBar(
        title: Text(
          'Request Assistance',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _loadingPets
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(AppConstants.primaryColor),
              ),
            )
          : _loadError != null
              ? _buildErrorState()
              : _pets.isEmpty
                  ? _buildNoPetsState()
                  : _buildForm(brown),
    );
  }

  Widget _buildErrorState() {
    // Scrollable + centered error UI to avoid overflow on small screens / long messages.
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_off, size: 64, color: Colors.grey[600]),
            const SizedBox(height: 16),
            Text(
              'Couldn\'t load pets',
              style: GoogleFonts.poppins(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _loadError!,
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadPets,
              icon: const Icon(Icons.refresh),
              label: Text(
                'Retry',
                style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(AppConstants.primaryColor),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoPetsState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.pets, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              'No pets registered',
              style: GoogleFonts.poppins(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Add a pet first to request assistance.',
              textAlign: TextAlign.center,
              style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AddPetScreen()),
                );
                if (mounted) _loadPets();
              },
              icon: const Icon(Icons.add),
              label: Text(
                'Add your first pet',
                style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(AppConstants.primaryColor),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm(Color brown) {
    return Form(
      key: _formKey,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // How It Works card (light brown, stethoscope, heading + text)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: brown.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: brown.withValues(alpha: 0.4),
                  width: 1,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: brown.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.medical_services,
                      color: Color(AppConstants.primaryColor),
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'How It Works',
                          style: GoogleFonts.poppins(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: const Color(AppConstants.primaryColor),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Our team will assign the best available veterinarian to your case. You\'ll be notified once a vet is assigned and they will contact you shortly.',
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: Colors.grey[800],
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Form card (white, rounded)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Select Pet *
                  Text(
                    'Select Pet *',
                    style: GoogleFonts.poppins(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[800],
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedPetId,
                    decoration: InputDecoration(
                      hintText: 'Choose your pet...',
                      hintStyle: GoogleFonts.poppins(color: Colors.grey[500]),
                      prefixIcon: const Icon(
                        Icons.pets,
                        color: Color(AppConstants.primaryColor),
                        size: 22,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                    items: _pets.map((pet) {
                      final id = pet['_id']?.toString();
                      final name = pet['name']?.toString() ?? 'Unknown';
                      final breed = pet['breed']?.toString() ?? '—';
                      final age = pet['age']?.toString();
                      return DropdownMenuItem<String>(
                        value: id,
                        child: Text(
                          '$name • $breed${age != null ? ' • $age yrs' : ''}',
                          style: GoogleFonts.poppins(fontSize: 14),
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    }).toList(),
                    onChanged: (value) {
                      setState(() => _selectedPetId = value);
                    },
                    validator: (value) =>
                        value == null || value.isEmpty
                            ? 'Please select a pet'
                            : null,
                  ),
                  const SizedBox(height: 20),

                  // Describe the Issue *
                  Text(
                    'Describe the Issue *',
                    style: GoogleFonts.poppins(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[800],
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _issueController,
                    maxLines: 5,
                    maxLength: _issueMaxLength,
                    style: GoogleFonts.poppins(fontSize: 14),
                    decoration: InputDecoration(
                      hintText:
                          'Please describe what\'s wrong with your pet in detail...',
                      hintStyle: GoogleFonts.poppins(
                        fontSize: 14,
                        color: Colors.grey[500],
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      contentPadding: const EdgeInsets.all(14),
                      counterText: '',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please describe the issue';
                      }
                      if (value.trim().length < 10) {
                        return 'Please provide more details (at least 10 characters)';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${_issueController.text.length}/$_issueMaxLength characters',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey[500],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Your Location *
                  Text(
                    'Your Location *',
                    style: GoogleFonts.poppins(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[800],
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _locationController,
                    style: GoogleFonts.poppins(fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Enter your address',
                      hintStyle: GoogleFonts.poppins(color: Colors.grey[500]),
                      prefixIcon: const Icon(
                        Icons.location_on,
                        color: Color(AppConstants.primaryColor),
                        size: 22,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your location';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  // Cancel + Request Assistance buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _isLoading
                              ? null
                              : () => Navigator.of(context).pop(),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.grey[700],
                            side: BorderSide(color: Colors.grey.shade400),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: Text(
                            'Cancel',
                            style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          onPressed: _isLoading ? null : _submitRequest,
                          icon: _isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(
                                  Icons.medical_services,
                                  size: 20,
                                  color: Colors.white,
                                ),
                          label: Text(
                            _isLoading
                                ? 'Submitting...'
                                : 'Request Assistance',
                            style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: Colors.white,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red.shade600,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
