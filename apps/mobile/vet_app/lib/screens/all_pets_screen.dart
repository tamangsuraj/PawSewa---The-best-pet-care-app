import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/api_client.dart';
import '../core/constants.dart';

class AllPetsScreen extends StatefulWidget {
  const AllPetsScreen({super.key});

  @override
  State<AllPetsScreen> createState() => _AllPetsScreenState();
}

class _AllPetsScreenState extends State<AllPetsScreen> {
  final _apiClient = ApiClient();
  List<dynamic> _allCases = [];
  bool _isLoading = true;
  String? _error;
  String _filterStatus = 'active'; // active, completed, all

  @override
  void initState() {
    super.initState();
    _loadCases();
  }

  Future<void> _loadCases() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _apiClient.getMyAssignments();
      if (response.statusCode == 200) {
        setState(() {
          _allCases = response.data['data'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load assignments: $e';
        _isLoading = false;
      });
    }
  }

  List<dynamic> get _filteredCases {
    switch (_filterStatus) {
      case 'active':
        return _allCases.where((c) => 
          c['status'] == 'assigned' || c['status'] == 'in_progress'
        ).toList();
      case 'completed':
        return _allCases.where((c) => c['status'] == 'completed').toList();
      case 'all':
      default:
        return _allCases;
    }
  }

  int get _activeCount => _allCases.where((c) => 
    c['status'] == 'assigned' || c['status'] == 'in_progress'
  ).length;
  
  int get _completedCount => _allCases.where((c) => 
    c['status'] == 'completed'
  ).length;

  // Calculate urgency based on how long ago the case was assigned
  String _getUrgency(Map<String, dynamic> caseData) {
    if (caseData['assignedAt'] == null) return 'normal';
    
    try {
      final assignedAt = DateTime.parse(caseData['assignedAt']);
      final now = DateTime.now();
      final hoursSinceAssigned = now.difference(assignedAt).inHours;
      
      if (hoursSinceAssigned >= 24) return 'critical'; // Over 24 hours
      if (hoursSinceAssigned >= 6) return 'high'; // Over 6 hours
      if (hoursSinceAssigned >= 2) return 'medium'; // Over 2 hours
      return 'normal';
    } catch (e) {
      return 'normal';
    }
  }

