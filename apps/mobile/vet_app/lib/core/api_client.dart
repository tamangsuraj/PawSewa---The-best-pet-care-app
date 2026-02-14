import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'api_config.dart';
import 'storage_service.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  late Dio _dio;
  final StorageService _storage = StorageService();

  void _log(String message) {
    if (kDebugMode) {
      debugPrint(message);
    }
  }

  /// Initialize with configurable base URL (ApiConfig — single source of truth).
  Future<void> initialize() async {
    final baseUrl = await ApiConfig.getBaseUrl();
    if (kDebugMode) debugPrint('[API] Using base URL: $baseUrl');
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
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
          // For FormData (e.g. product with images), remove Content-Type so Dio sets multipart/form-data.
          // BaseOptions use application/json; sending that with FormData would break server parsing.
          if (options.data is FormData) {
            options.headers.remove(Headers.contentTypeHeader);
          }

          // Log request
          _log('[API] *** Request ***');
          _log('[API] uri: ${options.uri}');
          _log('[API] method: ${options.method}');
          _log(
            '[API] headers:\n${options.headers.entries.map((e) => '[API]  ${e.key}: ${e.value}').join('\n')}',
          );
          if (options.data != null) {
            _log('[API] data:\n[API] ${options.data}');
          }
          _log('[API]');

          // Attach token if available
          final token = await _storage.getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          return handler.next(options);
        },
        onResponse: (response, handler) {
          // Log response
          _log('[API] *** Response ***');
          _log('[API] uri: ${response.requestOptions.uri}');
          _log('[API] statusCode: ${response.statusCode}');
          _log('[API] Response Text:\n[API] ${response.data}');
          _log('[API]');

          return handler.next(response);
        },
        onError: (error, handler) {
          // Log error
          _log('[API] *** DioException ***:');
          _log('[API] uri: ${error.requestOptions.uri}');
          _log('[API] ${error.toString()}');
          if (error.type == DioExceptionType.connectionError ||
              error.type == DioExceptionType.connectionTimeout) {
            _log(
              '[API] 💡 Connection failed. Ensure: (1) Backend is running, '
              '(2) Device and PC are on same Wi‑Fi, (3) API host is correct. '
              'Override: flutter run --dart-define=API_HOST=YOUR_PC_IP',
            );
          }
          if (error.response != null) {
            _log('[API] *** Response ***');
            _log('[API] uri: ${error.response!.requestOptions.uri}');
            _log('[API] statusCode: ${error.response!.statusCode}');
            _log('[API] statusMessage: ${error.response!.statusMessage}');
            _log(
              '[API] headers:\n${error.response!.headers.map.entries.map((e) => '[API]  ${e.key}: ${e.value}').join('\n')}',
            );
            _log('[API] Response Text:\n[API] ${error.response!.data}');
          }
          _log('[API]');

          return handler.next(error);
        },
      ),
    );
  }

  /// Re-initialize after user changes API host.
  Future<void> reinitialize() async {
    final baseUrl = await ApiConfig.getBaseUrl();
    if (kDebugMode) debugPrint('[API] Reinit base URL: $baseUrl');
    _dio.options.baseUrl = baseUrl;
  }

  // Login
  Future<Response> login(String email, String password) async {
    return await _dio.post(
      '/users/login',
      data: {'email': email, 'password': password},
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

  // New: get my assigned service tasks (service request flow)
  Future<Response> getMyServiceTasks() async {
    return await _dio.get('/service-requests/my/tasks');
  }

  // New: generic status update for service requests
  Future<Response> updateServiceStatus({
    required String requestId,
    required String status,
    String? visitNotes,
    String? reason,
  }) async {
    return await _dio.patch(
      '/service-requests/status/$requestId',
      data: <String, dynamic>{
        'status': status,
        if (visitNotes != null && visitNotes.isNotEmpty)
          'visitNotes': visitNotes,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
    );
  }

  // New: update my live location (for vets/riders)
  Future<Response> updateMyLiveLocation({
    required double lat,
    required double lng,
  }) async {
    return await _dio.patch(
      '/users/me/location',
      data: {'lat': lat, 'lng': lng},
    );
  }

  // Shop / product management for shop owners & admins
  Future<Response> getProducts() async {
    return await _dio.get('/products');
  }

  Future<Response> getCategories() async {
    return await _dio.get('/categories');
  }

  Future<Response> createCategory(String name) async {
    return await _dio.post('/categories', data: {'name': name});
  }

  /// Create category with optional image (multipart).
  Future<Response> createCategoryForm(FormData formData) async {
    return await _dio.post('/categories', data: formData);
  }

  Future<Response> createProductForm(FormData formData) async {
    // Content-Type is cleared for FormData in the interceptor so Dio sets multipart/form-data.
    return await _dio.post('/products', data: formData);
  }

  Future<Response> updateProductStock({
    required String productId,
    required String stockQuantity,
  }) async {
    return await _dio.patch(
      '/products/$productId',
      data: <String, dynamic>{'stockQuantity': stockQuantity},
    );
  }

  // Rider: orders assigned to me (pet supplies deliveries)
  Future<Response> getRiderAssignedOrders() async {
    return await _dio.get('/orders/rider/assigned');
  }

  /// Rider or admin: update order status (pending | processing | out_for_delivery | delivered).
  Future<Response> updateOrderStatus({
    required String orderId,
    required String status,
  }) async {
    return await _dio.patch(
      '/orders/$orderId/status',
      data: <String, dynamic>{'status': status},
    );
  }
}
