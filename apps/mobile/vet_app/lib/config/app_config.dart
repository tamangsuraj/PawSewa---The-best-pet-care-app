import '../core/constants.dart';

/// Global server configuration for API + Socket.io (same origin as ngrok tunnel).
///
/// Priority:
/// 1. `--dart-define=PAWSEWA_BASE_URL=https://xxx.ngrok-free.app`
/// 2. `--dart-define=BASE_URL=https://xxx.ngrok-free.app` (alias)
/// 3. [ngrokDefaultOrigin] when you replace the placeholder
/// 4. `--dart-define=API_HOST=192.168.1.x` or LAN default
class AppConfig {
  AppConfig._();

  static const String ngrokDefaultOrigin = 'https://your-id.ngrok-free.app';

  static const String _dartDefineOrigin = String.fromEnvironment(
    'PAWSEWA_BASE_URL',
    defaultValue: '',
  );

  static const String _dartDefineBaseUrl = String.fromEnvironment(
    'BASE_URL',
    defaultValue: '',
  );

  static const String _dartDefineLanHost = String.fromEnvironment(
    'API_HOST',
    defaultValue: '192.168.1.5',
  );

  static bool _looksLikePlaceholder(String o) {
    final s = o.toLowerCase();
    return s.contains('your-id') || s.contains('your_id');
  }

  static String defaultHostValue() {
    if (AppConstants.kUseEmulator) return '10.0.2.2';
    final fromBase = _dartDefineBaseUrl.trim();
    if (fromBase.isNotEmpty) {
      return fromBase.endsWith('/')
          ? fromBase.substring(0, fromBase.length - 1)
          : fromBase;
    }
    final fromEnv = _dartDefineOrigin.trim();
    if (fromEnv.isNotEmpty) {
      return fromEnv.endsWith('/')
          ? fromEnv.substring(0, fromEnv.length - 1)
          : fromEnv;
    }
    final ng = ngrokDefaultOrigin.trim();
    if (ng.isNotEmpty && !_looksLikePlaceholder(ng)) {
      return ng.endsWith('/') ? ng.substring(0, ng.length - 1) : ng;
    }
    return _dartDefineLanHost.trim();
  }
}
