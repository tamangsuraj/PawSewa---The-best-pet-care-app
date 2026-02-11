import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
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
    if (kDebugMode) {
      debugPrint('[API] Using base URL: ${AppConstants.baseUrl}');
    }
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.baseUrl,
        // Local network: keep timeouts reasonable to surface real connectivity issues
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: const {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add interceptor to attach token to every request
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (kDebugMode) {
            debugPrint('[API] → ${options.method} ${options.uri}');
          }
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
            await _storage.clearAll();
            // You can add navigation to login here if needed
          }

          // For timeouts and 5xx errors, return a friendlier error message
          final statusCode = error.response?.statusCode ?? 0;
          final isTimeout = error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.receiveTimeout ||
              error.type == DioExceptionType.sendTimeout;
          final isServerError = statusCode >= 500;

          if (isTimeout || isServerError) {
            final friendly = DioException(
              requestOptions: error.requestOptions,
              response: error.response,
              type: error.type,
              error: 'Server is busy or unreachable. Please try again in a moment.',
            );
            return handler.next(friendly);
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
        logPrint: (obj) {
          if (kDebugMode) {
            debugPrint('[API] $obj');
          }
        },
      ),
    );
  }

  // Login
  Future<Response> login(String email, String password) async {
    return await _dio.post(
      '/users/login',
      data: {'email': email, 'password': password},
    );
  }

  // Register
  Future<Response> register(Map<String, dynamic> userData) async {
    return await _dio.post('/users', data: userData);
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
  Future<Response> getMyPets() async {
    return await _dio.get('/pets/my-pets');
  }

  Future<Response> getPets() async {
    return await getMyPets();
  }

  // Create case (request assistance) — same keys as website: petId, issueDescription, location (string)
  Future<Response> createCase(Map<String, dynamic> data) async {
    if (kDebugMode) {
      debugPrint('[API] createCase payload: $data');
    }
    return await _dio.post('/cases', data: data);
  }

  // Get my cases
  Future<Response> getMyCases() async {
    return await _dio.get('/cases/my/requests');
  }

  // Care+ request (grooming, bathing, training)
  Future<Response> createCareRequest(Map<String, dynamic> data) async {
    return await _dio.post('/care/request', data: data);
  }

  Future<Response> getMyCareRequests() async {
    return await _dio.get('/care/my-requests');
  }

  // Shop: products & categories
  Future<Response> getProducts({String? search, String? category}) async {
    return await _dio.get(
      '/products',
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category.isNotEmpty) 'category': category,
      },
    );
  }

  Future<Response> getCategories() async {
    return await _dio.get('/categories');
  }

  Future<Response> getProductDetail(String id) async {
    return await _dio.get('/products/$id');
  }

  Future<Response> createOrder(Map<String, dynamic> data) async {
    return await _dio.post('/orders', data: data);
  }

  // Create service request (OSM-enabled flow)
  /// Sends: petId, serviceType, preferredDate, timeWindow, notes?, location: { address, coordinates: { lat, lng } }
  Future<Response> createServiceRequest(Map<String, dynamic> data) async {
    if (kDebugMode) {
      debugPrint('[API] createServiceRequest payload: ${data.toString()}');
    }
    return await _dio.post('/service-requests', data: data);
  }

  // Payments – Khalti
  Future<Response> initiateKhaltiPayment({
    required String serviceRequestId,
    required double amount,
  }) async {
    return await _dio.post(
      '/payments/khalti/initiate',
      data: {
        'serviceRequestId': serviceRequestId,
        'amount': amount,
      },
    );
  }

  // Payments – eSewa
  Future<Response> initiateEsewaPayment({
    required String serviceRequestId,
    required double amount,
  }) async {
    return await _dio.post(
      '/payments/esewa/initiate',
      data: {
        'serviceRequestId': serviceRequestId,
        'amount': amount,
      },
    );
  }

  // Get my service requests
  Future<Response> getMyServiceRequests() async {
    return await _dio.get('/service-requests/my/requests');
  }

  // Live tracking for a specific service request
  Future<Response> getServiceRequestLive(String requestId) async {
    return await _dio.get('/service-requests/$requestId/live');
  }

  // Chat messages for a service request
  Future<Response> getServiceRequestMessages(String requestId) async {
    return await _dio.get('/service-requests/$requestId/messages');
  }

  // Submit review for a completed service request (rating 1-5, optional comment)
  Future<Response> submitServiceRequestReview(
    String requestId, {
    required int rating,
    String? comment,
  }) async {
    return await _dio.post(
      '/service-requests/$requestId/review',
      data: {'rating': rating, 'comment': comment ?? ''},
    );
  }

  // Get prescription URL for a completed request (opens in browser if present)
  Future<Response> getServiceRequestPrescription(String requestId) async {
    return await _dio.get('/service-requests/$requestId/prescription');
  }
}
