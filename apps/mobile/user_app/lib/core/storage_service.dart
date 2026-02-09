import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
  );

  // Save auth token
  Future<void> saveToken(String token) async {
    await _storage.write(key: AppConstants.tokenKey, value: token);
  }

  // Get auth token
  Future<String?> getToken() async {
    return await _storage.read(key: AppConstants.tokenKey);
  }

  // Save user data
  Future<void> saveUser(String userData) async {
    await _storage.write(key: AppConstants.userKey, value: userData);
  }

  // Get user data
  Future<String?> getUser() async {
    return await _storage.read(key: AppConstants.userKey);
  }

  // Clear all data (logout)
  Future<void> clearAll() async {
    await _storage.delete(key: AppConstants.tokenKey);
    await _storage.delete(key: AppConstants.userKey);
  }

  // Check if user is logged in
  Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
