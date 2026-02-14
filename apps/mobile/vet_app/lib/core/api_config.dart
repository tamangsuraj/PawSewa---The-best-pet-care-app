import 'package:shared_preferences/shared_preferences.dart';

import 'constants.dart';

/// Central API config — single source of truth. Change here only.
/// Supports: Local IP (192.168.1.5) or ngrok URL (https://xxx.ngrok-free.app)
class ApiConfig {
  static const _keyHost = 'api_host_override';

  static String _defaultHost() {
    if (AppConstants.kUseEmulator) return '10.0.2.2';
    return const String.fromEnvironment(
      'API_HOST',
      defaultValue: '192.168.1.5',
    );
  }

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

  static Future<void> setHost(String host) async {
    final prefs = await SharedPreferences.getInstance();
    final trimmed = host.trim();
    if (trimmed.isEmpty) {
      await prefs.remove(_keyHost);
    } else {
      await prefs.setString(_keyHost, trimmed);
    }
  }
}
