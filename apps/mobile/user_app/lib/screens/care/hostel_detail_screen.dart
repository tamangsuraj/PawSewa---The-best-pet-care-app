import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';

import '../../core/constants.dart';
import 'care_booking_screen.dart';
import 'grooming_booking_screen.dart';

// ── Grooming service list (shown in Grooming / Spa detail) ─────────────────
final _groomingServices = [
  ('Bath & Blow Dry', LucideIcons.droplets),
  ('Full Haircut', LucideIcons.scissors),
  ('Nail Trimming', LucideIcons.hand),
  ('Ear Cleaning', LucideIcons.ear),
  ('Sanitary Trim', LucideIcons.droplet),
];

List<Map<String, dynamic>> _getStaffList(String serviceType, Map<String, dynamic> h) {
  if (serviceType != 'Grooming' && serviceType != 'Spa') return [];
  final staff = h['staff'];
  if (staff is List && staff.isNotEmpty) {
    return staff
        .map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{})
        .toList();
  }
  final owner = h['ownerId'];
  if (owner is Map && owner['name'] != null) {
    return [
      {'name': owner['name'].toString(), 'experienceYears': 3},
    ];
  }
  return [
    {'name': 'Lead Groomer', 'experienceYears': 5},
  ];
}

// ── Color / style constants ─────────────────────────────────────────────────
const _primary = Color(AppConstants.primaryColor);
const _teal = Color(AppConstants.accentColor);
const _bg = Color(0xFFF8F7F5);

class HostelDetailScreen extends StatefulWidget {
  const HostelDetailScreen({super.key, required this.hostel, this.onBooked});

  final Map<String, dynamic> hostel;
  final VoidCallback? onBooked;

  @override
  State<HostelDetailScreen> createState() => _HostelDetailScreenState();
}

class _HostelDetailScreenState extends State<HostelDetailScreen> {
  final _pageCtrl = PageController();
  int _imgIdx = 0;
  late final List<String> _images;
  late final String _serviceType;
  late final bool _isSession;
  late final num _price;
  late final String _name;
  late final String _address;
  late final double _rating;
  late final int _reviewCount;
  late final String _desc;
  late final List _amenities;
  late final List _schedule;

