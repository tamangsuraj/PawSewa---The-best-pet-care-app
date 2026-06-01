import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/partner_scaffold.dart';

/// Partner inbox: same `notifications` collection as customer app.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _api = ApiClient();
  List<Map<String, dynamic>> _items = [];
  int _unreadCount = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.getMyNotifications();
      if (!mounted) {
        return;
      }
      if (res.statusCode == 200 && res.data is Map) {
        final root = res.data as Map;
        final data = root['data'];
        if (data is Map) {
          final raw = data['items'];
          final unread = data['unreadCount'];
          final list = <Map<String, dynamic>>[];
          if (raw is List) {
            for (final e in raw) {
              if (e is Map) {
                list.add(Map<String, dynamic>.from(e));
              }
            }
          }
          setState(() {
            _items = list;
            _unreadCount = unread is int ? unread : int.tryParse('$unread') ?? 0;
            _loading = false;
          });
          return;
        }
      }
      setState(() {
        _error = 'Could not load notifications';
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = e.response?.data is Map
            ? (e.response!.data as Map)['message']?.toString() ?? 'Network error'
            : 'Network error';
        _loading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = 'Something went wrong';
        _loading = false;
      });
    }
  }

  Future<void> _markAllRead() async {
    try {
      await _api.markAllNotificationsRead();
      if (mounted) {
        await _load();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not mark all read')),
        );
      }
    }
  }

  Future<void> _tapItem(Map<String, dynamic> item) async {
    final id = item['_id']?.toString();
    final read = item['isRead'] == true;
    if (id == null || id.isEmpty) {
      return;
    }
    if (!read) {
      try {
        await _api.markNotificationRead(id);
      } catch (_) {}
    }
    if (mounted) {
      setState(() {
        item['isRead'] = true;
        if (_unreadCount > 0) {
          _unreadCount -= 1;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const brown = Color(AppConstants.primaryColor);
    final ink = const Color(AppConstants.inkColor);

    return PartnerScaffold(
      title: 'Notifications',
      subtitle: _unreadCount > 0 ? '$_unreadCount unread' : 'All caught up',
      actions: [
        if (_unreadCount > 0)
          TextButton(
            onPressed: _markAllRead,
            child: Text(
              'Mark all read',
              style: GoogleFonts.outfit(
                color: Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        IconButton(
          icon: const Icon(Icons.refresh_rounded),
          onPressed: _loading ? null : _load,
          tooltip: 'Refresh',
        ),
      ],
      body: Stack(
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: RefreshIndicator(
              color: brown,
              onRefresh: _load,
              child: _loading
                  ? const Center(child: PawSewaLoader())
                  : _error != null
                      ? PartnerEmptyState(
                          title: "Couldn't load notifications",
                          body: _error!,
                          icon: Icons.notifications_off_rounded,
                          primaryAction: OutlinedButton.icon(
                            onPressed: _load,
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Retry'),
                          ),
                        )
                      : _items.isEmpty
                          ? const PartnerEmptyState(
                              title: 'No alerts yet',
                              body: 'Assignments, bookings and system messages will appear here.',
                              icon: Icons.notifications_none_rounded,
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                              itemCount: _items.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 8),
                              itemBuilder: (context, i) {
                                final item = _items[i];
                                final title = item['title']?.toString() ?? 'Notice';
                                final message = item['message']?.toString() ?? '';
                                final read = item['isRead'] == true;
                                final created = item['createdAt']?.toString() ?? '';
                                final type = item['type']?.toString() ?? '';
                                String timeStr = '';
                                if (created.isNotEmpty) {
                                  final dt = DateTime.tryParse(created);
                                  if (dt != null) {
                                    final local = dt.toLocal();
                                    timeStr =
                                        '${local.day}/${local.month}/${local.year} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
                                  }
                                }

                                return Material(
                                  color: read ? Colors.white : brown.withValues(alpha: 0.04),
                                  borderRadius: BorderRadius.circular(16),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(16),
                                    onTap: () => _tapItem(item),
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          // Unread dot
                                          Padding(
                                            padding: const EdgeInsets.only(top: 6, right: 10),
                                            child: AnimatedContainer(
                                              duration: const Duration(milliseconds: 200),
                                              width: 8,
                                              height: 8,
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                color: read
                                                    ? Colors.transparent
                                                    : brown,
                                              ),
                                            ),
                                          ),
                                          // Icon
                                          Container(
                                            width: 42,
                                            height: 42,
                                            margin: const EdgeInsets.only(right: 12),
                                            decoration: BoxDecoration(
                                              color: brown.withValues(alpha: 0.08),
                                              borderRadius: BorderRadius.circular(14),
                                            ),
                                            child: Icon(
                                              _iconForType(type),
                                              color: brown,
                                              size: 20,
                                            ),
                                          ),
                                          // Content
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Row(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        title,
                                                        style: GoogleFonts.outfit(
                                                          fontWeight: read ? FontWeight.w600 : FontWeight.w800,
                                                          fontSize: 14.5,
                                                          color: ink,
                                                        ),
                                                      ),
                                                    ),
                                                    if (type.isNotEmpty) ...[
                                                      const SizedBox(width: 6),
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(
                                                          horizontal: 7,
                                                          vertical: 2,
                                                        ),
                                                        decoration: BoxDecoration(
                                                          color: brown.withValues(alpha: 0.08),
                                                          borderRadius: BorderRadius.circular(6),
                                                        ),
                                                        child: Text(
                                                          type.replaceAll('_', ' '),
                                                          style: GoogleFonts.outfit(
                                                            fontSize: 10,
                                                            fontWeight: FontWeight.w700,
                                                            color: brown,
                                                          ),
                                                        ),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                                if (message.isNotEmpty) ...[
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    message,
                                                    style: GoogleFonts.outfit(
                                                      fontSize: 13,
                                                      height: 1.4,
                                                      color: ink.withValues(alpha: 0.70),
                                                    ),
                                                  ),
                                                ],
                                                if (timeStr.isNotEmpty) ...[
                                                  const SizedBox(height: 6),
                                                  Text(
                                                    timeStr,
                                                    style: GoogleFonts.outfit(
                                                      fontSize: 11,
                                                      color: ink.withValues(alpha: 0.42),
                                                      fontWeight: FontWeight.w500,
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'service_request':
      case 'appointment_assigned':
        return Icons.medical_services_rounded;
      case 'shop_order':
      case 'order':
        return Icons.shopping_bag_rounded;
      case 'care_booking':
      case 'care_booking_request':
        return Icons.home_work_rounded;
      case 'reminder':
        return Icons.alarm_rounded;
      case 'system':
        return Icons.info_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }
}
