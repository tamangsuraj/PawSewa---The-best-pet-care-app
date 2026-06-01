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

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  if (kDebugMode) {
    debugPrint('[FCM] background message: ${message.messageId}');
  }
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

    await _ensureAndroidChannel();

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

  Future<void> _ensureAndroidChannel() async {
    const channel = AndroidNotificationChannel(
      _androidChannelId,
      'System notifications',
      description: 'Operational and broadcast messages',
      importance: Importance.high,
    );
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  Future<void> _onForegroundMessage(RemoteMessage message) async {
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
