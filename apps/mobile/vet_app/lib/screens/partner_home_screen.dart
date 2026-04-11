import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';
import '../core/partner_role.dart';
import '../core/storage_service.dart';
import '../widgets/partner_scaffold.dart';
import 'clinic_queue_screen.dart';
import 'earnings_screen.dart';
import 'patient_chats_screen.dart';
import 'partner_support_chat_screen.dart';
import 'notifications_screen.dart';
import 'rider_delivery_orders_screen.dart';
import 'rider_live_map_screen.dart';
import 'rider_history_screen.dart';
import 'seller_inquiries_screen.dart';
import 'seller_new_orders_screen.dart';
import 'shop_inventory_screen.dart';
import 'shop_analytics_screen.dart';
import 'vet_clinic_assignments_screen.dart';
import 'care_calendar_screen.dart';
import 'care_pet_records_screen.dart';
import 'care_staff_tasks_screen.dart';
import 'unified_inbox_screen.dart';
import 'login_screen.dart';
import 'my_business_screen.dart';
import 'profile_editor_screen.dart';

class PartnerHomeScreen extends StatefulWidget {
  const PartnerHomeScreen({super.key});

  @override
  State<PartnerHomeScreen> createState() => _PartnerHomeScreenState();
}

class _PartnerHomeScreenState extends State<PartnerHomeScreen> {
  final _storage = StorageService();

  String _role = PartnerRole.vet;
  int _tab = 0; // 0=Home, 1=Inbox, 2=Tasks, 3=Analytics, 4=Profile

  String _userName = 'Partner';
  String _userSubtitle = 'Staff';

  @override
  void initState() {
    super.initState();
    _hydrate();
  }

  Future<void> _hydrate() async {
    final user = await _storage.getUser();
    String name = _userName;
    String serverRole = '';
    if (user != null && user.trim().isNotEmpty) {
      try {
        final m = jsonDecode(user);
        if (m is Map) {
          name = (m['name'] ?? m['fullName'] ?? name).toString();
          serverRole = (m['role'] ?? '').toString();
        }
      } catch (_) {/* ignore */}
    }
    final allowed = allowedPartnerPanelsForServerRole(serverRole);
    var panel = await _storage.getActivePartnerRole();
    if (panel == null || !allowed.contains(panel)) {
      panel = defaultPartnerPanelForServerRole(serverRole);
      await _storage.setActivePartnerRole(panel);
    }
    if (!mounted) return;
    setState(() {
      _role = panel!;
      _userName = name;
      _userSubtitle = serverRole.isNotEmpty ? serverRole : _userSubtitle;
    });
  }

