import 'package:dio/dio.dart';
import 'storage_service.dart';
import 'constants.dart';

class ApiClient {
  late final Dio _dio;
  final StorageService _storage = StorageService();

  ApiClient() {
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

    // Add interceptor to attach token to requests
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Log request
          print('[API] *** Request ***');
          print('[API] uri: ${options.uri}');
          print('[API] method: ${options.method}');
          print('[API] headers:\n${options.headers.entries.map((e) => '[API]  ${e.key}: ${e.value}').join('\n')}');
          if (options.data != null) {
            print('[API] data:\n[API] ${options.data}');
          }
          print('[API]');

          // Attach token if available
          final token = await _storage.getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          
          return handler.next(options);
        },
        onResponse: (response, handler) {
          // Log response
          print('[API] *** Response ***');
          print('[API] uri: ${response.requestOptions.uri}');
          print('[API] statusCode: ${response.statusCode}');
          print('[API] Response Text:\n[API] ${response.data}');
          print('[API]');
          
          return handler.next(response);
        },
        onError: (error, handler) {
          // Log error
          print('[API] *** DioException ***:');
          print('[API] uri: ${error.requestOptions.uri}');
          print('[API] ${error.toString()}');
          if (error.response != null) {
            print('[API] *** Response ***');
            print('[API] uri: ${error.response!.requestOptions.uri}');
            print('[API] statusCode: ${error.response!.statusCode}');
            print('[API] statusMessage: ${error.response!.statusMessage}');
            print('[API] headers:\n${error.response!.headers.map.entries.map((e) => '[API]  ${e.key}: ${e.value}').join('\n')}');
            print('[API] Response Text:\n[API] ${error.response!.data}');
          }
          print('[API]');
          
          return handler.next(error);
        },
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

  // Get user profile
  Future<Response> getUserProfile() async {
    return await _dio.get('/users/profile');
  }

  // Update user profile
  Future<Response> updateUserProfile(Map<String, dynamic> data) async {
    return await _dio.put('/users/profile', data: data);
  }

  // Update staff professional profile (Veterinarian)
  Future<Response> updateStaffProfile(Map<String, dynamic> data) async {
    return await _dio.put('/users/staff/profile', data: data);
  }

  // Get my assigned cases (Veterinarian)
  Future<Response> getMyAssignments() async {
    return await _dio.get('/cases/my/assignments');
  }

  // Start case (Veterinarian)
  Future<Response> startCase(String caseId) async {
    return await _dio.patch('/cases/$caseId/start');
  }

  // Complete case (Veterinarian)
  Future<Response> completeCase(String caseId) async {
    return await _dio.patch('/cases/$caseId/complete');
  }

  // Get all pets (for staff to view)
  Future<Response> getAllPets() async {
    return await _dio.get('/pets');
  }
}
