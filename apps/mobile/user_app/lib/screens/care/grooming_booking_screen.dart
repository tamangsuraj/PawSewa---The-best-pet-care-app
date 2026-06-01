import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/khalti_verify_helper.dart';
import '../../core/storage_service.dart';
import '../../models/pet.dart';
import '../../services/pet_service.dart';
import '../shop/khalti_payment_screen.dart';
import '../cart/delivery_pin_screen.dart';

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
  Map<String, dynamic>? _pickupLocation; // { lat, lng, address }
  final Set<String> _selectedAddOns = {};
  DateTime? _selectedDate;
  String? _selectedTimeSlot;
  Map<String, dynamic>? _booking;
  bool _loadingPets = true;
  bool _creating = false;
  bool _paying = false;
  String? _error;
  String _userAddress = '';
  String _userPhone = '';
  bool _savingContact = false;

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
      final userRaw = await _storage.getUser();
      if (userRaw != null && userRaw.isNotEmpty) {
        final decoded = jsonDecode(userRaw);
        if (decoded is Map) {
          _userPhone = decoded['phone']?.toString() ?? '';
        }
      }
      final addrResp = await _apiClient.getMySavedAddresses();
      final body = addrResp.data;
      if (body is Map && body['data'] is List) {
        final list = body['data'] as List;
        if (list.isNotEmpty && list.first is Map) {
          final a = Map<String, dynamic>.from(list.first as Map);
          final street = a['street']?.toString().trim() ?? '';
          final landmark = a['landmark']?.toString().trim() ?? '';
          _userAddress = [street, landmark].where((s) => s.isNotEmpty).join(', ');
          if (_userAddress.isEmpty) {
            final lat = a['lat'];
            final lng = a['lng'];
            if (lat != null && lng != null) {
              _userAddress = '$lat, $lng';
            }
          }
        }
      }
    } catch (_) {}
    if (mounted) setState(() {});
  }

  Future<void> _editLocation() async {
    final result = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => const DeliveryPinScreen(
          returnAddress: true,
          returnLocationPayload: true,
        ),
      ),
    );
    if (result == null || !mounted) return;

    final lat = (result['lat'] as num?)?.toDouble();
    final lng = (result['lng'] as num?)?.toDouble();
    final addr = result['address']?.toString().trim() ?? '';
    if (lat == null || lng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not read map location. Try again.')),
      );
      return;
    }

    setState(() => _savingContact = true);
    try {
      await _apiClient.putMySavedAddress(
        lat: lat,
        lng: lng,
        label: 'Home',
        street: addr,
      );
      if (!mounted) return;
      setState(() {
        _userAddress = addr.isNotEmpty ? addr : '$lat, $lng';
        _savingContact = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Location saved'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _userAddress = addr.isNotEmpty ? addr : '$lat, $lng';
        _savingContact = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Location set locally; save failed: ${e.toString().replaceFirst('Exception: ', '')}',
          ),
        ),
      );
    }
  }

  Future<void> _editPhone() async {
    final ctrl = TextEditingController(text: _userPhone);
    final primary = const Color(AppConstants.primaryColor);

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Phone number', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.phone,
          autofocus: true,
          decoration: InputDecoration(
            hintText: '98XXXXXXXX',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: GoogleFonts.outfit()),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: primary),
            child: Text('Save', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );

    final phone = ctrl.text.trim();
    ctrl.dispose();
    if (saved != true || !mounted) return;
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid phone number')),
      );
      return;
    }

    setState(() => _savingContact = true);
    try {
      final resp = await _apiClient.updateProfile({'phone': phone});
      if (resp.statusCode != 200) {
        throw Exception('Could not update phone');
      }
      final raw = await _storage.getUser();
      if (raw != null && raw.isNotEmpty) {
        try {
          final u = jsonDecode(raw);
          if (u is Map) {
            final um = Map<String, dynamic>.from(u);
            um['phone'] = phone;
            await _storage.saveUser(jsonEncode(um));
          }
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _userPhone = phone;
        _savingContact = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Phone number saved'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _savingContact = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
        ),
      );
    }
  }

  Widget _contactRow({
    required IconData icon,
    required String value,
    required String emptyHint,
    required VoidCallback onEdit,
  }) {
    const primary = Color(AppConstants.primaryColor);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: primary),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            value.isEmpty ? emptyHint : value,
            style: GoogleFonts.outfit(
              fontSize: 13,
              color: value.isEmpty ? Colors.grey[600] : Colors.black87,
              height: 1.35,
            ),
          ),
        ),
        TextButton(
          onPressed: _savingContact ? null : onEdit,
          child: Text(
            value.isEmpty ? 'Add' : 'Edit',
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: primary,
            ),
          ),
        ),
      ],
    );
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
      final isPickup = _serviceDelivery == 'home_visit';
      if (isPickup && (_pickupLocation == null || _pickupLocation!['address'] == null)) {
        throw Exception('Please select a pickup location');
      }
      final resp = await _apiClient.createCareBooking({
        'hostelId': widget.hostel['_id'],
        'petId': _selectedPet!.id,
        'checkIn': checkIn.toIso8601String(),
        'checkOut': checkOut.toIso8601String(),
        'packageName': _selectedPackage!['name'],
        'addOns': _selectedAddOns.toList(),
        'serviceDelivery': _serviceDelivery,
        'logisticsType': isPickup ? 'pickup' : 'self_drop',
        if (isPickup)
          'pickupAddress': {
            'address': _pickupLocation!['address'],
            'coordinates': [
              _pickupLocation!['lng'],
              _pickupLocation!['lat'],
            ],
          },
        if (!isPickup)
          'pickupAddress': {
            'address': 'Self Drop-off',
            'point': {
              'type': 'Point',
              'coordinates': [0.0, 0.0],
            },
          },
        'paymentMethod': paymentOnline ? 'online' : 'cash_on_delivery',
      });

      if (resp.data is Map && resp.data['success'] == true && resp.data['data'] is Map) {
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
      final pidx = data?['pidx']?.toString();
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
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: primary),
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
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('SELECT PET'),
          const SizedBox(height: 12),
          if (_loadingPets)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Center(child: PawSewaLoader()),
            )
          else if (_pets.isEmpty)
            _emptyHint('Add a pet from My Pets first.')
          else
            SizedBox(
              height: 118,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _pets.length,
                itemBuilder: (context, i) {
                  final pet = _pets[i];
                  final selected = _selectedPet?.id == pet.id;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedPet = pet),
                    child: Container(
                      width: 200,
                      margin: const EdgeInsets.only(right: 14),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: selected ? primary : Colors.grey.shade300,
                          width: selected ? 2 : 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.06),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: primary.withValues(alpha: 0.12),
                            backgroundImage: pet.photoUrl != null &&
                                    pet.photoUrl!.isNotEmpty
                                ? CachedNetworkImageProvider(pet.photoUrl!)
                                : null,
                            child: pet.photoUrl == null || pet.photoUrl!.isEmpty
                                ? Text(
                                    pet.name.isNotEmpty
                                        ? pet.name[0].toUpperCase()
                                        : '?',
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 20,
                                      color: primary,
                                    ),
                                  )
                                : null,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  pet.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'ID: ${pet.pawId ?? pet.id}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    color: Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (selected)
                            Icon(Icons.check_circle_rounded, color: primary, size: 22),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 28),
          _sectionTitle('CHOOSE GROOMING PACKAGE'),
          const SizedBox(height: 14),
          SizedBox(
            height: 152,
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
                    width: 200,
                    margin: const EdgeInsets.only(right: 14),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: selected ? primary.withValues(alpha: 0.08) : Colors.grey[50],
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: selected ? primary : Colors.grey.shade300, width: selected ? 2 : 1),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('NPR ${price.toStringAsFixed(0)}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 17, color: primary)),
                        const SizedBox(height: 4),
                        Text(name, style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 15)),
                        if (desc.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(desc, maxLines: 2, overflow: TextOverflow.ellipsis, style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600], height: 1.25)),
                        ],
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(Icons.access_time, size: 14, color: Colors.grey[600]),
                            Text(' $mins mins', style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600])),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 28),
          _sectionTitle('SERVICE DELIVERY'),
          const SizedBox(height: 14),
          Row(
            children: [
              _deliveryCard('home_visit', 'Request Pickup', 'We’ll pick up your pet from your location', Icons.local_taxi_rounded),
              const SizedBox(width: 12),
              _deliveryCard('visit_center', 'Self-Drop', 'You bring your pet to the center', Icons.store_rounded),
            ],
          ),
          if (_serviceDelivery == 'home_visit') ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Pickup address',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: primary),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _pickupLocation?['address']?.toString() ?? 'No pickup location selected yet.',
                    style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey[700]),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final result = await Navigator.of(context).push<Map<String, dynamic>>(
                          MaterialPageRoute(
                            builder: (_) => const DeliveryPinScreen(
                              returnAddress: true,
                              returnLocationPayload: true,
                            ),
                          ),
                        );
                        if (result != null && mounted) {
                          setState(() => _pickupLocation = result);
                        }
                      },
                      icon: const Icon(Icons.my_location_rounded),
                      label: Text('Pick pickup location', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: primary,
                        side: const BorderSide(color: primary),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 28),
          _sectionTitle('ADD-ONS'),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _addOns.map((a) {
              final name = a['name']?.toString() ?? '';
              final price = (a['price'] ?? 0) as num;
              final sel = _selectedAddOns.contains(name);
              return FilterChip(
                label: Text('$name (+Rs. ${price.toStringAsFixed(0)})', style: GoogleFonts.outfit(fontSize: 13)),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
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
          const SizedBox(height: 28),
          _sectionTitle('SELECT DATE & TIME'),
          const SizedBox(height: 14),
          SizedBox(
            height: 64,
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
                    width: 62,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: BoxDecoration(
                      color: sel ? primary : Colors.grey[100],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(weekday, style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w600, color: sel ? Colors.white : Colors.grey[700])),
                        const SizedBox(height: 2),
                        Text('${d.day}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16, color: sel ? Colors.white : Colors.grey[800])),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _timeSlots.map((t) {
              final sel = _selectedTimeSlot == t;
              return GestureDetector(
                onTap: () => setState(() => _selectedTimeSlot = t),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  decoration: BoxDecoration(
                    color: sel ? primary : Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(t, style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 13, color: sel ? Colors.white : Colors.grey[800])),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 28),
          _sectionTitle('LOCATION & CONTACT'),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                _contactRow(
                  icon: Icons.location_on_rounded,
                  value: _userAddress,
                  emptyHint: 'Tap Add to pin your location on the map',
                  onEdit: _editLocation,
                ),
                const Divider(height: 20),
                _contactRow(
                  icon: Icons.phone_rounded,
                  value: _userPhone,
                  emptyHint: 'Tap Add to enter your contact number',
                  onEdit: _editPhone,
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          _sectionTitle('PAYMENT & SUMMARY'),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(20),
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
            Text(_error!, style: GoogleFonts.outfit(fontSize: 13, color: Colors.red)),
          ],
        ],
      ),
    );
  }

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600]),
    );
  }

  Widget _emptyHint(String text) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.amber.shade200)),
      child: Text(text, style: GoogleFonts.outfit(fontSize: 14, color: Colors.amber.shade900)),
    );
  }

  Widget _deliveryCard(String value, String title, String subtitle, IconData icon) {
    const primary = Color(AppConstants.primaryColor);
    final selected = _serviceDelivery == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _serviceDelivery = value),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? primary : Colors.grey.shade300, width: selected ? 2 : 1),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 28, color: primary),
              const SizedBox(height: 10),
              Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 4),
              Text(subtitle, style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600], height: 1.3)),
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
          Text(label, style: GoogleFonts.outfit(fontSize: 14, fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(value, style: GoogleFonts.outfit(fontSize: 14, fontWeight: bold ? FontWeight.bold : FontWeight.w500, color: const Color(AppConstants.primaryColor))),
        ],
      ),
    );
  }

  Widget _buildBookFooter() {
    const primary = Color(AppConstants.primaryColor);
    const khaltiPurple = Color(0xFF5C2D91);
    final disabled = _creating ||
        _pets.isEmpty ||
        _selectedPackage == null ||
        _selectedDate == null ||
        _selectedTimeSlot == null;
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                onPressed: disabled ? null : () => _createBooking(paymentOnline: true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: khaltiPurple,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.grey.shade300,
                  disabledForegroundColor: Colors.grey.shade600,
                  elevation: disabled ? 0 : 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: _creating
                    ? const SizedBox(
                        height: 24,
                        width: 24,
                        child: PawSewaLoader(width: 36, center: false),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.account_balance_wallet_rounded, size: 22),
                          const SizedBox(width: 10),
                          Text(
                            'Confirm & Pay with Khalti',
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton(
                onPressed: disabled ? null : () => _createBooking(paymentOnline: false),
                style: OutlinedButton.styleFrom(
                  foregroundColor: primary,
                  side: BorderSide(color: primary.withValues(alpha: 0.5), width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  'Book & Pay at Center (COD)',
                  style: GoogleFonts.outfit(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
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
          Text('Payment Summary', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold)),
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
          Text('PAY WITH', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600])),
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
          icon: _paying ? const SizedBox(width: 20, height: 20, child: PawSewaLoader(width: 36, center: false)) : const Icon(Icons.payment, size: 18),
          label: Text('Confirm Grooming Appointment  Rs. ${total.toStringAsFixed(0)}', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
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
