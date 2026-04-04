import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../core/storage_service.dart';
import '../../services/socket_service.dart';
import '../../widgets/pawsewa_brand_logo.dart';
import 'vet_direct_chat_screen.dart';

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
  String _careName = 'Customer Care';
  List<Map<String, dynamic>> _messages = [];
  bool _typingRemote = false;
  Timer? _typingDebounce;
  Timer? _typingHide;
  List<Map<String, dynamic>> _myVets = [];
  Map<String, bool> _vetOnline = {};
  Timer? _presenceTimer;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _loadUserId();
    await _loadThread();
    await _loadMyVets();
    await _socket.connect();
    _socket.addCustomerCareMessageListener(_onCareMessage);
    _socket.addCustomerCareTypingListener(_onCareTyping);
    await _joinWhenReady();
    _refreshVetPresence();
    _presenceTimer?.cancel();
    _presenceTimer = Timer.periodic(
      const Duration(seconds: 25),
      (_) => _refreshVetPresence(),
    );
  }

  Future<void> _loadMyVets() async {
    try {
      final res = await _api.getChatsMyVets();
      final body = res.data;
      if (body is Map && body['success'] == true) {
        final list = body['data'] as List<dynamic>? ?? [];
        if (!mounted) return;
        setState(() {
          _myVets = list
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
        });
      }
    } catch (_) {
      /* optional feature */
    }
  }

  void _refreshVetPresence() {
    final ids = _myVets
        .map((v) => v['_id']?.toString())
        .whereType<String>()
        .toList();
    if (ids.isEmpty || !_socket.isConnected) return;
    _socket.queryVetPresence(ids, (map) {
      if (!mounted) return;
      setState(() {
        _vetOnline = {
          for (final e in map.entries)
            e.key: e.value == true || e.value == 'true',
        };
      });
    });
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
      final msgs = data['messages'] as List<dynamic>? ?? [];
      _messages = msgs.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on DioException catch (e) {
      final d = e.response?.data;
      _error = d is Map && d['message'] is String
          ? d['message'] as String
          : 'Could not load messages.';
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) {
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
        '_id': mid.isEmpty ? 'tmp-${DateTime.now().millisecondsSinceEpoch}' : mid,
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
    final saved = text;
    setState(() => _textController.clear());

    void restore() {
      _textController.text = saved;
    }

    if (_socket.isConnected) {
      _socket.sendCustomerCareMessage(id, saved, (ack) {
        final ok = ack is Map && ack['success'] == true;
        if (!ok && mounted) {
          _fallbackHttpSend(id, saved, restore);
        }
      });
    } else {
      await _fallbackHttpSend(id, saved, restore);
    }
  }

  Future<void> _fallbackHttpSend(
    String id,
    String text,
    void Function() restore,
  ) async {
    try {
      await _api.postCustomerCareMessage(id, text);
      await _loadThread();
    } catch (_) {
      restore();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Message could not be sent')),
        );
      }
    }
  }

  @override
  void dispose() {
    _presenceTimer?.cancel();
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
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
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
      );
    }

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_myVets.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 0, 8),
              child: Text(
                'Your Pet\'s Vets',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: const Color(AppConstants.accentColor),
                ),
              ),
            ),
            SizedBox(
              height: 104,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _myVets.length,
                separatorBuilder: (_, _) => const SizedBox(width: 16),
                itemBuilder: (context, i) {
                  final v = _myVets[i];
                  final id = v['_id']?.toString() ?? '';
                  final name = v['name']?.toString() ?? 'Vet';
                  final pic = v['profilePicture']?.toString();
                  final online = _vetOnline[id] == true;
                  return GestureDetector(
                    onTap: () {
                      final oid = _myUserId;
                      if (oid == null) return;
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => VetDirectChatScreen(
                            vet: v,
                            ownerId: oid,
                          ),
                        ),
                      );
                    },
                    child: SizedBox(
                      width: 72,
                      child: Column(
                        children: [
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              CircleAvatar(
                                radius: 32,
                                backgroundColor: const Color(
                                  AppConstants.primaryColor,
                                ).withValues(alpha: 0.12),
                                backgroundImage: pic != null && pic.isNotEmpty
                                    ? NetworkImage(pic)
                                    : null,
                                child: pic == null || pic.isEmpty
                                    ? Text(
                                        name.isNotEmpty
                                            ? name[0].toUpperCase()
                                            : '?',
                                        style: const TextStyle(
                                          fontSize: 22,
                                          fontWeight: FontWeight.w600,
                                          color: Color(AppConstants.primaryColor),
                                        ),
                                      )
                                    : null,
                              ),
                              if (online)
                                Positioned(
                                  right: 2,
                                  bottom: 2,
                                  child: Container(
                                    width: 14,
                                    height: 14,
                                    decoration: BoxDecoration(
                                      color: Colors.green,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: Colors.white,
                                        width: 2,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            name.startsWith('Dr.') ? name : 'Dr. $name',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const Divider(height: 1),
          ],
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox(
                    width: 48,
                    height: 48,
                    child: Image.asset(
                      'assets/brand/image_607767.png',
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => ColoredBox(
                        color: const Color(AppConstants.primaryColor).withValues(alpha: 0.12),
                        child: const Center(
                          child: PawSewaBrandLogo(height: 32),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Customer Care',
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Colors.grey[700],
                        ),
                      ),
                      Text(
                        _careName,
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: const Color(AppConstants.accentColor),
                        ),
                      ),
                      Text(
                        'We\'re here to help you and your pet',
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
                    _myUserId != null && m['senderId']?.toString() == _myUserId;
                final text = m['text']?.toString() ?? '';
                return Align(
                  alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    onChanged: _onTextChanged,
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
                FilledButton(
                  onPressed: _send,
                  style: FilledButton.styleFrom(
                    shape: const CircleBorder(),
                    padding: const EdgeInsets.all(14),
                  ),
                  child: const Icon(Icons.send_rounded, size: 22),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
