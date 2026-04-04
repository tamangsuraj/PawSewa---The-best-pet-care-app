import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/api_config.dart';
import '../core/storage_service.dart';

/// Singleton Socket.io service: JWT auth, auto-reconnect, chat + status listeners.
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

  io.Socket? get socket => _socket;
  bool get isConnected => _socket?.connected ?? false;

  /// Connect with stored JWT. Call after login. Enables auto-reconnect.
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
      // WebSocket-only + forceNew: avoids ngrok free-tier HTML / polling rate-limit issues.
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
          debugPrint('[SocketService] ConnectError: $err (reconnecting in background; tap "Can\'t connect? Set server IP" on login to fix)');
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

      // Unified events (web + mobile parity); same payloads as legacy care / marketplace.
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
          'timestamp': map['timestamp'],
        };
        if (tt == 'support') {
          for (final cb in _customerCareMsgListeners) {
            cb?.call(Map<String, dynamic>.from(normalized));
          }
        } else if (tt == 'seller' || tt == 'delivery') {
          for (final cb in _marketplaceMsgListeners) {
            cb?.call({
              'conversationId': normalized['conversationId'],
              'messageId': normalized['messageId'],
              'senderId': normalized['senderId'],
              'text': normalized['text'],
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
        } else if (tt == 'seller' || tt == 'delivery') {
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

  /// Disconnect and clear token usage (e.g. on logout).
  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _connecting = false;
  }

  /// Join a service request chat room. Call when opening a request chat.
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

  /// Send a chat message to a request room.
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

  /// Emit typing indicator.
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
    void Function(dynamic) callback,
  ) {
    if (_socket == null || !_socket!.connected) {
      callback({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'send_message',
      {'conversationId': conversationId, 'text': text},
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
    void Function(dynamic)? callback,
  }) {
    if (_socket == null || !_socket!.connected) {
      callback?.call({'success': false, 'message': 'Not connected'});
      return;
    }
    _socket!.emitWithAck(
      'send_message',
      {
        'conversationId': conversationId,
        'text': text,
        if (productId != null && productId.isNotEmpty) 'productId': productId,
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

  void queryVetPresence(
    List<String> vetIds,
    void Function(Map<String, dynamic>) callback,
  ) {
    if (_socket == null || !_socket!.connected) {
      callback({});
      return;
    }
    _socket!.emitWithAck(
      'query_vet_presence',
      vetIds,
      ack: (data) {
        if (data is Map) {
          callback(Map<String, dynamic>.from(data));
        } else {
          callback({});
        }
      },
    );
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

  void addConnectListener(void Function() listener) {
    _connectListeners.add(listener);
  }

  void addDisconnectListener(void Function(String) listener) {
    _disconnectListeners.add(listener);
  }
}
