import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

/// Central API config — single source of truth. Change here only.
/// Supports: LAN / 127.0.0.1 or ngrok URL (https://xxx.ngrok-free.app)
class ApiConfig {
  static const _keyHost = 'api_host_override';

  static String _defaultHost() => AppConfig.defaultHostValue();

  static Future<String> getHost() async {
    final prefs = await SharedPreferences.getInstance();
    final override = prefs.getString(_keyHost);
    return override?.trim().isEmpty ?? true ? _defaultHost() : override!.trim();
  }

  static bool _isFullUrl(String value) =>
      value.startsWith('http://') || value.startsWith('https://');

  static Future<String> getBaseUrl() async {
    final value = await getHost();
    if (_isFullUrl(value)) {
      final base =
          value.endsWith('/') ? value.substring(0, value.length - 1) : value;
      return '$base/api/v1';
    }
    return 'http://$value:3000/api/v1';
  }

  /// Socket.io server origin (same as API host, no path).
  static Future<String> getSocketUrl() async {
    final value = await getHost();
    if (_isFullUrl(value)) {
      return value.endsWith('/') ? value.substring(0, value.length - 1) : value;
    }
    return 'http://$value:3000';
  }

  static Future<void> setHost(String host) async {
    final prefs = await SharedPreferences.getInstance();
    final trimmed = host.trim();
    if (trimmed.isEmpty) {
      await prefs.remove(_keyHost);
    } else {
      await prefs.setString(_keyHost, trimmed);
    }
  }

  static Future<void> clearOverride() async {
    await setHost('');
  }

  static Future<bool> hasOverride() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_keyHost);
    return v != null && v.trim().isNotEmpty;
  }

  static Map<String, String> ngrokHeadersForBaseUrl([String? _]) {
    return {'ngrok-skip-browser-warning': 'true'};
  }
}
