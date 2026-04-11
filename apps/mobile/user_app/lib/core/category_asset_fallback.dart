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
    // Care centres / hostel images
    'pets': '../../../assets/petphotos/',
    'hostel': '../../../assets/petphotos/',
  };

  static List<String> _prefixAlternates(String prefix) {
    final out = <String>[prefix];
    final stripped = prefix.replaceFirst(RegExp(r'^(\.\./)+'), '');
    if (stripped != prefix) out.add(stripped);
    // In case someone configured without leading "../" but manifest has it (rare).
    if (!out.contains('../../../$stripped')) out.add('../../../$stripped');
    return out.toSet().toList();
  }

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

  /// Maps API category name/slug strings to an asset folder key in [_categoryToPrefix].
  static String normalizeShopCategory(String? raw) {
    final s = (raw ?? '').trim().toLowerCase();
    if (s.isEmpty) return 'pets';
    final n = _normalizeCategory(s);
    if (_categoryToPrefix.containsKey(n)) return n;
    if (s.contains('food') ||
        s.contains('feed') ||
        s.contains('treat') ||
        s.contains('snack') ||
        s.contains('hay') ||
        s.contains('kibble')) {
      return 'food';
    }
    if (s.contains('groom')) return 'grooming';
    if (s.contains('medic') ||
        s.contains('vitamin') ||
        s.contains('supplement') ||
        s.contains('deworm') ||
        s.contains('flea') ||
        s.contains('tick')) {
      return 'medicine';
    }
    if (s.contains('accessor') ||
        s.contains('toy') ||
        s.contains('collar') ||
        s.contains('leash') ||
        s.contains('bandana')) {
      return 'accessories';
    }
    if (s.contains('essential') ||
        s.contains('bowl') ||
        s.contains('bed') ||
        s.contains('crate') ||
        s.contains('litter') ||
        s.contains('carrier')) {
      return 'essentials';
    }
    return 'pets';
  }

  static String shopCategoryHint(Map<String, dynamic>? product) {
    if (product == null) return '';
    final cat = product['category'];
    if (cat is Map) {
      final name = cat['name']?.toString() ?? '';
      final slug = cat['slug']?.toString() ?? '';
      return '$name $slug'.trim();
    }
    return cat?.toString().trim() ?? '';
  }

  static String shopProductSeed(Map<String, dynamic> product) {
    return product['_id']?.toString() ??
        product['id']?.toString() ??
        product['name']?.toString() ??
        '0';
  }

  /// Stable image per [seed] so grid tiles do not flicker on rebuild.
  static Future<String?> pickForCategorySeeded(
    String? categoryHint,
    String seed,
  ) async {
    final norm = normalizeShopCategory(categoryHint);
    final prefix = _categoryToPrefix[norm];
    if (prefix == null) return null;

    await _ensureLoaded();
    final byPrefix = _byPrefix ?? const <String, List<String>>{};
    final list = byPrefix[prefix] ?? const <String>[];
    if (list.isEmpty) {
      if (kDebugMode) {
        debugPrint('[INFO] Mapping local assets from folder: $prefix (empty).');
      }
      return null;
    }
    if (kDebugMode) {
      debugPrint('[INFO] Mapping local assets from folder: $prefix.');
    }
    final idx = (seed.hashCode & 0x7fffffff) % list.length;
    return list[idx];
  }

  static Future<void> _ensureLoaded() async {
    if (_byPrefix != null) return;
    final byPrefix = <String, List<String>>{};
    for (final prefix in _categoryToPrefix.values.toSet()) {
      byPrefix[prefix] = <String>[];
    }

    // Use Flutter's AssetManifest API so this works regardless of whether
    // the manifest is stored as json/bin in the build output.
    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    final allAssets = manifest.listAssets();

    // Precompute alternates for each configured prefix.
    final altByConfigured = <String, List<String>>{
      for (final p in byPrefix.keys) p: _prefixAlternates(p),
    };

    for (final path in allAssets) {
      for (final configuredPrefix in byPrefix.keys) {
        final alternates = altByConfigured[configuredPrefix] ?? const <String>[];
        if (alternates.any(path.startsWith)) {
          byPrefix[configuredPrefix]!.add(path);
        }
      }
    }

    for (final e in byPrefix.entries) {
      e.value.sort();
    }

    _byPrefix = byPrefix;

    if (kDebugMode) {
      // Helpful to verify which prefix format Flutter actually emitted.
      final report = <String, int>{};
      for (final entry in _categoryToPrefix.entries) {
        final list = byPrefix[entry.value] ?? const <String>[];
        report[entry.key] = list.length;
      }
      debugPrint('[ASSETS] CategoryAssetFallback loaded: $report');
    }
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

  /// Home promo slider: always picks from [foodimages]. When [preferTimothyHayPromo]
  /// is true, prefers filenames suggesting hay / small-pet feed (Timothy Hay promo).
  static Future<String?> pickFoodImageForHomeBanner({
    bool preferTimothyHayPromo = false,
  }) async {
    await _ensureLoaded();
    final prefix = _categoryToPrefix['food']!;
    final byPrefix = _byPrefix ?? const <String, List<String>>{};
    final list = byPrefix[prefix] ?? const <String>[];
    if (list.isEmpty) {
      if (kDebugMode) {
        debugPrint('[INFO] foodimages empty for home banner.');
      }
      return null;
    }
    if (preferTimothyHayPromo) {
      const keys = [
        'hay',
        'timothy',
        'grass',
        'feed',
        'pellet',
        'herb',
        'rabbit',
        'guinea',
        'bale',
      ];
      final matches = list.where((p) {
        final n = p.toLowerCase();
        return keys.any((k) => n.contains(k));
      }).toList();
      if (matches.isNotEmpty) {
        return matches[_rng.nextInt(matches.length)];
      }
    }
    if (kDebugMode) {
      debugPrint('[INFO] Mapping local assets from folder: $prefix (home banner).');
    }
    return list[_rng.nextInt(list.length)];
  }

  /// Home slider assets: 0 = hostel/pet stays, 1 = grooming folder, 2 = food (Timothy Hay when [preferTimothyHayPromo]).
  static Future<String?> pickHomeBannerAsset(
    int bannerImageIndex, {
    bool preferTimothyHayPromo = false,
  }) async {
    await _ensureLoaded();
    switch (bannerImageIndex.clamp(0, 2)) {
      case 0:
        return pickForCategory('hostel');
      case 1:
        return pickForCategory('grooming');
      case 2:
      default:
        return pickFoodImageForHomeBanner(
          preferTimothyHayPromo: preferTimothyHayPromo,
        );
    }
  }
}

