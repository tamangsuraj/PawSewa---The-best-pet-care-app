import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

/// Central API config — single source of truth. Change here only.
/// Supports:
/// - Local IP (192.168.1.5) — phone and PC on same Wi‑Fi
/// - ngrok URL (https://xxx.ngrok-free.app) — works from anywhere, no IP changes
class ApiConfig {
  static const _keyHost = 'api_host_override';

  static String _defaultHost() => AppConfig.defaultHostValue();

  /// Stored value: either host (IP) or full URL (e.g. https://xxx.ngrok-free.app)
  static Future<String> getHost() async {
    final prefs = await SharedPreferences.getInstance();
    final override = prefs.getString(_keyHost);
    return override?.trim().isEmpty ?? true ? _defaultHost() : override!.trim();
  }

  /// True if value looks like a full URL (ngrok, etc.)
  static bool _isFullUrl(String value) =>
      value.startsWith('http://') || value.startsWith('https://');

  /// Current API base URL (e.g. http://192.168.1.5:3000/api/v1 or https://xxx.ngrok-free.app/api/v1)
  static Future<String> getBaseUrl() async {
    final value = await getHost();
    if (_isFullUrl(value)) {
      final base = value.endsWith('/') ? value.substring(0, value.length - 1) : value;
      return '$base/api/v1';
    }
    return 'http://$value:3000/api/v1';
  }

  /// Scheme + host + port only (no path). Send to backend for Khalti `return_url` so it matches this app’s API host.
  static Future<String> getApiOrigin() async {
    final base = await getBaseUrl();
    final uri = Uri.parse(base);
    if (!uri.hasScheme) return '';
    final port = uri.hasPort ? ':${uri.port}' : '';
    return '${uri.scheme}://${uri.host}$port';
  }

  /// Current Socket.io URL
  static Future<String> getSocketUrl() async {
    final value = await getHost();
    if (_isFullUrl(value)) {
      return value.endsWith('/') ? value.substring(0, value.length - 1) : value;
    }
    return 'http://$value:3000';
  }

  /// Save custom host or full URL. Accepts IP (192.168.1.5) or ngrok URL (https://xxx.ngrok-free.app).
  static Future<void> setHost(String host) async {
    final prefs = await SharedPreferences.getInstance();
    final trimmed = host.trim();
    if (trimmed.isEmpty) {
      await prefs.remove(_keyHost);
    } else {
      await prefs.setString(_keyHost, trimmed);
    }
  }

  /// Clear saved override, revert to default.
  static Future<void> clearOverride() async {
    await setHost('');
  }

  /// True if user has set a custom host.
  static Future<bool> hasOverride() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_keyHost);
    return v != null && v.trim().isNotEmpty;
  }

  /// Ngrok may inject an HTML interstitial; send this on every request to the API.
  static Map<String, String> ngrokHeadersForBaseUrl(String baseUrl) {
    if (baseUrl.toLowerCase().contains('ngrok')) {
      return {'ngrok-skip-browser-warning': 'true'};
    }
    return {};
  }

  static bool looksLikeNgrokUrl(String url) =>
      url.toLowerCase().contains('ngrok');
}
