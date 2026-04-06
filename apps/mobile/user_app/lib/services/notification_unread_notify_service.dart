import 'dart:async';

import 'package:flutter/widgets.dart';

import '../core/api_client.dart';

/// In-app alerts bell badge (`GET /notifications/me` unreadCount).
class NotificationUnreadNotifyService extends ChangeNotifier with WidgetsBindingObserver {
  NotificationUnreadNotifyService() {
    WidgetsBinding.instance.addObserver(this);
  }

  int unreadCount = 0;

  void setUnread(int n) {
    final next = n < 0 ? 0 : n;
    if (unreadCount == next) {
      return;
    }
    unreadCount = next;
    notifyListeners();
  }

  void reset() {
    unreadCount = 0;
    notifyListeners();
  }

  Future<void> refreshFromApi() async {
    try {
      final r = await ApiClient().dio.get<Map<String, dynamic>>(
        '/notifications/me',
        queryParameters: <String, dynamic>{'limit': 1, 'skip': 0},
      );
      final dynamic rawRoot = r.data;
      if (rawRoot is! Map) {
        return;
      }
      final data = rawRoot['data'];
      if (data is! Map) {
        return;
      }
      final raw = data['unreadCount'];
      final n = raw is int ? raw : int.tryParse('$raw') ?? 0;
      setUnread(n);
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(refreshFromApi());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
