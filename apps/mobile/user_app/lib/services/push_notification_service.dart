import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../core/api_client.dart';
import '../core/storage_service.dart';
import '../firebase_options.dart';

const String _androidChannelId = 'pawsewa_reminders';

/// Must be a top-level function for background delivery.
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
  final StorageService _storage = StorageService();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (_) {},
    );

    await _ensureAndroidChannel();

    final messaging = FirebaseMessaging.instance;
    await messaging.setAutoInitEnabled(true);
    final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
    if (kDebugMode) {
      debugPrint('[FCM] permission: ${settings.authorizationStatus}');
    }

    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    messaging.onTokenRefresh.listen((t) => _registerToken(t));

    await _registerCurrentToken();

    _initialized = true;
  }

  Future<void> _ensureAndroidChannel() async {
    const channel = AndroidNotificationChannel(
      _androidChannelId,
      'Health reminders',
      description: 'Pet vaccination and care reminders',
      importance: Importance.high,
    );
    await _local
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  Future<void> _registerCurrentToken() async {
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null && token.isNotEmpty) {
      await _registerToken(token);
    }
  }

  /// Call after login or when user returns to app with a valid session.
  Future<void> syncTokenIfLoggedIn() async {
    final loggedIn = await _storage.isLoggedIn();
    if (!loggedIn) return;
    await _registerCurrentToken();
  }

  Future<void> _registerToken(String token) async {
    final loggedIn = await _storage.isLoggedIn();
    if (!loggedIn) return;
    try {
      await ApiClient().registerFcmToken(token);
      if (kDebugMode) debugPrint('[FCM] token registered with backend');
    } catch (e) {
      if (kDebugMode) debugPrint('[FCM] register failed: $e');
    }
  }

  Future<void> _onForegroundMessage(RemoteMessage message) async {
    final n = message.notification;
    final title = n?.title ?? 'PawSewa';
    final body = n?.body ?? '';
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannelId,
        'Health reminders',
        channelDescription: 'Pet vaccination and care reminders',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    );
    await _local.show(
      message.hashCode,
      title,
      body,
      details,
    );
  }
}