  @override
  void initState() {
    super.initState();
    final h = widget.hostel;
    final rawImgs = h['images'] is List ? h['images'] as List : <dynamic>[];
    _images = rawImgs
        .where((e) => e != null && e.toString().trim().isNotEmpty)
        .map((e) => e.toString())
        .toList();
    if (_images.isEmpty) _images.add('');

    _serviceType = h['serviceType']?.toString() ?? 'Hostel';
    _isSession = ['Grooming', 'Training', 'Wash', 'Spa'].contains(_serviceType);
    _price = (h['pricePerNight'] ?? h['pricePerSession'] ?? 0) as num;
    _name = h['name']?.toString() ?? 'Care Service';
    _desc = h['description']?.toString() ?? 'Quality care for your pet.';
    _rating = (h['rating'] ?? 0.0) is num ? (h['rating'] as num).toDouble() : 0.0;
    _reviewCount = (h['reviewCount'] ?? 0) as int;
    _address = h['location'] is Map && h['location']['address'] != null
        ? h['location']['address'].toString()
        : '';
    _amenities = h['amenities'] is List ? h['amenities'] as List : <dynamic>[];
    _schedule = h['schedule'] is List ? h['schedule'] as List : <dynamic>[];
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  void _book() {
    final isGroomingFlow = [
      'Grooming',
      'Spa',
      'Training',
      'Wash',
    ].contains(_serviceType);
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (c, a, b) => isGroomingFlow
            ? GroomingBookingScreen(
                hostel: widget.hostel,
                onBooked: () {
                  Navigator.popUntil(context, (r) => r.isFirst);
                  widget.onBooked?.call();
                },
              )
            : CareBookingScreen(
                hostel: widget.hostel,
                onBooked: () {
                  Navigator.popUntil(context, (r) => r.isFirst);
                  widget.onBooked?.call();
                },
              ),
        transitionsBuilder: (c, anim, b, child) => SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 1),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
          child: child,
        ),
      ),
    );
  }

  // ── Image gallery header ──────────────────────────────────────────────────
  Widget _buildGallery() {
    return SizedBox(
      height: 300,
      child: Stack(
        children: [
          PageView.builder(
            controller: _pageCtrl,
            itemCount: _images.length,
            onPageChanged: (i) => setState(() => _imgIdx = i),
            itemBuilder: (_, i) {
              final url = _images[i];
              return url.isEmpty
                  ? Container(
                      color: _primary.withValues(alpha: 0.08),
                      child: const Center(child: Icon(Icons.pets, size: 72, color: _primary)),
                    )
                  : CachedNetworkImage(
                      imageUrl: url,
                      httpHeaders: const {'ngrok-skip-browser-warning': 'true'},
                      fit: BoxFit.cover,
                      width: double.infinity,
                      placeholder: (c, url) => Container(
                        color: const Color(0xFFF3EDE7),
                        child: const Center(child: PawSewaLoader()),
                      ),
                      errorWidget: (c, url, err) => Container(
                        color: _primary.withValues(alpha: 0.06),
                        child: const Center(child: Icon(Icons.pets, size: 72, color: _primary)),
                      ),
                    );
            },
          ),

          // Gradient at top for back button visibility
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 90,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.45),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Back button
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 12,
            child: _CircleButton(
              icon: Icons.arrow_back_rounded,
              onTap: () => Navigator.pop(context),
            ),
          ),

          // Photo count / thumbnail dots
          if (_images.length > 1)
            Positioned(
              bottom: 14,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _images.length > 8 ? 8 : _images.length,
                  (i) => AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: _imgIdx == i ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: _imgIdx == i
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
            ),

          // Photo count badge
          if (_images.length > 1)
            Positioned(
              bottom: 14,
              right: 14,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.photo_library_rounded, color: Colors.white, size: 12),
                    const SizedBox(width: 4),
                    Text(
                      '${_imgIdx + 1}/${_images.length}',
                      style: GoogleFonts.outfit(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Header info card ──────────────────────────────────────────────────────
  Widget _buildHeaderCard() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Category pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              _serviceType,
              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: _primary),
            ),
          ),
          const SizedBox(height: 10),

          // Name
          Text(
            _name,
            style: GoogleFonts.outfit(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF1A1A1A),
              height: 1.2,
            ),
          ),
          const SizedBox(height: 8),

          // Location + badges row
          Row(
            children: [
              const Icon(Icons.location_on_rounded, size: 15, color: Color(0xFF9CA3AF)),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  _address.isNotEmpty ? _address : 'Kathmandu Valley',
                  style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF6B7280)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Rating row
          if (_rating > 0) ...[
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: _teal,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star_rounded, color: Colors.white, size: 15),
                      const SizedBox(width: 4),
                      Text(
                        _rating.toStringAsFixed(1),
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                if (_reviewCount > 0)
                  Text(
                    '$_reviewCount review${_reviewCount == 1 ? '' : 's'}',
                    style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF6B7280)),
                  ),
                const Spacer(),
                // Verified badge
                if (widget.hostel['isVerified'] == true)
                  Row(
                    children: [
                      const Icon(Icons.verified_rounded, size: 16, color: Color(0xFF16A34A)),
                      const SizedBox(width: 4),
                      Text(
                        'Verified',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF16A34A),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ── Key highlights ─────────────────────────────────────────────────────────
  Widget _buildHighlights() {
    final highlights = <(IconData, String)>[];
    if (_isSession) {
      highlights.addAll([
        (Icons.access_time_rounded, 'Flexible timings'),
        (Icons.workspace_premium_rounded, 'Certified staff'),
        (Icons.sentiment_satisfied_alt_rounded, 'Stress-free'),
      ]);
    } else {
      highlights.addAll([
        (Icons.nights_stay_rounded, 'Overnight stays'),
        (Icons.medical_services_outlined, 'Vet on call'),
        (Icons.videocam_rounded, 'Live updates'),
      ]);
    }

    return Container(
      margin: const EdgeInsets.only(top: 8),
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: highlights.map((h) {
          final (icon, label) = h;
          return Expanded(
            child: Column(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: _primary.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, size: 22, color: _primary),
                ),
                const SizedBox(height: 6),
                Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF374151),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Section header ─────────────────────────────────────────────────────────
  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: GoogleFonts.outfit(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF1A1A1A),
        ),
      ),
    );
  }

  // ── About section ─────────────────────────────────────────────────────────
  Widget _buildAbout() {
    return _Section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('About'),
          Text(
            _desc,
            style: GoogleFonts.outfit(
              fontSize: 14,
              color: const Color(0xFF4B5563),
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  // ── Included services (Grooming / Spa) ────────────────────────────────────
  Widget _buildIncludedServices() {
    if (!_isSession || (_serviceType != 'Grooming' && _serviceType != 'Spa')) {
      return const SizedBox.shrink();
    }
    return _Section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader("What's included"),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 3.2,
            children: _groomingServices.map((e) {
              final (label, icon) = e;
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F7F5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Row(
                  children: [
                    Icon(icon, size: 18, color: _primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        label,
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w500, color: const Color(0xFF374151)),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // ── Groomers ──────────────────────────────────────────────────────────────
  Widget _buildGroomers() {
    final staff = _getStaffList(_serviceType, widget.hostel);
    if (staff.isEmpty) return const SizedBox.shrink();
    return _Section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('Our team'),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: staff.map((s) {
                final nm = s['name']?.toString() ?? 'Groomer';
                final yrs = s['experienceYears'];
                return Container(
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.all(14),
                  width: 130,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F7F5),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: _primary.withValues(alpha: 0.1),
                        child: Text(
                          nm.isNotEmpty ? nm[0].toUpperCase() : 'G',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: _primary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        nm,
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF1A1A1A)),
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (yrs != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          '${yrs}y exp',
                          style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF6B7280)),
                        ),
                      ],
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  // ── Amenities ─────────────────────────────────────────────────────────────
  Widget _buildAmenities() {
    if (_amenities.isEmpty) return const SizedBox.shrink();
    return _Section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('Amenities'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _amenities.take(10).map((a) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F7F5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle_outline_rounded, size: 14, color: _teal),
                    const SizedBox(width: 6),
                    Text(
                      a.toString(),
                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500, color: const Color(0xFF374151)),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // ── Daily schedule (Hostel) ────────────────────────────────────────────────
  Widget _buildSchedule() {
    if (_schedule.isEmpty || _serviceType != 'Hostel') return const SizedBox.shrink();
    return _Section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('Daily schedule'),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8F7F5),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: _schedule.take(6).toList().asMap().entries.map((e) {
                final i = e.key;
                final s = e.value is Map ? Map<String, dynamic>.from(e.value as Map) : <String, dynamic>{};
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    border: i > 0
                        ? const Border(top: BorderSide(color: Color(0xFFE5E7EB)))
                        : null,
                  ),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 72,
                        child: Text(
                          s['time']?.toString() ?? '',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: _primary,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          s['activity']?.toString() ?? '',
                          style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF4B5563)),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  // ── Location ──────────────────────────────────────────────────────────────
  Widget _buildLocation() {
    if (_address.isEmpty) return const SizedBox.shrink();
    return _Section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('Location'),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F7F5),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: _primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.location_on_rounded, size: 20, color: _primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _address,
                    style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF374151), height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Policies ──────────────────────────────────────────────────────────────
  Widget _buildPolicies() {
    final isHostel = _serviceType == 'Hostel' || _serviceType == 'Daycare';
    if (!isHostel) return const SizedBox.shrink();
    return _Section(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('Policies'),
          _PolicyRow(
            icon: Icons.access_time_rounded,
            label: _serviceType == 'Hostel' ? 'Check-in / Check-out' : 'Timings',
            value: '9:00 AM – 6:00 PM',
          ),
          const SizedBox(height: 10),
          _PolicyRow(
            icon: Icons.pets,
            label: 'Pets accepted',
            value: 'Dogs, Cats & small pets',
          ),
          const SizedBox(height: 10),
          _PolicyRow(
            icon: Icons.no_food_rounded,
            label: 'Meals included',
            value: 'Yes – 3 meals/day',
          ),
        ],
      ),
    );
  }

  // ── Bottom booking bar ─────────────────────────────────────────────────────
  Widget _buildBottomBar() {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 14,
        bottom: MediaQuery.of(context).padding.bottom + 14,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Rs. ${_price.toStringAsFixed(0)}',
                style: GoogleFonts.outfit(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: _primary,
                ),
              ),
              Text(
                _isSession ? 'per session' : 'per night',
                style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF9CA3AF)),
              ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: FilledButton(
              onPressed: _book,
              style: FilledButton.styleFrom(
                backgroundColor: _primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.calendar_month_rounded, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Book Now',
                    style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
    return Scaffold(
      backgroundColor: _bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildGallery(),
            _buildHeaderCard(),
            _buildHighlights(),
            _buildAbout(),
            _buildIncludedServices(),
            _buildGroomers(),
            _buildAmenities(),
            _buildSchedule(),
            _buildLocation(),
            _buildPolicies(),
            const SizedBox(height: 20),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }
}

// ── Reusable section wrapper ────────────────────────────────────────────────
class _Section extends StatelessWidget {
  const _Section({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      color: Colors.white,
      padding: const EdgeInsets.all(20),
      child: child,
    );
  }
}

// ── Policy row ─────────────────────────────────────────────────────────────
class _PolicyRow extends StatelessWidget {
  const _PolicyRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(AppConstants.accentColor)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF9CA3AF), fontWeight: FontWeight.w500),
              ),
              Text(
                value,
                style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF374151)),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Circle icon button (back / share) ──────────────────────────────────────
class _CircleButton extends StatelessWidget {
  const _CircleButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.40),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}

