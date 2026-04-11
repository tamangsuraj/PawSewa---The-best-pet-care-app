import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Centralised, deterministic Unsplash image resolution for every product,
/// category, pet-type, and care-centre card in the PawSewa user app.
///
/// All URLs use high-quality static Unsplash photo IDs so they are CDN-cached
/// and never return "Ngrok browser warning" pages.
class ProductImageService {
  ProductImageService._();

  /// Web fallback when no DB image and local asset bundles are empty (Unsplash CDN; not ngrok).
  static const String defaultWebFallbackProduct =
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=80&w=800';

  static const Map<String, String> _ngrok = {
    'ngrok-skip-browser-warning': 'true',
  };

  // ── Pet-type category circles ─────────────────────────────────────────────
  static const Map<String, String> petTypeUrls = {
    'dog':   'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=500',
    'dogs':  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=500',
    'cat':   'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=500',
    'cats':  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=500',
    'bird':  'https://images.unsplash.com/photo-1444464666168-49d633b867ad?q=80&w=500',
    'birds': 'https://images.unsplash.com/photo-1444464666168-49d633b867ad?q=80&w=500',
    'rabbit': 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?q=80&w=500',
    'small pets': 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?q=80&w=500',
    'fish':  'https://images.unsplash.com/photo-1535591273668-578e31182c4f?q=80&w=500',
  };

  // ── Shop product-category pools (multiple options → picked by product id hash) ──
  static const Map<String, List<String>> _categoryPools = {
    'food': [
      'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?q=80&w=500',
      'https://images.unsplash.com/photo-1601758003122-53c40e686a19?q=80&w=500',
      'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?q=80&w=500',
      'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?q=80&w=500',
    ],
    'medicine': [
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=500',
      'https://images.unsplash.com/photo-1576671081837-49000212a370?q=80&w=500',
      'https://images.unsplash.com/photo-1550831106-0994fe8abcfe?q=80&w=500',
    ],
    'accessories': [
      'https://images.unsplash.com/photo-1604917877934-07d8d248d396?q=80&w=500',
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=500',
      'https://images.unsplash.com/photo-1601758003122-53c40e686a19?q=80&w=500',
      'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?q=80&w=500',
    ],
    'grooming': [
      'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=80&w=500',
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=500',
      'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=500',
    ],
    'essentials': [
      'https://images.unsplash.com/photo-1596854307943-57e9a37e5c03?q=80&w=500',
      'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?q=80&w=500',
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=500',
    ],
    // keyword-based overrides matched against product name
    'harness': ['https://images.unsplash.com/photo-1604917877934-07d8d248d396?q=80&w=500'],
    'collar':  ['https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=500'],
    'leash':   ['https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=80&w=500'],
    'toy':     ['https://images.unsplash.com/photo-1567393528677-d6adf4b3c85a?q=80&w=500'],
    'brush':   ['https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=80&w=500'],
    'shampoo': ['https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=500'],
    'bowl':    ['https://images.unsplash.com/photo-1596854307943-57e9a37e5c03?q=80&w=500'],
    'bed':     ['https://images.unsplash.com/photo-1596854307943-57e9a37e5c03?q=80&w=500'],
    'carrier': ['https://images.unsplash.com/photo-1596854307943-57e9a37e5c03?q=80&w=500'],
    'tick':    ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=500'],
    'flea':    ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=500'],
    'treat':   ['https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?q=80&w=500'],
    'kibble':  ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?q=80&w=500'],
    'hay':     ['https://images.unsplash.com/photo-1425082661705-1834bfd09dca?q=80&w=500'],
  };

