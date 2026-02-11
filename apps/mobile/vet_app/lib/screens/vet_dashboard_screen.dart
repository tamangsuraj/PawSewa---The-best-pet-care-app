import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/storage_service.dart';
import '../core/constants.dart';
import '../core/api_client.dart';
import 'login_screen.dart';
import 'profile_editor_screen.dart';
import 'all_pets_screen.dart';
import 'service_task_detail_screen.dart';
import 'shop_inventory_screen.dart';
import 'package:url_launcher/url_launcher.dart';

class VetDashboardScreen extends StatefulWidget {
  const VetDashboardScreen({super.key});

  @override
  State<VetDashboardScreen> createState() => _VetDashboardScreenState();
}

class _VetDashboardScreenState extends State<VetDashboardScreen> {
  final _storage = StorageService();
  final _apiClient = ApiClient();
  String _userName = 'Staff Member';
  String _userRole = 'veterinarian';
  int _newAssignmentsCount = 0;
  int _ongoingCasesCount = 0;
  int _currentAssignmentsCount = 0;
  int _completedCasesCount = 0;
  int _totalCasesCount = 0;
  bool _isLoadingAssignments = false;
  bool _isLoadingStats = false;
  String _selectedFilter = 'today'; // today, week, 48hours, month

  bool _shareLocation = false;
  Timer? _locationTimer;

