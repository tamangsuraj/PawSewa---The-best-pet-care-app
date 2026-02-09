import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';

class StorageService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  // Save JWT token
  Future<void> saveToken(String token) async {
    await _storage.write(key: AppConstants.tokenKey, value: token);
  }

  // Get JWT token
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
