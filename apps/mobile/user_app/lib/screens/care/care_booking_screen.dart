import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/khalti_verify_helper.dart';
import '../../models/pet.dart';
import '../../services/pet_service.dart';
import '../shop/khalti_payment_screen.dart';

class CareBookingScreen extends StatefulWidget {
  final Map<String, dynamic> hostel;
  final VoidCallback? onBooked;

  const CareBookingScreen({
    super.key,
    required this.hostel,
    this.onBooked,
  });

  @override
  State<CareBookingScreen> createState() => _CareBookingScreenState();
}

class _CareBookingScreenState extends State<CareBookingScreen> {
  final _apiClient = ApiClient();
  final _petService = PetService();

  List<Pet> _pets = [];
  Pet? _selectedPet;
  DateTime? _checkIn;
  DateTime? _checkOut;
  String? _selectedRoomType;
  Map<String, dynamic>? _booking;
  bool _loadingPets = true;
  bool _creating = false;
  bool _paying = false;

  List<Map<String, dynamic>> get _roomTypes {
    final rt = widget.hostel['roomTypes'];
    if (rt is List && rt.isNotEmpty) {
      return rt
          .map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{})
          .toList();
    }
    return [];
  }

  static String _stringId(dynamic id) => id?.toString() ?? '';

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  /// GeoJSON payload aligned with backend CareBooking schema:
  /// pickupAddress: { address, point: { type: 'Point', coordinates: [lng, lat] } }
  /// Returns null when coordinates are missing.
  Map<String, dynamic>? _selfDropPickupAddressPayload() {
    final loc = widget.hostel['location'];
    String addr = 'Care centre location';
    double? lat;
    double? lng;

    if (loc is Map) {
      final a = (loc['address'] ?? '').toString().trim();
      if (a.isNotEmpty) addr = a;

      final c = loc['coordinates'];
      if (c is Map) {
        lat = _toDouble(c['lat']);
        lng = _toDouble(c['lng']);
      } else if (c is List && c.length >= 2) {
        lng = _toDouble(c[0]);
        lat = _toDouble(c[1]);
      }

      final point = loc['point'];
      if ((lat == null || lng == null) && point is Map) {
        final coords = point['coordinates'];
        if (coords is List && coords.length >= 2) {
          lng = _toDouble(coords[0]);
          lat = _toDouble(coords[1]);
        }
      }
    }

    if (lat == null || lng == null || !lat.isFinite || !lng.isFinite) {
      debugPrint('[ERROR] GeoJSON Point validation failed: coordinates missing.');
      return null;
    }
    debugPrint('[SUCCESS] GeoJSON validation passed for Hostel Booking.');
    return <String, dynamic>{
      'address': addr,
      'point': <String, dynamic>{
        'type': 'Point',
        'coordinates': <double>[lng, lat],
      },
    };
  }

  String _careBookingUserMessage(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && d['message'] != null) {
        return d['message'].toString();
      }
      if (e.message != null && e.message!.isNotEmpty) {
        return e.message!;
      }
    }
    return e.toString().replaceFirst('Exception: ', '');
  }

  void _logCareBookingError(Object e, StackTrace st) {
    final msg = _careBookingUserMessage(e);
    if (msg.toLowerCase().contains('geo') ||
        msg.toLowerCase().contains('coordinate') ||
        msg.toLowerCase().contains('point')) {
      debugPrint('[ERROR] GeoJSON validation failed: coordinates missing.');
    }
    debugPrint('[ERROR] Hostel booking failed: $msg');
    debugPrint('$e\n$st');
  }

  @override
  void initState() {
    super.initState();
    _loadPets();
  }

  Future<void> _loadPets() async {
    setState(() => _loadingPets = true);
    try {
      final pets = await _petService.getMyPets();
      if (mounted) {
        setState(() {
          _pets = pets;
          _selectedPet = pets.isNotEmpty ? pets.first : null;
          _loadingPets = false;
        });
        debugPrint(
          '[INFO] Initializing Hostel Booking for Pet ID: ${pets.isNotEmpty ? pets.first.id : "none"}',
        );
      }
    } catch (_) {
      if (mounted) setState(() => _loadingPets = false);
    }
  }

  Future<void> _pickDate(bool isCheckIn) async {
    final now = DateTime.now();
    final first = isCheckIn ? now : (_checkIn ?? now);
    final picked = await showDatePicker(
      context: context,
      initialDate: isCheckIn ? now : (first.add(const Duration(days: 1))),
      firstDate: isCheckIn ? now : first,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null && mounted) {
      setState(() {
        if (isCheckIn) {
          _checkIn = picked;
          if (_checkOut != null && !_checkOut!.isAfter(picked)) {
            _checkOut = picked.add(const Duration(days: 1));
          }
        } else {
          _checkOut = picked;
        }
      });
    }
  }

  Future<void> _createBooking({required bool paymentOnline}) async {
    if (_selectedPet == null || _checkIn == null || _checkOut == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select pet, check-in and check-out dates.')),
      );
      return;
    }
    if (!_checkOut!.isAfter(_checkIn!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Check-out must be after check-in.')),
      );
      return;
    }

    setState(() {
      _creating = true;
    });

    final pickup = _selfDropPickupAddressPayload();
    if (pickup == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a pickup location')),
      );
      return;
    }

    final hostelOid = _stringId(widget.hostel['_id']);
    try {
      final body = <String, dynamic>{
        'hostelId': hostelOid,
        'centreId': hostelOid,
        'petId': _selectedPet!.id,
        'checkIn': _checkIn!.toIso8601String(),
        'checkOut': _checkOut!.toIso8601String(),
        'logisticsType': 'self_drop',
        'paymentMethod': paymentOnline ? 'online' : 'cash_on_delivery',
        'pickupAddress': pickup,
      };
      if (_selectedRoomType != null) body['roomType'] = _selectedRoomType;
      final resp = await _apiClient.createCareBooking(body);

      if (resp.data is Map && resp.data['success'] == true && resp.data['data'] != null) {
        final booking = Map<String, dynamic>.from(resp.data['data'] as Map);
        if (mounted) {
          setState(() {
            _booking = booking;
            _creating = false;
          });
          debugPrint('[SUCCESS] Hostel booking record created in PawSewa-Cluster.');
          if (!paymentOnline) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Booking confirmed! Pay at check-in.'), backgroundColor: Colors.green),
              );
              widget.onBooked?.call();
            }
          }
        }
      } else {
        throw Exception(resp.data is Map ? (resp.data['message'] ?? 'Failed to create booking') : 'Failed to create booking');
      }
    } catch (e, st) {
      _logCareBookingError(e, st);
      if (mounted) {
        setState(() => _creating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_careBookingUserMessage(e))),
        );
      }
    }
  }

  Future<void> _payWithKhalti() async {
    if (_booking == null) return;

    setState(() => _paying = true);
    try {
      final resp = await _apiClient.initiateCareBookingPayment(_booking!['_id'].toString());
      final data = resp.data is Map ? resp.data['data'] as Map? : null;
      final url = data?['paymentUrl']?.toString();
      final successUrl = data?['successUrl']?.toString() ?? '';
      final pidx = data?['pidx']?.toString();

      if (url == null || url.isEmpty) {
        throw Exception('No payment URL received');
      }

      if (!mounted) return;
      final success = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => KhaltiPaymentScreen(
            paymentUrl: url,
            successUrl: successUrl,
          ),
        ),
      );

      if (mounted) {
        setState(() => _paying = false);
        if (success == true) {
          final verified = await verifyKhaltiPaymentOrNotify(
            context,
            _apiClient,
            pidx,
          );
          if (!mounted) return;
          if (verified) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Payment successful!'),
                backgroundColor: Colors.green,
              ),
            );
            widget.onBooked?.call();
          }
        }
      }
    } catch (e, st) {
      debugPrint('[ERROR] Khalti payment flow failed: ${_careBookingUserMessage(e)}');
      debugPrint('$e\n$st');
      if (mounted) {
        setState(() => _paying = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_careBookingUserMessage(e))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);

    return Scaffold(
      resizeToAvoidBottomInset: true,
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(AppConstants.primaryColor)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'HOSTEL BOOKING',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            fontSize: 16,
            color: primary,
          ),
        ),
      ),
      body: _booking != null ? _buildCheckoutBody() : _buildBookingForm(),
      bottomNavigationBar: _booking != null ? _buildCheckoutFooter() : _buildBookFooter(),
    );
  }

  Widget _buildBookingForm() {
    const primary = Color(AppConstants.primaryColor);
    final roomTypes = _roomTypes;
    final nights = _checkIn != null && _checkOut != null
        ? _checkOut!.difference(_checkIn!).inDays
        : 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Guest / Pet selection
          Text(
            'Guest Information',
            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
          ),
          const SizedBox(height: 8),
          if (_loadingPets)
            const Center(child: Padding(
              padding: EdgeInsets.all(24),
              child: PawSewaLoader(),
            ))
          else if (_pets.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: Text(
                'Add a pet first from My Pets to make a booking.',
                style: GoogleFonts.outfit(fontSize: 14, color: Colors.amber.shade900),
              ),
            )
          else
            SizedBox(
              height: 116,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _pets.length,
                itemBuilder: (context, i) {
                  final pet = _pets[i];
                  final selected = _selectedPet?.id == pet.id;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedPet = pet),
                    child: Container(
                      width: 160,
                      margin: const EdgeInsets.only(right: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: selected ? primary : Colors.grey.shade300,
                          width: selected ? 2 : 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 24,
                            backgroundColor: primary.withValues(alpha: 0.2),
                            backgroundImage: pet.photoUrl != null && pet.photoUrl!.isNotEmpty
                                ? CachedNetworkImageProvider(pet.photoUrl!)
                                : null,
                            child: pet.photoUrl == null || pet.photoUrl!.isEmpty
                                ? Text(
                                    pet.name.isNotEmpty ? pet.name[0].toUpperCase() : '?',
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.bold,
                                      color: primary,
                                    ),
                                  )
                                : null,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  pet.name,
                                  style: GoogleFonts.outfit(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                if (pet.pawId != null)
                                  Text(
                                    pet.pawId!,
                                    style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey[600]),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                              ],
                            ),
                          ),
                          if (selected)
                            Icon(Icons.check_circle, color: primary, size: 20),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 24),

          // Booking duration
          Text(
            'Booking Duration',
            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _DateField(
                  label: 'CHECK-IN',
                  date: _checkIn,
                  onTap: () => _pickDate(true),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _DateField(
                  label: 'CHECK-OUT',
                  date: _checkOut,
                  onTap: () => _pickDate(false),
                ),
              ),
            ],
          ),
          if (nights > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                '$nights night${nights > 1 ? 's' : ''}',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: primary,
                ),
              ),
            ),
          const SizedBox(height: 24),

          // Room type (if hostel has room types)
          if (roomTypes.isNotEmpty) ...[
            Text(
              'Select Room Type',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 200,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: roomTypes.length,
                itemBuilder: (context, i) {
                  final rt = roomTypes[i];
                  final name = rt['name']?.toString() ?? 'Room';
                  final price = (rt['pricePerNight'] ?? 0) as num;
                  final selected = _selectedRoomType == name;
                  final img = rt['images'] is List && (rt['images'] as List).isNotEmpty
                      ? (rt['images'] as List)[0].toString()
                      : widget.hostel['images'] is List && (widget.hostel['images'] as List).isNotEmpty
                          ? (widget.hostel['images'] as List)[0].toString()
                          : null;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedRoomType = name),
                    child: Container(
                      width: 200,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: selected ? primary : Colors.grey.shade300,
                          width: selected ? 2 : 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.06),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                            child: AspectRatio(
                              aspectRatio: 16 / 10,
                              child: img != null && img.isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: img,
                                      fit: BoxFit.cover,
                                      placeholder: (_, _) => Container(
                                        color: Colors.grey[200],
                                        child: const Icon(Icons.bed, color: Color(AppConstants.primaryColor)),
                                      ),
                                      errorWidget: (_, _, _) => Container(
                                        color: Colors.grey[200],
                                        child: const Icon(Icons.bed, color: Color(AppConstants.primaryColor)),
                                      ),
                                    )
                                  : Container(
                                      color: Colors.grey[200],
                                      child: const Icon(Icons.bed, size: 40, color: Color(AppConstants.primaryColor)),
                                    ),
                            ),
                          ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      height: 1.2,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Rs. ${price.toStringAsFixed(0)} /night',
                                    style: GoogleFonts.outfit(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: primary,
                                      height: 1.2,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),
          ],
        ],
      ),
    );
  }

  Widget _buildBookFooter() {
    const primary = Color(AppConstants.primaryColor);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ElevatedButton(
              onPressed: _creating || _pets.isEmpty
                  ? null
                  : () async {
                      await _createBooking(paymentOnline: true);
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _creating
                  ? const SizedBox(
                      height: 24,
                      width: 24,
                      child: PawSewaLoader(width: 36, center: false),
                    )
                  : Text(
                      'Proceed to Payment',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 16),
                    ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: _creating || _pets.isEmpty
                  ? null
                  : () async {
                      await _createBooking(paymentOnline: false);
                    },
              child: Text(
                'Book & Pay at Check-in (COD)',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey[700],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmCodFromCheckout() async {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Booking confirmed. Pay at check-in.'),
        backgroundColor: Colors.green,
      ),
    );
    widget.onBooked?.call();
    Navigator.of(context).pop();
  }

  Widget _buildCheckoutBody() {
    const primary = Color(AppConstants.primaryColor);
    final b = _booking!;
    final total = (b['totalAmount'] ?? 0) as num;
    final subtotal = (b['subtotal'] ?? 0) as num;
    final serviceFee = (b['serviceFee'] ?? 0) as num;
    final cleaningFee = (b['cleaningFee'] ?? 0) as num;
    final tax = (b['tax'] ?? 0) as num;

    return SafeArea(
      top: true,
      bottom: false,
      minimum: const EdgeInsets.only(top: 8),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Payment Summary',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
            ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Column(
              children: [
                _SummaryRow(label: 'Room / Service', value: 'Rs. ${subtotal.toStringAsFixed(0)}'),
                if (cleaningFee > 0) _SummaryRow(label: 'Cleaning Fee', value: 'Rs. ${cleaningFee.toStringAsFixed(0)}'),
                _SummaryRow(label: 'Service Fee', value: 'Rs. ${serviceFee.toStringAsFixed(0)}'),
                if (tax > 0) _SummaryRow(label: 'Tax (13% VAT)', value: 'Rs. ${tax.toStringAsFixed(2)}'),
                const Divider(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Total Amount',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF2D2D2D),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        'Rs. ${total.toStringAsFixed(2)}',
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: primary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'QUICK PAYMENT',
            style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600]),
          ),
          const SizedBox(height: 12),
          // Khalti button
          OutlinedButton.icon(
            onPressed: _paying ? null : _payWithKhalti,
            icon: _paying
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: PawSewaLoader(width: 32, center: false),
                  )
                : Image.asset('assets/khalti.png', height: 24, width: 24, errorBuilder: (_, _, _) => const Icon(Icons.payment)),
            label: Text(
              'Pay with Khalti',
              style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
            ),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: const BorderSide(color: Color(0xFF5C2D91)),
              foregroundColor: const Color(0xFF5C2D91),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const SizedBox(height: 24),
          Text(
            'Care policies',
            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.check_circle, size: 20, color: primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Vaccination card and health certificate are mandatory upon check-in for the safety of all pets.',
                    style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey[700]),
                  ),
                ),
              ],
            ),
          ),
        ],
        ),
      ),
    );
  }

  Widget _buildCheckoutFooter() {
    const primary = Color(AppConstants.primaryColor);
    final total = (_booking?['totalAmount'] ?? 0) as num;

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 12,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ElevatedButton.icon(
              onPressed: _paying ? null : _payWithKhalti,
              icon: _paying
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: PawSewaLoader(width: 36, center: false),
                    )
                  : const Icon(Icons.payment_rounded, size: 18),
              label: Text(
                'Pay with Khalti  Rs. ${total.toStringAsFixed(0)}',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 15),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _paying ? null : _confirmCodFromCheckout,
              icon: const Icon(Icons.payments_outlined, size: 18),
              label: Text(
                'Pay at check-in (COD)',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 14),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.grey[800],
                side: BorderSide(color: Colors.grey.shade300),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime? date;
  final VoidCallback onTap;

  const _DateField({required this.label, required this.date, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey[600]),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.calendar_today, size: 18, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Text(
                  date != null
                      ? '${date!.day}/${date!.month}/${date!.year}'
                      : 'Select date',
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: date != null ? Colors.black87 : Colors.grey[500],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[700]),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w500),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
