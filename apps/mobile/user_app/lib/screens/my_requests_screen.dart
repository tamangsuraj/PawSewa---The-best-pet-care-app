import 'dart:async';

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/layout_utils.dart';
import '../services/socket_service.dart';
import 'services/services_screen.dart';
import 'service_request_tracking_screen.dart';

/// Unified list of both "Request Assistance" (cases) and "Book Appointment" (service requests).
/// Same as admin Live Cases: one place for all customer requests.
class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  final _apiClient = ApiClient();
  List<dynamic> _items = [];
  bool _isLoading = true;
  String? _error;
  String _filterStatus = 'all';
  Timer? _refreshTimer;

  void _onStatusChange(Map<String, dynamic> _) {
    if (mounted) _loadAll();
  }

  @override
  void initState() {
    super.initState();
    _loadAll();
    SocketService.instance.addStatusChangeListener(_onStatusChange);
    _refreshTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted) _loadAll();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    SocketService.instance.removeStatusChangeListener(_onStatusChange);
    super.dispose();
  }

  Future<void> _loadAll() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _apiClient.getMyCases(),
        _apiClient.getMyServiceRequests(),
      ]);
      final casesRes = results[0];
      final requestsRes = results[1];

      final cases = (casesRes.data is Map ? (casesRes.data as Map)['data'] : null) as List<dynamic>? ?? [];
      final requests =
          (requestsRes.data is Map ? (requestsRes.data as Map)['data'] : null) as List<dynamic>? ?? [];

      final caseItems = cases.map<Map<String, dynamic>>((c) {
        final map = Map<String, dynamic>.from(c is Map ? c as Map<String, dynamic> : <String, dynamic>{});
        map['_requestType'] = 'assistance';
        return map;
      }).toList();

      final requestItems = requests.map<Map<String, dynamic>>((r) {
        final map = Map<String, dynamic>.from(r is Map ? r as Map<String, dynamic> : <String, dynamic>{});
        map['_requestType'] = 'appointment';
        return map;
      }).toList();

      final merged = <Map<String, dynamic>>[...caseItems, ...requestItems]
        ..sort((a, b) {
          final aTime = DateTime.tryParse(a['createdAt']?.toString() ?? '') ?? DateTime(0);
          final bTime = DateTime.tryParse(b['createdAt']?.toString() ?? '') ?? DateTime(0);
          return bTime.compareTo(aTime);
        });

      if (mounted) {
        setState(() {
          _items = merged;
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

  List<dynamic> get _filteredItems {
    if (_filterStatus == 'all') return _items;
    return _items.where((i) => i['status'] == _filterStatus).toList();
  }

  int get _pendingCount => _items.where((i) => i['status'] == 'pending').length;
  int get _activeCount =>
      _items.where((i) => ['assigned', 'in_progress'].contains(i['status'])).length;
  int get _completedCount => _items.where((i) => i['status'] == 'completed').length;

  bool _isAppointment(Map<String, dynamic> item) => item['_requestType'] == 'appointment';

  @override
  Widget build(BuildContext context) {
    final primary = const Color(AppConstants.primaryColor);

    return Scaffold(
      backgroundColor: const Color(AppConstants.bentoBackgroundColor),
      appBar: AppBar(
        title: Text(
          'My Requests',
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
            onPressed: _loadAll,
          ),
        ],
      ),
      body: _isLoading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(color: Color(AppConstants.primaryColor)),
                  const SizedBox(height: 16),
                  Text(
                    'Loading your requests…',
                    style: GoogleFonts.poppins(color: Colors.grey[700]),
                  ),
                ],
              ),
            )
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _loadAll,
                  color: primary,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildStats(),
                          const SizedBox(height: 16),
                          _buildFilterChips(),
                          const SizedBox(height: 16),
                          if (_filteredItems.isEmpty) _buildEmpty() else _buildList(),
                        ],
                      ),
                    ),
                  ),
                ),
    );
  }

  Widget _buildError() {
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
              onPressed: _loadAll,
              icon: const Icon(Icons.refresh_rounded),
              label: Text('Retry', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(AppConstants.primaryColor),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStats() {
    return Row(
      children: [
        Expanded(
          child: _statCard('Pending', _pendingCount, Icons.schedule, Colors.amber),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _statCard('Active', _activeCount, Icons.local_hospital, Colors.blue),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _statCard('Done', _completedCount, Icons.check_circle, Colors.green),
        ),
      ],
    );
  }

  Widget _statCard(String label, int count, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: LayoutUtils.bentoCardDecoration(context),
      child: Column(
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(
            count.toString(),
            style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.bold, color: color),
          ),
          Text(
            label,
            style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _chip('All', 'all'),
          _chip('Pending', 'pending'),
          _chip('Assigned', 'assigned'),
          _chip('In progress', 'in_progress'),
          _chip('Completed', 'completed'),
        ],
      ),
    );
  }

  Widget _chip(String label, String value) {
    final selected = _filterStatus == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(
          label,
          style: GoogleFonts.poppins(
            color: selected ? Colors.white : Colors.grey[700],
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
        selected: selected,
        onSelected: (_) => setState(() => _filterStatus = value),
        backgroundColor: Colors.white,
        selectedColor: const Color(AppConstants.primaryColor),
        checkmarkColor: Colors.white,
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Icon(
              Icons.assignment_outlined,
              size: 72,
              color: const Color(AppConstants.primaryColor).withValues(alpha: 0.5),
            ),
            const SizedBox(height: 20),
            Text(
              _filterStatus == 'all' ? 'No requests yet' : 'No ${_filterStatus.replaceAll('_', ' ')} requests',
              style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.grey[800]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Use Request Assistance or Book Appointment to create one. They all appear here and in admin Live Cases.',
              style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ServicesScreen()),
                ).then((_) => _loadAll());
              },
              icon: const Icon(Icons.add_rounded),
              label: Text('Request assistance or book', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(AppConstants.primaryColor),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _filteredItems.length,
      itemBuilder: (context, index) => _buildCard(_filteredItems[index] as Map<String, dynamic>),
    );
  }

  Widget _buildCard(Map<String, dynamic> item) {
    final isAppointment = _isAppointment(item);
    final pet = item['pet'] is Map ? item['pet'] as Map<String, dynamic> : null;
    final status = item['status']?.toString() ?? 'pending';

    Color statusColor;
    String statusText;
    IconData statusIcon;
    switch (status) {
      case 'assigned':
        statusColor = Colors.blue;
        statusText = 'Assigned';
        statusIcon = Icons.person;
        break;
      case 'in_progress':
        statusColor = Colors.orange;
        statusText = 'In Progress';
        statusIcon = Icons.local_hospital;
        break;
      case 'completed':
        statusColor = Colors.green;
        statusText = 'Completed';
        statusIcon = Icons.check_circle;
        break;
      case 'cancelled':
        statusColor = Colors.red;
        statusText = 'Cancelled';
        statusIcon = Icons.cancel;
        break;
      default:
        statusColor = Colors.amber.shade700;
        statusText = 'Pending';
        statusIcon = Icons.schedule;
    }

    String title;
    String subtitle;
    if (isAppointment) {
      title = item['serviceType']?.toString() ?? 'Appointment';
      final date = item['preferredDate']?.toString();
      final window = item['timeWindow']?.toString();
      subtitle = date != null ? '$date${window != null ? ' · $window' : ''}' : '';
    } else {
      title = 'Request Assistance';
      subtitle = item['issueDescription']?.toString() ?? '';
      if (subtitle.length > 80) subtitle = '${subtitle.substring(0, 80)}…';
    }

    final location = isAppointment
        ? (item['location'] is Map ? (item['location'] as Map)['address']?.toString() : null) ?? ''
        : item['location']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: LayoutUtils.bentoCardDecoration(context),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (isAppointment) {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ServiceRequestTrackingScreen(
                    requestId: item['_id']?.toString() ?? '',
                  ),
                ),
              ).then((_) => _loadAll());
            } else {
              _showCaseDetail(item);
            }
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isAppointment
                            ? Colors.blue.withValues(alpha: 0.15)
                            : Colors.amber.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        isAppointment ? 'Appointment' : 'Assistance',
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isAppointment ? Colors.blue.shade800 : Colors.amber.shade800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, size: 14, color: statusColor),
                          const SizedBox(width: 4),
                          Text(
                            statusText,
                            style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(AppConstants.primaryColor).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: pet != null && (pet['image'] != null || pet['photoUrl'] != null)
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: CachedNetworkImage(
                                imageUrl: (pet['photoUrl'] ?? pet['image']).toString(),
                                fit: BoxFit.cover,
                                placeholder: (context, url) => const Center(
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                ),
                                errorWidget: (context, url, error) => const Icon(
                                  Icons.pets,
                                  color: Color(AppConstants.primaryColor),
                                  size: 26,
                                ),
                              ),
                            )
                          : const Icon(Icons.pets, color: Color(AppConstants.primaryColor), size: 26),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            pet?['name']?.toString() ?? 'Pet',
                            style: GoogleFonts.poppins(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: const Color(AppConstants.accentColor),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            title,
                            style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[800]),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (subtitle.isNotEmpty)
                            Text(
                              subtitle,
                              style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          if (location.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(Icons.location_on, size: 14, color: Color(AppConstants.primaryColor)),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    location,
                                    style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600]),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: Colors.grey),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showCaseDetail(Map<String, dynamic> item) {
    final pet = item['pet'] is Map ? item['pet'] as Map<String, dynamic> : null;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Request Assistance',
                style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              if (pet != null)
                Text(
                  'Pet: ${pet['name']}',
                  style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[700]),
                ),
              const SizedBox(height: 8),
              Text(
                item['issueDescription']?.toString() ?? 'No description',
                style: GoogleFonts.poppins(fontSize: 14),
              ),
              const SizedBox(height: 8),
              Text(
                'Location: ${item['location'] ?? '—'}',
                style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[600]),
              ),
              const SizedBox(height: 8),
              Text(
                'Status: ${(item['status'] ?? 'pending').toString().replaceAll('_', ' ')}',
                style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
