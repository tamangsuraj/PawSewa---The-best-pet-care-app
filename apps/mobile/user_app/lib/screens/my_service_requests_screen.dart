import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'service_request_tracking_screen.dart';

class MyServiceRequestsScreen extends StatefulWidget {
  const MyServiceRequestsScreen({super.key});

  @override
  State<MyServiceRequestsScreen> createState() => _MyServiceRequestsScreenState();
}

class _MyServiceRequestsScreenState extends State<MyServiceRequestsScreen> {
  final _apiClient = ApiClient();
  List<dynamic> _requests = [];
  bool _isLoading = true;
  String? _error;
  String _filterStatus = 'all'; // all, pending, assigned, in_progress, completed, cancelled

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _apiClient.getMyServiceRequests();
      if (response.statusCode == 200) {
        setState(() {
          _requests = response.data['data'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load service requests (status: ${response.statusCode}).';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load service requests: $e';
        _isLoading = false;
      });
    }
  }

  List<dynamic> get _filteredRequests {
    if (_filterStatus == 'all') return _requests;
    return _requests.where((r) => r['status'] == _filterStatus).toList();
  }

  int get _pendingCount => _requests.where((r) => r['status'] == 'pending').length;
  int get _activeCount =>
      _requests.where((r) => r['status'] == 'assigned' || r['status'] == 'in_progress').length;
  int get _completedCount => _requests.where((r) => r['status'] == 'completed').length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          'My Service Requests',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadRequests,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(AppConstants.primaryColor),
              ),
            )
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 64, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(
                        _error!,
                        style: GoogleFonts.poppins(color: Colors.red),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadRequests,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(AppConstants.primaryColor),
                        ),
                        child: Text(
                          'Retry',
                          style: GoogleFonts.poppins(color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadRequests,
                  color: const Color(AppConstants.primaryColor),
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: _buildStatCard(
                                  'Pending Review',
                                  _pendingCount,
                                  Icons.schedule,
                                  Colors.orange,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildStatCard(
                                  'Active',
                                  _activeCount,
                                  Icons.local_hospital,
                                  Colors.blue,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildStatCard(
                                  'Completed',
                                  _completedCount,
                                  Icons.check_circle,
                                  Colors.green,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),

                          // Filter chips
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                _buildFilterChip('All', 'all'),
                                _buildFilterChip('Pending', 'pending'),
                                _buildFilterChip('Assigned', 'assigned'),
                                _buildFilterChip('In Progress', 'in_progress'),
                                _buildFilterChip('Completed', 'completed'),
                                _buildFilterChip('Cancelled', 'cancelled'),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),

                          if (_filteredRequests.isEmpty)
                            Center(
                              child: Column(
                                children: [
                                  const SizedBox(height: 40),
                                  const Icon(
                                    Icons.assignment,
                                    size: 80,
                                    color: Colors.grey,
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    _filterStatus == 'all'
                                        ? 'No Service Requests Yet'
                                        : 'No ${_filterStatus.replaceAll('_', ' ')} Requests',
                                    style: GoogleFonts.poppins(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey[700],
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    _filterStatus == 'all'
                                        ? 'Book a service to get started'
                                        : 'No requests with this status',
                                    style: GoogleFonts.poppins(
                                      fontSize: 14,
                                      color: Colors.grey[500],
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                              ),
                            )
                          else
                            ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _filteredRequests.length,
                              itemBuilder: (context, index) {
                                return _buildRequestCard(_filteredRequests[index]);
                              },
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
    );
  }

  Widget _buildStatCard(String label, int count, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
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
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(
            count.toString(),
            style: GoogleFonts.poppins(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 12,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }
  Widget _buildFilterChip(String label, String value) {
    final bool selected = _filterStatus == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            color: selected ? Colors.white : Colors.grey[800],
          ),
        ),
        selected: selected,
        selectedColor: const Color(AppConstants.primaryColor),
        backgroundColor: Colors.white,
        side: BorderSide(
          color: selected ? const Color(AppConstants.primaryColor) : Colors.grey.shade300,
        ),
        onSelected: (val) {
          if (val) {
            setState(() {
              _filterStatus = value;
            });
          }
        },
      ),
    );
  }

  Widget _buildRequestCard(Map<String, dynamic> request) {
    final pet = request['pet'] as Map<String, dynamic>?;
    final staff = request['assignedStaff'] as Map<String, dynamic>?;
    final serviceType = request['serviceType'] ?? 'Service';
    final status = (request['status'] ?? 'pending') as String;
    final preferredDate = request['preferredDate'] as String?;
    final timeWindow = request['timeWindow'] as String?;

    Color statusColor;
    String statusLabel;

    switch (status) {
      case 'pending':
        statusColor = Colors.orange;
        statusLabel = 'Pending Review';
        break;
      case 'assigned':
        statusColor = Colors.blue;
        statusLabel = 'Assigned';
        break;
      case 'in_progress':
        statusColor = Colors.deepPurple;
        statusLabel = 'In Progress';
        break;
      case 'completed':
        statusColor = Colors.green;
        statusLabel = 'Completed';
        break;
      case 'cancelled':
        statusColor = Colors.red;
        statusLabel = 'Cancelled';
        break;
      default:
        statusColor = Colors.grey;
        statusLabel = status;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          if (request['_id'] == null) return;
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ServiceRequestTrackingScreen(
                requestId: request['_id'].toString(),
                initialServiceType: serviceType,
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 26 / 255),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      statusLabel,
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    serviceType,
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: const Color(AppConstants.accentColor),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (pet != null)
                Text(
                  pet['name'] ?? 'Pet',
                  style: GoogleFonts.poppins(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              if (preferredDate != null || timeWindow != null)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    [
                      if (preferredDate != null) 'Date: ${preferredDate.toString().split('T').first}',
                      if (timeWindow != null) 'Time: $timeWindow',
                    ].join(' • '),
                    style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[700]),
                  ),
                ),
              if (request['scheduledTime'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    'Scheduled: ${DateTime.tryParse(request['scheduledTime'])?.toLocal().toString().substring(0, 16) ?? request['scheduledTime'].toString()}',
                    style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[800]),
                  ),
                ),
              if (staff != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: const Color(AppConstants.primaryColor),
                        backgroundImage: staff['profilePicture'] != null
                            ? NetworkImage(staff['profilePicture'] as String)
                            : null,
                        child: staff['profilePicture'] == null
                            ? Text(
                                (staff['name'] as String?)?.substring(0, 1).toUpperCase() ?? 'V',
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Assigned Vet: ${staff['name'] ?? 'To be assigned'}',
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[800]),
                        ),
                      ),
                    ],
                  ),
                ),
              if (request['location'] != null && request['location']['address'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on, size: 16, color: Color(AppConstants.primaryColor)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          request['location']['address'],
                          style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[800]),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
