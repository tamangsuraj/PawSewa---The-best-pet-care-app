import 'dart:convert';
import 'package:http/http.dart' as http;

/// API Service for Flutter Applications
/// Handles HTTP requests with Bearer token authentication
class ApiService {
  // Base URL - Change this for production
  static const String baseUrl = 'http://localhost:3000/api/v1';
  
  // For Android emulator, use: http://10.0.2.2:3000/api/v1
  // For iOS simulator, use: http://localhost:3000/api/v1
  // For physical device, use your computer's IP: http://192.168.x.x:3000/api/v1

  /// Generic API request handler
  static Future<Map<String, dynamic>> request({
    required String endpoint,
    required String method,
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final url = Uri.parse('$baseUrl$endpoint');
    
    final headers = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };

    http.Response response;

    try {
      switch (method.toUpperCase()) {
        case 'GET':
          response = await http.get(url, headers: headers);
          break;
        case 'POST':
          response = await http.post(
            url,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'PUT':
          response = await http.put(
            url,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'DELETE':
          response = await http.delete(url, headers: headers);
          break;
        default:
          throw Exception('Unsupported HTTP method: $method');
      }

      final data = jsonDecode(response.body);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return data;
      } else {
        throw Exception(data['message'] ?? 'API request failed');
      }
    } catch (e) {
      print('API Request Error: $e');
      rethrow;
    }
  }

  /// Register a new user
  static Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    String? role,
    String? phone,
  }) async {
    return await request(
      endpoint: '/users',
      method: 'POST',
      body: {
        'name': name,
        'email': email,
        'password': password,
        if (role != null) 'role': role,
        if (phone != null) 'phone': phone,
      },
    );
  }

  /// Login user
  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    return await request(
      endpoint: '/users/login',
      method: 'POST',
      body: {
        'email': email,
        'password': password,
      },
    );
  }

  /// Get user profile (requires token)
  static Future<Map<String, dynamic>> getProfile(String token) async {
    return await request(
      endpoint: '/users/profile',
      method: 'GET',
      token: token,
    );
  }

  /// Update user profile (requires token)
  static Future<Map<String, dynamic>> updateProfile({
    required String token,
    String? name,
    String? email,
    String? phone,
    String? password,
  }) async {
    return await request(
      endpoint: '/users/profile',
      method: 'PUT',
      token: token,
      body: {
        if (name != null) 'name': name,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
        if (password != null) 'password': password,
      },
    );
  }

  /// Health check
  static Future<Map<String, dynamic>> healthCheck() async {
    return await request(
      endpoint: '/health',
      method: 'GET',
    );
  }
}

/// Auth Response Model
class AuthResponse {
  final bool success;
  final AuthData data;

  AuthResponse({required this.success, required this.data});

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      success: json['success'] ?? false,
      data: AuthData.fromJson(json['data']),
    );
  }
}

/// Auth Data Model
class AuthData {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? phone;
  final String token;

  AuthData({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phone,
    required this.token,
  });

  factory AuthData.fromJson(Map<String, dynamic> json) {
    return AuthData(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'pet_owner',
      phone: json['phone'],
      token: json['token'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'email': email,
      'role': role,
      'phone': phone,
      'token': token,
    };
  }
}