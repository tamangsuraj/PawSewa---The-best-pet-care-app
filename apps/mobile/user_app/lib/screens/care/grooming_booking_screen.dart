import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/storage_service.dart';
import '../../models/pet.dart';
import '../../services/pet_service.dart';
import '../shop/khalti_payment_screen.dart';

class GroomingBookingScreen extends StatefulWidget {
  final Map<String, dynamic> hostel;
  final VoidCallback? onBooked;

  const GroomingBookingScreen({
    super.key,
    required this.hostel,
    this.onBooked,
  });

  @override
  State<GroomingBookingScreen> createState() => _GroomingBookingScreenState();
}

class _GroomingBookingScreenState extends State<GroomingBookingScreen> {
  final _apiClient = ApiClient();
  final _petService = PetService();
  final _storage = StorageService();

  List<Pet> _pets = [];
  Pet? _selectedPet;
  Map<String, dynamic>? _selectedPackage;
  String _serviceDelivery = 'visit_center';
  final Set<String> _selectedAddOns = {};
  DateTime? _selectedDate;
  String? _selectedTimeSlot;
  Map<String, dynamic>? _booking;
  bool _loadingPets = true;
  bool _creating = false;
  bool _paying = false;
  String? _error;
  final String _userAddress = '';
  String _userPhone = '';

  static const _timeSlots = [
    '09:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM',
  ];

