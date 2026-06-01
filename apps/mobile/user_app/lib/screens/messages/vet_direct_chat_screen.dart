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
import '../../widgets/messaging_chat_app_bar.dart';
import '../../widgets/messaging_chat_composer.dart';
import 'agora_vet_direct_call_screen.dart';

/// 1:1 chat with a vet (room id: ownerUserId_vetUserId).
class VetDirectChatScreen extends StatefulWidget {
  const VetDirectChatScreen({
    super.key,
    required this.vet,
    required this.ownerId,
    this.petName,
  });

  final Map<String, dynamic> vet;
  final String ownerId;
  final String? petName;

  @override
  State<VetDirectChatScreen> createState() => _VetDirectChatScreenState();
}

class _VetDirectChatScreenState extends State<VetDirectChatScreen> {
  final _api = ApiClient();
  final _socket = SocketService.instance;
  final _scroll = ScrollController();
  final _text = TextEditingController();

  String get _vetId => widget.vet['_id']?.toString() ?? '';
  String get _vetName => widget.vet['name']?.toString() ?? 'Vet';
  String get _displayVetName {
    final n = _vetName.trim();
    if (n.isEmpty) return 'Vet';
    return n.startsWith('Dr.') ? n : 'Dr. $n';
  }

  String? _pic;
  String _myName = 'You';
  String? _petLabel;

