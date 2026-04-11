import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/api_config.dart';
import '../core/storage_service.dart';

/// Singleton Socket.io: JWT auth, marketplace + service chat events (Partner app).
class SocketService {
  SocketService._();
  static final SocketService _instance = SocketService._();
  static SocketService get instance => _instance;

  final StorageService _storage = StorageService();
  io.Socket? _socket;
  bool _connecting = false;
  final List<void Function(Map<String, dynamic>)?> _newMessageListeners = [];
  final List<void Function(Map<String, dynamic>)?> _statusChangeListeners = [];
  final List<void Function(Map<String, dynamic>)?> _staffMovedListeners = [];
  final List<void Function(Map<String, dynamic>)?> _isTypingListeners = [];
  final List<void Function(Map<String, dynamic>)?> _customerCareMsgListeners = [];
  final List<void Function(Map<String, dynamic>)?> _customerCareTypingListeners = [];
  final List<void Function(Map<String, dynamic>)?> _marketplaceMsgListeners = [];
  final List<void Function(Map<String, dynamic>)?> _marketplaceTypingListeners = [];
  final List<void Function(Map<String, dynamic>)?> _vetDirectMsgListeners = [];
  final List<void Function(Map<String, dynamic>)?> _vetDirectTypingListeners = [];
  final List<void Function()?> _connectListeners = [];
  final List<void Function(String)?> _disconnectListeners = [];
  /// Rider/seller shop fulfillment: job:available, order:assigned_rider, order:assigned_seller
  final List<void Function(String event, Map<String, dynamic> payload)?>
      _shopOrderListeners = [];
  /// Admin care dispatch → partner My Business
  final List<void Function(String event, Map<String, dynamic> payload)?>
      _careBookingListeners = [];
  final List<void Function(Map<String, dynamic>)?> _appointmentUpdateListeners = [];
  final List<void Function(Map<String, dynamic>)?> _incomingCallListeners = [];
  final List<void Function(Map<String, dynamic>)?> _callAnsweredListeners = [];
  final List<void Function(Map<String, dynamic>)?> _callEndedListeners = [];

  io.Socket? get socket => _socket;
  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    if (_connecting || (_socket != null && _socket!.connected)) return;
    final token = await _storage.getToken();
    if (token == null || token.isEmpty) {
      if (kDebugMode) debugPrint('[SocketService] No token, skip connect');
      return;
    }

