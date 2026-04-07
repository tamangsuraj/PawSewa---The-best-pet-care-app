import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../services/socket_service.dart';
import '../../widgets/premium_empty_state.dart';
import '../../widgets/premium_shimmer.dart';
import '../../widgets/premium_info_chip.dart';
import '../messages/marketplace_thread_screen.dart';

/// How to filter hostel / care bookings from the drawer.
enum MyCareBookingsListMode {
  all,
  historyOnly,
}

/// Lists care bookings for the logged-in owner (`GET /care-bookings/my`).
class MyCareBookingsScreen extends StatefulWidget {
  const MyCareBookingsScreen({
    super.key,
    this.listMode = MyCareBookingsListMode.all,
  });

  final MyCareBookingsListMode listMode;

  @override
  State<MyCareBookingsScreen> createState() => _MyCareBookingsScreenState();
}

class _MyCareBookingsScreenState extends State<MyCareBookingsScreen> {
  final _api = ApiClient();
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  Timer? _poll;
  void Function(String, Map<String, dynamic>)? _careSocket;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 22), (_) => _load(silent: true));
    _careSocket = (_, _) {
      if (mounted) _load(silent: true);
    };
    SocketService.instance.addCareBookingListener(_careSocket!);
    SocketService.instance.connect();
  }

  @override
  void dispose() {
    _poll?.cancel();
    if (_careSocket != null) {
      SocketService.instance.removeCareBookingListener(_careSocket!);
    }
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final res = await _api.getMyCareBookings();
      if (!mounted) {
        return;
      }
      if (res.statusCode == 200 && res.data is Map) {
        final list = res.data['data'];
        setState(() {
          _items = list is List ? list : [];
          _loading = false;
          _error = null;
        });
      } else if (!silent) {
        setState(() {
          _error = 'Could not load bookings';
          _loading = false;
        });
      }
    } on DioException catch (e) {
      if (!mounted) {
        return;
      }
      if (!silent) {
        setState(() {
          _error = e.response?.data is Map
              ? (e.response!.data as Map)['message']?.toString() ?? 'Network error'
              : 'Network error';
          _loading = false;
        });
      }
    } catch (_) {
      if (!mounted) {
        return;
      }
      if (!silent) {
        setState(() {
          _error = 'Something went wrong';
          _loading = false;
        });
      }
    }
  }

  static String _statusLabel(String raw) {
    switch (raw) {
      case 'awaiting_approval':
        return 'Awaiting centre approval';
      case 'confirmed':
        return 'Confirmed';
      case 'checked_in':
        return 'Checked in';
      case 'completed':
        return 'Completed';
      case 'declined':
        return 'Declined';
      case 'cancelled':
        return 'Cancelled';
      case 'pending':
        return 'Awaiting approval';
      case 'paid':
        return 'Paid · awaiting approval';
      case 'accepted':
        return 'Confirmed';
      case 'rejected':
        return 'Declined';
      default:
        return raw.replaceAll('_', ' ');
    }
  }

  Future<void> _openCareChat(Map<String, dynamic> m) async {
    final id = m['_id']?.toString();
    if (id == null) return;
    final hostel = m['hostelId'];
    final centre = hostel is Map ? (hostel['name']?.toString() ?? 'Care centre') : 'Care centre';
    try {
      final res = await _api.openCareBookingChat(id);
      final body = res.data;
      if (body is! Map || body['success'] != true) return;
      final conv = body['data'];
      if (conv is! Map) return;
      final cid = conv['_id']?.toString();
      if (cid == null || !mounted) return;
      await Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => MarketplaceThreadScreen(
            conversationId: cid,
            threadType: 'CARE',
            peerName: centre,
            peerSubtitle: 'Care booking updates',
            productIdForFirstMessage: null,
            highContrast: true,
          ),
        ),
      );
      if (mounted) _load(silent: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  static const Set<String> _historyStatuses = {
    'completed',
    'cancelled',
    'rejected',
    'declined',
  };

  List<dynamic> get _visibleItems {
    if (widget.listMode == MyCareBookingsListMode.all) {
      return _items;
    }
    return _items.where((raw) {
      if (raw is! Map) {
        return false;
      }
      final s = raw['status']?.toString() ?? '';
      return _historyStatuses.contains(s);
    }).toList();
  }

  String get _appBarTitle {
    if (widget.listMode == MyCareBookingsListMode.historyOnly) {
      return 'Booking history';
    }
    return 'Care bookings';
  }

  @override
  Widget build(BuildContext context) {
    const brown = Color(AppConstants.primaryColor);
    final visible = _visibleItems;
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          _appBarTitle,
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: Colors.white),
        ),
        backgroundColor: brown,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: RefreshIndicator(
        color: brown,
        onRefresh: _load,
        child: _loading
            ? PremiumShimmer(
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                  children: const [
                    SkeletonListTile(),
                    SkeletonListTile(),
                    SkeletonListTile(),
                  ],
                ),
              )
            : _error != null
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  PremiumEmptyState(
                    title: 'Couldn’t load bookings',
                    body: _error!,
                    icon: Icons.wifi_off_rounded,
                    primaryAction: FilledButton.icon(
                      onPressed: _load,
                      style: FilledButton.styleFrom(backgroundColor: brown),
                      icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                      label: Text('Retry', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              )
            : _items.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: [
                  const PremiumEmptyState(
                    title: 'No care centre bookings yet',
                    body: 'Book from Pet Care+ to reserve stays, grooming, or training.',
                    icon: Icons.home_work_outlined,
                  ),
                ],
              )
            : visible.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: [
                  const PremiumEmptyState(
                    title: 'No past bookings',
                    body: 'Completed, cancelled, or rejected stays appear here.',
                    icon: Icons.history_rounded,
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: visible.length,
                separatorBuilder: (context, index) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final raw = visible[i];
                  if (raw is! Map) {
                    return const SizedBox(height: 0);
                  }
                  final m = Map<String, dynamic>.from(raw);
                  final status = m['status']?.toString() ?? '—';
                  final hostel = m['hostelId'];
                  String title = 'Care booking';
                  if (hostel is Map) {
                    title = hostel['name']?.toString() ?? title;
                  }
                  final created = m['createdAt']?.toString();
                  final pet = m['pet'];
                  String petName = '';
                  if (pet is Map) {
                    petName = pet['name']?.toString() ?? '';
                  }
                  final checkIn = m['checkIn']?.toString();
                  final checkOut = m['checkOut']?.toString();
                  String dateLine = '';
                  if (checkIn != null && checkIn.contains('T')) {
                    dateLine = checkIn.split('T').first;
                  } else if (created != null && created.contains('T')) {
                    dateLine = created.split('T').first;
                  }

                  final statusKey = status.toLowerCase();
                  Color statusColor;
                  switch (statusKey) {
                    case 'pending':
                    case 'awaiting_approval':
                    case 'paid':
                      statusColor = Colors.orange.shade700;
                      break;
                    case 'accepted':
                    case 'confirmed':
                      statusColor = const Color(AppConstants.accentColor);
                      break;
                    case 'checked_in':
                      statusColor = Colors.teal.shade700;
                      break;
                    case 'completed':
                      statusColor = Colors.green.shade700;
                      break;
                    case 'cancelled':
                    case 'rejected':
                    case 'declined':
                      statusColor = Colors.red.shade700;
                      break;
                    default:
                      statusColor = Colors.grey.shade700;
                  }
                  final showChat = !const {
                    'completed',
                    'cancelled',
                    'declined',
                    'rejected',
                  }.contains(statusKey);

                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: brown.withValues(alpha: 0.10)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 14,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: brown.withValues(alpha: 0.10),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: const Icon(
                                      Icons.home_work_rounded,
                                      color: brown,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 15,
                                            color: const Color(AppConstants.inkColor),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          petName.isNotEmpty
                                              ? 'Pet: $petName'
                                              : 'Care booking',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.w600,
                                            fontSize: 12.5,
                                            color: const Color(AppConstants.inkColor)
                                                .withValues(alpha: 0.65),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: statusColor.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(999),
                                        border: Border.all(
                                          color: statusColor.withValues(alpha: 0.22),
                                        ),
                                      ),
                                      child: Text(
                                        _statusLabel(statusKey),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.outfit(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 0.02,
                                          color: statusColor,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  if (dateLine.isNotEmpty)
                                    _Chip(
                                      icon: Icons.calendar_today_rounded,
                                      text: dateLine,
                                    ),
                                  if (checkOut != null && checkOut.contains('T'))
                                    _Chip(
                                      icon: Icons.event_available_rounded,
                                      text: 'Out: ${checkOut.split('T').first}',
                                    ),
                                  _Chip(
                                    icon: Icons.receipt_long_rounded,
                                    text: widget.listMode == MyCareBookingsListMode.historyOnly
                                        ? 'History'
                                        : 'Active',
                                  ),
                                ],
                              ),
                              if (hostel is! Map) ...[
                                const SizedBox(height: 10),
                                const PremiumInfoChip(
                                  icon: Icons.info_outline_rounded,
                                  title: 'Details limited',
                                  body:
                                      'Some booking details are still syncing. Pull to refresh in a moment.',
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      if (showChat)
                        Positioned(
                          right: 6,
                          top: 6,
                          child: Material(
                            color: brown.withValues(alpha: 0.12),
                            shape: const CircleBorder(),
                            child: IconButton(
                              tooltip: 'Chat with care centre',
                              icon: Icon(Icons.chat_bubble_rounded, color: brown),
                              onPressed: () => _openCareChat(m),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(AppConstants.sandColor).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: primary.withValues(alpha: 0.10)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: primary.withValues(alpha: 0.85)),
          const SizedBox(width: 6),
          Text(
            text,
            style: GoogleFonts.outfit(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: const Color(AppConstants.inkColor)
                  .withValues(alpha: 0.78),
            ),
          ),
        ],
      ),
    );
  }
}