  bool _loading = true;
  String? _error;
  final List<Map<String, dynamic>> _messages = [];
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
    _pic = widget.vet['profilePicture']?.toString();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _loadMyName();
    await _loadPetLabel();
    await _loadMessages();
    await _socket.connect();
    _socket.addVetDirectMessageListener(_onMsg);
    _socket.addVetDirectTypingListener(_onTyping);
    _joinWhenReady();
  }

  Future<void> _loadPetLabel() async {
    String? pet = widget.petName?.trim();
    if (pet != null && (pet.isEmpty || pet.toLowerCase() == 'null')) {
      pet = null;
    }
    if (pet == null) {
      for (final key in ['petName', 'lastPetName']) {
        final v = widget.vet[key]?.toString().trim();
        if (v != null && v.isNotEmpty && v.toLowerCase() != 'null') {
          pet = v;
          break;
        }
      }
      final petObj = widget.vet['pet'];
      if (pet == null && petObj is Map) {
        final n = petObj['name']?.toString().trim();
        if (n != null && n.isNotEmpty) pet = n;
      }
    }
    if (pet == null) {
      try {
        final res = await _api.getMyPets();
        final body = res.data;
        if (body is Map && body['success'] == true) {
          final list = body['data'] as List<dynamic>?;
          if (list != null && list.isNotEmpty) {
            final first = list.first;
            if (first is Map) {
              final n = first['name']?.toString().trim();
              if (n != null && n.isNotEmpty) pet = n;
            }
          }
        }
      } catch (_) {}
    }
    if (!mounted) return;
    setState(() => _petLabel = pet);
  }

  String? get _chatSubtitle {
    if (_petLabel != null && _petLabel!.isNotEmpty) {
      return 'Chatting about ${_petLabel!}';
    }
    final clinic = widget.vet['clinicName']?.toString().trim();
    if (clinic != null && clinic.isNotEmpty) return clinic;
    final spec = widget.vet['specialization']?.toString().trim() ??
        widget.vet['specialty']?.toString().trim();
    if (spec != null && spec.isNotEmpty) return spec;
    return 'Direct vet chat';
  }

  Future<void> _loadMyName() async {
    final raw = await StorageService().getUser();
    if (raw == null) return;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      final n = m['name']?.toString();
      if (n != null && n.isNotEmpty && mounted) {
        setState(() => _myName = n);
      }
    } catch (_) {}
  }

  Future<void> _placeCall(bool video) async {
    final ch = vetDirectRtcChannel(widget.ownerId, _vetId);
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => AgoraVetDirectCallScreen(
          channelName: ch,
          myUserId: widget.ownerId,
          peerUserId: _vetId,
          peerName: _vetName,
          localDisplayName: _myName,
          video: video,
          iAmCaller: true,
        ),
      ),
    );
  }

  Future<void> _joinWhenReady() async {
    for (var i = 0; i < 48; i++) {
      await Future.delayed(const Duration(milliseconds: 250));
      if (_socket.isConnected) {
        _socket.joinVetDirectRoom(
          ownerId: widget.ownerId,
          vetId: _vetId,
          callback: (ack) {
            if (kDebugMode) debugPrint('[VetDirect] join $ack');
            _socket.emitMarkAsRead(
              ownerId: widget.ownerId,
              vetId: _vetId,
            );
          },
        );
        return;
      }
    }
  }

  Future<void> _loadMessages() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _api.getVetDirectMessages(
        ownerId: widget.ownerId,
        vetId: _vetId,
      );
      final body = res.data;
      if (body is! Map || body['success'] != true) {
        throw Exception('Could not load chat');
      }
      final data = body['data'] as Map<String, dynamic>?;
      final list = data?['messages'] as List<dynamic>? ?? [];
      if (!mounted) return;
      setState(() {
        _messages.clear();
        for (final e in list) {
          if (e is Map) {
            _messages.add(Map<String, dynamic>.from(e));
          }
        }
        _loading = false;
      });
      _unreadNotify?.setActiveChatId('v:${widget.ownerId}:$_vetId');
      _scrollBottom();
    } on DioException catch (e) {
      final d = e.response?.data;
      _error = d is Map && d['message'] is String
          ? d['message'] as String
          : 'Could not load chat.';
      setState(() => _loading = false);
    } catch (e) {
      if (!mounted) return;
      _error = 'Network error. Please try again.';
      setState(() => _loading = false);
    }
  }

  void _onMsg(Map<String, dynamic> data) {
    if (data['ownerId']?.toString() != widget.ownerId ||
        data['vetId']?.toString() != _vetId) {
      return;
    }
    final mid = data['messageId']?.toString() ?? '';
    if (mid.isNotEmpty && _messages.any((m) => m['_id']?.toString() == mid)) {
      return;
    }
    if (!mounted) return;
    setState(() {
      _messages.add({
        '_id': mid.isEmpty
            ? 'tmp-${DateTime.now().millisecondsSinceEpoch}'
            : mid,
        'sender': data['sender'],
        'text': data['text'],
        'createdAt': data['timestamp'],
      });
    });
    _scrollBottom();
  }

  void _onTyping(Map<String, dynamic> data) {
    if (data['ownerId']?.toString() != widget.ownerId ||
        data['vetId']?.toString() != _vetId) {
      return;
    }
    final uid = data['userId']?.toString();
    if (uid == widget.ownerId) return;
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

  void _scrollBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  void _onChanged(String v) {
    _typingDebounce?.cancel();
    if (v.trim().isNotEmpty) {
      _socket.setVetDirectTyping(
        ownerId: widget.ownerId,
        vetId: _vetId,
        isTyping: true,
      );
    } else {
      _socket.setVetDirectTyping(
        ownerId: widget.ownerId,
        vetId: _vetId,
        isTyping: false,
      );
    }
    _typingDebounce = Timer(const Duration(milliseconds: 600), () {
      if (v.trim().isEmpty) {
        _socket.setVetDirectTyping(
          ownerId: widget.ownerId,
          vetId: _vetId,
          isTyping: false,
        );
      }
    });
  }

  Future<void> _send() async {
    final t = _text.text.trim();
    if (t.isEmpty) return;
    _socket.setVetDirectTyping(
      ownerId: widget.ownerId,
      vetId: _vetId,
      isTyping: false,
    );

    if (_socket.isConnected) {
      _socket.sendVetDirectMessage(
        ownerId: widget.ownerId,
        vetId: _vetId,
        text: t,
        callback: (ack) {
          final ok = ack is Map && ack['success'] == true;
          if (ok) {
            if (mounted) setState(() => _text.clear());
          } else if (mounted) {
            _fallbackHttp(t);
          }
        },
      );
    } else {
      await _fallbackHttp(t);
    }
  }

  Future<void> _fallbackHttp(String text) async {
    try {
      await _api.postVetDirectMessage(
        ownerId: widget.ownerId,
        vetId: _vetId,
        text: text,
      );
      if (mounted) setState(() => _text.clear());
      await _loadMessages();
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
    _socket.removeVetDirectMessageListener(_onMsg);
    _socket.removeVetDirectTypingListener(_onTyping);
    _socket.setVetDirectTyping(
      ownerId: widget.ownerId,
      vetId: _vetId,
      isTyping: false,
    );
    _socket.leaveVetDirectRoom(ownerId: widget.ownerId, vetId: _vetId);
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    const ink = Color(AppConstants.inkColor);
    const bg = Color(AppConstants.bentoBackgroundColor);
    const bubbleOther = Color(AppConstants.sandColor);

    return Scaffold(
      backgroundColor: bg,
      appBar: MessagingChatAppBar(
        title: _displayVetName,
        subtitle: _chatSubtitle,
        avatarUrl: _pic,
        avatarLabel: _vetName,
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 8),
            child: Center(
              child: MessagingCallBar(
                onAudio: () => unawaited(_placeCall(false)),
                onVideo: () => unawaited(_placeCall(true)),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: PawSewaLoader())
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
                      onPressed: _loadMessages,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : Column(
              children: [
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
                            '$_vetName is typing…',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontStyle: FontStyle.italic,
                              color: Colors.grey[600],
                            ),
                          ),
                        );
                      }
                      final m = _messages[i];
                      final mine = m['sender']?.toString() == widget.ownerId;
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
                            color: mine ? primary : bubbleOther,
                            borderRadius: BorderRadius.circular(16),
                            border: mine
                                ? null
                                : Border.all(
                                    color: primary.withValues(alpha: 0.12),
                                  ),
                          ),
                          child: Text(
                            text,
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              color: mine ? Colors.white : ink,
                              height: 1.35,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                MessagingChatComposer(
                  controller: _text,
                  hintText: 'Message your vet…',
                  onChanged: _onChanged,
                  onSend: _send,
                ),
              ],
            ),
    );
  }
}