  List<Map<String, dynamic>> get _packages {
    final pkgs = widget.hostel['groomingPackages'];
    if (pkgs is List && pkgs.isNotEmpty) {
      return pkgs.map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}).toList();
    }
    final base = (widget.hostel['pricePerSession'] ?? widget.hostel['pricePerNight'] ?? 1500) as num;
    return [
      {'name': 'Essential Clean', 'price': base.toDouble(), 'description': 'Bath, Brush, Nails', 'durationMinutes': 45},
      {'name': 'Full Spa', 'price': (base * 1.5).toDouble(), 'description': 'Essential + Haircut', 'durationMinutes': 90},
    ];
  }

  List<Map<String, dynamic>> get _addOns {
    final aos = widget.hostel['addOns'];
    if (aos is List && aos.isNotEmpty) {
      return aos.map((e) => e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{}).toList();
    }
    return [
      {'name': 'Tick & Flea Wash', 'price': 200},
      {'name': 'Special Shampoo', 'price': 300},
      {'name': 'Ear Cleaning', 'price': 150},
    ];
  }

  double get _serviceTotal {
    final p = _selectedPackage;
    if (p == null) return 0;
    final price = (p['price'] ?? 0) as num;
    double add = 0;
    for (final n in _selectedAddOns) {
      final ao = _addOns.firstWhere((a) => a['name'] == n, orElse: () => <String, dynamic>{});
      add += ((ao['price'] ?? 0) as num).toDouble();
    }
    return price + add;
  }

  @override
  void initState() {
    super.initState();
    _loadPets();
    _loadUserInfo();
  }

  Future<void> _loadPets() async {
    setState(() => _loadingPets = true);
    try {
      final pets = await _petService.getMyPets();
      if (mounted) {
        setState(() {
          _pets = pets;
          _selectedPet = pets.isNotEmpty ? pets.first : null;
          _selectedPackage = _packages.isNotEmpty ? _packages.first : null;
          _loadingPets = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingPets = false);
    }
  }

  Future<void> _loadUserInfo() async {
    try {
      final user = await _storage.getUser();
      if (user != null) {
        final phoneMatch = RegExp(r'"phone"\s*:\s*"([^"]*)"').firstMatch(user);
        _userPhone = phoneMatch?.group(1) ?? '';
      }
    } catch (_) {}
  }

  Future<void> _createBooking({required bool paymentOnline}) async {
    if (_selectedPet == null || _selectedPackage == null || _selectedDate == null || _selectedTimeSlot == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select pet, package, date and time.')),
      );
      return;
    }

    final slot = _selectedTimeSlot!;
    int hour = 9, minute = 0;
    final m = RegExp(r'(\d+):(\d+)\s*(AM|PM)?', caseSensitive: false).firstMatch(slot);
    if (m != null) {
      hour = int.tryParse(m.group(1) ?? '9') ?? 9;
      minute = int.tryParse(m.group(2) ?? '0') ?? 0;
      final ampm = (m.group(3) ?? '').toUpperCase();
      if (ampm == 'PM' && hour < 12) hour += 12;
      if (ampm == 'AM' && hour == 12) hour = 0;
    }
    final checkIn = DateTime(_selectedDate!.year, _selectedDate!.month, _selectedDate!.day, hour, minute);
    final duration = (_selectedPackage!['durationMinutes'] ?? 45) as int;
    final checkOut = checkIn.add(Duration(minutes: duration));

    setState(() {
      _creating = true;
      _error = null;
    });

    try {
      final resp = await _apiClient.createCareBooking({
        'hostelId': widget.hostel['_id'],
        'petId': _selectedPet!.id,
        'checkIn': checkIn.toIso8601String(),
        'checkOut': checkOut.toIso8601String(),
        'packageName': _selectedPackage!['name'],
        'addOns': _selectedAddOns.toList(),
        'serviceDelivery': _serviceDelivery,
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
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Booking confirmed!'), backgroundColor: Colors.green),
            );
            widget.onBooked?.call();
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
      if (url == null || url.isEmpty) throw Exception('No payment URL');
      if (!mounted) return;
      final success = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => KhaltiPaymentScreen(paymentUrl: url, successUrl: successUrl),
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
    final serviceType = widget.hostel['serviceType']?.toString() ?? 'Grooming';

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
          'Pet $serviceType',
          style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16, color: primary),
        ),
      ),
      body: _booking != null ? _buildCheckoutBody() : _buildBookingForm(),
      bottomNavigationBar: _booking != null ? _buildCheckoutFooter() : _buildBookFooter(),
    );
  }

  Widget _buildBookingForm() {
    const primary = Color(AppConstants.primaryColor);
    final now = DateTime.now();
    final dates = List.generate(7, (i) => now.add(Duration(days: i)));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('SELECT PET'),
          const SizedBox(height: 8),
          if (_loadingPets)
            const Center(child: CircularProgressIndicator(color: Color(AppConstants.primaryColor)))
          else if (_pets.isEmpty)
            _emptyHint('Add a pet from My Pets first.')
          else
            DropdownButtonFormField<Pet>(
              initialValue: _selectedPet,
              decoration: _inputDecoration(),
              items: _pets.map((p) => DropdownMenuItem(value: p, child: Text('${p.name} (ID: ${p.pawId ?? p.id})'))).toList(),
              onChanged: (v) => setState(() => _selectedPet = v),
            ),
          const SizedBox(height: 24),
          _sectionTitle('CHOOSE GROOMING PACKAGE'),
          const SizedBox(height: 12),
          SizedBox(
            height: 130,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _packages.length,
              itemBuilder: (_, i) {
                final p = _packages[i];
                final name = p['name']?.toString() ?? '';
                final price = (p['price'] ?? 0) as num;
                final desc = p['description']?.toString() ?? '';
                final mins = (p['durationMinutes'] ?? 45) as int;
                final selected = _selectedPackage?['name'] == name;
                return GestureDetector(
                  onTap: () => setState(() => _selectedPackage = p),
                  child: Container(
                    width: 180,
                    margin: const EdgeInsets.only(right: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: selected ? primary.withValues(alpha: 0.08) : Colors.grey[50],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: selected ? primary : Colors.grey.shade300, width: selected ? 2 : 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('NPR ${price.toStringAsFixed(0)}', style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 16, color: primary)),
                        Text(name, style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 14)),
                        if (desc.isNotEmpty) Text(desc, style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600])),
                        Row(
                          children: [
                            Icon(Icons.access_time, size: 14, color: Colors.grey[600]),
                            Text(' $mins mins', style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[600])),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24),
          _sectionTitle('SERVICE DELIVERY'),
          const SizedBox(height: 12),
          Row(
            children: [
              _deliveryCard('home_visit', 'Home Visit', 'Groomer comes to your location', Icons.home),
              const SizedBox(width: 12),
              _deliveryCard('visit_center', 'Visit Center', 'Visit our care center', Icons.store),
            ],
          ),
          const SizedBox(height: 24),
          _sectionTitle('ADD-ONS'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _addOns.map((a) {
              final name = a['name']?.toString() ?? '';
              final price = (a['price'] ?? 0) as num;
              final sel = _selectedAddOns.contains(name);
              return FilterChip(
                label: Text('$name (+Rs. ${price.toStringAsFixed(0)})'),
                selected: sel,
                onSelected: (v) => setState(() {
                  if (v) {
                    _selectedAddOns.add(name);
                  } else {
                    _selectedAddOns.remove(name);
                  }
                }),
                selectedColor: primary.withValues(alpha: 0.2),
                checkmarkColor: primary,
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          _sectionTitle('SELECT DATE & TIME'),
          const SizedBox(height: 12),
          SizedBox(
            height: 50,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: dates.length,
              itemBuilder: (_, i) {
                final d = dates[i];
                final sel = _selectedDate != null && _selectedDate!.day == d.day && _selectedDate!.month == d.month;
                final weekday = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][d.weekday - 1];
                return GestureDetector(
                  onTap: () => setState(() => _selectedDate = d),
                  child: Container(
                    width: 56,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: sel ? primary : Colors.grey[100],
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(weekday, style: GoogleFonts.poppins(fontSize: 10, color: sel ? Colors.white : Colors.grey[700])),
                        Text('${d.day}', style: GoogleFonts.poppins(fontWeight: FontWeight.bold, fontSize: 14, color: sel ? Colors.white : Colors.grey[800])),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _timeSlots.map((t) {
              final sel = _selectedTimeSlot == t;
              return GestureDetector(
                onTap: () => setState(() => _selectedTimeSlot = t),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: sel ? primary : Colors.grey[100],
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(t, style: GoogleFonts.poppins(fontWeight: FontWeight.w600, color: sel ? Colors.white : Colors.grey[800])),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          _sectionTitle('LOCATION & CONTACT'),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey[200]!)),
            child: Column(
              children: [
                Row(children: [
                  Icon(Icons.location_on, size: 18, color: primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_userAddress.isEmpty ? 'Add address in profile' : _userAddress, style: GoogleFonts.poppins(fontSize: 13))),
                  Text('Edit', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: primary)),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  Icon(Icons.phone, size: 18, color: primary),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_userPhone.isEmpty ? 'Add phone in profile' : _userPhone, style: GoogleFonts.poppins(fontSize: 13))),
                  Text('Edit', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: primary)),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _sectionTitle('PAYMENT & SUMMARY'),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey[200]!)),
            child: Column(
              children: [
                _summaryRow('Service Fee', 'NPR ${_serviceTotal.toStringAsFixed(0)}'),
                if (_selectedAddOns.isNotEmpty)
                  _summaryRow('Add-ons', 'NPR ${_selectedAddOns.fold<double>(0, (s, n) {
                    final ao = _addOns.firstWhere((a) => a['name'] == n, orElse: () => <String, dynamic>{});
                    return s + ((ao['price'] ?? 0) as num).toDouble();
                  }).toStringAsFixed(0)}'),
                const Divider(height: 24),
                _summaryRow('Total Amount', 'NPR ${_serviceTotal.toStringAsFixed(0)}', bold: true),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: GoogleFonts.poppins(fontSize: 13, color: Colors.red)),
          ],
        ],
      ),
    );
  }

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600]),
    );
  }

  InputDecoration _inputDecoration() {
    return InputDecoration(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }

  Widget _emptyHint(String text) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.amber.shade200)),
      child: Text(text, style: GoogleFonts.poppins(fontSize: 14, color: Colors.amber.shade900)),
    );
  }

  Widget _deliveryCard(String value, String title, String subtitle, IconData icon) {
    const primary = Color(AppConstants.primaryColor);
    final selected = _serviceDelivery == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _serviceDelivery = value),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? primary : Colors.grey.shade300),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 24, color: primary),
              const SizedBox(height: 8),
              Text(title, style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
              Text(subtitle, style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey[600])),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.poppins(fontSize: 14, fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(value, style: GoogleFonts.poppins(fontSize: 14, fontWeight: bold ? FontWeight.bold : FontWeight.w500, color: const Color(AppConstants.primaryColor))),
        ],
      ),
    );
  }

  Widget _buildBookFooter() {
    const primary = Color(AppConstants.primaryColor);
    final disabled = _creating || _pets.isEmpty || _selectedPackage == null || _selectedDate == null || _selectedTimeSlot == null;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ElevatedButton(
              onPressed: disabled ? null : () => _createBooking(paymentOnline: true),
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: _creating
              ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text('Confirm & Pay with Khalti', style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 15)),
        ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: disabled ? null : () => _createBooking(paymentOnline: false),
              child: Text('Book & Pay at Center (COD)', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey[700])),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckoutBody() {
    final b = _booking!;
    final total = (b['totalAmount'] ?? 0) as num;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Payment Summary', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey[200]!)),
            child: Column(
              children: [
                _summaryRow('Service', 'NPR ${(b['subtotal'] ?? 0)}'),
                if ((b['cleaningFee'] ?? 0) > 0) _summaryRow('Cleaning Fee', 'NPR ${b['cleaningFee']}'),
                _summaryRow('Service Fee', 'NPR ${b['serviceFee']}'),
                if ((b['tax'] ?? 0) > 0) _summaryRow('Tax', 'NPR ${b['tax']}'),
                const Divider(height: 24),
                _summaryRow('Total Amount', 'NPR ${total.toStringAsFixed(2)}', bold: true),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text('PAY WITH', style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600])),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _paying ? null : _payWithKhalti,
            icon: Image.asset('assets/khalti.png', height: 24, width: 24, errorBuilder: (_, _, _) => const Icon(Icons.payment)),
            label: const Text('Pay with Khalti'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: const BorderSide(color: Color(0xFF5C2D91)),
              foregroundColor: const Color(0xFF5C2D91),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 12, offset: const Offset(0, -4))],
        ),
        child: ElevatedButton.icon(
          onPressed: _paying ? null : _payWithKhalti,
          icon: _paying ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.payment, size: 18),
          label: Text('Confirm Grooming Appointment  Rs. ${total.toStringAsFixed(0)}', style: GoogleFonts.poppins(fontWeight: FontWeight.w600)),
          style: ElevatedButton.styleFrom(
            backgroundColor: primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
    );
  }
}
