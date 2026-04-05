import 'dart:async';
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
import 'shop/my_orders_screen.dart';
import 'care/my_care_bookings_screen.dart';
import 'messages/messages_hub_screen.dart';
import 'care/care_screen.dart';
import 'my_pets/my_pets_screen.dart';
import 'drawer_placeholder_screen.dart';
import '../services/socket_service.dart';
import '../services/chat_unread_notify_service.dart';
import '../services/push_notification_service.dart';
import '../widgets/pawsewa_brand_logo.dart';
import '../widgets/editorial_canvas.dart';
import 'package:flutter/foundation.dart';

class PetDashboardScreen extends StatefulWidget {
  const PetDashboardScreen({super.key});

  @override
  State<PetDashboardScreen> createState() => _PetDashboardScreenState();
}

class _PetDashboardScreenState extends State<PetDashboardScreen>
    with WidgetsBindingObserver {
  final _petService = PetService();
  final _storage = StorageService();
  final GlobalKey<ScaffoldState> _shellScaffoldKey = GlobalKey<ScaffoldState>();

  List<Pet> _pets = [];
  bool _isLoading = true;
  String _userName = 'Pet Owner';
  String? _userAvatarUrl;
  int _currentIndex = 0;
  int _lastBottomBarIndex = 0; // when on Messages, bottom bar shows this

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadUserData();
    _loadPets();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(PushNotificationService.instance.syncTokenIfLoggedIn());
    }
  }

  Future<void> _loadUserData() async {
    final userDataString = await _storage.getUser();
    if (userDataString == null) {
      return;
    }
    try {
      final decoded = jsonDecode(userDataString);
      if (decoded is! Map) {
        return;
      }
      final m = Map<String, dynamic>.from(decoded);
      final name = m['name']?.toString();
      final pic = m['profilePicture']?.toString() ??
          m['photoUrl']?.toString() ??
          m['avatar']?.toString();
      if (!mounted) {
        return;
      }
      setState(() {
        if (name != null && name.isNotEmpty) {
          _userName = name;
        }
        if (pic != null && pic.isNotEmpty) {
          _userAvatarUrl = pic;
        }
      });
    } catch (_) {
      try {
        final nameMatch = RegExp(
          r'"name"\s*:\s*"([^"]*)"',
        ).firstMatch(userDataString);
        if (nameMatch != null && mounted) {
          setState(() {
            _userName = nameMatch.group(1) ?? 'Pet Owner';
          });
        }
      } catch (_) {}
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
    if (mounted) {
      context.read<ChatUnreadNotifyService>().reset();
    }
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
                      style: GoogleFonts.outfit(
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
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(AppConstants.primaryColor),
                                ),
                              ),
                              const SizedBox(height: 4),
                              SelectableText(
                                pet.pawId ?? '',
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.brown[800],
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Long press to copy or let your vet scan the QR.',
                                style: GoogleFonts.outfit(
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
                      label: Text('Close', style: GoogleFonts.outfit()),
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
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.outfit(
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
        return 'Chats';
      case 4:
        return 'Pet Care+';
      case 5:
        return 'My Pets';
      default:
        return AppConstants.appName;
    }
  }

  void _goToTab(int index) {
    setState(() => _currentIndex = index);
    Navigator.pop(context);
  }

  void _closeDrawerAndPush(Widget screen) {
    Navigator.pop(context);
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }

  void _navigateToDrawerScreen(String screenName, Widget? screen) {
    if (screen == null) {
      if (kDebugMode) {
        debugPrint('[ERROR] Navigation failed: Screen $screenName not found.');
      }
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Screen $screenName is not available.')),
      );
      return;
    }
    _closeDrawerAndPush(screen);
  }

  static const Color _primaryBrown = Color(AppConstants.primaryColor);
  static const Color _subInk = Color(0xFF6B7280);
  static const Color _drawerDivider = Color(0xFFEEEEEE);

  bool _isNetworkImageUrl(String? u) {
    if (u == null || u.isEmpty) {
      return false;
    }
    return u.startsWith('http://') || u.startsWith('https://');
  }

  Widget _buildDrawer(BuildContext context) {
    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: 34,
                    backgroundColor: const Color(0xFFF3F4F6),
                    child: CircleAvatar(
                      radius: 32,
                      backgroundColor: Colors.grey.shade200,
                      backgroundImage: _isNetworkImageUrl(_userAvatarUrl)
                          ? CachedNetworkImageProvider(_userAvatarUrl!)
                          : null,
                      child: _isNetworkImageUrl(_userAvatarUrl)
                          ? null
                          : Icon(
                              Icons.person_rounded,
                              size: 34,
                              color: Colors.grey.shade500,
                            ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _userName,
                          style: GoogleFonts.outfit(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: Colors.black87,
                            height: 1.2,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 10),
                        Material(
                          color: _primaryBrown,
                          borderRadius: BorderRadius.circular(20),
                          elevation: 0,
                          child: InkWell(
                            onTap: () {
                              _navigateToDrawerScreen(
                                'Edit Profile',
                                const DrawerPlaceholderScreen(
                                  title: 'Edit Profile',
                                ),
                              );
                            },
                            borderRadius: BorderRadius.circular(20),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 7,
                              ),
                              child: Text(
                                'Edit Profile',
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                  letterSpacing: 0.2,
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
            const Divider(height: 1, thickness: 1, color: _drawerDivider),
            Flexible(
              child: ListView(
                physics: const ClampingScrollPhysics(),
                padding: const EdgeInsets.only(top: 4, bottom: 12),
                children: [
                  ExpansionTile(
                    iconColor: _primaryBrown,
                    collapsedIconColor: _primaryBrown,
                    leading: Icon(
                      Icons.local_shipping_outlined,
                      color: _primaryBrown,
                      size: 22,
                    ),
                    title: Text(
                      'Pet Supply Order',
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: _primaryBrown,
                      ),
                    ),
                    tilePadding: const EdgeInsets.symmetric(horizontal: 12),
                    childrenPadding: EdgeInsets.zero,
                    children: [
                      _drawerSubItem(
                        icon: Icons.home_outlined,
                        label: 'Home',
                        active: _currentIndex == 2,
                        onTap: () => _goToTab(2),
                      ),
                      _drawerSubItem(
                        icon: Icons.history_rounded,
                        label: 'Order History',
                        active: false,
                        onTap: () => _closeDrawerAndPush(
                          const MyOrdersScreen(
                            listMode: MyOrdersListMode.historyOnly,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 1, thickness: 1, color: _drawerDivider),
                  ExpansionTile(
                    iconColor: _primaryBrown,
                    collapsedIconColor: _primaryBrown,
                    leading: Icon(
                      Icons.event_available_outlined,
                      color: _primaryBrown,
                      size: 22,
                    ),
                    title: Text(
                      'Appointments',
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: _primaryBrown,
                      ),
                    ),
                    tilePadding: const EdgeInsets.symmetric(horizontal: 12),
                    childrenPadding: EdgeInsets.zero,
                    children: [
                      _drawerSubItem(
                        icon: Icons.home_outlined,
                        label: 'Home',
                        active: _currentIndex == 1,
                        onTap: () => _goToTab(1),
                      ),
                      _drawerSubItem(
                        icon: Icons.history_rounded,
                        label: 'Appointments History',
                        active: false,
                        onTap: () => _closeDrawerAndPush(const MyRequestsScreen()),
                      ),
                    ],
                  ),
                  const Divider(height: 1, thickness: 1, color: _drawerDivider),
                  ExpansionTile(
                    iconColor: _primaryBrown,
                    collapsedIconColor: _primaryBrown,
                    leading: Icon(
                      Icons.cottage_outlined,
                      color: _primaryBrown,
                      size: 22,
                    ),
                    title: Text(
                      'Pet Hostel',
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: _primaryBrown,
                      ),
                    ),
                    tilePadding: const EdgeInsets.symmetric(horizontal: 12),
                    childrenPadding: EdgeInsets.zero,
                    children: [
                      _drawerSubItem(
                        icon: Icons.home_outlined,
                        label: 'Home',
                        active: _currentIndex == 4,
                        onTap: () => _goToTab(4),
                      ),
                      _drawerSubItem(
                        icon: Icons.history_rounded,
                        label: 'Booking History',
                        active: false,
                        onTap: () => _closeDrawerAndPush(
                          const MyCareBookingsScreen(),
                        ),
                      ),
                    ],
                  ),
                  _drawerUtilityTile(
                    icon: Icons.phone_in_talk_outlined,
                    label: 'Contact Us',
                    onTap: () => _closeDrawerAndPush(
                      const DrawerPlaceholderScreen(title: 'Contact Us'),
                    ),
                  ),
                  _drawerUtilityTile(
                    icon: Icons.notifications_none_rounded,
                    label: 'Notifications',
                    onTap: () => _closeDrawerAndPush(
                      const DrawerPlaceholderScreen(title: 'Notifications'),
                    ),
                  ),
                  _drawerUtilityTile(
                    icon: Icons.help_outline_rounded,
                    label: 'FAQs',
                    onTap: () => _closeDrawerAndPush(
                      const DrawerPlaceholderScreen(title: 'FAQs'),
                    ),
                  ),
                  _drawerUtilityTile(
                    icon: Icons.star_border_rounded,
                    label: 'Rate our app',
                    onTap: () => _closeDrawerAndPush(
                      const DrawerPlaceholderScreen(title: 'Rate our app'),
                    ),
                  ),
                  if (kDebugMode) ...[
                    const Divider(height: 20, thickness: 1, color: _drawerDivider),
                    _drawerUtilityTile(
                      icon: Icons.build_outlined,
                      label: 'Auth test (debug)',
                      onTap: () => _closeDrawerAndPush(
                        const DrawerPlaceholderScreen(title: 'Auth test'),
                      ),
                    ),
                    _drawerUtilityTile(
                      icon: Icons.g_mobiledata_rounded,
                      label: 'Google Sign-In test',
                      onTap: () => _closeDrawerAndPush(
                        const DrawerPlaceholderScreen(
                          title: 'Google Sign-In test',
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  _drawerUtilityTile(
                    icon: Icons.logout_rounded,
                    label: 'Sign out',
                    onTap: () {
                      Navigator.pop(context);
                      _handleLogout();
                    },
                    iconColor: Colors.red.shade700,
                    labelColor: Colors.red.shade800,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawerUtilityTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? iconColor,
    Color? labelColor,
  }) {
    final ic = iconColor ?? _primaryBrown;
    final lc = labelColor ?? _primaryBrown;
    return Column(
      children: [
        const Divider(height: 1, thickness: 1, color: _drawerDivider),
        ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          leading: Icon(icon, color: ic, size: 22),
          title: Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: lc,
            ),
          ),
          onTap: onTap,
        ),
      ],
    );
  }

  Widget _drawerSubItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    required bool active,
  }) {
    return Padding(
      padding: const EdgeInsets.only(left: 8, right: 8, bottom: 2),
      child: Material(
        color: active
            ? _primaryBrown.withValues(alpha: 0.1)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: active
                  ? const Border(
                      left: BorderSide(color: _primaryBrown, width: 3),
                    )
                  : null,
            ),
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
            child: Row(
              children: [
                const SizedBox(width: 20),
                Icon(icon, color: _subInk, size: 20),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    label,
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: _subInk,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
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
        return const MessagesHubScreen();
      case 4:
        return CareScreen(
          onOpenMainDrawer: () => _shellScaffoldKey.currentState?.openDrawer(),
        );
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
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  color: Colors.white.withValues(alpha: 0.9),
                                ),
                              ),
                              Text(
                                _userName,
                                style: GoogleFonts.outfit(
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
                                style: GoogleFonts.outfit(
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
                                style: GoogleFonts.outfit(
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
                          style: GoogleFonts.outfit(
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
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          color: Colors.grey[600],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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
                                style: GoogleFonts.outfit(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(AppConstants.accentColor),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Add your first pet to get started!',
                                style: GoogleFonts.outfit(
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
      decoration: const BoxDecoration(color: Colors.white),
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
            selectedLabelStyle: GoogleFonts.outfit(
              fontSize: 9,
              fontWeight: FontWeight.w600,
            ),
            unselectedLabelStyle: GoogleFonts.outfit(
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
      key: _shellScaffoldKey,
      resizeToAvoidBottomInset: true,
      backgroundColor: _currentIndex == 4
          ? const Color(0xFFF8F9FA)
          : const Color(AppConstants.secondaryColor),
      drawer: _buildDrawer(context),
      appBar: AppBar(
        centerTitle: false,
        leading: Builder(
          builder: (BuildContext ctx) {
            return IconButton(
              icon: const Icon(Icons.menu, size: 22),
              onPressed: () {
                Scaffold.of(ctx).openDrawer();
              },
              color: Colors.black87,
            );
          },
        ),
        title: Row(
          children: [
            const PawSewaBrandLogo(height: 26),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    AppConstants.appName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Colors.black87,
                    ),
                  ),
                  Text(
                    _titleForIndex(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: const Color(AppConstants.primaryColor),
                    ),
                  ),
                ],
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
          Consumer<ChatUnreadNotifyService>(
            builder: (context, unread, _) {
              final c = unread.totalUnread;
              final btn = IconButton(
                icon: Icon(
                  _currentIndex == 3
                      ? Icons.chat_bubble
                      : Icons.chat_bubble_outline,
                  color: _currentIndex == 3
                      ? const Color(AppConstants.primaryColor)
                      : Colors.grey[700],
                  size: 20,
                ),
                onPressed: () {
                  setState(() => _currentIndex = 3);
                },
                tooltip: 'Messages',
              );
              if (c <= 0) return btn;
              return Badge.count(
                count: c > 99 ? 99 : c,
                child: btn,
              );
            },
          ),
        ],
      ),
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: _currentIndex == 4
                ? const ColoredBox(color: Color(0xFFF8F9FA))
                : IgnorePointer(
                    child: EditorialCanvas(
                      variant: EditorialSurfaceVariant.customer,
                      child: const SizedBox.expand(),
                    ),
                  ),
          ),
          Positioned.fill(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              switchInCurve: Curves.easeInOut,
              switchOutCurve: Curves.easeInOut,
              transitionBuilder: (Widget child, Animation<double> animation) {
                return FadeTransition(opacity: animation, child: child);
              },
              child: KeyedSubtree(
                key: ValueKey<int>(_currentIndex),
                child: _buildCurrentTab(),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: _currentIndex == 0
          ? FloatingActionButton.extended(
              heroTag: 'fab_add_pet',
              onPressed: _navigateToAddPet,
              backgroundColor: const Color(AppConstants.primaryColor),
              icon: const Icon(Icons.add, color: Colors.white),
              label: Text(
                'Add Pet',
                style: GoogleFonts.outfit(
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