  Future<void> _setRole(String role) async {
    if (role == _role) return;
    final allowed = allowedPartnerPanelsForServerRole(_userSubtitle);
    if (!allowed.contains(role)) return;
    await _storage.setActivePartnerRole(role);
    if (!mounted) return;
    setState(() {
      _role = role;
      _tab = 0;
    });
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final roleLabel = switch (_role) {
      PartnerRole.vet => 'Vet panel',
      PartnerRole.rider => 'Rider panel',
      PartnerRole.seller => 'Seller panel',
      _ => 'Care panel',
    };

    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      body: SafeArea(
        top: false,
        child: IndexedStack(
          index: _tab,
          children: [
            _RoleHome(
              role: _role,
              roleLabel: roleLabel,
              userName: _userName,
              userSubtitle: _userSubtitle,
              canSwitchPanel:
                  allowedPartnerPanelsForServerRole(_userSubtitle).length > 1,
              onRoleTap: () => _showRoleSheet(context),
              onOpen: (screen) => _push(context, screen),
            ),
            _InboxHub(
              role: _role,
              onOpen: (screen) => _push(context, screen),
            ),
            _TasksHub(
              role: _role,
              onOpen: (screen) => _push(context, screen),
            ),
            _AnalyticsHub(
              role: _role,
              onOpen: (screen) => _push(context, screen),
            ),
            _ProfileHub(
              role: _role,
              name: _userName,
              subtitle: _userSubtitle,
              canSwitchPanel:
                  allowedPartnerPanelsForServerRole(_userSubtitle).length > 1,
              onRoleTap: () => _showRoleSheet(context),
              onOpen: (screen) => _push(context, screen),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_rounded), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.inbox_rounded), label: 'Inbox'),
          NavigationDestination(icon: Icon(Icons.task_alt_rounded), label: 'Tasks'),
          NavigationDestination(icon: Icon(Icons.query_stats_rounded), label: 'Analytics'),
          NavigationDestination(icon: Icon(Icons.person_rounded), label: 'Profile'),
        ],
      ),
    );
  }

  Future<void> _showRoleSheet(BuildContext context) async {
    final primary = Theme.of(context).colorScheme.primary;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (sheetCtx) {
        final allowed = allowedPartnerPanelsForServerRole(_userSubtitle);
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Switch panel',
                style: GoogleFonts.fraunces(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: const Color(AppConstants.inkColor),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Only panels that match your PawSewa account role are shown.',
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: const Color(AppConstants.inkColor).withValues(alpha: 0.70),
                ),
              ),
              const SizedBox(height: 14),
              if (allowed.contains(PartnerRole.vet))
                _RoleTile(
                  selected: _role == PartnerRole.vet,
                  icon: Icons.medical_services_rounded,
                  title: 'Vet',
                  subtitle: 'Queue · visits · prescriptions · calls',
                  primary: primary,
                  onTap: () {
                    Navigator.pop(sheetCtx);
                    _setRole(PartnerRole.vet);
                  },
                ),
              if (allowed.contains(PartnerRole.rider))
                _RoleTile(
                  selected: _role == PartnerRole.rider,
                  icon: Icons.delivery_dining_rounded,
                  title: 'Rider',
                  subtitle: 'Jobs · live map · proof of delivery',
                  primary: primary,
                  onTap: () {
                    Navigator.pop(sheetCtx);
                    _setRole(PartnerRole.rider);
                  },
                ),
              if (allowed.contains(PartnerRole.seller))
                _RoleTile(
                  selected: _role == PartnerRole.seller,
                  icon: Icons.storefront_rounded,
                  title: 'Seller',
                  subtitle: 'Orders · inventory · analytics',
                  primary: primary,
                  onTap: () {
                    Navigator.pop(sheetCtx);
                    _setRole(PartnerRole.seller);
                  },
                ),
              if (allowed.contains(PartnerRole.care))
                _RoleTile(
                  selected: _role == PartnerRole.care,
                  icon: Icons.home_work_rounded,
                  title: 'Care centre',
                  subtitle: 'Bookings · calendar · intake records',
                  primary: primary,
                  onTap: () {
                    Navigator.pop(sheetCtx);
                    _setRole(PartnerRole.care);
                  },
                ),
            ],
          ),
        );
      },
    );
  }
}

