import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/storage_service.dart';
import '../models/pet.dart';
import '../services/pet_service.dart';
import 'login_screen.dart';
import 'my_requests_screen.dart';
import 'services/services_screen.dart';
import 'shop/shop_screen.dart';
import 'shop/my_orders_screen.dart';
import 'care/my_care_bookings_screen.dart';
import 'care/my_care_requests_screen.dart';
import 'messages/messages_hub_screen.dart';
import 'care/care_screen.dart';
import 'care/my_clinic_appointments_screen.dart';
import 'care/vet_clinic_booking_screen.dart';
import 'my_pets/my_pets_screen.dart';
import 'owner_profile_screen.dart';
import 'home_screen.dart';
import 'notifications_screen.dart';
import 'support/contact_us_screen.dart';
import 'support/faq_screen.dart';
import 'support/rate_feedback_screen.dart';
import 'settings_screen.dart';
import '../services/socket_service.dart';
import '../services/chat_unread_notify_service.dart';
import '../services/notification_unread_notify_service.dart';
import '../services/push_notification_service.dart';
import '../services/ongoing_call_service.dart';
import '../widgets/pawsewa_brand_logo.dart';

class PetDashboardScreen extends StatefulWidget {
  const PetDashboardScreen({super.key});

  @override
  State<PetDashboardScreen> createState() => _PetDashboardScreenState();
}

