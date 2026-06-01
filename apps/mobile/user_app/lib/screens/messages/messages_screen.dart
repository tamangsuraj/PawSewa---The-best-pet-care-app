import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/pawsewa_call_channel.dart';
import '../../core/storage_service.dart';
import '../../services/socket_service.dart';
import '../../services/chat_unread_notify_service.dart';
import '../../widgets/messaging_call_bar.dart';
import 'agora_vet_direct_call_screen.dart';

/// Customer Care chat — loads the default support conversation with PawSewa.
class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final _api = ApiClient();
  final _socket = SocketService.instance;
  final _storage = StorageService();
  final _scroll = ScrollController();
  final _textController = TextEditingController();

  bool _loading = true;
  String? _error;
  String? _conversationId;
  String? _myUserId;
  String? _careUserId;
  String _careName = 'Customer Care';
  String _myDisplayName = 'You';
  List<Map<String, dynamic>> _messages = [];
  bool _typingRemote = false;
  Timer? _typingDebounce;
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

  Future<void> _loadUserId() async {
    final raw = await _storage.getUser();
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      final id = m['_id'] ?? m['id'];
      if (id != null) _myUserId = id.toString();
      final n = m['name']?.toString();
      if (n != null && n.isNotEmpty) {
        _myDisplayName = n;
      }
    } catch (_) {}
  }

  bool get _canCareCall =>
      _myUserId != null &&
      _careUserId != null &&
      _careUserId!.isNotEmpty;

  Future<void> _placeCareCall(bool video) async {
    final oid = _myUserId;
    final cid = _careUserId;
    if (oid == null || cid == null || cid.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Care contact is not available for calls right now.'),
          ),
        );
      }
      return;
    }
    final ch = customerCareRtcChannel(oid, cid);
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => AgoraVetDirectCallScreen(
          channelName: ch,
          myUserId: oid,
          peerUserId: cid,
          peerName: _careName,
          localDisplayName: _myDisplayName,
          video: video,
          iAmCaller: true,
        ),
      ),
    );
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
        throw Exception('Unable to load Customer Care chat');
      }
      final data = body['data'] as Map<String, dynamic>?;
      if (data == null) throw Exception('No data');
      final conv = data['conversation'] as Map<String, dynamic>?;
      _conversationId = conv?['_id']?.toString();
      final care = data['careContact'] as Map<String, dynamic>?;
      if (care != null && care['name'] != null) {
        _careName = care['name'].toString();
      }
      _careUserId = care != null
          ? (care['_id'] ?? care['id'])?.toString()
          : null;
      final msgs = data['messages'] as List<dynamic>? ?? [];
      _messages = msgs.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on DioException catch (e) {
      final d = e.response?.data;
      _error = d is Map && d['message'] is String
          ? d['message'] as String
          : 'Could not load messages.';
    } catch (e) {
      _error = 'Network error. Please try again.';
    } finally {
      if (mounted) {
        final cid = _conversationId;
        if (cid != null) {
          _unreadNotify?.setActiveChatId('c:$cid');
        }
        setState(() => _loading = false);
        _scrollToBottom();
      }
    }
  }

  Future<void> _joinWhenReady() async {
    final id = _conversationId;
    if (id == null) return;
    for (var i = 0; i < 48; i++) {
      await Future.delayed(const Duration(milliseconds: 250));
      if (_socket.isConnected) {
        _socket.joinCustomerCareRoom(id, (ack) {
          if (kDebugMode) debugPrint('[CustomerCare] join $ack');
          _socket.emitMarkReadConversation(id);
        });
        return;
      }
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

  void _onTextChanged(String v) {
    _typingDebounce?.cancel();
    final id = _conversationId;
    if (id == null) return;
    if (v.trim().isNotEmpty) {
      _socket.setCustomerCareTyping(id, true);
    } else {
      _socket.setCustomerCareTyping(id, false);
    }
    _typingDebounce = Timer(const Duration(milliseconds: 600), () {
      if (v.trim().isEmpty) {
        _socket.setCustomerCareTyping(id, false);
      }
    });
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    final id = _conversationId;
    if (text.isEmpty || id == null) return;
    _socket.setCustomerCareTyping(id, false);

    if (_socket.isConnected) {
      _socket.sendCustomerCareMessage(id, text, (ack) {
        final ok = ack is Map && ack['success'] == true;
        if (ok) {
          if (mounted) setState(() => _textController.clear());
        } else if (mounted) {
          _fallbackHttpSend(id, text);
        }
      });
    } else {
      await _fallbackHttpSend(id, text);
    }
  }

  Future<void> _fallbackHttpSend(String id, String text) async {
    try {
      await _api.postCustomerCareMessage(id, text);
      if (mounted) setState(() => _textController.clear());
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
    _typingDebounce?.cancel();
    _typingHide?.cancel();
    _socket.removeCustomerCareMessageListener(_onCareMessage);
    _socket.removeCustomerCareTypingListener(_onCareTyping);
    final id = _conversationId;
    if (id != null) {
      _socket.setCustomerCareTyping(id, false);
    }
    _textController.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);

    if (_loading) {
      return const Scaffold(body: Center(child: PawSewaLoader()));
    }
    if (_error != null) {
      return Scaffold(
        body: Center(
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
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_canCareCall)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Row(
                  children: [
                    Text(
                      'Call Customer Care',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey[700],
                      ),
                    ),
                    const Spacer(),
                    MessagingCallBar(
                      onAudio: () => unawaited(_placeCareCall(false)),
                      onVideo: () => unawaited(_placeCareCall(true)),
                      iconColor: Colors.white,
                    ),
                  ],
                ),
              ),
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
                        'Customer Care is typing…',
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
                  final text = m['text']?.toString() ?? '';
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
                        text,
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
              color: Colors.white,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _textController,
                        onChanged: _onTextChanged,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        minLines: 1,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: 'Message Customer Care…',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: _send,
                      tooltip: 'Send',
                      icon: const Icon(Icons.send_rounded, color: Colors.white),
                      style: IconButton.styleFrom(
                        backgroundColor: primary,
                        padding: const EdgeInsets.all(14),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
