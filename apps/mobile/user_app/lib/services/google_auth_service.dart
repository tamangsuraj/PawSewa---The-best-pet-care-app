import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';

class GoogleAuthService {
  static final GoogleAuthService _instance = GoogleAuthService._internal();
  factory GoogleAuthService() => _instance;
  GoogleAuthService._internal();

  // Web Client ID from the same Firebase project as this app (google-services.json).
  // Required so Google returns an ID token on Android/iOS.
  static const String _serverClientId =
      '188502859936-doe0igj265poprfntbg3hkq8coo3kndu.apps.googleusercontent.com';

  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    serverClientId: _serverClientId,
  );

  final ApiClient _apiClient = ApiClient();

  Future<Map<String, dynamic>?> signInWithGoogle() async {
    try {
      // Trigger the Google Sign-In flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        // User cancelled the sign-in
        return null;
      }

      // Obtain the auth details from the request
      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final String? idToken = googleAuth.idToken;

      if (idToken == null) {
        throw Exception('Failed to get ID token from Google');
      }

      // Backend requires email and name; optional googleId for new-account password.
      final String email = googleUser.email;
      final String name = googleUser.displayName ?? email.split('@').first;

      final response = await _apiClient.post('/auth/google', {
        'googleToken': idToken,
        'email': email,
        'name': name,
        'googleId': googleUser.id,
      });

      if (response.data['success'] == true) {
        return response.data['data'];
      } else {
        throw Exception(response.data['message'] ?? 'Google sign-in failed');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Google Sign-In Error: $e');
      }
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
  }
}