class _RoleTile extends StatelessWidget {
  const _RoleTile({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.primary,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final Color primary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ink = const Color(AppConstants.inkColor);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: selected ? primary.withValues(alpha: 0.08) : const Color(0xFFF8F7F5),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: primary.withValues(alpha: 0.14)),
                  ),
                  child: Icon(icon, color: primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.outfit(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: GoogleFonts.outfit(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                          color: ink.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Icon(
                  selected ? Icons.check_circle_rounded : Icons.chevron_right_rounded,
                  color: selected ? primary : ink.withValues(alpha: 0.45),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleHome extends StatelessWidget {
  const _RoleHome({
    required this.role,
    required this.roleLabel,
    required this.userName,
    required this.userSubtitle,
    required this.canSwitchPanel,
    required this.onRoleTap,
    required this.onOpen,
  });

  final String role;
  final String roleLabel;
  final String userName;
  final String userSubtitle;
  final bool canSwitchPanel;
  final VoidCallback onRoleTap;
  final void Function(Widget screen) onOpen;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);

    final actions = <Widget>[
      if (canSwitchPanel)
        IconButton(
          tooltip: 'Switch panel',
          onPressed: onRoleTap,
          icon: const Icon(Icons.swap_horiz_rounded),
        ),
    ];

    final tiles = switch (role) {
      PartnerRole.vet => <_ActionTileModel>[
          _ActionTileModel(
            icon: Icons.event_note_rounded,
            title: 'Clinic appointments',
            subtitle: 'Admin assignments · start · complete',
            onTap: () => onOpen(const VetClinicAssignmentsScreen()),
          ),
          _ActionTileModel(
            icon: Icons.groups_rounded,
            title: 'Clinic queue',
            subtitle: 'Triage → diagnosis → prescribed',
            onTap: () => onOpen(const ClinicQueueScreen()),
          ),
          _ActionTileModel(
            icon: Icons.chat_bubble_rounded,
            title: 'Patient chats',
            subtitle: 'Messages + media',
            onTap: () => onOpen(const PatientChatsScreen()),
          ),
          _ActionTileModel(
            icon: Icons.business_center_rounded,
            title: 'My business',
            subtitle: 'Services · bookings · billing',
            onTap: () => onOpen(const MyBusinessScreen()),
          ),
          _ActionTileModel(
            icon: Icons.attach_money_rounded,
            title: 'Earnings',
            subtitle: 'Daily & monthly view',
            onTap: () => onOpen(const EarningsScreen()),
          ),
        ],
      PartnerRole.rider => <_ActionTileModel>[
          _ActionTileModel(
            icon: Icons.local_shipping_rounded,
            title: 'Delivery jobs',
            subtitle: 'Accept → pickup → deliver',
            onTap: () => onOpen(const RiderDeliveryOrdersScreen()),
          ),
          _ActionTileModel(
            icon: Icons.map_rounded,
            title: 'Live map',
            subtitle: 'Share GPS while on duty',
            onTap: () => onOpen(const RiderLiveMapScreen()),
          ),
          _ActionTileModel(
            icon: Icons.history_rounded,
            title: 'History',
            subtitle: 'Delivered drops & receipts',
            onTap: () => onOpen(const RiderHistoryScreen()),
          ),
          _ActionTileModel(
            icon: Icons.support_agent_rounded,
            title: 'Support',
            subtitle: 'Partner customer care',
            onTap: () => onOpen(const PartnerSupportChatScreen()),
          ),
        ],
      PartnerRole.seller => <_ActionTileModel>[
          _ActionTileModel(
            icon: Icons.inventory_2_rounded,
            title: 'Inventory',
            subtitle: 'Stock · products · categories',
            onTap: () => onOpen(const ShopInventoryScreen()),
          ),
          _ActionTileModel(
            icon: Icons.query_stats_rounded,
            title: 'Shop analytics',
            subtitle: 'KPIs & low stock',
            onTap: () => onOpen(const ShopAnalyticsScreen()),
          ),
          _ActionTileModel(
            icon: Icons.question_answer_rounded,
            title: 'Customer inquiries',
            subtitle: 'Chats & questions',
            onTap: () => onOpen(const SellerInquiriesScreen()),
          ),
          _ActionTileModel(
            icon: Icons.notifications_rounded,
            title: 'Notifications',
            subtitle: 'Assignments & alerts',
            onTap: () => onOpen(const NotificationsScreen()),
          ),
        ],
      _ => <_ActionTileModel>[
          _ActionTileModel(
            icon: Icons.calendar_month_rounded,
            title: 'Care calendar',
            subtitle: 'Upcoming bookings',
            onTap: () => onOpen(const CareCalendarScreen()),
          ),
          _ActionTileModel(
            icon: Icons.pets_rounded,
            title: 'Pet records',
            subtitle: 'Owner contacts & intake',
            onTap: () => onOpen(const CarePetRecordsScreen()),
          ),
          _ActionTileModel(
            icon: Icons.checklist_rounded,
            title: 'Staff tasks',
            subtitle: 'Cleaning, walks, grooming',
            onTap: () => onOpen(const CareStaffTasksScreen()),
          ),
          _ActionTileModel(
            icon: Icons.support_agent_rounded,
            title: 'Support',
            subtitle: 'Partner customer care',
            onTap: () => onOpen(const PartnerSupportChatScreen()),
          ),
          _ActionTileModel(
            icon: Icons.notifications_rounded,
            title: 'Notifications',
            subtitle: 'Bookings & updates',
            onTap: () => onOpen(const NotificationsScreen()),
          ),
        ],
    };

    return PartnerScaffold(
      title: 'PawSewa Partner',
      subtitle: roleLabel,
      actions: actions,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 16,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Icon(Icons.badge_rounded, color: primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        userName,
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        userSubtitle,
                        style: GoogleFonts.outfit(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                          color: ink.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: onRoleTap,
                  style: FilledButton.styleFrom(
                    backgroundColor: primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(
                    'Switch',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _ActionGrid(tiles: tiles),
        ],
      ),
    );
  }
}

class _ActionTileModel {
  _ActionTileModel({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
}

class _ActionGrid extends StatelessWidget {
  const _ActionGrid({required this.tiles});
  final List<_ActionTileModel> tiles;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.06,
      ),
      itemCount: tiles.length,
      itemBuilder: (context, i) {
        final t = tiles[i];
        return Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: t.onTap,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: primary.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(t.icon, color: primary),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    t.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Expanded(
                    child: Text(
                      t.subtitle,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.outfit(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                        height: 1.25,
                        color: ink.withValues(alpha: 0.65),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Text(
                        'Open',
                        style: GoogleFonts.outfit(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: primary,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.arrow_forward_rounded, size: 16, color: primary),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _InboxHub extends StatelessWidget {
  const _InboxHub({required this.role, required this.onOpen});
  final String role;
  final void Function(Widget screen) onOpen;

  @override
  Widget build(BuildContext context) {
    final tiles = <_HubTile>[
      _HubTile(
        icon: Icons.chat_bubble_rounded,
        title: 'Unified inbox',
        subtitle: 'Customer chats, support, calls, notifications',
        onTap: () => onOpen(const UnifiedInboxScreen()),
      ),
      _HubTile(
        icon: Icons.support_agent_rounded,
        title: 'Partner support',
        subtitle: 'Customer care for partners',
        onTap: () => onOpen(const PartnerSupportChatScreen()),
      ),
      _HubTile(
        icon: Icons.notifications_rounded,
        title: 'Notifications',
        subtitle: 'Assignments, booking updates, system alerts',
        onTap: () => onOpen(const NotificationsScreen()),
      ),
    ];

    return _HubScaffold(
      title: 'Inbox',
      subtitle: 'Messages and updates',
      tiles: tiles,
    );
  }
}

class _TasksHub extends StatelessWidget {
  const _TasksHub({required this.role, required this.onOpen});
  final String role;
  final void Function(Widget screen) onOpen;

  @override
  Widget build(BuildContext context) {
    final tiles = switch (role) {
      PartnerRole.vet => <_HubTile>[
          _HubTile(
            icon: Icons.groups_rounded,
            title: 'Clinic queue',
            subtitle: 'Triage and complete visits',
            onTap: () => onOpen(const ClinicQueueScreen()),
          ),
        ],
      PartnerRole.rider => <_HubTile>[
          _HubTile(
            icon: Icons.local_shipping_rounded,
            title: 'Delivery jobs',
            subtitle: 'Assigned orders + status flow',
            onTap: () => onOpen(const RiderDeliveryOrdersScreen()),
          ),
          _HubTile(
            icon: Icons.map_rounded,
            title: 'Live map',
            subtitle: 'Location sharing while on duty',
            onTap: () => onOpen(const RiderLiveMapScreen()),
          ),
        ],
      PartnerRole.seller => <_HubTile>[
          _HubTile(
            icon: Icons.receipt_long_rounded,
            title: 'New orders',
            subtitle: 'Confirm stock & ready for rider',
            onTap: () => onOpen(const SellerNewOrdersScreen()),
          ),
          _HubTile(
            icon: Icons.inventory_2_rounded,
            title: 'Inventory',
            subtitle: 'Products, stock, categories',
            onTap: () => onOpen(const ShopInventoryScreen()),
          ),
          _HubTile(
            icon: Icons.question_answer_rounded,
            title: 'Customer inquiries',
            subtitle: 'Questions and chats',
            onTap: () => onOpen(const SellerInquiriesScreen()),
          ),
        ],
      _ => <_HubTile>[
          _HubTile(
            icon: Icons.calendar_month_rounded,
            title: 'Bookings calendar',
            subtitle: 'Upcoming check-ins/outs',
            onTap: () => onOpen(const CareCalendarScreen()),
          ),
          _HubTile(
            icon: Icons.pets_rounded,
            title: 'Pet records',
            subtitle: 'Intake, owner contacts, notes',
            onTap: () => onOpen(const CarePetRecordsScreen()),
          ),
        ],
    };

    return _HubScaffold(
      title: 'Tasks',
      subtitle: 'Operational work for your role',
      tiles: tiles,
    );
  }
}

class _AnalyticsHub extends StatelessWidget {
  const _AnalyticsHub({required this.role, required this.onOpen});
  final String role;
  final void Function(Widget screen) onOpen;

  @override
  Widget build(BuildContext context) {
    final tiles = switch (role) {
      PartnerRole.vet => <_HubTile>[
          _HubTile(
            icon: Icons.attach_money_rounded,
            title: 'Earnings',
            subtitle: 'Daily & monthly breakdowns',
            onTap: () => onOpen(const EarningsScreen()),
          ),
          _HubTile(
            icon: Icons.business_center_rounded,
            title: 'My business',
            subtitle: 'Billing, services, bookings',
            onTap: () => onOpen(const MyBusinessScreen()),
          ),
        ],
      PartnerRole.rider => <_HubTile>[
          _HubTile(
            icon: Icons.history_rounded,
            title: 'History',
            subtitle: 'Delivered drops and receipts',
            onTap: () => onOpen(const RiderHistoryScreen()),
          ),
          _HubTile(
            icon: Icons.attach_money_rounded,
            title: 'Earnings',
            subtitle: 'Delivery earnings view',
            onTap: () => onOpen(const EarningsScreen()),
          ),
        ],
      PartnerRole.seller => <_HubTile>[
          _HubTile(
            icon: Icons.query_stats_rounded,
            title: 'Shop analytics',
            subtitle: 'KPIs and low stock',
            onTap: () => onOpen(const ShopAnalyticsScreen()),
          ),
        ],
      _ => <_HubTile>[
          _HubTile(
            icon: Icons.calendar_month_rounded,
            title: 'Calendar',
            subtitle: 'Upcoming bookings agenda',
            onTap: () => onOpen(const CareCalendarScreen()),
          ),
        ],
    };

    return _HubScaffold(
      title: 'Analytics',
      subtitle: 'Performance insights',
      tiles: tiles,
    );
  }
}

class _ProfileHub extends StatefulWidget {
  const _ProfileHub({
    required this.role,
    required this.name,
    required this.subtitle,
    required this.canSwitchPanel,
    required this.onRoleTap,
    required this.onOpen,
  });

  final String role;
  final String name;
  final String subtitle;
  final bool canSwitchPanel;
  final VoidCallback onRoleTap;
  final void Function(Widget screen) onOpen;

  @override
  State<_ProfileHub> createState() => _ProfileHubState();
}

class _ProfileHubState extends State<_ProfileHub> {
  final _storage = StorageService();

  String _name = '';
  String _email = '';
  String _phone = '';
  String _role = '';
  String _specialty = '';
  String _bio = '';
  String? _profilePicUrl;
  bool _isProfileComplete = false;

  @override
  void initState() {
    super.initState();
    _name = widget.name;
    _role = widget.subtitle;
    _loadProfile();
  }

  @override
  void didUpdateWidget(_ProfileHub old) {
    super.didUpdateWidget(old);
    if (old.name != widget.name || old.subtitle != widget.subtitle) {
      setState(() {
        _name = widget.name;
        _role = widget.subtitle;
      });
    }
  }

  Future<void> _loadProfile() async {
    final raw = await _storage.getUser();
    if (raw == null || raw.trim().isEmpty) return;
    try {
      final m = jsonDecode(raw);
      if (m is Map && mounted) {
        setState(() {
          _name = (m['name'] ?? m['fullName'] ?? _name).toString();
          _email = (m['email'] ?? '').toString();
          _phone = (m['phone'] ?? '').toString();
          _role = (m['role'] ?? _role).toString();
          _specialty = (m['specialty'] ?? m['specialization'] ?? '').toString();
          _bio = (m['bio'] ?? '').toString();
          _profilePicUrl = m['profilePicture']?.toString();
          _isProfileComplete = m['isProfileComplete'] == true;
        });
      }
    } catch (_) {}
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Log out?', style: GoogleFonts.fraunces(fontWeight: FontWeight.w600)),
        content: Text(
          'You will be signed out of your PawSewa partner account.',
          style: GoogleFonts.outfit(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: GoogleFonts.outfit()),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade600,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Log out', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _storage.clearAll();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);

    final roleColor = switch (_role.toLowerCase()) {
      'vet' || 'veterinarian' => const Color(0xFF2E7D32),
      'rider' || 'delivery' => const Color(0xFF1565C0),
      'seller' || 'shop_owner' => const Color(0xFF6A1B9A),
      _ => primary,
    };

    return PartnerScaffold(
      title: 'Profile',
      subtitle: 'Account & preferences',
      actions: [
        if (widget.canSwitchPanel)
          IconButton(
            tooltip: 'Switch panel',
            onPressed: widget.onRoleTap,
            icon: const Icon(Icons.swap_horiz_rounded),
          ),
      ],
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // ── Profile hero card ────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
              boxShadow: [
                BoxShadow(
                  color: primary.withValues(alpha: 0.06),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    // Avatar
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: primary.withValues(alpha: 0.12),
                      backgroundImage: (_profilePicUrl != null && _profilePicUrl!.isNotEmpty)
                          ? NetworkImage(_profilePicUrl!)
                          : null,
                      child: (_profilePicUrl == null || _profilePicUrl!.isEmpty)
                          ? Icon(Icons.person_rounded, size: 38, color: primary)
                          : null,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _name.isNotEmpty ? _name : 'Partner',
                            style: GoogleFonts.fraunces(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: ink,
                            ),
                          ),
                          const SizedBox(height: 4),
                          // Role badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: roleColor.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: roleColor.withValues(alpha: 0.25)),
                            ),
                            child: Text(
                              _role.isNotEmpty ? _role.toUpperCase() : 'PARTNER',
                              style: GoogleFonts.outfit(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: roleColor,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ),
                          if (_isProfileComplete) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(Icons.verified_rounded, size: 13, color: Colors.green.shade600),
                                const SizedBox(width: 4),
                                Text(
                                  'Profile verified',
                                  style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    color: Colors.green.shade600,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                // Info rows
                if (_email.isNotEmpty || _phone.isNotEmpty || _specialty.isNotEmpty || _bio.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Divider(height: 1),
                  const SizedBox(height: 12),
                  if (_email.isNotEmpty)
                    _InfoRow(icon: Icons.email_outlined, label: 'Email', value: _email),
                  if (_phone.isNotEmpty)
                    _InfoRow(icon: Icons.phone_outlined, label: 'Phone', value: _phone),
                  if (_specialty.isNotEmpty)
                    _InfoRow(icon: Icons.medical_services_outlined, label: 'Specialty', value: _specialty),
                  if (_bio.isNotEmpty)
                    _InfoRow(icon: Icons.info_outline_rounded, label: 'Bio', value: _bio),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),

          // ── Settings tiles ───────────────────────────────────────────────
          _SectionLabel('Account'),
          const SizedBox(height: 8),
          _SettingsTile(
            icon: Icons.edit_rounded,
            title: 'Edit profile',
            subtitle: 'Name, photo, specialty & bio',
            onTap: () {
              widget.onOpen(const ProfileEditorScreen());
              // Reload after returning (via a short delay so push completes)
              Future.delayed(const Duration(milliseconds: 800), _loadProfile);
            },
          ),
          if (widget.canSwitchPanel)
            _SettingsTile(
              icon: Icons.swap_horiz_rounded,
              title: 'Switch panel',
              subtitle: 'Vet · Rider · Seller · Care',
              onTap: widget.onRoleTap,
            ),
          _SettingsTile(
            icon: Icons.notifications_rounded,
            title: 'Notifications',
            subtitle: 'Updates and alerts',
            onTap: () => widget.onOpen(const NotificationsScreen()),
          ),
          const SizedBox(height: 18),

          // ── Info card (replaces PartnerEmptyState to avoid layout crash) ─
          _SectionLabel('Compliance & payouts'),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(Icons.verified_user_outlined, color: primary, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'KYC & banking',
                        style: GoogleFonts.outfit(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: ink,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'KYC and payout banking are coordinated with PawSewa support when you enable paid payouts on your partner account.',
                        style: GoogleFonts.outfit(
                          fontSize: 12.5,
                          height: 1.4,
                          color: ink.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ── Logout button ────────────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton.icon(
              onPressed: _logout,
              icon: Icon(Icons.logout_rounded, color: Colors.red.shade600),
              label: Text(
                'Log out',
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Colors.red.shade600,
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Colors.red.shade200, width: 1.5),
                backgroundColor: Colors.red.shade50,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HubTile {
  _HubTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
}

class _HubScaffold extends StatelessWidget {
  const _HubScaffold({
    required this.title,
    required this.subtitle,
    required this.tiles,
  });

  final String title;
  final String subtitle;
  final List<_HubTile> tiles;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);

    return PartnerScaffold(
      title: title,
      subtitle: subtitle,
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
        itemCount: tiles.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final t = tiles[i];
          return Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: t.onTap,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: primary.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(t.icon, color: primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t.title,
                            style: GoogleFonts.outfit(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w800,
                              color: ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            t.subtitle,
                            style: GoogleFonts.outfit(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w500,
                              color: ink.withValues(alpha: 0.65),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Icon(Icons.chevron_right_rounded, color: ink.withValues(alpha: 0.45)),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        text.toUpperCase(),
        style: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: const Color(AppConstants.inkColor).withValues(alpha: 0.45),
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    final ink = const Color(AppConstants.inkColor);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: ink.withValues(alpha: 0.45)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: ink.withValues(alpha: 0.45),
                    letterSpacing: 0.3,
                  ),
                ),
                Text(
                  value,
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: ink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(icon, color: primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.outfit(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: GoogleFonts.outfit(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                          color: ink.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Icon(Icons.chevron_right_rounded, color: ink.withValues(alpha: 0.45)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

