import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';

/// Lists care bookings for the logged-in owner (`GET /care-bookings/my`).
class MyCareBookingsScreen extends StatefulWidget {
  const MyCareBookingsScreen({super.key});

  @override
  State<MyCareBookingsScreen> createState() => _MyCareBookingsScreenState();
}

class _MyCareBookingsScreenState extends State<MyCareBookingsScreen> {
  final _api = ApiClient();
  List<dynamic> _items = [];
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
      final res = await _api.getMyCareBookings();
      if (!mounted) {
        return;
      }
      if (res.statusCode == 200 && res.data is Map) {
        final list = res.data['data'];
        setState(() {
          _items = list is List ? list : [];
          _loading = false;
        });
      } else {
        setState(() {
          _error = 'Could not load bookings';
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
          'Care bookings',
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
            ? const Center(child: CircularProgressIndicator(color: brown))
            : _error != null
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center, style: GoogleFonts.outfit()),
                  ),
                ],
              )
            : _items.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 48),
                  Icon(Icons.home_work_outlined, size: 56, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(
                    'No hostel or care bookings yet',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Book from Pet Care+ on your home dashboard.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[600]),
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
                    return const SizedBox.shrink();
                  }
                  final m = Map<String, dynamic>.from(raw);
                  final status = m['status']?.toString() ?? '—';
                  final hostel = m['hostelId'];
                  String title = 'Care booking';
                  if (hostel is Map) {
                    title = hostel['name']?.toString() ?? title;
                  }
                  final created = m['createdAt']?.toString();
                  return Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    elevation: 0.5,
                    child: ListTile(
                      title: Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        [status, if (created != null) created.split('T').first].join(' · '),
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
