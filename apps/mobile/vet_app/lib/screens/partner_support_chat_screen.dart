import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/storage_service.dart';
import '../services/socket_service.dart';
import '../services/chat_unread_notify_service.dart';

/// PawSewa Customer Support (same thread model as user app — Marketplace SUPPORT).
class PartnerSupportChatScreen extends StatefulWidget {
  const PartnerSupportChatScreen({super.key});

  @override
  State<PartnerSupportChatScreen> createState() =>
      _PartnerSupportChatScreenState();
}

class _PartnerSupportChatScreenState extends State<PartnerSupportChatScreen> {
  final _api = ApiClient();
  final _socket = SocketService.instance;
  final _storage = StorageService();
  final _scroll = ScrollController();
  final _text = TextEditingController();

  bool _loading = true;
  String? _error;
  String? _conversationId;
  String? _myUserId;
  String _careName = 'Customer Care';
  final List<Map<String, dynamic>> _messages = [];
  Timer? _typingDebounce;
  bool _typingRemote = false;
  Timer? _typingHide;
  ChatUnreadNotifyService? _unreadNotify;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _unreadNotify ??= context.read<ChatUnreadNotifyService>();
  }

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _loadUserId();
    await _loadThread();
    await _socket.connect();
    _socket.addCustomerCareMessageListener(_onCareMessage);
    _socket.addCustomerCareTypingListener(_onCareTyping);
    await _joinWhenReady();
  }

  Future<void> _joinWhenReady() async {
    final id = _conversationId;
    if (id == null) return;
    for (var i = 0; i < 48; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 250));
      if (_socket.isConnected) {
        _socket.joinCustomerCareRoom(id, (ack) {
          if (kDebugMode) debugPrint('[CustomerCare] join $ack');
          _socket.emitMarkReadConversation(id);
        });
        return;
      }
    }
  }

  Future<void> _loadUserId() async {
    final raw = await _storage.getUser();
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      final id = m['_id'] ?? m['id'];
      if (id != null) _myUserId = id.toString();
    } catch (_) {}
  }

  Future<void> _loadThread() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.getCustomerCareMine();
      final body = res.data;
      if (body is! Map || body['success'] != true) {
        throw Exception(body is Map ? body['message']?.toString() : 'Failed');
      }
      final data = body['data'] as Map<String, dynamic>?;
      final conv = data?['conversation'] as Map<String, dynamic>?;
      final msgs = data?['messages'] as List<dynamic>? ?? [];
      final care = data?['careContact'] as Map<String, dynamic>?;
      final id = conv?['_id']?.toString();
      if (id == null) throw Exception('No conversation');
      if (!mounted) return;
      setState(() {
        _conversationId = id;
        _careName = care?['name']?.toString() ?? 'Customer Care';
        _messages
          ..clear()
          ..addAll(msgs.map((e) => Map<String, dynamic>.from(e as Map)));
        _loading = false;
      });
      _unreadNotify?.setActiveChatId('c:$id');
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } on DioException catch (e) {
      final d = e.response?.data;
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = d is Map && d['message'] is String
            ? d['message'] as String
            : 'Could not load messages.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  void _onCareMessage(Map<String, dynamic> data) {
    if (data['conversationId']?.toString() != _conversationId) return;
    if (!mounted) return;
    final mid = data['messageId']?.toString() ?? '';
    if (_messages.any((m) => m['_id']?.toString() == mid)) return;
    setState(() {
      _messages.add({
        '_id': mid.isEmpty
            ? 'tmp-${DateTime.now().millisecondsSinceEpoch}'
            : mid,
        'senderId': data['senderId'],
        'receiverId': data['receiverId'],
        'text': data['text'],
        'timestamp': data['timestamp'],
      });
    });
    _scrollToBottom();
  }

  void _onCareTyping(Map<String, dynamic> data) {
    if (data['conversationId']?.toString() != _conversationId) return;
    final uid = data['userId']?.toString();
    if (uid != null && uid == _myUserId) return;
    if (!mounted) return;
    if (data['isTyping'] == true) {
      setState(() => _typingRemote = true);
      _typingHide?.cancel();
      _typingHide = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => _typingRemote = false);
      });
    } else {
      setState(() => _typingRemote = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    final id = _conversationId;
    if (text.isEmpty || id == null) return;
    _socket.setCustomerCareTyping(id, false);

    if (_socket.isConnected) {
      _socket.sendCustomerCareMessage(id, text, (ack) {
        final ok = ack is Map && ack['success'] == true;
        if (ok) {
          if (mounted) setState(() => _text.clear());
        } else if (mounted) {
          _fallbackSend(id, text);
        }
      });
    } else {
      await _fallbackSend(id, text);
    }
  }

  Future<void> _fallbackSend(String id, String text) async {
    try {
      await _api.postCustomerCareMessage(id, text);
      if (mounted) setState(() => _text.clear());
      await _loadThread();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Message could not be sent')),
        );
      }
    }
  }

  @override
  void dispose() {
    _unreadNotify?.setActiveChatId(null);
    _typingHide?.cancel();
    _typingDebounce?.cancel();
    _socket.removeCustomerCareMessageListener(_onCareMessage);
    _socket.removeCustomerCareTypingListener(_onCareTyping);
    final id = _conversationId;
    if (id != null) _socket.setCustomerCareTyping(id, false);
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.secondaryColor),
      appBar: AppBar(
        title: Text(
          'Customer Support',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(AppConstants.primaryColor),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _loadThread,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: const Color(
                          AppConstants.primaryColor,
                        ).withValues(alpha: 0.15),
                        child: const Icon(
                          Icons.send_rounded,
                          color: Color(AppConstants.primaryColor),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _careName,
                              style: GoogleFonts.outfit(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                                color: const Color(AppConstants.primaryColor),
                              ),
                            ),
                            Text(
                              'We\'re here to help',
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length + (_typingRemote ? 1 : 0),
                    itemBuilder: (context, i) {
                      if (_typingRemote && i == _messages.length) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            'Typing…',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontStyle: FontStyle.italic,
                              color: Colors.grey[600],
                            ),
                          ),
                        );
                      }
                      final m = _messages[i];
                      final mine =
                          _myUserId != null &&
                          m['senderId']?.toString() == _myUserId;
                      final t = m['text']?.toString() ?? '';
                      return Align(
                        alignment: mine
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.of(context).size.width * 0.78,
                          ),
                          decoration: BoxDecoration(
                            color: mine
                                ? const Color(AppConstants.primaryColor)
                                : Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            t,
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              color: mine ? Colors.white : Colors.black87,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                Material(
                  color: const Color(AppConstants.secondaryColor),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _text,
                            onChanged: (v) {
                              final id = _conversationId;
                              if (id == null) return;
                              _typingDebounce?.cancel();
                              if (v.trim().isNotEmpty) {
                                _socket.setCustomerCareTyping(id, true);
                              } else {
                                _socket.setCustomerCareTyping(id, false);
                              }
                              _typingDebounce = Timer(
                                const Duration(milliseconds: 600),
                                () {
                                  if (v.trim().isEmpty) {
                                    _socket.setCustomerCareTyping(id, false);
                                  }
                                },
                              );
                            },
                            textInputAction: TextInputAction.send,
                            onSubmitted: (_) => _send(),
                            minLines: 1,
                            maxLines: 4,
                            decoration: InputDecoration(
                              hintText: 'Message…',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: _send,
                          tooltip: 'Send',
                          icon: const Icon(
                            Icons.send_rounded,
                            color: Colors.white,
                          ),
                          style: IconButton.styleFrom(
                            backgroundColor: const Color(
                              AppConstants.primaryColor,
                            ),
                            padding: const EdgeInsets.all(14),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
