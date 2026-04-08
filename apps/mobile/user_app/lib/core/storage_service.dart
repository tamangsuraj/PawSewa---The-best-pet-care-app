import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'constants.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  // Session persistence is stored in SharedPreferences (fast bootstrap on app start).
  // A best-effort migration reads older secure-storage keys once (if present) and copies them into prefs.
  final FlutterSecureStorage _legacySecureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<SharedPreferences> _prefs() => SharedPreferences.getInstance();

  Future<void> _migrateIfNeeded(SharedPreferences prefs) async {
    final hasToken = (prefs.getString(AppConstants.tokenKey) ?? '').trim().isNotEmpty;
    final hasUser = (prefs.getString(AppConstants.userKey) ?? '').trim().isNotEmpty;
    if (hasToken || hasUser) return;

    try {
      final legacyToken = (await _legacySecureStorage.read(key: AppConstants.tokenKey))?.trim() ?? '';
      final legacyUser = (await _legacySecureStorage.read(key: AppConstants.userKey))?.trim() ?? '';

      if (legacyToken.isNotEmpty) {
        await prefs.setString(AppConstants.tokenKey, legacyToken);
      }
      if (legacyUser.isNotEmpty) {
        await prefs.setString(AppConstants.userKey, legacyUser);
      }

      // If token is missing but user JSON includes it, recover it.
      if (legacyToken.isEmpty && legacyUser.isNotEmpty) {
        try {
          final decoded = jsonDecode(legacyUser);
          if (decoded is Map && decoded['token'] is String) {
            final recovered = (decoded['token'] as String).trim();
            if (recovered.isNotEmpty) {
              await prefs.setString(AppConstants.tokenKey, recovered);
            }
          }
        } catch (_) {}
      }

      // Do not delete legacy values automatically; keep rollback-safe.
    } catch (_) {
      // Ignore migration errors; treat as not logged in.
    }
  }

  // Save auth token
  Future<void> saveToken(String token) async {
    final prefs = await _prefs();
    await prefs.setString(AppConstants.tokenKey, token);
  }

  // Get auth token
  Future<String?> getToken() async {
    final prefs = await _prefs();
    await _migrateIfNeeded(prefs);

    final token = (prefs.getString(AppConstants.tokenKey) ?? '').trim();
    if (token.isNotEmpty) return token;

    final userJson = (prefs.getString(AppConstants.userKey) ?? '').trim();
    if (userJson.isEmpty) return null;

    // Fallback: some flows persist token inside saved user JSON.
    try {
      final decoded = jsonDecode(userJson);
      if (decoded is Map && decoded['token'] is String) {
        final recovered = (decoded['token'] as String).trim();
        if (recovered.isNotEmpty) {
          await prefs.setString(AppConstants.tokenKey, recovered);
          return recovered;
        }
      }
    } catch (_) {}

    return null;
  }

  // Save user data
  Future<void> saveUser(String userData) async {
    final prefs = await _prefs();
    await prefs.setString(AppConstants.userKey, userData);
  }

  // Get user data
  Future<String?> getUser() async {
    final prefs = await _prefs();
    await _migrateIfNeeded(prefs);
    final v = (prefs.getString(AppConstants.userKey) ?? '').trim();
    return v.isEmpty ? null : v;
  }

  // Clear all data (logout)
  Future<void> clearAll() async {
    final prefs = await _prefs();
    await prefs.remove(AppConstants.tokenKey);
    await prefs.remove(AppConstants.userKey);
  }

  // Check if user is logged in
  Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
