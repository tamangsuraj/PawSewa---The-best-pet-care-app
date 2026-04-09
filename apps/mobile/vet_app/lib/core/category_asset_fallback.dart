import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class CategoryAssetFallback {
  CategoryAssetFallback._();

  static final Random _rng = Random();
  static Map<String, List<String>>? _byPrefix;

  static const Map<String, String> _categoryToPrefix = {
    'accessories': '../../../assets/accessoriesimages/',
    'essentials': '../../../assets/essentialsimages/',
    'food': '../../../assets/foodimages/',
    'grooming': '../../../assets/groomingimages/',
    'medicine': '../../../assets/medicineimages/',
    'pets': '../../../assets/petphotos/',
    'hostel': '../../../assets/petphotos/',
  };

  static String _normalizeCategory(String? raw) {
    final s = (raw ?? '').trim().toLowerCase();
    if (s.isEmpty) return '';
    if (s.contains('hostel') || s.contains('care')) return 'hostel';
    if (s.contains('medicine') || s.contains('med')) return 'medicine';
    if (s.contains('groom')) return 'grooming';
    if (s.contains('food')) return 'food';
    if (s.contains('essential')) return 'essentials';
    if (s.contains('access')) return 'accessories';
    if (s.contains('pet')) return 'pets';
    return s;
  }

  static Future<void> _ensureLoaded() async {
    if (_byPrefix != null) return;
    final raw = await rootBundle.loadString('AssetManifest.json');
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      _byPrefix = <String, List<String>>{};
      return;
    }

    final byPrefix = <String, List<String>>{};
    for (final prefix in _categoryToPrefix.values.toSet()) {
      byPrefix[prefix] = <String>[];
    }

    for (final k in decoded.keys) {
      final path = k.toString();
      for (final prefix in byPrefix.keys) {
        if (path.startsWith(prefix)) {
          byPrefix[prefix]!.add(path);
        }
      }
    }

    for (final e in byPrefix.entries) {
      e.value.sort();
    }

    _byPrefix = byPrefix;
  }

  static Future<String?> pickForCategory(String? category) async {
    final norm = _normalizeCategory(category);
    final prefix = _categoryToPrefix[norm];
    if (prefix == null) return null;

    await _ensureLoaded();
    final byPrefix = _byPrefix ?? const <String, List<String>>{};
    final list = byPrefix[prefix] ?? const <String>[];
    if (list.isEmpty) {
      if (kDebugMode) {
        debugPrint('[INFO] Mapping local assets from folder: $prefix.');
      }
      return null;
    }
    if (kDebugMode) {
      debugPrint('[INFO] Mapping local assets from folder: $prefix.');
    }
    return list[_rng.nextInt(list.length)];
  }
}

