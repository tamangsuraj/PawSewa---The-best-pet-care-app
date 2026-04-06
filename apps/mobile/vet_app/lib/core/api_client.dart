import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'api_config.dart';
import 'app_navigator.dart';
import 'storage_service.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  late Dio _dio;
  final StorageService _storage = StorageService();

  Dio get dio => _dio;

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
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...ApiConfig.ngrokHeadersForBaseUrl(baseUrl),
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
        onError: (error, handler) async {
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

          if (error.response?.statusCode == 401) {
            final p = error.requestOptions.path;
            final isAuthAttempt =
                p.contains('login') ||
                p.contains('register') ||
                p.contains('verify-otp') ||
                p.contains('google');
            if (!isAuthAttempt) {
              await _storage.clearAll();
              final nav = appNavigatorKey.currentState;
              if (nav != null) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  final n = appNavigatorKey.currentState;
                  if (n != null) {
                    n.pushNamedAndRemoveUntil('/login', (_) => false);
                  }
                });
              }
            }
          }

          if (error.type == DioExceptionType.connectionError) {
            final friendly = DioException(
              requestOptions: error.requestOptions,
              response: error.response,
              type: error.type,
              error:
                  'You appear to be offline or the server is unreachable. Check your connection and try again.',
            );
            return handler.next(friendly);
          }

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
    final ng = ApiConfig.ngrokHeadersForBaseUrl(baseUrl);
    _dio.options.headers.remove('ngrok-skip-browser-warning');
    if (ng.isNotEmpty) _dio.options.headers.addAll(ng);
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

  Future<Response> getMyNotifications({int limit = 50, int skip = 0}) async {
    return await _dio.get(
      '/notifications/me',
      queryParameters: {'limit': limit, 'skip': skip},
    );
  }

  Future<Response> markNotificationRead(String id) async {
    return await _dio.patch('/notifications/$id/read');
  }

  Future<Response> markAllNotificationsRead() async {
    return await _dio.patch('/notifications/read-all');
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
  Future<Response> completeCase(String caseId, {String? notes}) async {
    return await _dio.patch(
      '/cases/$caseId/complete',
      data: notes != null && notes.isNotEmpty ? {'notes': notes} : null,
    );
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
    Map<String, dynamic>? visitVitals,
    DateTime? scheduledTime,
  }) async {
    return await _dio.patch(
      '/service-requests/status/$requestId',
      data: <String, dynamic>{
        'status': status,
        if (visitNotes != null && visitNotes.isNotEmpty)
          'visitNotes': visitNotes,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
        if (scheduledTime != null) 'scheduledTime': scheduledTime.toIso8601String(),
        if (visitVitals != null) 'visitVitals': visitVitals,
      },
    );
  }

  Future<Response> setServiceFollowUp({
    required String requestId,
    required DateTime scheduledTime,
  }) async {
    return await _dio.patch(
      '/service-requests/$requestId/follow-up',
      data: <String, dynamic>{'scheduledTime': scheduledTime.toIso8601String()},
    );
  }

  Future<Response> uploadServicePrescriptionPdf(
    String requestId,
    Uint8List bytes, {
    required String filename,
    void Function(int sent, int total)? onSendProgress,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });
    return _dio.post(
      '/service-requests/$requestId/prescription/upload',
      data: formData,
      onSendProgress: onSendProgress,
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

  /// Veterinarian clinical note → owner `Medical History` + bell notification.
  Future<Response> postPetClinicalEntry({
    required String petId,
    required String diagnosis,
    String? prescription,
    String? notes,
    String? serviceRequestId,
  }) async {
    return await _dio.post(
      '/pets/$petId/clinical-entry',
      data: <String, dynamic>{
        'diagnosis': diagnosis,
        if (prescription != null && prescription.isNotEmpty) 'prescription': prescription,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (serviceRequestId != null && serviceRequestId.isNotEmpty)
          'serviceRequestId': serviceRequestId,
      },
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

  /// Shop owner: orders assigned by admin for fulfillment.
  Future<Response> getSellerAssignedOrders() async {
    return await _dio.get('/orders/seller/assigned');
  }

  /// Shop owner: confirm items in stock before rider pickup.
  Future<Response> confirmSellerOrderStock(String orderId) async {
    return await _dio.patch('/orders/$orderId/seller-confirm');
  }

  /// Get vet/care earnings (payments received from pet owners for completed services).
  Future<Response> getVetEarnings() async {
    return await _dio.get('/vets/earnings');
  }

  // My Business (hostel owner / service provider)
  Future<Response> getMyHostels() async {
    return await _dio.get('/hostels/my/list');
  }

  Future<Response> toggleHostelAvailability(String hostelId) async {
    return await _dio.patch('/hostels/$hostelId/availability');
  }

  Future<Response> getIncomingBookings() async {
    return await _dio.get('/care-bookings/incoming');
  }

  Future<Response> respondToBooking(String bookingId, {required bool accept}) async {
    return await _dio.patch('/care-bookings/$bookingId/respond', data: {'accept': accept});
  }

  Future<Response> getSubscriptionPlans() async {
    return await _dio.get('/subscriptions/plans');
  }

  Future<Response> getMySubscription() async {
    return await _dio.get('/subscriptions/my');
  }

  Future<Response> initiateSubscriptionPayment({
    required String plan,
    required String billingCycle,
  }) async {
    return await _dio.post('/subscriptions/initiate', data: {
      'plan': plan,
      'billingCycle': billingCycle,
    });
  }

  Future<Response> createProviderApplication(Map<String, dynamic> data) async {
    return await _dio.post('/provider-applications', data: data);
  }

  Future<Response> getMyProviderApplication() async {
    return await _dio.get('/provider-applications/my');
  }

  // Marketplace chat (seller + rider)
  Future<Response> getSellerMarketplaceInbox() async {
    return await _dio.get('/marketplace-chat/seller/inbox');
  }

  Future<Response> getRiderMarketplaceInbox() async {
    return await _dio.get('/marketplace-chat/rider/inbox');
  }

  Future<Response> getRiderDeliveryChat(String orderId) async {
    return await _dio.get('/marketplace-chat/delivery/rider-order/$orderId');
  }

  Future<Response> getMarketplaceMessages(String conversationId) async {
    return await _dio.get('/marketplace-chat/conversations/$conversationId/messages');
  }

  Future<Response> postMarketplaceMessage(
    String conversationId, {
    String text = '',
    String? productId,
    String? mediaUrl,
    String? mediaType,
  }) async {
    return await _dio.post(
      '/marketplace-chat/conversations/$conversationId/messages',
      data: {
        if (text.isNotEmpty) 'text': text,
        if (productId != null && productId.isNotEmpty) 'productId': productId,
        if (mediaUrl != null && mediaUrl.isNotEmpty) 'mediaUrl': mediaUrl,
        if (mediaType != null && mediaType.isNotEmpty) 'mediaType': mediaType,
      },
    );
  }

  Future<Response> uploadChatMedia(
    Uint8List bytes, {
    required String filename,
    void Function(int sent, int total)? onSendProgress,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });
    return _dio.post(
      '/chat/upload',
      data: formData,
      onSendProgress: onSendProgress,
    );
  }

  /// Owners whose pets this vet has treated (eligible for vet–owner chat).
  Future<Response> getChatsMyPatients() async {
    return await _dio.get('/chats/my-patients');
  }

  Future<Response> getVetDirectMessages({
    required String ownerId,
    required String vetId,
  }) async {
    return await _dio.get(
      '/chats/vet-direct/messages',
      queryParameters: {'ownerId': ownerId, 'vetId': vetId},
    );
  }

  Future<Response> postVetDirectMessage({
    required String ownerId,
    required String vetId,
    required String text,
  }) async {
    return await _dio.post(
      '/chats/vet-direct/messages',
      data: {'ownerId': ownerId, 'vetId': vetId, 'text': text},
    );
  }

  /// PawSewa Customer Support thread (vets, riders, sellers, …).
  Future<Response> getCustomerCareMine() async {
    return await _dio.get('/customer-care/mine');
  }

  Future<Response> postCustomerCareMessage(String conversationId, String text) async {
    return await _dio.post(
      '/customer-care/conversations/$conversationId/messages',
      data: {'text': text},
    );
  }

  Future<Response> getAgoraRtcToken({
    required String channelName,
    int? uid,
  }) async {
    return await _dio.get(
      '/calls/token',
      queryParameters: {
        'channelName': channelName,
        ...?uid != null ? {'uid': uid} : null,
      },
    );
  }

  Future<Response> postCallLog(Map<String, dynamic> body) async {
    return await _dio.post('/calls/log', data: body);
  }
}