class _PetDashboardScreenState extends State<PetDashboardScreen>
    with WidgetsBindingObserver {
  final _petService = PetService();
  final _storage = StorageService();
  final _api = ApiClient();
  final GlobalKey<ScaffoldState> _shellScaffoldKey = GlobalKey<ScaffoldState>();

  List<Pet> _pets = [];
  bool _isLoading = true;
  String _userName = 'Pet Owner';
  String? _userAvatarUrl;
  int _currentIndex = 0;
  int _lastBottomBarIndex = 0; // when on Messages, bottom bar shows this

  /// Sub-tab for [ServicesScreen] (0 Upcoming … 3 Clinics). Reset when opening Services from the bottom bar.
  int _servicesInitialTab = 0;

  /// Selected pet on Home tab (drives `GET /pets/home-dashboard/:petId`).
  int _homePetIndex = 0;

  /// When Home opens Shop, optionally jump to a category.
  String? _shopInitialCategorySlug;
  String? _shopInitialCategoryName;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadUserData();
    _loadPets();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      unawaited(context.read<NotificationUnreadNotifyService>().refreshFromApi());
    });
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
      if (mounted) {
        unawaited(context.read<NotificationUnreadNotifyService>().refreshFromApi());
      }
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

  /// Sync name and avatar from `GET /users/profile` (Mongo `users` / pawsewa_chat.users).
  Future<void> _refreshUserProfileFromApi() async {
    try {
      final response = await _api.getUserProfile();
      if (response.statusCode != 200 || response.data is! Map) {
        return;
      }
      final root = response.data as Map;
      final data = root['data'];
      if (data is! Map) {
        return;
      }
      final m = Map<String, dynamic>.from(data);
      final name = m['name']?.toString();
      final pic = m['profilePicture']?.toString();
      final raw = await _storage.getUser();
      if (raw != null && raw.isNotEmpty) {
        try {
          final decoded = jsonDecode(raw);
          if (decoded is Map) {
            final um = Map<String, dynamic>.from(decoded);
            if (name != null && name.isNotEmpty) {
              um['name'] = name;
            }
            if (pic != null && pic.isNotEmpty) {
              um['profilePicture'] = pic;
            }
            await _storage.saveUser(jsonEncode(um));
          }
        } catch (_) {}
      }
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
    } catch (_) {}
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
        if (_homePetIndex >= _pets.length) {
          _homePetIndex = 0;
        }
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
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
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
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
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
    setState(() {
      _currentIndex = index;
    });
    Navigator.pop(context);
  }

  /// Opens [ServicesScreen] with sub-tab `index` (0–3). Closes the drawer when open.
  void _goToServicesTab(int index) {
    setState(() {
      _servicesInitialTab = index.clamp(0, 3);
      _currentIndex = 1;
    });
    Navigator.pop(context);
  }

  void _closeDrawerAndPush(Widget screen) {
    Navigator.pop(context);
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
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
    final maxW = MediaQuery.sizeOf(context).width;
    final drawerW = math.min(maxW * 0.88, 320.0);
    return Drawer(
      width: drawerW,
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
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
                            onTap: () async {
                              Navigator.pop(context);
                              final ok = await Navigator.push<bool>(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const OwnerProfileScreen(),
                                ),
                              );
                              if (ok == true && mounted) {
                                await _loadUserData();
                                await _refreshUserProfileFromApi();
                              }
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
            Expanded(
              child: ListView(
                physics: const ClampingScrollPhysics(),
                padding: const EdgeInsets.only(top: 4, bottom: 12),
                children: [
                  ExpansionTile(
                    iconColor: _primaryBrown,
                    collapsedIconColor: _primaryBrown,
                    shape: const Border(),
                    collapsedShape: const Border(),
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
                        onTap: () {
                          _goToTab(2);
                        },
                      ),
                      _drawerSubItem(
                        icon: Icons.receipt_long_outlined,
                        label: 'Order History',
                        active: false,
                        onTap: () {
                          _closeDrawerAndPush(
                            const MyOrdersScreen(
                              listMode: MyOrdersListMode.historyOnly,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const Divider(height: 1, thickness: 1, color: _drawerDivider),
                  ExpansionTile(
                    iconColor: _primaryBrown,
                    collapsedIconColor: _primaryBrown,
                    shape: const Border(),
                    collapsedShape: const Border(),
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
                        onTap: () {
                          _goToServicesTab(0);
                        },
                      ),
                      _drawerSubItem(
                        icon: Icons.receipt_long_outlined,
                        label: 'Appointments History',
                        active: false,
                        onTap: () {
                          _closeDrawerAndPush(
                            const MyRequestsScreen(
                              initialFilterStatus: 'completed',
                            ),
                          );
                        },
                      ),
                      _drawerSubItem(
                        icon: Icons.vaccines_rounded,
                        label: 'Book vaccination / checkup',
                        active: false,
                        onTap: () {
                          _closeDrawerAndPush(const VetClinicBookingScreen());
                        },
                      ),
                      _drawerSubItem(
                        icon: Icons.event_available_outlined,
                        label: 'My clinic appointments',
                        active: false,
                        onTap: () {
                          _closeDrawerAndPush(const MyClinicAppointmentsScreen());
                        },
                      ),
                    ],
                  ),
                  const Divider(height: 1, thickness: 1, color: _drawerDivider),
                  ExpansionTile(
                    iconColor: _primaryBrown,
                    collapsedIconColor: _primaryBrown,
                    shape: const Border(),
                    collapsedShape: const Border(),
                    leading: Icon(
                      Icons.design_services_outlined,
                      color: _primaryBrown,
                      size: 22,
                    ),
                    title: Text(
                      'Care centre requests',
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
                        icon: Icons.content_cut_outlined,
                        label: 'Grooming requests',
                        active: false,
                        onTap: () {
                          _closeDrawerAndPush(
                            const MyCareRequestsScreen(
                              kind: CareRequestsKind.grooming,
                            ),
                          );
                        },
                      ),
                      _drawerSubItem(
                        icon: Icons.school_outlined,
                        label: 'Training requests',
                        active: false,
                        onTap: () {
                          _closeDrawerAndPush(
                            const MyCareRequestsScreen(
                              kind: CareRequestsKind.training,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const Divider(height: 1, thickness: 1, color: _drawerDivider),
                  ExpansionTile(
                    iconColor: _primaryBrown,
                    collapsedIconColor: _primaryBrown,
                    shape: const Border(),
                    collapsedShape: const Border(),
                    leading: Icon(
                      Icons.cottage_outlined,
                      color: _primaryBrown,
                      size: 22,
                    ),
                    title: Text(
                      'Care centres',
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
                        onTap: () {
                          _goToTab(4);
                        },
                      ),
                      _drawerSubItem(
                        icon: Icons.receipt_long_outlined,
                        label: 'Booking History',
                        active: false,
                        onTap: () {
                          _closeDrawerAndPush(
                            const MyCareBookingsScreen(
                              listMode: MyCareBookingsListMode.historyOnly,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  _drawerUtilityTile(
                    icon: Icons.tune_rounded,
                    label: 'Settings',
                    onTap: () {
                      _closeDrawerAndPush(const SettingsScreen());
                    },
                  ),
                  _drawerUtilityTile(
                    icon: Icons.phone_in_talk_outlined,
                    label: 'Contact Us',
                    onTap: () {
                      _closeDrawerAndPush(
                        const ContactUsScreen(),
                      );
                    },
                  ),
                  _drawerUtilityTile(
                    icon: Icons.notifications_none_rounded,
                    label: 'Notifications',
                    onTap: () {
                      _closeDrawerAndPush(
                        const NotificationsScreen(),
                      );
                    },
                  ),
                  _drawerUtilityTile(
                    icon: Icons.contact_support_outlined,
                    label: 'FAQs',
                    onTap: () {
                      _closeDrawerAndPush(
                        const FaqScreen(),
                      );
                    },
                  ),
                  _drawerUtilityTile(
                    icon: Icons.star_border_rounded,
                    label: 'Rate our app',
                    onTap: () {
                      _closeDrawerAndPush(
                        const RateFeedbackScreen(),
                      );
                    },
                  ),
                  const SizedBox(height: 12),
                  const Divider(height: 1, thickness: 1, color: _drawerDivider),
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                    leading: Icon(Icons.logout_rounded, color: Colors.red.shade700, size: 22),
                    title: Text(
                      'Sign out',
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Colors.red.shade800,
                      ),
                    ),
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
        return ServicesScreen(initialTabIndex: _servicesInitialTab);
      case 2:
        return ShopScreen(
          initialCategorySlug: _shopInitialCategorySlug,
          initialCategoryName: _shopInitialCategoryName,
        );
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
    return CustomerHomeScreen(
      pets: _pets,
      homePetIndex: _homePetIndex,
      onHomePetIndexChanged: (int i) {
        setState(() {
          _homePetIndex = i;
        });
      },
      onShowPetDetails: _showPetDetails,
      isLoadingPets: _isLoading,
      onRefreshPets: _loadPets,
      onOpenServicesTab: (int tab) {
        setState(() {
          _servicesInitialTab = tab;
          _currentIndex = 1;
        });
      },
      onOpenShopTab: ({String? categorySlug, String? categoryName}) {
        setState(() {
          _shopInitialCategorySlug = categorySlug;
          _shopInitialCategoryName = categoryName;
          _currentIndex = 2;
        });
      },
      onOpenCareTab: () {
        setState(() {
          _currentIndex = 4;
        });
      },
    );
  }

  PreferredSizeWidget _standardShellAppBar(BuildContext context) {
    return AppBar(
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
      title: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const PawSewaBrandLogo(height: 26),
            const SizedBox(width: 10),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: math.max(120, MediaQuery.sizeOf(context).width * 0.38),
              ),
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
      ),
      backgroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      iconTheme: const IconThemeData(color: Colors.black87),
      actions: [
        Consumer2<NotificationUnreadNotifyService, OngoingCallService>(
          builder: (context, nUnread, ongoing, _) {
            final bell = Stack(
              clipBehavior: Clip.none,
              children: [
                IconButton(
                  icon: const Icon(Icons.notifications_none_rounded, size: 22),
                  color: Colors.black87,
                  onPressed: () async {
                    await Navigator.push<void>(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => const NotificationsScreen(),
                      ),
                    );
                    if (context.mounted) {
                      unawaited(nUnread.refreshFromApi());
                    }
                  },
                  tooltip: 'Notifications',
                ),
                if (ongoing.active)
                  Positioned(
                    right: 2,
                    top: 4,
                    child: IgnorePointer(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.redAccent,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'LIVE',
                          style: GoogleFonts.outfit(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            );
            final c = nUnread.unreadCount;
            if (c <= 0) {
              return bell;
            }
            return Badge.count(
              count: c > 99 ? 99 : c,
              child: bell,
            );
          },
        ),
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
                setState(() {
                  _currentIndex = 3;
                });
              },
              tooltip: 'Messages',
            );
            if (c <= 0) {
              return btn;
            }
            return Badge.count(
              count: c > 99 ? 99 : c,
              child: btn,
            );
          },
        ),
      ],
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
    final barW = MediaQuery.sizeOf(context).width;
    final showAllLabels = barW >= 380;
    final labelSize = barW < 340 ? 8.0 : 9.0;
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
                if (index <= 2) {
                  _currentIndex = index;
                } else {
                  _currentIndex = index == 3 ? 4 : 5;
                }
                if (index == 1) {
                  _servicesInitialTab = 0;
                }
              });
            },
            backgroundColor: Colors.transparent,
            elevation: 0,
            selectedItemColor: primary,
            unselectedItemColor: Colors.grey[600],
            selectedLabelStyle: GoogleFonts.outfit(
              fontSize: labelSize,
              fontWeight: FontWeight.w600,
            ),
            unselectedLabelStyle: GoogleFonts.outfit(
              fontSize: labelSize,
              fontWeight: FontWeight.w500,
            ),
            showUnselectedLabels: showAllLabels,
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
      onDrawerChanged: (isOpened) {
        if (isOpened) {
          unawaited(_refreshUserProfileFromApi());
        }
      },
      backgroundColor: const Color(0xFFFFFFFF),
      drawer: _buildDrawer(context),
      // Use the same top nav style across all tabs (Home/Services/Shop/Care/My Pets).
      appBar: _standardShellAppBar(context),
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          const Positioned.fill(
            child: ColoredBox(color: Color(0xFFFFFFFF)),
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
                key: ValueKey<String>(
                  _currentIndex == 1
                      ? '1_${_servicesInitialTab.clamp(0, 3)}'
                      : '$_currentIndex',
                ),
                child: _buildCurrentTab(),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: null,
      bottomNavigationBar: _buildBottomNavBar(),
    );
  }
}
