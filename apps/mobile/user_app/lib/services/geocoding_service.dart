import 'dart:convert';

import 'package:http/http.dart' as http;

class GeocodingService {
  static const _endpoint = 'https://nominatim.openstreetmap.org/reverse';

  Future<String?> reverse({
    required double lat,
    required double lng,
  }) async {
    final uri = Uri.parse(_endpoint).replace(queryParameters: {
      'format': 'jsonv2',
      'lat': lat.toString(),
      'lon': lng.toString(),
      'zoom': '18',
      'addressdetails': '1',
    });

    final resp = await http.get(
      uri,
      headers: const {
        // Nominatim requires a valid User-Agent.
        'User-Agent': 'PawSewaUserApp/1.0 (support@pawsewa.com)',
      },
    );
    if (resp.statusCode < 200 || resp.statusCode >= 300) {
      return null;
    }
    final json = jsonDecode(resp.body);
    if (json is Map) {
      final name = json['display_name']?.toString();
      if (name != null && name.trim().isNotEmpty) return name.trim();
    }
    return null;
  }
}

