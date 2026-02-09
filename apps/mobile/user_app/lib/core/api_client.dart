import 'package:dio/dio.dart';
import 'constants.dart';
import 'storage_service.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  late final Dio _dio;
  final StorageService _storage = StorageService();

  Dio get dio => _dio;

  void initialize() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add interceptor to attach token to every request
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Get token from secure storage
          final token = await _storage.getToken();
          
          if (token != null && token.isNotEmpty) {
            // Attach Bearer token to Authorization header
            options.headers['Authorization'] = 'Bearer $token';
          }
          
          return handler.next(options);
        },
        onError: (error, handler) async {
          // Handle 401 Unauthorized - token expired or invalid
          if (error.response?.statusCode == 401) {
            // Clear stored credentials
            await _storage.clearAll();
            // You can add navigation to login here if needed
          }
          
          return handler.next(error);
        },
      ),
    );

    // Add logging interceptor for debugging
    _dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
        error: true,
        logPrint: (obj) => print('[API] $obj'),
      ),
    );
  }

  // Login
  Future<Response> login(String email, String password) async {
    return await _dio.post(
      '/users/login',
      data: {
        'email': email,
        'password': password,
      },
    );
  }

  // Register
  Future<Response> register(Map<String, dynamic> userData) async {
    return await _dio.post(
      '/users',
      data: userData,
    );
  }

  // Get user profile
  Future<Response> getUserProfile() async {
    return await _dio.get('/users/profile');
  }

  // Update user profile
  Future<Response> updateProfile(Map<String, dynamic> data) async {
    return await _dio.put('/users/profile', data: data);
  }

  // Generic POST method
  Future<Response> post(String path, Map<String, dynamic> data) async {
    return await _dio.post(path, data: data);
  }

  // Generic GET method
  Future<Response> get(String path) async {
    return await _dio.get(path);
  }

  // Generic PUT method
  Future<Response> put(String path, Map<String, dynamic> data) async {
    return await _dio.put(path, data: data);
  }

  // Generic DELETE method
  Future<Response> delete(String path) async {
    return await _dio.delete(path);
  }

  // Get pets
  Future<Response> getPets() async {
    return await _dio.get('/pets/my-pets');
  }

  // Create case (request assistance)
  Future<Response> createCase(Map<String, dynamic> data) async {
    return await _dio.post('/cases', data: data);
  }

  // Get my cases
  Future<Response> getMyCases() async {
    return await _dio.get('/cases/my/requests');
  }
}
