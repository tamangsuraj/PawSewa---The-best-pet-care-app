import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../widgets/premium_empty_state.dart';
import '../../widgets/premium_shimmer.dart';

/// Filters [GET /care/my-requests] by broad Care+ category.
enum CareRequestsKind { grooming, training }

/// Lists care requests (`GET /care/my-requests`) with optional kind filter.
class MyCareRequestsScreen extends StatefulWidget {
  const MyCareRequestsScreen({super.key, required this.kind});

  final CareRequestsKind kind;

  @override
  State<MyCareRequestsScreen> createState() => _MyCareRequestsScreenState();
}

class _MyCareRequestsScreenState extends State<MyCareRequestsScreen> {
  final _api = ApiClient();
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;

  String get _title {
    switch (widget.kind) {
      case CareRequestsKind.grooming:
        return 'Grooming (current & past)';
      case CareRequestsKind.training:
        return 'Training (current & past)';
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool _matchesKind(String? serviceType) {
    final t = (serviceType ?? '').toLowerCase();
    switch (widget.kind) {
      case CareRequestsKind.grooming:
        return {
          'grooming',
          'bathing',
          'spa',
          'wash',
        }.any((k) => t.contains(k));
      case CareRequestsKind.training:
        return t.contains('training');
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.getMyCareRequests();
      if (!mounted) {
        return;
      }
      if (res.statusCode == 200 && res.data is Map) {
        final list = res.data['data'];
        final raw = list is List ? list : <dynamic>[];
        final filtered = raw.where((e) {
          if (e is! Map) {
            return false;
          }
          return _matchesKind(e['serviceType']?.toString());
        }).toList();
        setState(() {
          _items = filtered;
          _loading = false;
        });
      } else {
        setState(() {
          _error = 'Could not load requests';
          _loading = false;
        });
      }
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

  @override
  Widget build(BuildContext context) {
    const brown = Color(AppConstants.primaryColor);
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          _title,
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
                    title: 'Couldn’t load history',
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
                  PremiumEmptyState(
                    title: 'No entries yet',
                    body: widget.kind == CareRequestsKind.grooming
                        ? 'Book grooming/bathing from Pet Care+ to see history here.'
                        : 'Book training from Pet Care+ to see history here.',
                    icon: Icons.spa_outlined,
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _items.length,
                separatorBuilder: (context, index) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final raw = _items[i];
                  if (raw is! Map) {
                    return const SizedBox(height: 0);
                  }
                  final m = Map<String, dynamic>.from(raw);
                  final st = m['status']?.toString() ?? '—';
                  final svc = m['serviceType']?.toString() ?? 'Care';
                  final pet = m['pet'];
                  String petName = '';
                  if (pet is Map) {
                    petName = pet['name']?.toString() ?? '';
                  }
                  final created = m['createdAt']?.toString();
                  return Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    elevation: 0.5,
                    child: ListTile(
                      title: Text(
                        [svc, if (petName.isNotEmpty) petName].join(' · '),
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        [st, if (created != null) created.split('T').first].join(' · '),
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600]),
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
