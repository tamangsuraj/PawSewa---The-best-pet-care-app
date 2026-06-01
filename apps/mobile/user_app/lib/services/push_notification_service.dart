import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

import '../core/api_client.dart';
import '../core/storage_service.dart';
import '../firebase_options.dart';
import '../models/pet.dart';
import '../screens/medical_history/medical_history_screen.dart';
import '../screens/messages/vet_direct_chat_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/service_request_tracking_screen.dart';
import '../screens/shop/my_orders_screen.dart';
import 'navigation_service.dart';

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
    await messaging.setAutoInitEnabled(true);
    final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
    if (kDebugMode) {
      debugPrint('[FCM] permission: ${settings.authorizationStatus}');
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      await Permission.notification.request();
    }

    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_onRemoteMessageOpened);
    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      _handleRemoteMessageData(initial.data);
    }

    messaging.onTokenRefresh.listen((t) => _registerToken(t));

    await _registerCurrentToken();

    _initialized = true;
  }

  void _onRemoteMessageOpened(RemoteMessage message) {
    _handleRemoteMessageData(message.data);
  }

  void _handleRemoteMessageData(Map<String, dynamic> data) {
    if (data.isEmpty) return;
    _handleNotificationTap(data);
  }
  void _handleNotificationTap(Map<String, dynamic> data) {
    final type = data['type']?.toString();
    final id = data['id']?.toString();
    final nav = NavigationService.navigatorKey;

    switch (type) {
      case 'appointment_accepted':
      case 'appointment_assigned':
      case 'service_request_created':
        if (id != null && id.isNotEmpty) {
          nav.currentState?.pushNamed('/appointment-detail', arguments: id);
        }
        break;
      case 'service_request_update':
        if (id != null && id.isNotEmpty) {
          nav.currentState?.pushNamed('/service-request-detail', arguments: id);
        }
        break;
      case 'order_update':
        nav.currentState?.pushNamed('/order-detail', arguments: id);
        break;
      case 'medical_record':
        final petId = data['petId']?.toString();
        if (petId != null && petId.isNotEmpty) {
          nav.currentState?.pushNamed('/health-records', arguments: petId);
        }
        break;
      case 'chat_message':
        final vetId = data['vetId']?.toString();
        if (vetId != null && vetId.isNotEmpty) {
          nav.currentState?.pushNamed('/vet-chat', arguments: data);
        }
        break;
      default:
        nav.currentState?.pushNamed('/notifications');
    }
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
    final payload = message.data.isNotEmpty ? jsonEncode(message.data) : null;
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannelId,
        'Health reminders',
        channelDescription: 'Pet vaccination and care reminders',
        importance: Importance.high,
        priority: Priority.high,
        icon: '@drawable/ic_stat_pawsewa',
      ),
      iOS: DarwinNotificationDetails(),
    );
    await _local.show(
      message.hashCode,
      title,
      body,
      details,
      payload: payload,
    );
  }
}

/// Resolves named routes opened from FCM taps.
Route<dynamic>? buildNotificationRoute(RouteSettings settings) {
  switch (settings.name) {
    case '/appointment-detail':
    case '/service-request-detail':
      final id = settings.arguments as String?;
      if (id != null && id.isNotEmpty) {
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => ServiceRequestTrackingScreen(requestId: id),
        );
      }
      break;
    case '/order-detail':
      return MaterialPageRoute<void>(
        settings: settings,
        builder: (_) => const MyOrdersScreen(),
      );
    case '/health-records':
      final petId = settings.arguments as String?;
      if (petId != null && petId.isNotEmpty) {
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => _HealthRecordsLoader(petId: petId),
        );
      }
      break;
    case '/vet-chat':
      final data = settings.arguments;
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        final vetId = map['vetId']?.toString() ?? '';
        if (vetId.isNotEmpty) {
          return MaterialPageRoute<void>(
            settings: settings,
            builder: (_) => _VetChatLoader(
              vetId: vetId,
              vetName: map['vetName']?.toString(),
              petName: map['petName']?.toString(),
            ),
          );
        }
      }
      break;
    case '/notifications':
      return MaterialPageRoute<void>(
        settings: settings,
        builder: (_) => const NotificationsScreen(),
      );
  }
  return null;
}

class _HealthRecordsLoader extends StatefulWidget {
  const _HealthRecordsLoader({required this.petId});

  final String petId;

  @override
  State<_HealthRecordsLoader> createState() => _HealthRecordsLoaderState();
}

class _HealthRecordsLoaderState extends State<_HealthRecordsLoader> {
  Pet? _pet;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final resp = await ApiClient().getPetHealthSummary(widget.petId);
      final body = resp.data;
      if (body is Map && body['success'] == true && body['data'] is Map) {
        final data = Map<String, dynamic>.from(body['data'] as Map);
        final petMap = data['pet'] is Map
            ? Map<String, dynamic>.from(data['pet'] as Map)
            : data;
        if (mounted) {
          setState(() => _pet = Pet.fromJson(petMap));
        }
        return;
      }
      final petsResp = await ApiClient().getMyPets();
      final petsBody = petsResp.data;
      if (petsBody is Map && petsBody['data'] is List) {
        for (final item in petsBody['data'] as List) {
          if (item is Map && item['_id']?.toString() == widget.petId) {
            if (mounted) {
              setState(() => _pet = Pet.fromJson(Map<String, dynamic>.from(item)));
            }
            return;
          }
        }
      }
      if (mounted) setState(() => _error = 'Pet not found');
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load pet records');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_pet != null) {
      return MedicalHistoryScreen(pet: _pet!);
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Health Records')),
      body: Center(
        child: _error != null
            ? Text(_error!)
            : const CircularProgressIndicator(),
      ),
    );
  }
}

class _VetChatLoader extends StatefulWidget {
  const _VetChatLoader({
    required this.vetId,
    this.vetName,
    this.petName,
  });

  final String vetId;
  final String? vetName;
  final String? petName;

  @override
  State<_VetChatLoader> createState() => _VetChatLoaderState();
}

class _VetChatLoaderState extends State<_VetChatLoader> {
  String? _ownerId;

  @override
  void initState() {
    super.initState();
    _resolveOwner();
  }

  Future<void> _resolveOwner() async {
    final raw = await StorageService().getUser();
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      if (mounted) setState(() => _ownerId = m['_id']?.toString());
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_ownerId == null || _ownerId!.isEmpty) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return VetDirectChatScreen(
      vet: {
        '_id': widget.vetId,
        'name': widget.vetName ?? 'Vet',
      },
      ownerId: _ownerId!,
      petName: widget.petName,
    );
  }
}
