import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';

/// Google Sign-In for Partner app — sends [appContext: partner] and [partnerRole] for new accounts.
class PartnerGoogleAuthService {
  static final PartnerGoogleAuthService _instance =
      PartnerGoogleAuthService._internal();
  factory PartnerGoogleAuthService() => _instance;
  PartnerGoogleAuthService._internal();

  static const String _serverClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '188502859936-doe0igj265poprfntbg3hkq8coo3kndu.apps.googleusercontent.com',
  );

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    serverClientId: _serverClientId,
  );

  final ApiClient _apiClient = ApiClient();

  /// [partnerRole] is required for **new** Google sign-ups (veterinarian | shop_owner | rider).
  Future<Map<String, dynamic>?> signInWithGoogle({
    required String partnerRole,
  }) async {
    try {
      await _apiClient.initialize();

      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return null;

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
        'appContext': 'partner',
        'partnerRole': partnerRole,
      });

      if (response.data['success'] == true) {
        return Map<String, dynamic>.from(response.data['data'] as Map);
      }
      throw Exception(response.data['message'] ?? 'Google sign-in failed');
    } catch (e) {
      if (kDebugMode) debugPrint('Partner Google Sign-In Error: $e');
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
  }
}