    _connecting = true;
    try {
      final url = await ApiConfig.getSocketUrl();
      _socket?.dispose();
      final built = io.OptionBuilder()
          .setTransports(['websocket'])
          .enableForceNew()
          .setExtraHeaders({
            'ngrok-skip-browser-warning': 'true',
          })
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(20)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(10000)
          .build();
      final opts = Map<String, dynamic>.from(built);
      opts['timeout'] = 60000;
      _socket = io.io(url, opts);

      bool connectErrorLogged = false;
      _socket!.onConnect((_) {
        if (kDebugMode) {
          if (url.contains('ngrok')) {
            debugPrint('[CONNECTION] Socket connected to ngrok: $url');
          } else {
            debugPrint('[CONNECTION] Socket connected: $url');
          }
          debugPrint('[SocketService] Connected');
        }
        _connecting = false;
        for (final cb in _connectListeners) {
          cb?.call();
        }
      });

      _socket!.onDisconnect((reason) {
        if (kDebugMode) debugPrint('[SocketService] Disconnect: $reason');
        _connecting = false;
        for (final cb in _disconnectListeners) {
          cb?.call(reason ?? '');
        }
      });

      _socket!.onConnectError((err) {
        _connecting = false;
        if (kDebugMode && !connectErrorLogged) {
          connectErrorLogged = true;
          debugPrint('[SocketService] ConnectError: $err');
        }
      });

      _socket!.on('new_message', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _newMessageListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.on('status_change', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _statusChangeListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.on('staff_moved', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _staffMovedListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.on('is_typing', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _isTypingListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.on('receive_message', (data) {
        final map = _toMap(data);
        if (map == null) return;
        final tt = map['threadType']?.toString();
        final normalized = {
          'conversationId': map['conversationId'],
          'messageId': map['messageId'],
          'senderId': map['senderId'],
          'receiverId': map['receiverId'],
          'text': map['text'] ?? map['content'],
          'mediaUrl': map['mediaUrl'],
          'mediaType': map['mediaType'],
          'timestamp': map['timestamp'],
        };
        if (tt == 'support') {
          for (final cb in _customerCareMsgListeners) {
            cb?.call(Map<String, dynamic>.from(normalized));
          }
        } else if (tt == 'seller' || tt == 'delivery' || tt == 'care') {
          for (final cb in _marketplaceMsgListeners) {
            cb?.call({
              'conversationId': normalized['conversationId'],
              'messageId': normalized['messageId'],
              'senderId': normalized['senderId'],
              'text': normalized['text'],
              'mediaUrl': normalized['mediaUrl'],
              'mediaType': normalized['mediaType'],
              'timestamp': normalized['timestamp'],
            });
          }
        }
      });

      _socket!.on('typing_status', (data) {
        final map = _toMap(data);
        if (map == null) return;
        final tt = map['threadType']?.toString();
        final typingPayload = {
          'conversationId': map['conversationId'],
          'userId': map['userId'],
          'userName': map['userName'],
          'isTyping': map['isTyping'],
        };
        if (tt == 'support') {
          for (final cb in _customerCareTypingListeners) {
            cb?.call(Map<String, dynamic>.from(typingPayload));
          }
        } else if (tt == 'seller' || tt == 'delivery' || tt == 'care') {
          for (final cb in _marketplaceTypingListeners) {
            cb?.call(Map<String, dynamic>.from(typingPayload));
          }
        }
      });

      _socket!.on('vet_direct_new_message', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _vetDirectMsgListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.on('vet_direct_is_typing', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _vetDirectTypingListeners) {
            cb?.call(map);
          }
        }
      });

      void dispatchShopOrder(String event, dynamic data) {
        final map = _toMap(data);
        if (map == null) return;
        for (final cb in _shopOrderListeners) {
          cb?.call(event, map);
        }
      }

      _socket!.on('job:available', (data) => dispatchShopOrder('job:available', data));
      _socket!.on(
        'order:assigned_rider',
        (data) => dispatchShopOrder('order:assigned_rider', data),
      );
      _socket!.on(
        'order:assigned_seller',
        (data) => dispatchShopOrder('order:assigned_seller', data),
      );
      _socket!.on(
        'orderUpdate',
        (data) => dispatchShopOrder('orderUpdate', data),
      );

      void dispatchCareBooking(String event, dynamic data) {
        final map = _toMap(data);
        if (map == null) return;
        for (final cb in _careBookingListeners) {
          cb?.call(event, map);
        }
      }

      _socket!.on(
        'care_booking:assigned',
        (data) => dispatchCareBooking('care_booking:assigned', data),
      );
      _socket!.on(
        'care_booking:update',
        (data) => dispatchCareBooking('care_booking:update', data),
      );
      _socket!.on(
        'care_booking:new',
        (data) => dispatchCareBooking('care_booking:new', data),
      );
      _socket!.on(
        'new_hostel_booking',
        (data) => dispatchCareBooking('care_booking:new', data),
      );

      _socket!.on('appointment:update', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _appointmentUpdateListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.on('incoming_call', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _incomingCallListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.on('call_answered', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _callAnsweredListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.on('call_ended', (data) {
        final map = _toMap(data);
        if (map != null) {
          for (final cb in _callEndedListeners) {
            cb?.call(map);
          }
        }
      });

      _socket!.connect();
    } catch (e) {
      if (kDebugMode) debugPrint('[SocketService] connect error: $e');
      _connecting = false;
    }
  }

  static Map<String, dynamic>? _toMap(dynamic data) {
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return null;
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _connecting = false;
  }

  void joinChatRoom(String requestId, void Function(dynamic) callback) {
    if (_socket == null || !_socket!.connected) {
      callback({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'join_request_room',
      requestId,
      ack: (response) {
        callback(response is Map ? response : {'success': false});
      },
    );
  }

  void sendMessage(
    String requestId,
    String text,
    void Function(dynamic) callback,
  ) {
    if (_socket == null || !_socket!.connected) {
      callback({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'send_message',
      {
        'requestId': requestId,
        'text': text,
        'timestamp': DateTime.now().toIso8601String(),
      },
      ack: (response) {
        callback(response is Map ? response : {'success': false});
      },
    );
  }

  void setTyping(String requestId, bool isTyping) {
    _socket?.emit('is_typing', {'requestId': requestId, 'isTyping': isTyping});
  }

  void joinCustomerCareRoom(
    String conversationId,
    void Function(dynamic) callback,
  ) {
    if (_socket == null || !_socket!.connected) {
      callback({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'join_room',
      {'conversationId': conversationId},
      ack: (response) {
        callback(response is Map ? response : {'success': false});
      },
    );
  }

  void sendCustomerCareMessage(
    String conversationId,
    String text,
    void Function(dynamic) callback, {
    String? mediaUrl,
    String? mediaType,
  }) {
    if (_socket == null || !_socket!.connected) {
      callback({'success': false, 'message': 'Not connected'});
      return;
    }
    final hasText = text.trim().isNotEmpty;
    final mUrl = mediaUrl?.trim() ?? '';
    final hasMedia =
        mUrl.isNotEmpty && (mediaType == 'image' || mediaType == 'video');
    if (!hasText && !hasMedia) {
      callback({'success': false, 'message': 'Empty message'});
      return;
    }
    _socket!.emitWithAck(
      'send_message',
      {
        'conversationId': conversationId,
        if (hasText) 'text': text,
        if (hasMedia) 'mediaUrl': mUrl,
        if (hasMedia) 'mediaType': mediaType,
      },
      ack: (response) {
        callback(response is Map ? response : {'success': false});
      },
    );
  }

  void setCustomerCareTyping(String conversationId, bool isTyping) {
    _socket?.emit('typing_status', {
      'conversationId': conversationId,
      'isTyping': isTyping,
    });
  }

  void joinMarketplaceRoom(
    String conversationId,
    void Function(dynamic) callback,
  ) {
    if (_socket == null || !_socket!.connected) {
      callback({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'join_room',
      {'conversationId': conversationId},
      ack: (response) {
        callback(response is Map ? response : {'success': false});
      },
    );
  }

  void sendMarketplaceMessage(
    String conversationId,
    String text, {
    String? productId,
    String? mediaUrl,
    String? mediaType,
    void Function(dynamic)? callback,
  }) {
    if (_socket == null || !_socket!.connected) {
      callback?.call({'success': false, 'message': 'Not connected'});
      return;
    }
    final hasText = text.trim().isNotEmpty;
    final mUrl = mediaUrl?.trim() ?? '';
    final hasMedia =
        mUrl.isNotEmpty && (mediaType == 'image' || mediaType == 'video');
    if (!hasText && !hasMedia) {
      callback?.call({'success': false, 'message': 'Empty message'});
      return;
    }
    _socket!.emitWithAck(
      'send_message',
      {
        'conversationId': conversationId,
        if (hasText) 'text': text,
        if (productId != null && productId.isNotEmpty) 'productId': productId,
        if (hasMedia) 'mediaUrl': mUrl,
        if (hasMedia) 'mediaType': mediaType,
      },
      ack: (response) {
        callback?.call(response is Map ? response : {'success': false});
      },
    );
  }

  void setMarketplaceTyping(String conversationId, bool isTyping) {
    _socket?.emit('typing_status', {
      'conversationId': conversationId,
      'isTyping': isTyping,
    });
  }

  void addMarketplaceMessageListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _marketplaceMsgListeners.add(listener);
  }

  void removeMarketplaceMessageListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _marketplaceMsgListeners.remove(listener);
  }

  void addMarketplaceTypingListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _marketplaceTypingListeners.add(listener);
  }

  void removeMarketplaceTypingListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _marketplaceTypingListeners.remove(listener);
  }

  void joinVetDirectRoom({
    required String ownerId,
    required String vetId,
    void Function(dynamic)? callback,
  }) {
    if (_socket == null || !_socket!.connected) {
      callback?.call({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'join_vet_direct_room',
      {'ownerId': ownerId, 'vetId': vetId},
      ack: (response) {
        callback?.call(response is Map ? response : {'success': false});
      },
    );
  }

  void leaveVetDirectRoom({
    required String ownerId,
    required String vetId,
  }) {
    _socket?.emitWithAck(
      'leave_vet_direct_room',
      {'ownerId': ownerId, 'vetId': vetId},
      ack: (_) {},
    );
  }

  void sendVetDirectMessage({
    required String ownerId,
    required String vetId,
    required String text,
    void Function(dynamic)? callback,
  }) {
    if (_socket == null || !_socket!.connected) {
      callback?.call({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'send_vet_direct_message',
      {'ownerId': ownerId, 'vetId': vetId, 'text': text},
      ack: (response) {
        callback?.call(response is Map ? response : {'success': false});
      },
    );
  }

  void setVetDirectTyping({
    required String ownerId,
    required String vetId,
    required bool isTyping,
  }) {
    _socket?.emit('vet_direct_typing', {
      'ownerId': ownerId,
      'vetId': vetId,
      'isTyping': isTyping,
    });
  }

  void addVetDirectMessageListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _vetDirectMsgListeners.add(listener);
  }

  void removeVetDirectMessageListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _vetDirectMsgListeners.remove(listener);
  }

  void addVetDirectTypingListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _vetDirectTypingListeners.add(listener);
  }

  void removeVetDirectTypingListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _vetDirectTypingListeners.remove(listener);
  }

  void addNewMessageListener(void Function(Map<String, dynamic>) listener) {
    _newMessageListeners.add(listener);
  }

  void removeNewMessageListener(void Function(Map<String, dynamic>) listener) {
    _newMessageListeners.remove(listener);
  }

  void addStatusChangeListener(void Function(Map<String, dynamic>) listener) {
    _statusChangeListeners.add(listener);
  }

  void removeStatusChangeListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _statusChangeListeners.remove(listener);
  }

  void addStaffMovedListener(void Function(Map<String, dynamic>) listener) {
    _staffMovedListeners.add(listener);
  }

  void removeStaffMovedListener(void Function(Map<String, dynamic>) listener) {
    _staffMovedListeners.remove(listener);
  }

  void addIsTypingListener(void Function(Map<String, dynamic>) listener) {
    _isTypingListeners.add(listener);
  }

  void removeIsTypingListener(void Function(Map<String, dynamic>) listener) {
    _isTypingListeners.remove(listener);
  }

  void addCustomerCareMessageListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _customerCareMsgListeners.add(listener);
  }

  void removeCustomerCareMessageListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _customerCareMsgListeners.remove(listener);
  }

  void addCustomerCareTypingListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _customerCareTypingListeners.add(listener);
  }

  void removeCustomerCareTypingListener(
    void Function(Map<String, dynamic>) listener,
  ) {
    _customerCareTypingListeners.remove(listener);
  }

  void addConnectListener(void Function() listener) {
    _connectListeners.add(listener);
  }

  void removeConnectListener(void Function() listener) {
    _connectListeners.remove(listener);
  }

  void emitMarkReadConversation(String conversationId) {
    _socket?.emit('mark_read', {'conversationId': conversationId});
  }

  void emitMarkAsRead({
    String? conversationId,
    String? requestId,
    String? ownerId,
    String? vetId,
    String? chatId,
  }) {
    final p = <String, dynamic>{};
    if (chatId != null && chatId.isNotEmpty) {
      p['chatId'] = chatId;
    }
    if (conversationId != null && conversationId.isNotEmpty) {
      p['conversationId'] = conversationId;
    }
    if (requestId != null && requestId.isNotEmpty) {
      p['requestId'] = requestId;
    }
    if (ownerId != null && vetId != null) {
      p['ownerId'] = ownerId;
      p['vetId'] = vetId;
    }
    if (p.isEmpty) return;
    _socket?.emitWithAck('mark_as_read', p, ack: (_) {});
  }

  void addDisconnectListener(void Function(String) listener) {
    _disconnectListeners.add(listener);
  }

  void addShopOrderListener(
    void Function(String event, Map<String, dynamic> payload) listener,
  ) {
    _shopOrderListeners.add(listener);
  }

  void removeShopOrderListener(
    void Function(String event, Map<String, dynamic> payload) listener,
  ) {
    _shopOrderListeners.remove(listener);
  }

  void addCareBookingListener(
    void Function(String event, Map<String, dynamic> payload) listener,
  ) {
    _careBookingListeners.add(listener);
  }

  void removeCareBookingListener(
    void Function(String event, Map<String, dynamic> payload) listener,
  ) {
    _careBookingListeners.remove(listener);
  }

  void addAppointmentUpdateListener(void Function(Map<String, dynamic>) listener) {
    _appointmentUpdateListeners.add(listener);
  }

  void removeAppointmentUpdateListener(void Function(Map<String, dynamic>) listener) {
    _appointmentUpdateListeners.remove(listener);
  }

  void emitMakeCall({
    required String toUserId,
    required String channelName,
    required String callType,
    String callerName = '',
    String? appointmentId,
    String? careBookingId,
    void Function(dynamic)? callback,
  }) {
    if (_socket == null || !_socket!.connected) {
      callback?.call({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'make_call',
      {
        'toUserId': toUserId,
        'channelName': channelName,
        'callType': callType,
        'callerName': callerName,
        if (appointmentId != null && appointmentId.isNotEmpty)
          'appointmentId': appointmentId,
        if (careBookingId != null && careBookingId.isNotEmpty)
          'careBookingId': careBookingId,
      },
      ack: (response) {
        callback?.call(response is Map ? response : {'success': false});
      },
    );
  }

  void emitAnswerCall({
    required String toUserId,
    required String channelName,
    void Function(dynamic)? callback,
  }) {
    if (_socket == null || !_socket!.connected) {
      callback?.call({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'answer_call',
      {'toUserId': toUserId, 'channelName': channelName},
      ack: (response) {
        callback?.call(response is Map ? response : {'success': false});
      },
    );
  }

  void emitHangUp({
    required String toUserId,
    required String channelName,
    int durationSeconds = 0,
    void Function(dynamic)? callback,
  }) {
    if (_socket == null || !_socket!.connected) {
      callback?.call({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'hang_up',
      {
        'toUserId': toUserId,
        'channelName': channelName,
        'durationSeconds': durationSeconds,
      },
      ack: (response) {
        callback?.call(response is Map ? response : {'success': false});
      },
    );
  }

  void addIncomingCallListener(void Function(Map<String, dynamic>) listener) {
    _incomingCallListeners.add(listener);
  }

  void removeIncomingCallListener(void Function(Map<String, dynamic>) listener) {
    _incomingCallListeners.remove(listener);
  }

  void addCallAnsweredListener(void Function(Map<String, dynamic>) listener) {
    _callAnsweredListeners.add(listener);
  }

  void removeCallAnsweredListener(void Function(Map<String, dynamic>) listener) {
    _callAnsweredListeners.remove(listener);
  }

  void addCallEndedListener(void Function(Map<String, dynamic>) listener) {
    _callEndedListeners.add(listener);
  }

  void removeCallEndedListener(void Function(Map<String, dynamic>) listener) {
    _callEndedListeners.remove(listener);
  }
}
