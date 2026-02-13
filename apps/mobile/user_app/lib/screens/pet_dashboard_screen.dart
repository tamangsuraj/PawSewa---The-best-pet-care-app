import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/constants.dart';
import '../core/storage_service.dart';
import '../models/pet.dart';
import '../services/pet_service.dart';
import '../widgets/pet_card.dart';
import 'login_screen.dart';
import 'add_pet_screen.dart';
import 'request_assistance_screen.dart';
import 'my_requests_screen.dart';
import 'services/services_screen.dart';
import 'shop/shop_screen.dart';
import 'messages/messages_screen.dart';
import 'care/care_screen.dart';
import 'my_pets/my_pets_screen.dart';
import '../services/socket_service.dart';

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
  int _lastBottomBarIndex = 0; // when on Messages, bottom bar shows this

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
    SocketService.instance.disconnect();
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
              const SizedBox(height: 12),

              // Digital ID Card for PawID + QR
              if (pet.pawId != null && pet.pawId!.isNotEmpty)
                GestureDetector(
                  onLongPress: () async {
                    final id = pet.pawId!;
                    // Capture context-dependent objects before the async gap.
                    final messenger = ScaffoldMessenger.of(context);
                    final canPop = Navigator.of(context).canPop();

                    await Clipboard.setData(ClipboardData(text: id));
                    if (!mounted || !canPop) return;

                    HapticFeedback.lightImpact();
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text('PawID copied: $id'),
                        duration: const Duration(seconds: 2),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  child: Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7EC),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: const Color(AppConstants.primaryColor),
                        width: 1.2,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(
                              AppConstants.primaryColor,
                            ).withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.badge,
                            color: Color(AppConstants.primaryColor),
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Digital Paw ID',
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(AppConstants.primaryColor),
                                ),
                              ),
                              const SizedBox(height: 4),
                              SelectableText(
                                pet.pawId ?? '',
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.brown[800],
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Long press to copy or let your vet scan the QR.',
                                style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  color: Colors.brown[600],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2D3B5)),
                          ),
                          child: QrImageView(
                            data: pet.pawId!,
                            size: 72,
                            eyeStyle: const QrEyeStyle(
                              eyeShape: QrEyeShape.square,
                              color: Color(AppConstants.primaryColor),
                            ),
                            dataModuleStyle: const QrDataModuleStyle(
                              dataModuleShape: QrDataModuleShape.square,
                              color: Color(AppConstants.primaryColor),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
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
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header: profile + Edit Profile (like reference)
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
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _userName,
                          style: GoogleFonts.poppins(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                          overflow: TextOverflow.ellipsis,
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
            // Menu items – scrollable to prevent overflow
            Flexible(
              child: ListView(
                shrinkWrap: true,
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
                                    builder: (_) => const MyRequestsScreen(),
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
                                'My Requests',
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
                      : ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _pets.length,
                          itemBuilder: (context, index) {
                            final pet = _pets[index];
                            return PetCard(
                              pet: pet,
                              onTap: () => _showPetDetails(pet),
                            );
                          },
                        ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  int _bottomBarSelectedIndex() {
    if (_currentIndex == 3) return _lastBottomBarIndex;
    if (_currentIndex <= 2) return _currentIndex;
    return _currentIndex == 4 ? 3 : 4; // Care -> 3, My Pets -> 4
  }

  Widget _buildBottomNavBar() {
    const primary = Color(AppConstants.primaryColor);
    const iconSize = 20.0;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.only(top: 2, bottom: 4),
          child: BottomNavigationBar(
            type: BottomNavigationBarType.fixed,
            currentIndex: _bottomBarSelectedIndex(),
            onTap: (index) {
              setState(() {
                _lastBottomBarIndex = index;
                _currentIndex = index <= 2 ? index : (index == 3 ? 4 : 5);
              });
            },
            backgroundColor: Colors.transparent,
            elevation: 0,
            selectedItemColor: primary,
            unselectedItemColor: Colors.grey[600],
            selectedLabelStyle: GoogleFonts.poppins(
              fontSize: 9,
              fontWeight: FontWeight.w600,
            ),
            unselectedLabelStyle: GoogleFonts.poppins(
              fontSize: 9,
              fontWeight: FontWeight.w500,
            ),
            showUnselectedLabels: true,
            items: [
              BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined, size: iconSize),
                activeIcon: Icon(Icons.home, size: iconSize),
                label: 'Home',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.calendar_today_outlined, size: iconSize),
                activeIcon: Icon(Icons.calendar_today, size: iconSize),
                label: 'Services',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.shopping_bag_outlined, size: iconSize),
                activeIcon: Icon(Icons.shopping_bag, size: iconSize),
                label: 'Shop',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.favorite_border, size: iconSize),
                activeIcon: Icon(Icons.favorite, size: iconSize),
                label: 'Care',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.pets, size: iconSize),
                activeIcon: Icon(Icons.pets, size: iconSize),
                label: 'My Pets',
              ),
            ],
          ),
        ),
      ),
    );
  }

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
                fontSize: 13,
                color: Colors.black87,
              ),
            ),
            Text(
              _titleForIndex(),
              style: GoogleFonts.poppins(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: const Color(AppConstants.primaryColor),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        iconTheme: const IconThemeData(color: Colors.black87),
        actions: [
          IconButton(
            icon: Icon(
              _currentIndex == 3 ? Icons.chat_bubble : Icons.chat_bubble_outline,
              color: _currentIndex == 3
                  ? const Color(AppConstants.primaryColor)
                  : Colors.grey[700],
              size: 20,
            ),
            onPressed: () {
              setState(() => _currentIndex = 3);
            },
            tooltip: 'Messages',
          ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        switchInCurve: Curves.easeInOut,
        switchOutCurve: Curves.easeInOut,
        transitionBuilder: (Widget child, Animation<double> animation) {
          return FadeTransition(
            opacity: animation,
            child: child,
          );
        },
        child: KeyedSubtree(
          key: ValueKey<int>(_currentIndex),
          child: _buildCurrentTab(),
        ),
      ),
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
      bottomNavigationBar: _buildBottomNavBar(),
    );
  }
}
