import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
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
  String? _error;

  List<Map<String, dynamic>> get _roomTypes {
    final rt = widget.hostel['roomTypes'];
    if (rt is List && rt.isNotEmpty) {
      return rt
          .map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{})
          .toList();
    }
    return [];
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
      _error = null;
    });

    try {
      final resp = await _apiClient.createCareBooking({
        'hostelId': widget.hostel['_id'],
        'petId': _selectedPet!.id,
        'checkIn': _checkIn!.toIso8601String(),
        'checkOut': _checkOut!.toIso8601String(),
        if (_selectedRoomType != null) 'roomType': _selectedRoomType,
        'paymentMethod': paymentOnline ? 'online' : 'cash_on_delivery',
      });

      if (resp.data is Map && resp.data['success'] == true && resp.data['data'] != null) {
        final booking = Map<String, dynamic>.from(resp.data['data'] as Map);
        if (mounted) {
          setState(() {
            _booking = booking;
            _creating = false;
          });
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
        throw Exception(resp.data['message'] ?? 'Failed to create booking');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _creating = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
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
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Payment successful!'), backgroundColor: Colors.green),
          );
          widget.onBooked?.call();
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _paying = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment failed: ${e.toString().replaceFirst('Exception: ', '')}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);

    return Scaffold(
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
          style: GoogleFonts.poppins(
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
            style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
          ),
          const SizedBox(height: 8),
          if (_loadingPets)
            const Center(child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(color: Color(AppConstants.primaryColor)),
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
                style: GoogleFonts.poppins(fontSize: 14, color: Colors.amber.shade900),
              ),
            )
          else
            SizedBox(
              height: 100,
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
                                    style: GoogleFonts.poppins(
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
                                  style: GoogleFonts.poppins(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                if (pet.pawId != null)
                                  Text(
                                    pet.pawId!,
                                    style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey[600]),
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
            style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
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
                style: GoogleFonts.poppins(
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
              style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 180,
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
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
                          Padding(
                            padding: const EdgeInsets.all(10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  name,
                                  style: GoogleFonts.poppins(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  'Rs. ${price.toStringAsFixed(0)} /night',
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: primary,
                                  ),
                                ),
                              ],
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

          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Text(
                  _error!,
                  style: GoogleFonts.poppins(fontSize: 13, color: Colors.red.shade800),
                ),
              ),
            ),
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
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      'Proceed to Payment',
                      style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 16),
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
                style: GoogleFonts.poppins(
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

  Widget _buildCheckoutBody() {
    const primary = Color(AppConstants.primaryColor);
    final b = _booking!;
    final total = (b['totalAmount'] ?? 0) as num;
    final subtotal = (b['subtotal'] ?? 0) as num;
    final serviceFee = (b['serviceFee'] ?? 0) as num;
    final cleaningFee = (b['cleaningFee'] ?? 0) as num;
    final tax = (b['tax'] ?? 0) as num;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment Summary',
            style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
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
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Total Amount',
                      style: GoogleFonts.poppins(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF2D2D2D),
                      ),
                    ),
                    Text(
                      'Rs. ${total.toStringAsFixed(2)}',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: primary,
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
            style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600]),
          ),
          const SizedBox(height: 12),
          // Khalti button
          OutlinedButton.icon(
            onPressed: _paying ? null : _payWithKhalti,
            icon: _paying
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(AppConstants.primaryColor)),
                  )
                : Image.asset('assets/khalti.png', height: 24, width: 24, errorBuilder: (_, _, _) => const Icon(Icons.payment)),
            label: Text(
              'Pay with Khalti',
              style: GoogleFonts.poppins(fontWeight: FontWeight.w600),
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
            'Hostel Policies',
            style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold, color: const Color(0xFF2D2D2D)),
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
                    style: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[700]),
                  ),
                ),
              ],
            ),
          ),
        ],
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
        child: ElevatedButton.icon(
          onPressed: _paying ? null : _payWithKhalti,
          icon: _paying
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.calendar_today, size: 18),
          label: Text(
            'Confirm Hostel Booking  Rs. ${total.toStringAsFixed(0)}',
            style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 15),
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
              style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey[600]),
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
                  style: GoogleFonts.poppins(
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
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey[700])),
          Text(value, style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
