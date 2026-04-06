import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';

/// Live alerts from `pawsewa_chat.notifications` via `GET /notifications/me`.
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
    const cream = Color(AppConstants.secondaryColor);

    return Scaffold(
      backgroundColor: cream,
      appBar: AppBar(
        title: Text(
          'Notifications',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: brown,
        foregroundColor: Colors.white,
        elevation: 0,
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
        ],
      ),
      body: RefreshIndicator(
        color: brown,
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: brown))
            : _error != null
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(24),
                    children: [
                      Text(
                        _error!,
                        style: GoogleFonts.outfit(color: Colors.red.shade800),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _load,
                        style: FilledButton.styleFrom(backgroundColor: brown),
                        child: const Text('Retry'),
                      ),
                    ],
                  )
                : _items.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(32),
                        children: [
                          Icon(
                            Icons.notifications_none_rounded,
                            size: 64,
                            color: Colors.grey.shade400,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'No alerts yet',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Reminders, bookings, and updates will appear here.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(16),
                        itemCount: _items.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final item = _items[i];
                          final title = item['title']?.toString() ?? 'Notice';
                          final message = item['message']?.toString() ?? '';
                          final read = item['isRead'] == true;
                          final created = item['createdAt']?.toString() ?? '';
                          final type = item['type']?.toString() ?? '';

                          return Material(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            elevation: 0.5,
                            child: InkWell(
                              borderRadius: BorderRadius.circular(14),
                              onTap: () {
                                _tapItem(item);
                              },
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      width: 8,
                                      height: 8,
                                      margin: const EdgeInsets.only(top: 6, right: 10),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: read ? Colors.grey.shade300 : brown,
                                      ),
                                    ),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  title,
                                                  style: GoogleFonts.outfit(
                                                    fontWeight: FontWeight.w700,
                                                    fontSize: 15,
                                                    color: Colors.black87,
                                                  ),
                                                ),
                                              ),
                                              if (type.isNotEmpty)
                                                Container(
                                                  padding: const EdgeInsets.symmetric(
                                                    horizontal: 8,
                                                    vertical: 2,
                                                  ),
                                                  decoration: BoxDecoration(
                                                    color: brown.withValues(alpha: 0.1),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Text(
                                                    type,
                                                    style: GoogleFonts.outfit(
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.w600,
                                                      color: brown,
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                          if (message.isNotEmpty) ...[
                                            const SizedBox(height: 6),
                                            Text(
                                              message,
                                              style: GoogleFonts.outfit(
                                                fontSize: 13,
                                                height: 1.35,
                                                color: Colors.grey.shade800,
                                              ),
                                            ),
                                          ],
                                          if (created.isNotEmpty) ...[
                                            const SizedBox(height: 8),
                                            Text(
                                              created.length > 16
                                                  ? created.substring(0, 16)
                                                  : created,
                                              style: GoogleFonts.outfit(
                                                fontSize: 11,
                                                color: Colors.grey.shade600,
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
    );
  }
}
