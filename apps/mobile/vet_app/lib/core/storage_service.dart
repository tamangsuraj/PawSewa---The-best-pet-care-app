import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  // Session persistence is stored in SharedPreferences (fast bootstrap on app start).
  // Legacy values may exist in secure storage from older builds; migrate once if prefs are empty.
  final FlutterSecureStorage _legacySecureStorage = const FlutterSecureStorage();

  Future<SharedPreferences> _prefs() => SharedPreferences.getInstance();

  Future<void> _migrateIfNeeded(SharedPreferences prefs) async {
    final hasToken = (prefs.getString(AppConstants.tokenKey) ?? '').trim().isNotEmpty;
    final hasUser = (prefs.getString(AppConstants.userKey) ?? '').trim().isNotEmpty;
    final hasRole = (prefs.getString(AppConstants.partnerRoleKey) ?? '').trim().isNotEmpty;
    if (hasToken || hasUser || hasRole) return;

    try {
      final legacyToken = (await _legacySecureStorage.read(key: AppConstants.tokenKey))?.trim() ?? '';
      final legacyUser = (await _legacySecureStorage.read(key: AppConstants.userKey))?.trim() ?? '';
      final legacyRole = (await _legacySecureStorage.read(key: AppConstants.partnerRoleKey))?.trim() ?? '';

      if (legacyToken.isNotEmpty) await prefs.setString(AppConstants.tokenKey, legacyToken);
      if (legacyUser.isNotEmpty) await prefs.setString(AppConstants.userKey, legacyUser);
      if (legacyRole.isNotEmpty) await prefs.setString(AppConstants.partnerRoleKey, legacyRole);
    } catch (_) {}
  }

  // Save JWT token
  Future<void> saveToken(String token) async {
    final prefs = await _prefs();
    await prefs.setString(AppConstants.tokenKey, token);
  }

  // Get JWT token
  Future<String?> getToken() async {
    final prefs = await _prefs();
    await _migrateIfNeeded(prefs);
    final token = (prefs.getString(AppConstants.tokenKey) ?? '').trim();
    return token.isEmpty ? null : token;
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
    await prefs.remove(AppConstants.partnerRoleKey);
  }

  // Check if user is logged in
  Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> setActivePartnerRole(String role) async {
    final prefs = await _prefs();
    await prefs.setString(AppConstants.partnerRoleKey, role);
  }

  Future<String?> getActivePartnerRole() async {
    final prefs = await _prefs();
    await _migrateIfNeeded(prefs);
    final v = (prefs.getString(AppConstants.partnerRoleKey) ?? '').trim();
    return v.isEmpty ? null : v;
  }

  /// Generic cached JSON payloads (offline-friendly lists).
  Future<void> setCache(String key, String value) async {
    final prefs = await _prefs();
    await prefs.setString('cache:$key', value);
  }

  Future<String?> getCache(String key) async {
    final prefs = await _prefs();
    final v = (prefs.getString('cache:$key') ?? '').trim();
    return v.isEmpty ? null : v;
  }
}
