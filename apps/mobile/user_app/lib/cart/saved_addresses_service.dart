import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SavedAddress {
  SavedAddress({
    required this.label,
    required this.address,
    required this.lat,
    required this.lng,
  });

  final String label;
  final String address;
  final double lat;
  final double lng;

  Map<String, dynamic> toJson() => {
        'label': label,
        'address': address,
        'lat': lat,
        'lng': lng,
      };

  static SavedAddress? fromJson(Map<String, dynamic>? map) {
    if (map == null) return null;
    final label = map['label']?.toString();
    final address = map['address']?.toString();
    final lat = (map['lat'] as num?)?.toDouble();
    final lng = (map['lng'] as num?)?.toDouble();
    if (label == null || address == null || lat == null || lng == null) {
      return null;
    }
    return SavedAddress(label: label, address: address, lat: lat, lng: lng);
  }
}

const String _key = 'pawsewa_saved_addresses';

class SavedAddressesService extends ChangeNotifier {
  List<SavedAddress> _list = [];
  bool _loaded = false;

  List<SavedAddress> get list => List.unmodifiable(_list);
  bool get isLoaded => _loaded;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null || raw.isEmpty) {
        _list = [];
      } else {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          _list = decoded
              .map((e) => SavedAddress.fromJson(e is Map ? Map<String, dynamic>.from(e) : null))
              .whereType<SavedAddress>()
              .toList();
        } else {
          _list = [];
        }
      }
      _loaded = true;
      notifyListeners();
    } catch (_) {
      _list = [];
      _loaded = true;
      notifyListeners();
    }
  }

  Future<void> add(SavedAddress address) async {
    _list.removeWhere((a) => a.label.toLowerCase() == address.label.toLowerCase());
    _list.insert(0, address);
    if (_list.length > 10) _list = _list.take(10).toList();
    await _save();
    notifyListeners();
  }

  Future<void> remove(String label) async {
    _list.removeWhere((a) => a.label.toLowerCase() == label.toLowerCase());
    await _save();
    notifyListeners();
  }

  Future<void> _save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = jsonEncode(_list.map((e) => e.toJson()).toList());
      await prefs.setString(_key, encoded);
    } catch (_) {}
  }
}
