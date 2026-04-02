import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

import '../core/api_client.dart';
import '../core/storage_service.dart';
import '../firebase_options.dart';

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

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _local.initialize(const InitializationSettings(android: androidInit, iOS: iosInit));

    await _ensureAndroidChannel();

    final messaging = FirebaseMessaging.instance;
    // iOS: system dialog for alerts; Android 13+: runtime POST_NOTIFICATIONS.
    await messaging.requestPermission(alert: true, badge: true, sound: true);
    if (Platform.isAndroid) {
      await Permission.notification.request();
    }
    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    FirebaseMessaging.instance.onTokenRefresh.listen((_) {
      registerFcmTokenWithBackend();
    });

    _initialized = true;
  }

  /// Sends current FCM token to [PATCH /api/v1/users/me] when a JWT is present.
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
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannelId,
        'System notifications',
        channelDescription: 'Operational and broadcast messages',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    );
    await _local.show(message.hashCode, n.title ?? 'PawSewa', n.body ?? '', details);
  }
}
