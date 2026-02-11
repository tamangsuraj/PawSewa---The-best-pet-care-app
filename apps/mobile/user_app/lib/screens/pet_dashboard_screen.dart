import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';
import '../core/storage_service.dart';
import '../models/pet.dart';
import '../services/pet_service.dart';
import '../widgets/pet_card.dart';
import 'login_screen.dart';
import 'add_pet_screen.dart';
import 'request_assistance_screen.dart';
import 'my_cases_screen.dart';
import 'my_service_requests_screen.dart';
import 'services/services_screen.dart';
import 'shop/shop_screen.dart';
import 'messages/messages_screen.dart';
import 'care/care_screen.dart';
import 'my_pets/my_pets_screen.dart';

class PetDashboardScreen extends StatefulWidget {
  const PetDashboardScreen({super.key});

  @override
  State<PetDashboardScreen> createState() => _PetDashboardScreenState();
}

class _PetDashboardScreenState extends State<PetDashboardScreen> {
  final _petService = PetService();
  final _storage = StorageService();

  List<Pet> _pets = [];
  bool _isLoading = true;
  String _userName = 'Pet Owner';
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadUserData();
    _loadPets();
  }

  Future<void> _loadUserData() async {
    final userDataString = await _storage.getUser();
    if (userDataString != null) {
      try {
        final nameMatch = RegExp(
          r'"name"\s*:\s*"([^"]*)"',
        ).firstMatch(userDataString);
        if (nameMatch != null) {
          setState(() {
            _userName = nameMatch.group(1) ?? 'Pet Owner';
          });
        }
      } catch (_) {
        // Ignore parse errors and keep default name
      }
    }
  }

  Future<void> _loadPets() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final pets = await _petService.getMyPets();
      setState(() {
        _pets = pets;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error loading pets: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _handleLogout() async {
    await _storage.clearAll();
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  Future<void> _navigateToAddPet() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const AddPetScreen()),
    );
    if (result == true) {
      _loadPets();
    }
  }

  void _showPetDetails(Pet pet) {
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
              Row(
                children: [
                  Expanded(
                    child: Text(
                      pet.name,
                      style: GoogleFonts.poppins(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: const Color(AppConstants.primaryColor),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _buildDetailRow('Species', pet.species),
              if (pet.breed != null && pet.breed!.isNotEmpty)
                _buildDetailRow('Breed', pet.breed!),
              if (pet.age != null) _buildDetailRow('Age', '${pet.age} years'),
              _buildDetailRow('Gender', pet.gender),
              if (pet.weight != null)
                _buildDetailRow('Weight', '${pet.weight} kg'),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        // For now just close; delete flow can be added back if needed
                      },
                      icon: const Icon(Icons.close),
                      label: Text('Close', style: GoogleFonts.poppins()),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(AppConstants.primaryColor),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              '$label:',
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.poppins(
                color: const Color(AppConstants.accentColor),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _titleForIndex() {
    switch (_currentIndex) {
      case 0:
        return 'Home';
      case 1:
        return 'Services';
      case 2:
        return 'Shop';
      case 3:
        return 'Messages';
      case 4:
        return 'Care';
      case 5:
        return 'My Pets';
      default:
        return AppConstants.appName;
    }
  }

  void _goToTab(int index) {
    setState(() => _currentIndex = index);
    Navigator.pop(context); // close drawer
  }

  Widget _buildDrawer(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header: profile + Edit Profile
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(AppConstants.primaryColor),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.pets,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _userName,
                          style: GoogleFonts.poppins(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Material(
                          color: const Color(AppConstants.primaryColor),
                          borderRadius: BorderRadius.circular(18),
                          child: InkWell(
                            onTap: () => Navigator.pop(context),
                            borderRadius: BorderRadius.circular(18),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              child: Text(
                                'Edit Profile',
                                style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            // Menu items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  _drawerItem(
                    context,
                    icon: Icons.home_outlined,
                    label: 'Home',
                    onTap: () => _goToTab(0),
                  ),
                  _drawerItem(
                    context,
                    icon: Icons.medical_services_outlined,
                    label: 'Services',
                    onTap: () => _goToTab(1),
                  ),
                  _drawerItem(
                    context,
                    icon: Icons.storefront_outlined,
                    label: 'Shop',
                    onTap: () => _goToTab(2),
                  ),
                  _drawerItem(
                    context,
                    icon: Icons.chat_bubble_outline,
                    label: 'Messages',
                    onTap: () => _goToTab(3),
                  ),
                  _drawerItem(
                    context,
                    icon: Icons.favorite_outline,
                    label: 'Care',
                    onTap: () => _goToTab(4),
                  ),
                  _drawerItem(
                    context,
                    icon: Icons.pets,
                    label: 'My Pets',
                    onTap: () => _goToTab(5),
                  ),
                  const Divider(height: 24),
                  _drawerItem(
                    context,
                    icon: Icons.logout,
                    label: 'Sign Out',
                    iconColor: Colors.red,
                    onTap: () {
                      Navigator.pop(context);
                      _handleLogout();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawerItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    VoidCallback? onTap,
    Color? iconColor,
  }) {
    final color = iconColor ?? const Color(AppConstants.primaryColor);
    return ListTile(
      leading: Icon(icon, color: color, size: 24),
      title: Text(
        label,
        style: GoogleFonts.poppins(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: Colors.black87,
        ),
      ),
      onTap: onTap,
    );
  }

  Widget _buildCurrentTab() {
    switch (_currentIndex) {
      case 0:
        return _buildHomeBody();
      case 1:
        return const ServicesScreen();
      case 2:
        return const ShopScreen();
      case 3:
        return const MessagesScreen();
      case 4:
        return const CareScreen();
      case 5:
        return const MyPetsScreen();
      default:
        return _buildHomeBody();
    }
  }

  Widget _buildHomeBody() {
    return SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final padding = (MediaQuery.sizeOf(context).width * 0.055).clamp(
            12.0,
            28.0,
          );
          return RefreshIndicator(
            onRefresh: _loadPets,
            color: const Color(AppConstants.primaryColor),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.all(padding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Welcome card
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
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(
                            Icons.pets,
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
                                'Welcome Back!',
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
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
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Quick actions
                  Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        const RequestAssistanceScreen(),
                                  ),
                                );
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red.shade600,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 16,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              icon: const Icon(
                                Icons.medical_services,
                                color: Colors.white,
                              ),
                              label: Text(
                                'Request Assistance',
                                style: GoogleFonts.poppins(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => const MyCasesScreen(),
                                  ),
                                );
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(
                                  AppConstants.primaryColor,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 16,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              icon: const Icon(
                                Icons.assignment,
                                color: Colors.white,
                              ),
                              label: Text(
                                'My Cases',
                                style: GoogleFonts.poppins(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const MyServiceRequestsScreen(),
                              ),
                            );
                          },
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: Colors.grey.shade300),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            backgroundColor: Colors.white,
                          ),
                          icon: const Icon(
                            Icons.medical_information,
                            color: Color(AppConstants.primaryColor),
                          ),
                          label: Text(
                            'My Service Requests',
                            style: GoogleFonts.poppins(
                              color: const Color(AppConstants.primaryColor),
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Pets section header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          'My Pets',
                          style: GoogleFonts.poppins(
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                            color: const Color(AppConstants.accentColor),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${_pets.length} ${_pets.length == 1 ? 'Pet' : 'Pets'}',
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Pets list / empty state
                  _isLoading
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32.0),
                            child: CircularProgressIndicator(
                              color: Color(AppConstants.primaryColor),
                            ),
                          ),
                        )
                      : _pets.isEmpty
                      ? Container(
                          padding: const EdgeInsets.all(32),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
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
                              const Icon(
                                Icons.pets,
                                size: 64,
                                color: Color(AppConstants.primaryColor),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'No Pets Yet',
                                style: GoogleFonts.poppins(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(AppConstants.accentColor),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Add your first pet to get started!',
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  color: Colors.grey[600],
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        )
                      : Column(
                          children: _pets
                              .map(
                                (pet) => PetCard(
                                  pet: pet,
                                  onTap: () => _showPetDetails(pet),
                                ),
                              )
                              .toList(),
                        ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  bool _isNavSelected(int index) => _currentIndex == index;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      drawer: _buildDrawer(context),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu, size: 22),
          onPressed: () => Scaffold.of(context).openDrawer(),
          color: Colors.black87,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              AppConstants.appName,
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.bold,
                fontSize: 15,
                color: Colors.black87,
              ),
            ),
            Text(
              _titleForIndex(),
              style: GoogleFonts.poppins(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: const Color(AppConstants.primaryColor),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: _buildCurrentTab(),
      floatingActionButton: _currentIndex == 0
          ? FloatingActionButton.extended(
              onPressed: _navigateToAddPet,
              backgroundColor: const Color(AppConstants.primaryColor),
              icon: const Icon(Icons.add, color: Colors.white),
              label: Text(
                'Add Pet',
                style: GoogleFonts.poppins(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : null,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: BottomNavigationBar(
              type: BottomNavigationBarType.fixed,
              currentIndex: _currentIndex,
              onTap: (index) {
                setState(() {
                  _currentIndex = index;
                });
              },
              backgroundColor: Colors.transparent,
              elevation: 0,
              selectedItemColor: const Color(AppConstants.primaryColor),
              unselectedItemColor: Colors.grey[600],
              selectedLabelStyle: GoogleFonts.poppins(
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
              unselectedLabelStyle: GoogleFonts.poppins(
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
              showUnselectedLabels: true,
              items: [
                BottomNavigationBarItem(
                  icon: Icon(
                    _isNavSelected(0) ? Icons.home : Icons.home_outlined,
                    size: 22,
                  ),
                  label: 'Home',
                ),
                BottomNavigationBarItem(
                  icon: Icon(
                    _isNavSelected(1)
                        ? Icons.medical_services
                        : Icons.medical_services_outlined,
                    size: 22,
                  ),
                  label: 'Services',
                ),
                BottomNavigationBarItem(
                  icon: Icon(
                    _isNavSelected(2)
                        ? Icons.storefront
                        : Icons.storefront_outlined,
                    size: 22,
                  ),
                  label: 'Shop',
                ),
                BottomNavigationBarItem(
                  icon: Icon(
                    _isNavSelected(3)
                        ? Icons.chat_bubble
                        : Icons.chat_bubble_outline,
                    size: 22,
                  ),
                  label: 'Messages',
                ),
                BottomNavigationBarItem(
                  icon: Icon(
                    _isNavSelected(4) ? Icons.favorite : Icons.favorite_outline,
                    size: 22,
                  ),
                  label: 'Care',
                ),
                BottomNavigationBarItem(
                  icon: Icon(Icons.pets, size: 22),
                  label: 'My Pets',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
