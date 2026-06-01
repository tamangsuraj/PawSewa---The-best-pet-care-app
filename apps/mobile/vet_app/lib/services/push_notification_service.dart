import 'dart:convert';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

import '../core/api_client.dart';
import '../core/app_navigator.dart';
import '../core/storage_service.dart';
import '../firebase_options.dart';
import '../screens/care_booking_detail_screen.dart';
import '../screens/rider_delivery_orders_screen.dart';
import '../screens/service_task_detail_screen.dart';

const String _androidChannelId = 'pawsewa_system';

/// High-priority channel used for incoming delivery alerts (rider).
/// Shows as a full-screen notification over the lock screen and other apps.
const String _riderAlertChannelId = 'rider_delivery_alert';
// Int64List is not a compile-time constant, so the channel can't be const.
final AndroidNotificationChannel _riderAlertChannel = AndroidNotificationChannel(
  _riderAlertChannelId,
  'Delivery Alerts',
  description: 'Incoming delivery orders for riders',
  importance: Importance.max,
  playSound: true,
  enableVibration: true,
  vibrationPattern: Int64List.fromList([0, 500, 300, 500, 300, 500]),
  sound: const RawResourceAndroidNotificationSound('rider_alert'),
);

/// FCM background/terminated handler — must be top-level and @pragma annotated.
/// Shows a full-screen intent notification so the alert appears over other apps
/// and over the lock screen, identical to an incoming phone call.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  if (message.data['type']?.toString() != 'new_order_delivery') return;

  final plugin = FlutterLocalNotificationsPlugin();
  await plugin.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@drawable/ic_stat_pawsewa'),
    ),
  );

  // Ensure the alert channel exists in this isolate too.
  await plugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(_riderAlertChannel);

  final summary = _buildOrderSummary(message.data);

  await plugin.show(
    message.hashCode,
    '🛵 New Delivery Request',
    summary,
    NotificationDetails(
      android: AndroidNotificationDetails(
        _riderAlertChannelId,
        'Delivery Alerts',
        channelDescription: 'Incoming delivery orders for riders',
        importance: Importance.max,
        priority: Priority.max,
        // fullScreenIntent = true causes Android to display the notification
        // as a full-screen activity (over lock screen) or heads-up HUD (while
        // using another app) — exactly like an incoming phone call.
        fullScreenIntent: true,
        category: AndroidNotificationCategory.call,
        playSound: true,
        sound: const RawResourceAndroidNotificationSound('rider_alert'),
        enableVibration: true,
        vibrationPattern: Int64List.fromList([0, 500, 300, 500, 300, 500]),
        icon: '@drawable/ic_stat_pawsewa',
        ongoing: false,
        autoCancel: true,
        // Ensures the notification wakes the screen.
        enableLights: true,
        color: const Color(0xFFF5A623),
      ),
    ),
    payload: jsonEncode(message.data),
  );
}

String _buildOrderSummary(Map<String, dynamic> data) {
  final orderId = data['orderId']?.toString() ?? data['_id']?.toString() ?? '';
  final shortId = orderId.length >= 6 ? '#${orderId.substring(orderId.length - 6).toUpperCase()}' : '';
  final amount = data['totalAmount']?.toString() ?? '';
  final parts = <String>[
    if (shortId.isNotEmpty) shortId,
    if (amount.isNotEmpty) 'Rs. $amount',
  ];
  return parts.isEmpty ? 'Tap to accept or decline' : '${parts.join(' · ')} — Tap to respond';
}

class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    const androidInit = AndroidInitializationSettings('@drawable/ic_stat_pawsewa');
    const iosInit = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        final payload = response.payload;
        if (payload == null || payload.isEmpty) return;
        try {
          final data = jsonDecode(payload) as Map<String, dynamic>;
          _handleNotificationTap(data);
        } catch (_) {}
      },
    );

    await _ensureChannels();

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);
    if (Platform.isAndroid) {
      await Permission.notification.request();
    }
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _handleNotificationTap(m.data));
    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      _handleNotificationTap(initial.data);
    }

    FirebaseMessaging.instance.onTokenRefresh.listen((_) {
      registerFcmTokenWithBackend();
    });

    _initialized = true;
  }

  void _handleNotificationTap(Map<String, dynamic> data) {
    final type = data['type']?.toString();
    final id = data['id']?.toString();
    final nav = appNavigatorKey.currentState;
    if (nav == null) return;

    switch (type) {
      case 'appointment_assigned':
      case 'service_request_update':
        if (id != null && id.isNotEmpty) {
          nav.pushNamed('/vet-appointment-detail', arguments: id);
        }
        break;
      case 'new_order_delivery':
        nav.pushNamed('/rider-delivery-detail');
        break;
      case 'care_booking_request':
        if (id != null && id.isNotEmpty) {
          nav.pushNamed('/care-booking-detail', arguments: id);
        }
        break;
      default:
        break;
    }
  }

  Future<void> registerFcmTokenWithBackend() async {
    final storage = StorageService();
    final jwt = await storage.getToken();
    if (jwt == null || jwt.isEmpty) return;

    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) return;

    try {
      await ApiClient().dio.patch<Map<String, dynamic>>(
        '/users/me',
        data: <String, dynamic>{'fcmToken': token},
      );
      if (kDebugMode) {
        debugPrint('[FCM] Token registered with backend.');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[FCM] Failed to register token: $e');
      }
    }
  }

  Future<void> _ensureChannels() async {
    final android = _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

    // General system notifications channel (low-priority).
    await android?.createNotificationChannel(
      const AndroidNotificationChannel(
        _androidChannelId,
        'System notifications',
        description: 'Operational and broadcast messages',
        importance: Importance.high,
      ),
    );

    // Rider delivery alert channel (max-priority, full-screen capable).
    await android?.createNotificationChannel(_riderAlertChannel);
  }

  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final type = message.data['type']?.toString();

    // For incoming delivery alerts the socket already triggers the in-app
    // overlay (RiderOrderAlertOverlay). Skip showing a redundant notification
    // when the app is in the foreground.
    if (type == 'new_order_delivery') return;

    final n = message.notification;
    if (n == null) return;

    final payload = message.data.isNotEmpty ? jsonEncode(message.data) : null;
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannelId,
        'System notifications',
        channelDescription: 'Operational and broadcast messages',
        importance: Importance.high,
        priority: Priority.high,
        icon: '@drawable/ic_stat_pawsewa',
      ),
      iOS: DarwinNotificationDetails(),
    );
    await _local.show(
      message.hashCode,
      n.title ?? 'PawSewa',
      n.body ?? '',
      details,
      payload: payload,
    );
  }
}

Route<dynamic>? buildPartnerNotificationRoute(RouteSettings settings) {
  switch (settings.name) {
    case '/vet-appointment-detail':
      final id = settings.arguments as String?;
      if (id != null && id.isNotEmpty) {
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => ServiceTaskDetailScreen(task: {'_id': id}),
        );
      }
      break;
    case '/rider-delivery-detail':
      return MaterialPageRoute<void>(
        settings: settings,
        builder: (_) => const RiderDeliveryOrdersScreen(),
      );
    case '/care-booking-detail':
      final id = settings.arguments as String?;
      if (id != null && id.isNotEmpty) {
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => CareBookingDetailScreen(
            initialBooking: {'_id': id},
          ),
        );
      }
      break;
  }
  return null;
}
