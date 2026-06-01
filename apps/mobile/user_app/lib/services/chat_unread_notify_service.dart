import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../core/api_client.dart';
import 'socket_service.dart';

/// Per-inbox section counts from GET /chats/unread-summary.
class ChatSectionUnread {
  const ChatSectionUnread({
    this.support = 0,
    this.vets = 0,
    this.care = 0,
    this.sellers = 0,
    this.delivery = 0,
  });

  final int support;
  final int vets;
  final int care;
  final int sellers;
  final int delivery;

  static const empty = ChatSectionUnread();

  factory ChatSectionUnread.fromMap(Map<String, dynamic>? raw) {
    if (raw == null) return ChatSectionUnread.empty;
    int n(String k) => int.tryParse('${raw[k]}') ?? 0;
    return ChatSectionUnread(
      support: n('support'),
      vets: n('vets'),
      care: n('care'),
      sellers: n('sellers'),
      delivery: n('delivery'),
    );
  }

  /// Tab order: Support, Vets, Care, Sellers, Delivery.
  int tabIndexWithUnread() {
    if (delivery > 0) return 4;
    if (sellers > 0) return 3;
    if (care > 0) return 2;
    if (vets > 0) return 1;
    if (support > 0) return 0;
    return 0;
  }
}

/// Global unread total, optional in-chat suppression, and foreground chime.
class ChatUnreadNotifyService extends ChangeNotifier with WidgetsBindingObserver {
  ChatUnreadNotifyService() {
    WidgetsBinding.instance.addObserver(this);
    SocketService.instance.addConnectListener(_onSocketConnect);
    _onSocketConnect();
  }

  int totalUnread = 0;
  ChatSectionUnread sectionUnread = ChatSectionUnread.empty;
  Map<String, int> unreadByThreadKey = {};
  String? activeChatId;
  bool _appInForeground = true;
  final AudioPlayer _player = AudioPlayer();

  int unreadForConversation(String conversationId) {
    return unreadByThreadKey['c:$conversationId'] ?? 0;
  }

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
    sectionUnread = ChatSectionUnread.empty;
    unreadByThreadKey = {};
    activeChatId = null;
    notifyListeners();
  }

  void _applySummary(Map<String, dynamic>? data) {
    if (data == null) return;
    totalUnread = int.tryParse('${data['totalUnread']}') ?? 0;
    sectionUnread = ChatSectionUnread.fromMap(
      data['sectionUnread'] is Map
          ? Map<String, dynamic>.from(data['sectionUnread'] as Map)
          : null,
    );
    final by = data['byChatId'];
    if (by is Map) {
      unreadByThreadKey = {
        for (final e in by.entries)
          e.key.toString(): int.tryParse('${e.value}') ?? 0,
      };
    }
    notifyListeners();
  }

  Future<void> refreshFromApi() async {
    try {
      final r = await ApiClient().dio.get<Map<String, dynamic>>('/chats/unread-summary');
      _applySummary(r.data?['data'] is Map
          ? Map<String, dynamic>.from(r.data!['data'] as Map)
          : null);
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
    unawaited(refreshFromApi());
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
    unawaited(refreshFromApi());
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
