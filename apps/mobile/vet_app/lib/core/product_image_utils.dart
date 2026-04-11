import 'api_config.dart';

/// Normalizes one API image field (string URL or `{ url, secure_url }` map).
String? parseProductImageEntry(dynamic e) {
  if (e == null) return null;
  if (e is Map) {
    for (final k in ['secure_url', 'url', 'src']) {
      final v = e[k];
      if (v != null) {
        final s = v.toString().trim();
        if (s.isNotEmpty) return s;
      }
    }
    return null;
  }
  final s = e.toString().trim();
  return s.isEmpty ? null : s;
}

bool _isAbsoluteHttp(String s) =>
    s.startsWith('http://') || s.startsWith('https://');

/// First usable absolute `http(s)` URL from [product] (images list or legacy fields).
String? firstAbsoluteProductImageUrl(Map<String, dynamic> product) {
  final raw = product['images'];
  if (raw is List) {
    for (final e in raw) {
      final s = parseProductImageEntry(e);
      if (s != null && _isAbsoluteHttp(s)) return s;
    }
  }
  for (final key in ['imageUrl', 'image', 'primaryImageUrl']) {
    final s = parseProductImageEntry(product[key]);
    if (s != null && _isAbsoluteHttp(s)) return s;
  }
  return null;
}

/// First non-empty path that is not already an absolute URL (e.g. `/uploads/x`, `uploads/x`).
String? firstRelativeProductImagePath(Map<String, dynamic> product) {
  final raw = product['images'];
  if (raw is List) {
    for (final e in raw) {
      final s = parseProductImageEntry(e);
      if (s == null || _isAbsoluteHttp(s)) continue;
      if (s.isNotEmpty) return s;
    }
  }
  for (final key in ['imageUrl', 'image', 'primaryImageUrl']) {
    final s = parseProductImageEntry(product[key]);
    if (s != null && !_isAbsoluteHttp(s) && s.isNotEmpty) return s;
  }
  return null;
}

/// Resolves a display URL for a product map (Cloudinary, ngrok-hosted files, relative paths).
Future<String?> resolveProductImageUrl(Map<String, dynamic> product) async {
  final abs = firstAbsoluteProductImageUrl(product);
  if (abs != null) return abs;

  final rel = firstRelativeProductImagePath(product);
  if (rel != null) {
    final origin = await ApiConfig.getSocketUrl();
    final base = origin.endsWith('/') ? origin.substring(0, origin.length - 1) : origin;
    final path = rel.startsWith('/') ? rel : '/$rel';
    return '$base$path';
  }
  return null;
}

/// Ngrok interstitial bypass for image fetches (harmless on other hosts).
Map<String, String> ngrokHeadersForImageUrl(String url) {
  if (url.toLowerCase().contains('ngrok')) {
    return {'ngrok-skip-browser-warning': 'true'};
  }
  return {};
}
