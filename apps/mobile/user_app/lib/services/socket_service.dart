import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/constants.dart';
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
      final url = AppConstants.socketUrl;
      _socket?.dispose();
      // Build options and add longer timeout (ms). Default is often ~20s; 60s helps on slow/mobile networks.
      final built = io.OptionBuilder()
          // Try polling first so initial handshake uses HTTP (more reliable on mobile/firewalls).
          .setTransports(['polling', 'websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(20)
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(10000)
          .build();
      final opts = Map<String, dynamic>.from(built);
      opts['timeout'] = 60000; // 60 seconds connection timeout (engine.io)
      _socket = io.io(url, opts);

      bool connectErrorLogged = false;
      _socket!.onConnect((_) {
        if (kDebugMode) debugPrint('[SocketService] Connected');
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
          debugPrint('[SocketService] ConnectError: $err (reconnecting in background; ensure device and backend are on same network, and baseUrl in constants.dart points to your PC IP)');
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