  List<dynamic> _serviceTasks = [];
  bool _loadingServiceTasks = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
    _loadNewAssignments();
    _loadStats();
    _loadServiceTasks();
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    super.dispose();
  }

  Future<void> _toggleLocationSharing(bool value) async {
    setState(() {
      _shareLocation = value;
    });

    _locationTimer?.cancel();

    if (!value) {
      return;
    }

    // Check location permission & services once when enabling
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Location services are disabled. Please enable GPS.',
              ),
            ),
          );
        }
        setState(() {
          _shareLocation = false;
        });
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Location permission denied. Cannot share live location.',
              ),
            ),
          );
        }
        setState(() {
          _shareLocation = false;
        });
        return;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error checking location permission: $e');
      }
      setState(() {
        _shareLocation = false;
      });
      return;
    }

    // Periodically push current GPS position
    _locationTimer = Timer.periodic(const Duration(seconds: 20), (_) async {
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
          ),
        );
        await _apiClient.updateMyLiveLocation(
          lat: position.latitude,
          lng: position.longitude,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint('Failed to send live location: $e');
        }
      }
    });
  }

  Future<void> _loadUserData() async {
    final userDataString = await _storage.getUser();
    if (userDataString != null) {
      try {
        final userData = jsonDecode(userDataString);
        setState(() {
          _userName = userData['name'] ?? 'Staff Member';
          _userRole = userData['role'] ?? 'veterinarian';
        });
      } catch (e) {
        if (kDebugMode) {
          debugPrint('Error parsing user data: $e');
        }
      }
    }
  }

  Future<void> _loadNewAssignments() async {
    if (_userRole != 'veterinarian') return;

    setState(() {
      _isLoadingAssignments = true;
    });

    try {
      final response = await _apiClient.getMyAssignments();
      if (response.statusCode == 200) {
        final cases = response.data['data'] ?? [];
        // Count only NEW assignments (assigned status, not yet started)
        final newCases = cases.where((c) => c['status'] == 'assigned').length;
        // Count ongoing cases (in_progress status)
        final ongoingCases = cases
            .where((c) => c['status'] == 'in_progress')
            .length;
        setState(() {
          _newAssignmentsCount = newCases;
          _ongoingCasesCount = ongoingCases;
          _isLoadingAssignments = false;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error loading assignments: $e');
      }
      setState(() {
        _isLoadingAssignments = false;
      });
    }
  }

  Future<void> _loadStats() async {
    if (_userRole != 'veterinarian') return;

    setState(() {
      _isLoadingStats = true;
    });

    try {
      final response = await _apiClient.getMyAssignments();
      if (response.statusCode == 200) {
        final allCases = response.data['data'] ?? [];

        final now = DateTime.now();

        // Filter current cases (assigned + in_progress) by assignedAt
        final currentCases = allCases.where((caseData) {
          final status = caseData['status'];
          if (status != 'assigned' && status != 'in_progress') return false;

          final assignedAt = caseData['assignedAt'] != null
              ? DateTime.parse(caseData['assignedAt'])
              : null;

          if (assignedAt == null) return false;

          switch (_selectedFilter) {
            case 'today':
              return assignedAt.year == now.year &&
                  assignedAt.month == now.month &&
                  assignedAt.day == now.day;
            case '48hours':
              return now.difference(assignedAt).inHours <= 48;
            case 'week':
              return now.difference(assignedAt).inDays <= 7;
            case 'month':
              return now.difference(assignedAt).inDays <= 30;
            default:
              return true;
          }
        }).length;

        // Filter completed cases by completedAt
        final completedCases = allCases.where((caseData) {
          final status = caseData['status'];
          if (status != 'completed') return false;

          final completedAt = caseData['completedAt'] != null
              ? DateTime.parse(caseData['completedAt'])
              : null;

          if (completedAt == null) return false;

          switch (_selectedFilter) {
            case 'today':
              return completedAt.year == now.year &&
                  completedAt.month == now.month &&
                  completedAt.day == now.day;
            case '48hours':
              return now.difference(completedAt).inHours <= 48;
            case 'week':
              return now.difference(completedAt).inDays <= 7;
            case 'month':
              return now.difference(completedAt).inDays <= 30;
            default:
              return true;
          }
        }).length;

        setState(() {
          _currentAssignmentsCount = currentCases;
          _completedCasesCount = completedCases;
          _totalCasesCount = currentCases + completedCases;
          _isLoadingStats = false;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error loading stats: $e');
      }
      setState(() {
        _isLoadingStats = false;
      });
    }
  }

  void _changeFilter(String filter) {
    setState(() {
      _selectedFilter = filter;
    });
    _loadStats();
  }

  Future<void> _loadServiceTasks() async {
    if (_userRole != 'veterinarian') return;
    setState(() => _loadingServiceTasks = true);
    try {
      final response = await _apiClient.getMyServiceTasks();
      if (response.statusCode == 200 && mounted) {
        setState(() {
          _serviceTasks = response.data['data'] ?? [];
          _loadingServiceTasks = false;
        });
      } else if (mounted) {
        setState(() => _loadingServiceTasks = false);
      }
    } catch (e) {
      if (kDebugMode) debugPrint('Error loading service tasks: $e');
      if (mounted) setState(() => _loadingServiceTasks = false);
    }
  }

  List<dynamic> get _todaysServiceTasks {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final todayEnd = todayStart.add(const Duration(days: 1));
    return _serviceTasks.where((t) {
      final d = t['scheduledTime'] ?? t['preferredDate'];
      if (d == null) return false;
      final dt = DateTime.tryParse(d.toString());
      return dt != null && !dt.isBefore(todayStart) && dt.isBefore(todayEnd);
    }).toList()..sort((a, b) {
      final da = DateTime.tryParse(
        (a['scheduledTime'] ?? a['preferredDate']).toString(),
      );
      final db = DateTime.tryParse(
        (b['scheduledTime'] ?? b['preferredDate']).toString(),
      );
      if (da == null || db == null) return 0;
      return da.compareTo(db);
    });
  }

  List<dynamic> get _upcoming48hServiceTasks {
    final now = DateTime.now();
    final end = now.add(const Duration(hours: 48));
    return _serviceTasks.where((t) {
      final status = t['status'];
      if (status == 'completed' || status == 'cancelled') return false;
      final d = t['scheduledTime'] ?? t['preferredDate'];
      if (d == null) return false;
      final dt = DateTime.tryParse(d.toString());
      return dt != null && dt.isAfter(now) && dt.isBefore(end);
    }).toList()..sort((a, b) {
      final da = DateTime.tryParse(
        (a['scheduledTime'] ?? a['preferredDate']).toString(),
      );
      final db = DateTime.tryParse(
        (b['scheduledTime'] ?? b['preferredDate']).toString(),
      );
      if (da == null || db == null) return 0;
      return da.compareTo(db);
    });
  }

  Future<void> _callOwner(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Widget _buildDutyTaskCard(
    BuildContext context,
    dynamic task, {
    bool compact = false,
  }) {
    final pet = task['pet'] as Map<String, dynamic>?;
    final user = task['user'] as Map<String, dynamic>?;
    final serviceType = task['serviceType'] ?? 'Service';
    final scheduledTime = task['scheduledTime'] ?? task['preferredDate'];
    String timeLabel = '';
    if (scheduledTime != null) {
      final dt = DateTime.tryParse(scheduledTime.toString());
      if (dt != null) {
        timeLabel =
            '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
        if (!compact) timeLabel = '${dt.day}/${dt.month} $timeLabel';
      }
    }
    final primary = const Color(AppConstants.primaryColor);
    final card = Container(
      padding: EdgeInsets.all(compact ? 10 : 14),
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
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              if (timeLabel.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    timeLabel,
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: primary,
                    ),
                  ),
                ),
              if (timeLabel.isNotEmpty) const SizedBox(width: 8),
              Expanded(
                child: Text(
                  pet?['name'] ?? 'Pet',
                  style: GoogleFonts.poppins(
                    fontSize: compact ? 14 : 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[900],
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            serviceType,
            style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[700]),
          ),
          if (!compact) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ServiceTaskDetailScreen(
                            task: Map<String, dynamic>.from(task),
                          ),
                        ),
                      ).then((_) => _loadServiceTasks());
                    },
                    icon: const Icon(Icons.map_rounded, size: 18),
                    label: Text(
                      'Open in Map',
                      style: GoogleFonts.poppins(fontSize: 12),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: primary,
                      side: BorderSide(color: primary),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: () => _callOwner(user?['phone'] as String?),
                  icon: const Icon(Icons.phone_rounded),
                  color: primary,
                  style: IconButton.styleFrom(
                    backgroundColor: primary.withValues(alpha: 0.12),
                  ),
                  tooltip: 'Call Owner',
                ),
              ],
            ),
          ] else
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ServiceTaskDetailScreen(
                        task: Map<String, dynamic>.from(task),
                      ),
                    ),
                  ).then((_) => _loadServiceTasks());
                },
                borderRadius: BorderRadius.circular(8),
                child: Row(
                  children: [
                    Icon(Icons.map_rounded, size: 16, color: primary),
                    const SizedBox(width: 4),
                    Text(
                      'Open map',
                      style: GoogleFonts.poppins(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
    if (compact) return card;
    return Padding(padding: const EdgeInsets.only(bottom: 12), child: card);
  }

  String _getFilterLabel() {
    switch (_selectedFilter) {
      case 'today':
        return 'Today';
      case '48hours':
        return 'Past 48 Hours';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      default:
        return 'Today';
    }
  }

  String _getRoleTitle() {
    switch (_userRole) {
      case 'veterinarian':
        return 'PawSewa Partner';
      case 'shop_owner':
        return 'Shop Partner Portal';
      case 'care_service':
        return 'Care Partner Portal';
      case 'rider':
        return 'Delivery Partner Portal';
      default:
        return 'PawSewa Partner';
    }
  }

  IconData _getRoleIcon() {
    switch (_userRole) {
      case 'veterinarian':
        return Icons.medical_services;
      case 'shop_owner':
        return Icons.store;
      case 'care_service':
        return Icons.home_work;
      case 'rider':
        return Icons.delivery_dining;
      default:
        return Icons.work;
    }
  }

  List<Map<String, dynamic>> _getRoleStats() {
    switch (_userRole) {
      case 'veterinarian':
        return [
          {
            'icon': Icons.assignment,
            'title': 'Current Cases',
            'value': _currentAssignmentsCount.toString(),
            'color': Colors.blue,
          },
          {
            'icon': Icons.check_circle,
            'title': 'Completed',
            'value': _completedCasesCount.toString(),
            'color': Colors.green,
          },
          {
            'icon': Icons.folder,
            'title': 'Total Cases',
            'value': _totalCasesCount.toString(),
            'color': Colors.orange,
          },
          {
            'icon': Icons.notifications_active,
            'title': 'New Alerts',
            'value': _newAssignmentsCount.toString(),
            'color': Colors.red,
          },
        ];
      case 'shop_owner':
        return [
          {
            'icon': Icons.shopping_cart,
            'title': 'Orders',
            'value': '0',
            'color': Colors.blue,
          },
          {
            'icon': Icons.inventory,
            'title': 'Products',
            'value': '0',
            'color': Colors.green,
          },
          {
            'icon': Icons.attach_money,
            'title': 'Revenue',
            'value': '\$0',
            'color': Colors.orange,
          },
          {
            'icon': Icons.trending_up,
            'title': 'Sales',
            'value': '0',
            'color': Colors.purple,
          },
        ];
      case 'care_service':
        return [
          {
            'icon': Icons.book_online,
            'title': 'Bookings',
            'value': '0',
            'color': Colors.blue,
          },
          {
            'icon': Icons.pets,
            'title': 'Pets',
            'value': '0',
            'color': Colors.green,
          },
          {
            'icon': Icons.cleaning_services,
            'title': 'Grooming',
            'value': '0',
            'color': Colors.orange,
          },
          {
            'icon': Icons.hotel,
            'title': 'Boarding',
            'value': '0',
            'color': Colors.purple,
          },
        ];
      case 'rider':
        return [
          {
            'icon': Icons.local_shipping,
            'title': 'Deliveries',
            'value': '0',
            'color': Colors.blue,
          },
          {
            'icon': Icons.pending,
            'title': 'Pending',
            'value': '0',
            'color': Colors.orange,
          },
          {
            'icon': Icons.check_circle,
            'title': 'Completed',
            'value': '0',
            'color': Colors.green,
          },
          {
            'icon': Icons.attach_money,
            'title': 'Earnings',
            'value': '\$0',
            'color': Colors.purple,
          },
        ];
      default:
        return [];
    }
  }

  List<Map<String, dynamic>> _getRoleActions() {
    switch (_userRole) {
      case 'veterinarian':
        return [
          {
            'icon': Icons.person_outline,
            'title': 'Edit Profile',
            'subtitle': 'Update your professional profile',
            'route': 'profile',
            'badge': 0,
          },
          {
            'icon': Icons.assignment,
            'title': 'My Assignments',
            'subtitle': 'View your assigned cases',
            'route': 'assignments',
            'badge': _newAssignmentsCount,
          },
          {
            'icon': Icons.location_searching,
            'title': _shareLocation
                ? 'Sharing Live Location'
                : 'Share Live Location',
            'subtitle': 'Help owners track your arrival (Kathmandu only)',
            'route': 'toggle_location',
            'badge': 0,
          },
        ];
      case 'shop_owner':
        return [
          {
            'icon': Icons.add_shopping_cart,
            'title': 'Shop Inventory',
            'subtitle': 'Add and manage products',
            'route': 'shop_inventory',
            'badge': 0,
          },
          {
            'icon': Icons.inventory_2,
            'title': 'Manage Inventory',
            'subtitle': 'Update product stock',
            'route': 'shop_inventory',
            'badge': 0,
          },
          {
            'icon': Icons.analytics,
            'title': 'View Analytics',
            'subtitle': 'Check sales reports',
            'route': null,
            'badge': 0,
          },
        ];
      case 'care_service':
        return [
          {
            'icon': Icons.add_circle,
            'title': 'New Booking',
            'subtitle': 'Add a new booking',
            'route': null,
            'badge': 0,
          },
          {
            'icon': Icons.calendar_month,
            'title': 'View Calendar',
            'subtitle': 'Check facility schedule',
            'route': null,
            'badge': 0,
          },
          {
            'icon': Icons.pets,
            'title': 'Pet Records',
            'subtitle': 'View pet information',
            'route': null,
            'badge': 0,
          },
        ];
      case 'rider':
        return [
          {
            'icon': Icons.map,
            'title': 'View Map',
            'subtitle': 'See delivery locations',
            'route': null,
            'badge': 0,
          },
          {
            'icon': Icons.list,
            'title': 'Active Deliveries',
            'subtitle': 'Check pending tasks',
            'route': null,
            'badge': 0,
          },
          {
            'icon': Icons.history,
            'title': 'Delivery History',
            'subtitle': 'View completed deliveries',
            'route': null,
            'badge': 0,
          },
        ];
      default:
        return [];
    }
  }

  Future<void> _handleLogout() async {
    await _storage.clearAll();
    if (mounted) {
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          AppConstants.appName,
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            onPressed: _handleLogout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(
            (MediaQuery.sizeOf(context).width * 0.055).clamp(12.0, 28.0),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(AppConstants.primaryColor),
                      const Color(AppConstants.accentColor),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(
                        AppConstants.primaryColor,
                      ).withValues(alpha: 77 / 255),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            _getRoleIcon(),
                            color: Colors.white,
                            size: 32,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _getRoleTitle(),
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  color: Colors.white.withValues(alpha: 0.9),
                                ),
                              ),
                              Text(
                                _userName,
                                style: GoogleFonts.poppins(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              if (_userRole == 'veterinarian' && _isLoadingAssignments)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: const LinearProgressIndicator(
                      minHeight: 6,
                      color: Color(AppConstants.primaryColor),
                      backgroundColor: Color(AppConstants.secondaryColor),
                    ),
                  ),
                ),

              // New Assignments Alert (for veterinarian partners)
              if (_userRole == 'veterinarian' && _newAssignmentsCount > 0)
                Container(
                  margin: const EdgeInsets.only(bottom: 24),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.red.shade600, Colors.red.shade700],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.red.withValues(alpha: 77 / 255),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: InkWell(
                    onTap: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AllPetsScreen(),
                        ),
                      );
                      if (!mounted) return;
                      if (result == true) {
                        _loadNewAssignments(); // Reload after viewing
                        _loadStats();
                      }
                    },
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.notification_important,
                            color: Colors.white,
                            size: 32,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'New Case Assignment!',
                                style: GoogleFonts.poppins(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                'You have $_newAssignmentsCount ${_newAssignmentsCount == 1 ? 'case' : 'cases'} waiting for you',
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  color: Colors.white.withValues(alpha: 0.9),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.arrow_forward_ios,
                          color: Colors.white,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),

              // Ongoing Cases Alert (for veterinarian partners)
              if (_userRole == 'veterinarian' && _ongoingCasesCount > 0)
                Container(
                  margin: const EdgeInsets.only(bottom: 24),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.orange.shade600, Colors.orange.shade700],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.orange.withValues(alpha: 77 / 255),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: InkWell(
                    onTap: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AllPetsScreen(),
                        ),
                      );
                      if (result == true || mounted) {
                        _loadNewAssignments();
                        _loadStats();
                      }
                    },
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.pending_actions,
                            color: Colors.white,
                            size: 32,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Ongoing Cases',
                                style: GoogleFonts.poppins(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                'You have $_ongoingCasesCount ${_ongoingCasesCount == 1 ? 'case' : 'cases'} in progress',
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  color: Colors.white.withValues(alpha: 0.9),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.arrow_forward_ios,
                          color: Colors.white,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),

              // Duty Dashboard: Today's Tasks & Upcoming 48h (service requests)
              if (_userRole == 'veterinarian') ...[
                const SizedBox(height: 8),
                Text(
                  'Duty Dashboard',
                  style: GoogleFonts.poppins(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: const Color(AppConstants.primaryColor),
                  ),
                ),
                const SizedBox(height: 12),
                if (_loadingServiceTasks)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(AppConstants.primaryColor),
                        ),
                      ),
                    ),
                  )
                else ...[
                  if (_todaysServiceTasks.isNotEmpty) ...[
                    Text(
                      'Today\'s Tasks',
                      style: GoogleFonts.poppins(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[800],
                      ),
                    ),
                    const SizedBox(height: 8),
                    ..._todaysServiceTasks.map(
                      (task) => _buildDutyTaskCard(context, task),
                    ),
                    const SizedBox(height: 20),
                  ],
                  if (_upcoming48hServiceTasks.isNotEmpty) ...[
                    Text(
                      'Upcoming (48h)',
                      style: GoogleFonts.poppins(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[800],
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 120,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _upcoming48hServiceTasks.length,
                        itemBuilder: (context, index) {
                          return Padding(
                            padding: const EdgeInsets.only(right: 12),
                            child: SizedBox(
                              width: 220,
                              child: _buildDutyTaskCard(
                                context,
                                _upcoming48hServiceTasks[index],
                                compact: true,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                  if (_todaysServiceTasks.isEmpty &&
                      _upcoming48hServiceTasks.isEmpty &&
                      _serviceTasks.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Text(
                        'No tasks today or in the next 48 hours.',
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                ],
                const SizedBox(height: 16),
              ],

              // Quick Stats
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${_getFilterLabel()}\'s Overview',
                    style: GoogleFonts.poppins(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: const Color(AppConstants.accentColor),
                    ),
                  ),
                  if (_userRole == 'veterinarian')
                    PopupMenuButton<String>(
                      onSelected: _changeFilter,
                      icon: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(AppConstants.primaryColor),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.filter_list,
                              color: Colors.white,
                              size: 16,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Filter',
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      itemBuilder: (context) => [
                        PopupMenuItem(
                          value: 'today',
                          child: Row(
                            children: [
                              Icon(
                                Icons.today,
                                size: 18,
                                color: _selectedFilter == 'today'
                                    ? const Color(AppConstants.primaryColor)
                                    : Colors.grey,
                              ),
                              const SizedBox(width: 12),
                              Text(
                                'Today',
                                style: GoogleFonts.poppins(
                                  fontWeight: _selectedFilter == 'today'
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: _selectedFilter == 'today'
                                      ? const Color(AppConstants.primaryColor)
                                      : Colors.black,
                                ),
                              ),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: '48hours',
                          child: Row(
                            children: [
                              Icon(
                                Icons.access_time,
                                size: 18,
                                color: _selectedFilter == '48hours'
                                    ? const Color(AppConstants.primaryColor)
                                    : Colors.grey,
                              ),
                              const SizedBox(width: 12),
                              Text(
                                'Past 48 Hours',
                                style: GoogleFonts.poppins(
                                  fontWeight: _selectedFilter == '48hours'
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: _selectedFilter == '48hours'
                                      ? const Color(AppConstants.primaryColor)
                                      : Colors.black,
                                ),
                              ),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: 'week',
                          child: Row(
                            children: [
                              Icon(
                                Icons.date_range,
                                size: 18,
                                color: _selectedFilter == 'week'
                                    ? const Color(AppConstants.primaryColor)
                                    : Colors.grey,
                              ),
                              const SizedBox(width: 12),
                              Text(
                                'This Week',
                                style: GoogleFonts.poppins(
                                  fontWeight: _selectedFilter == 'week'
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: _selectedFilter == 'week'
                                      ? const Color(AppConstants.primaryColor)
                                      : Colors.black,
                                ),
                              ),
                            ],
                          ),
                        ),
                        PopupMenuItem(
                          value: 'month',
                          child: Row(
                            children: [
                              Icon(
                                Icons.calendar_month,
                                size: 18,
                                color: _selectedFilter == 'month'
                                    ? const Color(AppConstants.primaryColor)
                                    : Colors.grey,
                              ),
                              const SizedBox(width: 12),
                              Text(
                                'This Month',
                                style: GoogleFonts.poppins(
                                  fontWeight: _selectedFilter == 'month'
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: _selectedFilter == 'month'
                                      ? const Color(AppConstants.primaryColor)
                                      : Colors.black,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 16),

              if (_userRole == 'veterinarian' && _isLoadingStats)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: const LinearProgressIndicator(
                      minHeight: 6,
                      color: Color(AppConstants.primaryColor),
                      backgroundColor: Color(AppConstants.secondaryColor),
                    ),
                  ),
                ),

              // Stats Grid
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 16,
                crossAxisSpacing: 16,
                childAspectRatio: 1.3,
                children: _getRoleStats().map((stat) {
                  return _buildStatCard(
                    icon: stat['icon'] as IconData,
                    title: stat['title'] as String,
                    value: stat['value'] as String,
                    color: stat['color'] as Color,
                  );
                }).toList(),
              ),
              const SizedBox(height: 32),

              // Quick Actions
              Text(
                'Quick Actions',
                style: GoogleFonts.poppins(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: const Color(AppConstants.accentColor),
                ),
              ),
              const SizedBox(height: 16),

              ..._getRoleActions().map((action) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _buildActionButton(
                    icon: action['icon'] as IconData,
                    title: action['title'] as String,
                    subtitle: action['subtitle'] as String,
                    badge: action['badge'] as int? ?? 0,
                    onTap: () async {
                      final route = action['route'] as String?;
                      if (route == 'profile') {
                        final result = await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ProfileEditorScreen(),
                          ),
                        );
                        if (result == true) {
                          _loadUserData(); // Reload user data after profile update
                        }
                      } else if (route == 'assignments') {
                        final result = await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const AllPetsScreen(),
                          ),
                        );
                        if (result == true || mounted) {
                          _loadNewAssignments(); // Reload after viewing
                        }
                      } else if (route == 'toggle_location') {
                        await _toggleLocationSharing(!_shareLocation);
                      } else if (route == 'shop_inventory') {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ShopInventoryScreen(),
                          ),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Feature coming soon!')),
                        );
                      }
                    },
                  ),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required String title,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: const Color(AppConstants.accentColor),
            ),
          ),
          Text(
            title,
            style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    int badge = 0,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(
                      AppConstants.primaryColor,
                    ).withValues(alpha: 26 / 255),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    icon,
                    color: const Color(AppConstants.primaryColor),
                    size: 24,
                  ),
                ),
                if (badge > 0)
                  Positioned(
                    right: -6,
                    top: -6,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 20,
                        minHeight: 20,
                      ),
                      child: Text(
                        badge > 99 ? '99+' : badge.toString(),
                        style: GoogleFonts.poppins(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: const Color(AppConstants.accentColor),
                          ),
                        ),
                      ),
                      if (badge > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            badge.toString(),
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                    ],
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, color: Colors.grey[400], size: 16),
          ],
        ),
      ),
    );
  }
}
