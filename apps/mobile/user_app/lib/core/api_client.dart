import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'api_config.dart';
import 'app_navigator.dart';
import 'storage_service.dart';

/// Extract API `message` from JSON object or JSON string body (some proxies return strings).
String? _parseApiErrorMessage(dynamic data) {
  if (data is Map && data['message'] != null) {
    final m = data['message'];
    return m is String ? m : m?.toString();
  }
  if (data is String) {
    final s = data.trim();
    if (s.isEmpty) return null;
    try {
      final decoded = jsonDecode(s);
      if (decoded is Map && decoded['message'] != null) {
        final m = decoded['message'];
        return m is String ? m : m?.toString();
      }
    } catch (_) {}
    // Plain text (e.g. ngrok: "The endpoint … is offline.")
    if (s.length > 280) {
      return '${s.substring(0, 277)}...';
    }
    return s;
  }
  return null;
}

/// Ngrok and other proxies attach headers; body may be plain text, not JSON.
String? _describeHttpError(Response? response, dynamic data) {
  final ngrok = response?.headers.value('ngrok-error-code');
  if (ngrok == 'ERR_NGROK_3200') {
    return 'Ngrok tunnel is offline or the URL changed. On your PC run: ngrok http 3000 (or npm run tunnel in backend). Then open the app’s server URL setting and paste the new https address — old ngrok links stop working when the tunnel closes.';
  }
  if (ngrok != null && ngrok.startsWith('ERR_NGROK')) {
    return 'Ngrok error ($ngrok). Check that ngrok is running and the app uses the current tunnel URL.';
  }
  return _parseApiErrorMessage(data);
}

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  late Dio _dio;
  final StorageService _storage = StorageService();

  Dio get dio => _dio;

  /// Initialize with configurable base URL (from ApiConfig / in-app override).
  Future<void> initialize() async {
    final baseUrl = await ApiConfig.getBaseUrl();
    if (kDebugMode) {
      debugPrint('[API] Using base URL: $baseUrl');
    }
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        // Local network: keep timeouts reasonable to surface real connectivity issues
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...ApiConfig.ngrokHeadersForBaseUrl(baseUrl),
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
          if (options.data is FormData) {
            options.headers.remove('Content-Type');
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

          // For timeouts, 5xx, or bad response with no useful message, use a friendly error
          final statusCode = error.response?.statusCode ?? 0;
          final isTimeout =
              error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.receiveTimeout ||
              error.type == DioExceptionType.sendTimeout;
          final isServerError = statusCode >= 500;
          final data = error.response?.data;
          final parsedMessage =
              _describeHttpError(error.response, data);
          final hasMessage =
              parsedMessage != null && parsedMessage.isNotEmpty;
          final badResponseWithNoMessage =
              error.type == DioExceptionType.badResponse &&
              (error.error == null || error.error.toString() == 'null') &&
              !hasMessage;

          // Surface proxy/plain-text errors (ngrok offline, etc.) on DioException.error
          if (error.type == DioExceptionType.badResponse && hasMessage) {
            final friendly = DioException(
              requestOptions: error.requestOptions,
              response: error.response,
              type: error.type,
              error: parsedMessage,
            );
            return handler.next(friendly);
          }

          if (isTimeout || isServerError || badResponseWithNoMessage) {
            String message =
                'Server is busy or unreachable. Please try again in a moment.';
            if (hasMessage) {
              message = parsedMessage;
            } else if (statusCode == 401) {
              message = 'Please sign in again.';
            } else if (error.type == DioExceptionType.connectionTimeout ||
                error.type == DioExceptionType.receiveTimeout ||
                error.type == DioExceptionType.sendTimeout) {
              message =
                  'Request timed out. Please check your connection and try again.';
            } else if (error.type == DioExceptionType.connectionError) {
              message =
                  'You appear to be offline or the server is unreachable. Check your connection and try again.';
            }
            final friendly = DioException(
              requestOptions: error.requestOptions,
              response: error.response,
              type: error.type,
              error: message,
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

  /// Re-initialize after user changes API host (updates baseUrl).
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

  /// Sync FCM token to [PATCH /api/v1/users/me] (`fcmToken`).
  Future<Response> registerFcmToken(String token) async {
    return await _dio.patch('/users/me', data: {'fcmToken': token});
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

  /// GET /pets/:id/health-summary — pet + age, visit_days_ago for dashboard
  Future<Response> getPetHealthSummary(String petId) async {
    return await _dio.get('/pets/$petId/health-summary');
  }

  /// Aggregated customer home: banner, health alerts, `products`, live delivery map pins.
  Future<Response> getHomeDashboard(String petId) async {
    return await _dio.get('/pets/home-dashboard/$petId');
  }

  /// In-app notifications (`notifications` collection).
  Future<Response> getMyNotifications({int limit = 50, int skip = 0}) async {
    return await _dio.get(
      '/notifications/me',
      queryParameters: {
        'limit': limit,
        'skip': skip,
      },
    );
  }

  Future<Response> markNotificationRead(String id) async {
    return await _dio.patch('/notifications/$id/read');
  }

  Future<Response> markAllNotificationsRead() async {
    return await _dio.patch('/notifications/read-all');
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

  // Shop: products & categories (supports pagination)
  Future<Response> getProducts({
    String? search,
    String? category,
    double? minPrice,
    double? maxPrice,
    int? page,
    int? limit,
    /// Align with web shop: recommended uses rating/reviews + pet personalization when logged in.
    String? sort,
    /// Optional override; backend also derives from JWT + primary pet when omitted.
    String? userPetType,
  }) async {
    return await _dio.get(
      '/products',
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category.isNotEmpty) 'category': category,
        if (minPrice != null && minPrice >= 0) 'minPrice': minPrice,
        if (maxPrice != null && maxPrice >= 0) 'maxPrice': maxPrice,
        if (page != null && page >= 1) 'page': page,
        if (limit != null && limit >= 1) 'limit': limit,
        if (sort != null && sort.isNotEmpty) 'sort': sort,
        if (userPetType != null && userPetType.isNotEmpty) 'userPetType': userPetType,
      },
    );
  }

  /// Log add-to-cart / view on personalized (match) recommendations for admin activity.
  Future<Response> postShopRecommendationEvent({
    required String productId,
    String action = 'add_to_cart',
  }) async {
    return await _dio.post(
      '/shop/recommendation-events',
      data: {'productId': productId, 'action': action},
    );
  }

  Future<Response> getCategories() async {
    return await _dio.get('/categories');
  }

  Future<Response> getProductDetail(String id) async {
    return await _dio.get('/products/$id');
  }

  // Favourites (requires auth)
  Future<Response> getFavourites({
    String? search,
    String? category,
    double? minPrice,
    double? maxPrice,
  }) async {
    return await _dio.get(
      '/favourites',
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category.isNotEmpty) 'category': category,
        if (minPrice != null && minPrice >= 0) 'minPrice': minPrice,
        if (maxPrice != null && maxPrice >= 0) 'maxPrice': maxPrice,
      },
    );
  }

  Future<Response> addFavourite(String productId) async {
    return await _dio.post('/favourites', data: {'productId': productId});
  }

  Future<Response> removeFavourite(String productId) async {
    return await _dio.delete('/favourites/$productId');
  }

  Future<Response> checkFavourite(String productId) async {
    return await _dio.get('/favourites/check/$productId');
  }

  Future<Response> createOrder(Map<String, dynamic> data) async {
    return await _dio.post('/orders', data: data);
  }

  /// Refresh drop coordinates on a pending shop order (e.g. after Khalti payment, before confirm).
  Future<Response> updateOrderDeliveryGps(
    String orderId, {
    required double lat,
    required double lng,
  }) async {
    return await _dio.patch(
      '/orders/$orderId/delivery-gps',
      data: {'lat': lat, 'lng': lng},
    );
  }

  /// Get current user's orders (shop orders).
  Future<Response> getMyOrders() async {
    return await _dio.get('/orders/my');
  }

  /// JSON invoice for print/share (owner, seller, or admin).
  Future<Response> getOrderInvoice(String orderId) async {
    return await _dio.get('/orders/$orderId/invoice');
  }

  /// Product review after delivery — [orderId] must be a delivered order containing the product.
  Future<Response> createProductReview({
    required String targetId,
    required String orderId,
    required int rating,
    String comment = '',
  }) async {
    return await _dio.post(
      '/reviews',
      data: {
        'targetType': 'product',
        'targetId': targetId,
        'orderId': orderId,
        'rating': rating,
        'comment': comment,
      },
    );
  }

  Future<Response> getMyProductReview(String productId) async {
    return await _dio.get(
      '/reviews/my',
      queryParameters: {'targetType': 'product', 'targetId': productId},
    );
  }

  // Marketplace chat (seller + delivery)
  Future<Response> getMarketplaceInbox() async {
    return await _dio.get('/marketplace-chat/inbox');
  }

  Future<Response> openSellerMarketplaceChat(String productId) async {
    return await _dio.post('/marketplace-chat/seller/open', data: {'productId': productId});
  }

  Future<Response> getDeliveryChatByOrder(String orderId) async {
    return await _dio.get('/marketplace-chat/delivery/by-order/$orderId');
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

  /// Multipart upload → Cloudinary via backend. Returns `{ success, data: { url, mediaType } }`.
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

  /// Initiate Khalti payment for a shop order. Returns pidx, paymentUrl, orderId.
  /// Backend creates the Khalti session; app should open paymentUrl in browser/WebView.
  Future<Response> initiateKhaltiForOrder(String orderId) async {
    return await _dio.post('/orders/$orderId/khalti/initiate');
  }

  /// Unified initiate payment (orders or service). Use type: 'order', orderId for shop.
  Future<Response> initiatePayment({
    required String type,
    String? orderId,
    String? serviceRequestId,
    double? amount,
  }) async {
    return await _dio.post('/payments/initiate-payment', data: {
      'type': type,
      ...? (orderId != null ? {'orderId': orderId} : null),
      ...? (serviceRequestId != null ? {'serviceRequestId': serviceRequestId} : null),
      ...? (amount != null ? {'amount': amount} : null),
    });
  }

  /// Verify payment using pidx (Khalti lookup).
  Future<Response> verifyPayment({required String pidx}) async {
    return await _dio.post('/payments/verify-payment', data: {'pidx': pidx});
  }

  /// Validate promo code. [currentOrderAmount] = cart total (e.g. grandTotal).
  /// [alreadyAppliedCode] if set and same as entered code, backend returns "Code already applied."
  /// Returns: success + data.discountAmount, data.code, data.discountPercentage or error message.
  Future<Response> validatePromoCode({
    required String code,
    required double currentOrderAmount,
    String? alreadyAppliedCode,
  }) async {
    return await _dio.post(
      '/promocodes/validate',
      data: {
        'code': code.trim().toUpperCase(),
        'currentOrderAmount': currentOrderAmount,
        if (alreadyAppliedCode != null && alreadyAppliedCode.isNotEmpty)
          'alreadyAppliedCode': alreadyAppliedCode,
      },
    );
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
      data: {'serviceRequestId': serviceRequestId, 'amount': amount},
    );
  }

  // Payments – eSewa
  Future<Response> initiateEsewaPayment({
    required String serviceRequestId,
    required double amount,
  }) async {
    return await _dio.post(
      '/payments/esewa/initiate',
      data: {'serviceRequestId': serviceRequestId, 'amount': amount},
    );
  }

  // Get my service requests
  Future<Response> getMyServiceRequests() async {
    return await _dio.get('/service-requests/my/requests');
  }

  /// Owner cancels a non-completed service request (appointment).
  Future<Response> cancelMyServiceRequest(String requestId, {String? reason}) async {
    return await _dio.patch(
      '/service-requests/$requestId/cancel',
      data: reason != null && reason.isNotEmpty ? {'reason': reason} : {},
    );
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

  // Care / Hostel APIs
  Future<Response> getHostels({String? serviceType}) async {
    final query = serviceType != null && serviceType.isNotEmpty
        ? '?serviceType=$serviceType'
        : '';
    return await _dio.get('/care-centers$query');
  }

  Future<Response> getHostelById(String hostelId) async {
    return await _dio.get('/hostels/$hostelId');
  }

  Future<Response> createCareBooking(Map<String, dynamic> data) async {
    return await _dio.post('/care-bookings', data: data);
  }

  Future<Response> getMyCareBookings() async {
    return await _dio.get('/care-bookings/my');
  }

  Future<Response> initiateCareBookingPayment(String bookingId) async {
    return await _dio.post('/care-bookings/$bookingId/pay');
  }

  /// Customer Care — default support conversation for pet owners.
  Future<Response> getCustomerCareMine() async {
    return await _dio.get('/customer-care/mine');
  }

  Future<Response> postCustomerCareMessage(String conversationId, String text) async {
    return await _dio.post(
      '/customer-care/conversations/$conversationId/messages',
      data: {'text': text},
    );
  }

  /// Vets linked via appointments, service requests, or pet medical visit records (Vet Chat shortcuts).
  Future<Response> getLinkedVets() async {
    return await _dio.get('/users/me/linked-vets');
  }

  /// Vet Circle — vets eligible for 1:1 chat (shared medical / appointment history).
  Future<Response> getChatsMyVets() async {
    return await _dio.get('/chats/my-vets');
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

  /// Agora RTC token (channelName from vet-direct helper or appointment id).
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

  /// Persist call duration for admin / care booking analytics.
  Future<Response> postCallLog(Map<String, dynamic> body) async {
    return await _dio.post('/calls/log', data: body);
  }
}
