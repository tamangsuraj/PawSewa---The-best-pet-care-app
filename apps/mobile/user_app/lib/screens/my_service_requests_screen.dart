import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/layout_utils.dart';
import '../services/socket_service.dart';
import 'services/services_screen.dart';
import 'service_request_tracking_screen.dart';

class MyServiceRequestsScreen extends StatefulWidget {
  const MyServiceRequestsScreen({super.key});

  @override
  State<MyServiceRequestsScreen> createState() =>
      _MyServiceRequestsScreenState();
}

class _MyServiceRequestsScreenState extends State<MyServiceRequestsScreen>
    with SingleTickerProviderStateMixin {
  final _apiClient = ApiClient();
  List<dynamic> _requests = [];
  bool _isLoading = true;
  String? _error;
  late TabController _tabController;
  Timer? _refreshTimer;
  String? _expandedRequestId; // Predictive: expand map when vet near

  void _onStatusChange(Map<String, dynamic> _) {
    if (mounted) _loadRequests();
  }

  void _onStaffMoved(Map<String, dynamic> _) {
    if (mounted) _loadRequests();
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadRequests();
    SocketService.instance.addStatusChangeListener(_onStatusChange);
    SocketService.instance.addStaffMovedListener(_onStaffMoved);
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) _loadRequests();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    SocketService.instance.removeStatusChangeListener(_onStatusChange);
    SocketService.instance.removeStaffMovedListener(_onStaffMoved);
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadRequests() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await _apiClient.getMyServiceRequests();
      if (response.statusCode == 200 && mounted) {
        setState(() {
          _requests = response.data['data'] ?? [];
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() {
          _error = 'Failed to load (${response.statusCode})';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load. Pull to retry.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _showLeaveReviewDialog(
    BuildContext context,
    String requestId,
  ) async {
    int rating = 5;
    final commentController = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text('Leave a review', style: GoogleFonts.poppins()),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Rating',
                      style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (i) {
                        final star = i + 1;
                        return IconButton(
                          icon: Icon(
                            rating >= star
                                ? Icons.star_rounded
                                : Icons.star_outline_rounded,
                            color: const Color(AppConstants.primaryColor),
                            size: 32,
                          ),
                          onPressed: () => setDialogState(() => rating = star),
                        );
                      }),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Comment (optional)',
                      style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: commentController,
                      maxLines: 3,
                      decoration: InputDecoration(
                        hintText: 'How was your experience?',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    if (ctx.mounted) Navigator.of(ctx).pop(false);
                  },
                  child: Text('Cancel', style: GoogleFonts.poppins()),
                ),
                FilledButton(
                  onPressed: () {
                    if (ctx.mounted) Navigator.of(ctx).pop(true);
                  },
                  child: Text('Submit', style: GoogleFonts.poppins()),
                ),
              ],
            );
          },
        );
      },
    );
    commentController.dispose();
    if (submitted != true || !mounted) return;
    try {
      final response = await _apiClient.submitServiceRequestReview(
        requestId,
        rating: rating,
        comment: commentController.text.trim().isNotEmpty
            ? commentController.text.trim()
            : null,
      );
      if (!context.mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      if (response.statusCode == 200) {
        _loadRequests();
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Thank you for your review!'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!context.mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      final msg = e is DioException && e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ??
                'Failed to submit review'
          : 'Failed to submit review';
      messenger.showSnackBar(
        SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _downloadPrescription(
    BuildContext context,
    String requestId,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final response = await _apiClient.getServiceRequestPrescription(
        requestId,
      );
      if (!mounted) {
        return;
      }
      if (response.statusCode != 200 || response.data is! Map) {
        return;
      }
      final data = response.data as Map;
      final url = data['data']?['prescriptionUrl']?.toString();
      if (url != null && url.trim().isNotEmpty) {
        final uri = Uri.parse(url.trim());
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          if (!mounted) {
            return;
          }
          messenger.showSnackBar(
            const SnackBar(
              content: Text('Could not open prescription link.'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      } else {
        if (!mounted) {
          return;
        }
        messenger.showSnackBar(
          const SnackBar(
            content: Text('No prescription available yet.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) {
        return;
      }
      final msg = e is DioException && e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ??
                'Could not load prescription'
          : 'Could not load prescription';
      messenger.showSnackBar(
        SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
      );
    }
  }

  List<dynamic> get _active =>
      _requests.where((r) => _isActiveStatus(r['status'])).toList();
  List<dynamic> get _history =>
      _requests.where((r) => _isHistoryStatus(r['status'])).toList();
  List<dynamic> get _scheduled =>
      _requests.where((r) => _isScheduled(r)).toList();

  bool _isActiveStatus(String? s) =>
      s == 'pending' || s == 'assigned' || s == 'in_progress';
  bool _isHistoryStatus(String? s) => s == 'completed' || s == 'cancelled';
  bool _isScheduled(dynamic r) {
    if (_isHistoryStatus(r['status'])) return false;
    final dateStr = r['preferredDate'] ?? r['scheduledTime'];
    if (dateStr == null) return false;
    final d = DateTime.tryParse(dateStr.toString());
    if (d == null) return false;
    final today = DateTime.now();
    final day = DateTime(today.year, today.month, today.day);
    return d.isAfter(day) || d.isAtSameMomentAs(day);
  }

  @override
  Widget build(BuildContext context) {
    final cream = const Color(AppConstants.bentoBackgroundColor);
    final primary = const Color(AppConstants.primaryColor);

    return Scaffold(
      backgroundColor: cream,
      appBar: AppBar(
        title: Text(
          'My Services',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            fontSize: 18,
            color: Colors.white,
          ),
        ),
        backgroundColor: primary,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadRequests,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          labelStyle: GoogleFonts.poppins(
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: GoogleFonts.poppins(fontSize: 13),
          tabs: const [
            Tab(text: 'Active'),
            Tab(text: 'History'),
            Tab(text: 'Scheduled'),
          ],
        ),
      ),
      body: _isLoading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(
                    color: Color(AppConstants.primaryColor),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Loading your appointments…',
                    style: GoogleFonts.poppins(color: Colors.grey[700]),
                  ),
                ],
              ),
            )
          : _error != null
          ? _buildErrorState()
          : TabBarView(
              controller: _tabController,
              children: [
                _buildTabContent(_active, isActive: true),
                _buildTabContent(_history, isHistory: true),
                _buildTabContent(_scheduled, isScheduled: true),
              ],
            ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_off_rounded, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: GoogleFonts.poppins(color: Colors.grey[700]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadRequests,
              icon: const Icon(Icons.refresh_rounded),
              label: Text(
                'Retry',
                style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(AppConstants.primaryColor),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabContent(
    List<dynamic> list, {
    bool isActive = false,
    bool isHistory = false,
    bool isScheduled = false,
  }) {
    if (list.isEmpty) {
      return _buildEmptyState(
        isActive: isActive,
        isHistory: isHistory,
        isScheduled: isScheduled,
      );
    }
    return RefreshIndicator(
      onRefresh: _loadRequests,
      color: const Color(AppConstants.primaryColor),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        itemCount: list.length,
        itemBuilder: (context, index) {
          return _buildBentoCard(
            list[index],
            isActive: isActive,
            isHistory: isHistory,
          );
        },
      ),
    );
  }

  Widget _buildEmptyState({
    required bool isActive,
    required bool isHistory,
    required bool isScheduled,
  }) {
    final String title;
    final String subtitle;
    if (isActive) {
      title = 'No active appointments';
      subtitle = 'Your live and in-progress services will appear here.';
    } else if (isHistory) {
      title = 'No history yet';
      subtitle = 'Completed and cancelled requests will show here.';
    } else {
      title = 'Nothing scheduled';
      subtitle = 'Upcoming appointments will appear here.';
    }

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(32),
              decoration: LayoutUtils.bentoCardDecoration(context),
              child: Column(
                children: [
                  Icon(
                    isHistory
                        ? Icons.history_rounded
                        : Icons.calendar_today_rounded,
                    size: 72,
                    color: const Color(
                      AppConstants.primaryColor,
                    ).withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    title,
                    style: GoogleFonts.poppins(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[800],
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    subtitle,
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                      child: ElevatedButton.icon(
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const ServicesScreen(),
                          ),
                        ).then((_) => _loadRequests());
                      },
                      icon: const Icon(Icons.add_rounded),
                      label: Text(
                        'Book Now',
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(AppConstants.primaryColor),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoCard(
    dynamic request, {
    bool isActive = false,
    bool isHistory = false,
  }) {
    final status = (request['status'] ?? 'pending') as String;
    final statusLabel = AppConstants.serviceRequestStatusLabel(status);
    final statusColor = _statusColor(status);
    final pet = request['pet'] as Map<String, dynamic>?;
    final staff = request['assignedStaff'] as Map<String, dynamic>?;
    final serviceType = request['serviceType'] ?? 'Service';
    final preferredDate = request['preferredDate'] as String?;
    final timeWindow = request['timeWindow'] as String?;
    final requestId = request['_id']?.toString();
    final bool showLiveMap =
        isActive &&
        (status == 'assigned' || status == 'in_progress') &&
        request['location'] != null &&
        request['location']['coordinates'] != null;
    final bool isCompleted = status == 'completed';
    final bool expanded = _expandedRequestId == requestId && showLiveMap;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: LayoutUtils.bentoCardDecoration(context),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () {
            if (requestId == null) return;
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ServiceRequestTrackingScreen(
                  requestId: requestId,
                  initialServiceType: serviceType,
                ),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _buildStatusBadge(statusLabel, statusColor, status),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        serviceType,
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: const Color(AppConstants.accentColor),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  pet?['name'] ?? 'Pet',
                  style: GoogleFonts.poppins(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[900],
                  ),
                ),
                if (preferredDate != null || timeWindow != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    [
                      preferredDate?.toString().split('T').first,
                      timeWindow,
                    ].whereType<String>().join(' • '),
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
                if (staff != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: const Color(AppConstants.primaryColor),
                        child: Text(
                          (staff['name'] as String?)
                                  ?.substring(0, 1)
                                  .toUpperCase() ??
                              'V',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${staff['name'] ?? 'Staff'}',
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: Colors.grey[700],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                if (request['location']?['address'] != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.location_on_rounded,
                        size: 16,
                        color: const Color(AppConstants.primaryColor),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          request['location']['address'],
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: Colors.grey[700],
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                if (showLiveMap) ...[
                  const SizedBox(height: 14),
                  _buildMapPreviewCard(request, expanded, requestId),
                ],
                if (isCompleted) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: request['review']?['submittedAt'] != null
                              ? null
                              : () => _showLeaveReviewDialog(
                                  context,
                                  requestId ?? request['_id']?.toString() ?? '',
                                ),
                          icon: const Icon(
                            Icons.star_outline_rounded,
                            size: 18,
                          ),
                          label: Text(
                            request['review']?['submittedAt'] != null
                                ? 'Reviewed'
                                : 'Leave Review',
                            style: GoogleFonts.poppins(fontSize: 12),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(
                              AppConstants.primaryColor,
                            ),
                            side: const BorderSide(
                              color: Color(AppConstants.primaryColor),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _downloadPrescription(
                            context,
                            requestId ?? request['_id']?.toString() ?? '',
                          ),
                          icon: const Icon(Icons.download_rounded, size: 18),
                          label: Text(
                            'Prescription',
                            style: GoogleFonts.poppins(fontSize: 12),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(
                              AppConstants.primaryColor,
                            ),
                            side: const BorderSide(
                              color: Color(AppConstants.primaryColor),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String label, Color color, String status) {
    final isLive = status == 'assigned' || status == 'in_progress';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isLive) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: color.withValues(alpha: 0.6), blurRadius: 4),
                ],
              ),
              margin: const EdgeInsets.only(right: 6),
            ),
          ],
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapPreviewCard(
    dynamic request,
    bool expanded,
    String? requestId,
  ) {
    final loc = request['location'] as Map<String, dynamic>?;
    if (loc == null || loc['coordinates'] == null) {
      return const SizedBox.shrink();
    }
    final coords = loc['coordinates'] as Map<String, dynamic>;
    final lat = (coords['lat'] as num?)?.toDouble();
    final lng = (coords['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: expanded ? 180 : 100,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: LatLng(lat, lng),
                initialZoom: 14,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.none,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.pawsewa.user_app',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: LatLng(lat, lng),
                      width: 28,
                      height: 28,
                      child: const Icon(
                        Icons.location_on_rounded,
                        color: Color(AppConstants.primaryColor),
                        size: 28,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Icon(
                  Icons.near_me_rounded,
                  size: 18,
                  color: const Color(AppConstants.primaryColor),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'View live map & ETA',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: const Color(AppConstants.primaryColor),
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _expandedRequestId = _expandedRequestId == requestId
                          ? null
                          : requestId;
                    });
                  },
                  child: Text(
                    expanded ? 'Collapse' : 'Expand',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: const Color(AppConstants.primaryColor),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'pending':
        return Colors.amber.shade700;
      case 'assigned':
        return Colors.blue.shade700;
      case 'in_progress':
        return Colors.deepPurple;
      case 'completed':
        return Colors.green.shade700;
      case 'cancelled':
        return Colors.red.shade700;
      default:
        return Colors.grey;
    }
  }
}
