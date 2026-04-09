import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../core/api_client.dart';

/// Structured console logging for Google OAuth (no emojis).
void _oauthLog(String level, String message) {
  debugPrint('[$level] $message');
}

class GoogleAuthService {
  static final GoogleAuthService _instance = GoogleAuthService._internal();
  factory GoogleAuthService() => _instance;
  GoogleAuthService._internal();

  /// Web OAuth client ID (server-side token verification). Override per build:
  /// `flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=xxx.apps.googleusercontent.com`
  static const String _serverClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '188502859936-doe0igj265poprfntbg3hkq8coo3kndu.apps.googleusercontent.com',
  );

  /// OpenID Connect + basic profile — surfaces the standard Google consent when needed.
  static const List<String> _scopes = <String>[
    'openid',
    'email',
    'profile',
  ];

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: _scopes,
    serverClientId: _serverClientId,
  );

  final ApiClient _apiClient = ApiClient();

  /// Manual OAuth only: never calls [GoogleSignIn.signInSilently].
  /// Clears the Google session first so [signIn] runs interactively (account picker).
  Future<Map<String, dynamic>?> signInWithGoogle() async {
    _oauthLog('INFO', 'Initializing manual Google OAuth flow.');
    await _apiClient.initialize();

    try {
      await _googleSignIn.signOut();
    } catch (e) {
      if (kDebugMode) {
        _oauthLog('DEBUG', 'Pre-sign-in Google signOut: ${e.toString()}');
      }
    }

    GoogleSignInAccount? googleUser;
    try {
      googleUser = await _googleSignIn.signIn();
    } on PlatformException catch (e) {
      if (e.code == GoogleSignIn.kSignInCanceledError) {
        _oauthLog('DEBUG', 'OAuth flow cancelled by user interaction.');
        return null;
      }
      _oauthLog(
        'ERROR',
        'Google Sign-In failed: ${e.code} ${e.message ?? ''}',
      );
      rethrow;
    }

    if (googleUser == null) {
      _oauthLog('DEBUG', 'OAuth flow cancelled by user interaction.');
      return null;
    }

    try {
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final String? idToken = googleAuth.idToken;

      if (idToken == null) {
        throw Exception('Failed to get ID token from Google');
      }

      final String email = googleUser.email;
      final String name = googleUser.displayName ?? email.split('@').first;

      final response = await _apiClient.post('/auth/google', {
        'googleToken': idToken,
        'email': email,
        'name': name,
        'appContext': 'customer',
      });

      if (response.data['success'] == true) {
        final data = response.data['data'];
        if (data is Map<String, dynamic>) {
          _oauthLog('SUCCESS', 'Authentication successful for user: $email');
          return data;
        }
        if (data is Map) {
          _oauthLog('SUCCESS', 'Authentication successful for user: $email');
          return Map<String, dynamic>.from(data);
        }
        throw Exception('Invalid response from server');
      } else {
        throw Exception(
          response.data['message']?.toString() ?? 'Google sign-in failed',
        );
      }
    } catch (e) {
      _oauthLog('ERROR', 'Google Sign-In Error: $e');
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
  }
}
