import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../core/api_client.dart';
import 'socket_service.dart';

/// Global unread total, optional in-chat suppression, and foreground chime.
class ChatUnreadNotifyService extends ChangeNotifier with WidgetsBindingObserver {
  ChatUnreadNotifyService() {
    WidgetsBinding.instance.addObserver(this);
    SocketService.instance.addConnectListener(_onSocketConnect);
    _onSocketConnect();
  }

  int totalUnread = 0;
  String? activeChatId;
  bool _appInForeground = true;
  final AudioPlayer _player = AudioPlayer();

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appInForeground = state == AppLifecycleState.resumed;
  }

  void setActiveChatId(String? chatId) {
    if (activeChatId == chatId) return;
    activeChatId = chatId;
  }

  void reset() {
    totalUnread = 0;
    activeChatId = null;
    notifyListeners();
  }

  Future<void> refreshFromApi() async {
    try {
      final r = await ApiClient().dio.get<Map<String, dynamic>>('/chats/unread-summary');
      final data = r.data?['data'];
      if (data is Map && data['totalUnread'] != null) {
        final n = int.tryParse('${data['totalUnread']}') ?? 0;
        totalUnread = n;
        notifyListeners();
      }
    } catch (_) {}
  }

  void _onSocketConnect() {
    final s = SocketService.instance.socket;
    if (s == null) return;
    s.off('new_message_notification');
    s.off('unread_sync');
    s.on('new_message_notification', _onNewMessageNotification);
    s.on('unread_sync', _onUnreadSync);
    unawaited(refreshFromApi());
  }

  void _onNewMessageNotification(dynamic data) {
    if (data is! Map) return;
    final map = Map<String, dynamic>.from(data);
    final n = int.tryParse('${map['totalUnread']}');
    if (n != null) {
      totalUnread = n;
      notifyListeners();
    }
    final chatId = map['chatId']?.toString();
    final shouldChime = _appInForeground &&
        chatId != null &&
        chatId.isNotEmpty &&
        chatId != activeChatId;
    if (shouldChime) {
      unawaited(_playChime());
    }
  }

  void _onUnreadSync(dynamic data) {
    if (data is! Map) return;
    final map = Map<String, dynamic>.from(data);
    final n = int.tryParse('${map['totalUnread']}');
    if (n != null) {
      totalUnread = n;
      notifyListeners();
    }
  }

  Future<void> _playChime() async {
    try {
      await _player.stop();
      await _player.play(AssetSource('sounds/notification.mp3'));
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ChatUnread] sound: $e');
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    SocketService.instance.removeConnectListener(_onSocketConnect);
    _player.dispose();
    super.dispose();
  }
}