  Future<void> _completeCase(String caseId) async {
    try {
      final response = await _apiClient.completeCase(caseId);
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Case completed successfully!', style: GoogleFonts.poppins()),
            backgroundColor: Colors.green,
          ),
        );
        _loadCases(); // Reload cases
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to complete case: $e', style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _startCase(String caseId) async {
    try {
      final response = await _apiClient.startCase(caseId);
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Case started!', style: GoogleFonts.poppins()),
            backgroundColor: Colors.blue,
          ),
        );
        _loadCases(); // Reload cases
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to start case: $e', style: GoogleFonts.poppins()),
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
          'My Assigned Cases',
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
            onPressed: _loadCases,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(AppConstants.primaryColor)))
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
                        onPressed: _loadCases,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(AppConstants.primaryColor),
                        ),
                        child: Text('Retry', style: GoogleFonts.poppins(color: Colors.white)),
                      ),
                    ],
                  ),
                )
              : _allCases.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.assignment, size: 64, color: Colors.grey),
                          const SizedBox(height: 16),
                          Text(
                            'No assigned cases yet',
                            style: GoogleFonts.poppins(
                              fontSize: 18,
                              color: Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Cases will appear here when assigned by the dispatch team',
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              color: Colors.grey[500],
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        // Stats Bar
                        Container(
                          padding: const EdgeInsets.all(16),
                          color: Colors.white,
                          child: Row(
                            children: [
                              Expanded(
                                child: _buildStatChip(
                                  'Active',
                                  _activeCount,
                                  Colors.orange,
                                  Icons.pending_actions,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildStatChip(
                                  'Completed',
                                  _completedCount,
                                  Colors.green,
                                  Icons.check_circle,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _buildStatChip(
                                  'Total',
                                  _allCases.length,
                                  const Color(AppConstants.primaryColor),
                                  Icons.folder,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Filter Tabs
                        Container(
                          color: Colors.white,
                          child: Row(
                            children: [
                              Expanded(
                                child: _buildFilterTab('Active', 'active', _activeCount),
                              ),
                              Expanded(
                                child: _buildFilterTab('Completed', 'completed', _completedCount),
                              ),
                              Expanded(
                                child: _buildFilterTab('All', 'all', _allCases.length),
                              ),
                            ],
                          ),
                        ),

                        // Cases List
                        Expanded(
                          child: _filteredCases.isEmpty
                              ? Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(
                                        Icons.assignment,
                                        size: 80,
                                        color: Colors.grey,
                                      ),
                                      const SizedBox(height: 16),
                                      Text(
                                        _filterStatus == 'active'
                                            ? 'No active cases'
                                            : _filterStatus == 'completed'
                                                ? 'No completed cases yet'
                                                : 'No assigned cases yet',
                                        style: GoogleFonts.poppins(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.grey[700],
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Cases will appear here when assigned by the dispatch team',
                                        style: GoogleFonts.poppins(
                                          fontSize: 14,
                                          color: Colors.grey[500],
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                    ],
                                  ),
                                )
                              : RefreshIndicator(
                                  onRefresh: _loadCases,
                                  color: const Color(AppConstants.primaryColor),
                                  child: ListView.builder(
                                    padding: const EdgeInsets.all(16),
                                    itemCount: _filteredCases.length,
                                    itemBuilder: (context, index) {
                                      return _buildCaseCard(_filteredCases[index]);
                                    },
                                  ),
                                ),
                        ),
                      ],
                    ),
    );
  }

  Widget _buildStatChip(String label, int count, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 4),
          Text(
            count.toString(),
            style: GoogleFonts.poppins(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 11,
              color: Colors.grey[700],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label, String value, int count) {
    final isSelected = _filterStatus == value;
    return InkWell(
      onTap: () {
        setState(() {
          _filterStatus = value;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: isSelected 
                  ? const Color(AppConstants.primaryColor) 
                  : Colors.transparent,
              width: 3,
            ),
          ),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected 
                    ? const Color(AppConstants.primaryColor) 
                    : Colors.grey[600],
              ),
            ),
            if (count > 0)
              Container(
                margin: const EdgeInsets.only(top: 4),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: isSelected 
                      ? const Color(AppConstants.primaryColor) 
                      : Colors.grey[300],
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  count.toString(),
                  style: GoogleFonts.poppins(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? Colors.white : Colors.grey[700],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCaseCard(Map<String, dynamic> caseData) {
    final pet = caseData['pet'];
    final customer = caseData['customer'];
    final status = caseData['status'] ?? 'pending';
    final urgency = _getUrgency(caseData);

    Color statusColor;
    String statusText;
    switch (status) {
      case 'assigned':
        statusColor = Colors.blue;
        statusText = 'Assigned';
        break;
      case 'in_progress':
        statusColor = Colors.orange;
        statusText = 'In Progress';
        break;
      case 'completed':
        statusColor = Colors.green;
        statusText = 'Completed';
        break;
      default:
        statusColor = Colors.grey;
        statusText = 'Pending';
    }

    // Urgency colors and labels
    Color? urgencyColor;
    String? urgencyLabel;
    IconData? urgencyIcon;
    
    if (status != 'completed') {
      switch (urgency) {
        case 'critical':
          urgencyColor = Colors.red;
          urgencyLabel = 'URGENT - Over 24h';
          urgencyIcon = Icons.warning;
          break;
        case 'high':
          urgencyColor = Colors.orange;
          urgencyLabel = 'High Priority - Over 6h';
          urgencyIcon = Icons.priority_high;
          break;
        case 'medium':
          urgencyColor = Colors.amber;
          urgencyLabel = 'Medium Priority - Over 2h';
          urgencyIcon = Icons.access_time;
          break;
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: urgencyColor != null 
            ? Border.all(color: urgencyColor, width: 2)
            : null,
        boxShadow: [
          BoxShadow(
            color: urgencyColor?.withOpacity(0.2) ?? Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Urgency Alert Banner (if urgent)
            if (urgencyColor != null && urgencyLabel != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: urgencyColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: urgencyColor, width: 2),
                ),
                child: Row(
                  children: [
                    Icon(urgencyIcon, color: urgencyColor, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        urgencyLabel,
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: urgencyColor,
                        ),
                      ),
                    ),
                    if (urgency == 'critical')
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: urgencyColor,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.notifications_active,
                          color: Colors.white,
                          size: 16,
                        ),
                      ),
                  ],
                ),
              ),

            // Status Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                statusText,
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: statusColor,
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Pet Info
            Row(
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: const Color(AppConstants.primaryColor).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    image: pet?['image'] != null
                        ? DecorationImage(
                            image: NetworkImage(pet['image']),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: pet?['image'] == null
                      ? const Icon(
                          Icons.pets,
                          size: 30,
                          color: Color(AppConstants.primaryColor),
                        )
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        pet?['name'] ?? 'Unknown Pet',
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: const Color(AppConstants.accentColor),
                        ),
                      ),
                      Text(
                        '${pet?['breed'] ?? 'Unknown'} • ${pet?['age'] ?? '?'} years',
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Customer Info
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.person, size: 16, color: Color(AppConstants.primaryColor)),
                      const SizedBox(width: 8),
                      Text(
                        customer?['name'] ?? 'Unknown',
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  if (customer?['phone'] != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.phone, size: 16, color: Color(AppConstants.primaryColor)),
                        const SizedBox(width: 8),
                        Text(
                          customer['phone'],
                          style: GoogleFonts.poppins(fontSize: 13),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Issue Description
            Text(
              'Issue:',
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              caseData['issueDescription'] ?? 'No description',
              style: GoogleFonts.poppins(
                fontSize: 14,
                color: Colors.grey[800],
              ),
            ),
            const SizedBox(height: 12),

            // Location
            Row(
              children: [
                const Icon(Icons.location_on, size: 16, color: Color(AppConstants.primaryColor)),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    caseData['location'] ?? 'No location',
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      color: Colors.grey[600],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Action Buttons
            if (status == 'assigned') ...[
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => _startCase(caseData['_id']),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    'Start Case',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ] else if (status == 'in_progress') ...[
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => _completeCase(caseData['_id']),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    'Mark as Complete',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
