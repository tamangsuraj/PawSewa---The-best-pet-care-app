import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/constants.dart';

class BookServiceScreen extends StatefulWidget {
  const BookServiceScreen({super.key});

  @override
  State<BookServiceScreen> createState() => _BookServiceScreenState();
}

class _BookServiceScreenState extends State<BookServiceScreen> {
  final _apiClient = ApiClient();
  final _notesController = TextEditingController();
  final _pageController = PageController();

  int _currentStep = 0;
  List<dynamic> _pets = [];
  bool _isLoading = true;
  String? _selectedPetId;
  String? _selectedServiceType;
  DateTime? _selectedDate;
  String? _selectedTimeWindow;

  final List<Map<String, dynamic>> _serviceTypes = [
    {
      'type': 'Appointment',
      'icon': Icons.calendar_today,
      'description': 'Schedule a consultation with our veterinarians',
      'color': Colors.blue,
    },
    {
      'type': 'Health Checkup',
      'icon': Icons.health_and_safety,
      'description': 'Comprehensive health examination for your pet',
      'color': Colors.green,
    },
    {
      'type': 'Vaccination',
      'icon': Icons.vaccines,
      'description': 'Keep your pet protected with timely vaccinations',
      'color': Colors.orange,
    },
  ];

  final List<String> _timeWindows = [
    'Morning (9am-12pm)',
    'Afternoon (12pm-4pm)',
    'Evening (4pm-8pm)',
  ];

  @override
  void initState() {
    super.initState();
    _loadPets();
  }

  @override
  void dispose() {
    _notesController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadPets() async {
    try {
      final response = await _apiClient.getMyPets();
      if (response.statusCode == 200) {
        setState(() {
          _pets = response.data['data'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      _showError('Failed to load pets: $e');
    }
  }

  Future<void> _submitRequest() async {
    if (_selectedPetId == null ||
        _selectedServiceType == null ||
        _selectedDate == null ||
        _selectedTimeWindow == null) {
      _showError('Please complete all s