  // ── Care-centre category fallbacks ────────────────────────────────────────
  static const Map<String, String> careFallbackUrls = {
    'hostel':   'https://images.unsplash.com/photo-1591946614720-90a587da4a36?q=80&w=800',
    'hotel':    'https://images.unsplash.com/photo-1591946614720-90a587da4a36?q=80&w=800',
    'grooming': 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=80&w=800',
    'spa':      'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=800',
    'training': 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800',
    'daycare':  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=800',
    'wash':     'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=800',
    'default':  'https://images.unsplash.com/photo-1591946614720-90a587da4a36?q=80&w=800',
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  /// First image URL stored on the product ([images] from API), if any.
  static String? storedImageUrlForProduct(Map<String, dynamic> product) {
    final raw = product['images'];
    if (raw is List && raw.isNotEmpty) {
      for (final e in raw) {
        final s = e?.toString().trim() ?? '';
        if (s.isNotEmpty) return s;
      }
    }
    for (final key in ['imageUrl', 'image']) {
      final v = product[key];
      if (v != null) {
        final s = v.toString().trim();
        if (s.isNotEmpty) return s;
      }
    }
    return null;
  }

  /// Resolves a product map: prefer API [images] / imageUrl; else Unsplash pools.
  static String urlForProduct(Map<String, dynamic> product) {
    final stored = storedImageUrlForProduct(product);
    if (stored != null) return stored;

    final name = (product['name'] ?? '').toString().toLowerCase();
    final catRaw = product['category'];
    final catName = catRaw is Map
        ? (catRaw['name'] ?? '').toString().toLowerCase()
        : (catRaw ?? '').toString().toLowerCase();
    final catSlug = catRaw is Map
        ? (catRaw['slug'] ?? '').toString().toLowerCase()
        : catName;

    // 1) Check product name keywords (most specific)
    for (final kw in _categoryPools.keys) {
      if (kw.length > 4 && name.contains(kw)) {
        return _pickFromPool(_categoryPools[kw]!, _seedOf(product));
      }
    }

    // 2) Match on category slug/name
    final catKey = _normCatKey('$catName $catSlug');
    if (_categoryPools.containsKey(catKey)) {
      return _pickFromPool(_categoryPools[catKey]!, _seedOf(product));
    }

    // 3) Fallback: shared high-quality pet-supplies photo
    return defaultWebFallbackProduct;
  }

  /// Resolves a category name/slug pair to an Unsplash URL for strip circles.
  static String urlForCategory(String name, String slug) {
    final k = '$name $slug'.toLowerCase();

    // Pet types first
    for (final e in petTypeUrls.entries) {
      if (k.contains(e.key)) return e.value;
    }

    final key = _normCatKey(k);
    if (_categoryPools.containsKey(key)) {
      return _categoryPools[key]!.first;
    }
    return 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=80&w=500';
  }

  /// Resolves a care-service type to its fallback Unsplash URL.
  static String urlForCareService(String serviceType) {
    final k = serviceType.toLowerCase();
    for (final e in careFallbackUrls.entries) {
      if (k.contains(e.key)) return e.value;
    }
    return careFallbackUrls['default']!;
  }

  // ── Widget helpers ─────────────────────────────────────────────────────────

  /// A drop-in that always shows an image (no paw icon fallback).
  static Widget networkImage(
    String url, {
    BoxFit fit = BoxFit.cover,
    double? width,
    double? height,
    BorderRadius? borderRadius,
    Widget? placeholder,
  }) {
    Widget img = CachedNetworkImage(
      imageUrl: url,
      httpHeaders: _ngrok,
      fit: fit,
      width: width,
      height: height,
      placeholder: (context, _) =>
          placeholder ??
          Container(
            color: const Color(0xFFF6F1EC),
            child: const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xFF795548),
                ),
              ),
            ),
          ),
      errorWidget: (context, url2, err) => _ErrorTile(url: url2, fit: fit),
    );
    if (borderRadius != null) {
      img = ClipRRect(borderRadius: borderRadius, child: img);
    }
    return img;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  static String _normCatKey(String raw) {
    final s = raw.trim().toLowerCase();
    if (s.contains('food') || s.contains('treat') || s.contains('kibble') || s.contains('hay')) return 'food';
    if (s.contains('medic') || s.contains('vitamin') || s.contains('tick') || s.contains('flea') || s.contains('deworm')) return 'medicine';
    if (s.contains('groom')) return 'grooming';
    if (s.contains('access') || s.contains('collar') || s.contains('harness') || s.contains('leash') || s.contains('toy')) return 'accessories';
    if (s.contains('essential') || s.contains('bowl') || s.contains('bed') || s.contains('crate') || s.contains('carrier')) return 'essentials';
    return '';
  }

  static String _seedOf(Map<String, dynamic> p) =>
      p['_id']?.toString() ?? p['id']?.toString() ?? p['name']?.toString() ?? '0';

  static String _pickFromPool(List<String> pool, String seed) {
    if (pool.isEmpty) return careFallbackUrls['default']!;
    final idx = (seed.hashCode & 0x7fffffff) % pool.length;
    return pool[idx];
  }
}

// ── Small error tile so failed images show a warm placeholder ─────────────

class _ErrorTile extends StatelessWidget {
  const _ErrorTile({required this.url, required this.fit});
  final String url;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF6F1EC),
      alignment: Alignment.center,
      child: const Icon(Icons.pets_rounded, color: Color(0xFFBCAAA4), size: 36),
    );
  }
}
