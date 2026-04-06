import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/editorial_canvas.dart';
import '../widgets/chat_media_inline.dart';
import '../core/storage_service.dart';
import '../services/socket_service.dart';
import '../services/chat_unread_notify_service.dart';

/// Real-time marketplace thread for partners (Socket.io + HTTP fallback).
class PartnerMarketplaceChatScreen extends StatefulWidget {
  const PartnerMarketplaceChatScreen({
    super.key,
    required this.conversationId,
    required this.peerName,
    this.peerSubtitle,
    this.highContrast = true,
  });

  final String conversationId;
  final String peerName;
  final String? peerSubtitle;
  final bool highContrast;

  @override
  State<PartnerMarketplaceChatScreen> createState() =>
      _PartnerMarketplaceChatScreenState();
}

class _PartnerMarketplaceChatScreenState
    extends State<PartnerMarketplaceChatScreen> {
  final _api = ApiClient();
  final _socket = SocketService.instance;
  final _storage = StorageService();
  final _scroll = ScrollController();
  final _text = TextEditingController();

  bool _loading = true;
  String? _error;
  String? _myUserId;
  List<Map<String, dynamic>> _messages = [];
  bool _typingRemote = false;
  Timer? _typingDebounce;
  Timer? _typingHide;
  ChatUnreadNotifyService? _unreadNotify;
  bool _uploading = false;
  double? _uploadProgress;
  final _picker = ImagePicker();

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
    await _loadMessages(silent: false);
    await _socket.connect();
    _socket.addMarketplaceMessageListener(_onSocketMessage);
    _socket.addMarketplaceTypingListener(_onTyping);
    _joinRoom();
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

  Future<void> _joinRoom() async {
    for (var i = 0; i < 40; i++) {
      await Future.delayed(const Duration(milliseconds: 200));
      if (_socket.isConnected) {
        _socket.joinMarketplaceRoom(widget.conversationId, (_) {
          _socket.emitMarkReadConversation(widget.conversationId);
        });
        return;
      }
    }
  }

  void _onSocketMessage(Map<String, dynamic> data) {
    if (data['conversationId']?.toString() != widget.conversationId) return;
    if (!mounted) return;
    final mid = data['messageId']?.toString() ?? '';
    if (_messages.any((m) => m['_id']?.toString() == mid)) return;
    setState(() {
      _messages.add({
        '_id': mid.isEmpty
            ? 'tmp-${DateTime.now().millisecondsSinceEpoch}'
            : mid,
        'sender': {'_id': data['senderId']},
        'content': data['text'],
        'mediaUrl': data['mediaUrl'],
        'mediaType': data['mediaType'],
        'createdAt': data['timestamp'],
      });
    });
    _scrollToBottom();
  }

  void _onTyping(Map<String, dynamic> data) {
    if (data['conversationId']?.toString() != widget.conversationId) return;
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
    final id = widget.conversationId;
    if (v.trim().isNotEmpty) {
      _socket.setMarketplaceTyping(id, true);
    } else {
      _socket.setMarketplaceTyping(id, false);
    }
    _typingDebounce = Timer(const Duration(milliseconds: 600), () {
      if (v.trim().isEmpty) _socket.setMarketplaceTyping(id, false);
    });
  }

  Future<void> _send() async {
    final t = _text.text.trim();
    if (t.isEmpty) return;
    await _sendPayload(text: t);
  }

  Future<void> _sendPayload({
    required String text,
    String? mediaUrl,
    String? mediaType,
  }) async {
    if (text.isEmpty && (mediaUrl == null || mediaUrl.isEmpty)) {
      return;
    }
    _socket.setMarketplaceTyping(widget.conversationId, false);
    final saved = _text.text;
    void restore() => _text.text = saved;

    if (_socket.isConnected) {
      _socket.sendMarketplaceMessage(
        widget.conversationId,
        text,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        callback: (ack) {
          final ok = ack is Map && ack['success'] == true;
          if (ok) {
            if (mounted) _text.clear();
          } else if (mounted) {
            unawaited(_fallbackHttp(text, restore, mediaUrl: mediaUrl, mediaType: mediaType));
          }
        },
      );
    } else {
      await _fallbackHttp(text, restore, mediaUrl: mediaUrl, mediaType: mediaType);
    }
  }

  Future<void> _fallbackHttp(
    String t,
    void Function() restore, {
    String? mediaUrl,
    String? mediaType,
  }) async {
    try {
      await _api.postMarketplaceMessage(
        widget.conversationId,
        text: t,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
      );
      if (mounted) _text.clear();
      await _loadMessages(silent: true);
    } catch (_) {
      restore();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Send failed')));
      }
    }
  }

  Future<void> _showAttachmentOptions() async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Photo from gallery'),
              onTap: () {
                Navigator.pop(ctx);
                unawaited(_pickAndUploadImage(ImageSource.gallery));
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam_outlined),
              title: const Text('Video from gallery'),
              onTap: () {
                Navigator.pop(ctx);
                unawaited(_pickAndUploadVideo(ImageSource.gallery));
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUploadImage(ImageSource source) async {
    final x = await _picker.pickImage(source: source, imageQuality: 88);
    if (x == null) return;
    final bytes = await x.readAsBytes();
    final name = x.path.split(RegExp(r'[/\\]')).last;
    await _uploadBytes(bytes, name.isNotEmpty ? name : 'photo.jpg');
  }

  Future<void> _pickAndUploadVideo(ImageSource source) async {
    final x = await _picker.pickVideo(source: source);
    if (x == null) return;
    final bytes = await x.readAsBytes();
    final name = x.path.split(RegExp(r'[/\\]')).last;
    await _uploadBytes(bytes, name.isNotEmpty ? name : 'clip.mp4');
  }

  Future<void> _uploadBytes(Uint8List bytes, String filename) async {
    if (!mounted) return;
    setState(() {
      _uploading = true;
      _uploadProgress = 0;
    });
    try {
      final res = await _api.uploadChatMedia(
        bytes,
        filename: filename,
        onSendProgress: (sent, total) {
          if (!mounted || total <= 0) return;
          setState(() => _uploadProgress = sent / total);
        },
      );
      final body = res.data;
      if (body is! Map || body['success'] != true) {
        throw Exception('upload failed');
      }
      final data = body['data'];
      if (data is! Map) throw Exception('upload failed');
      final url = data['url']?.toString();
      final mt = data['mediaType']?.toString();
      if (url == null || url.isEmpty || (mt != 'image' && mt != 'video')) {
        throw Exception('bad upload response');
      }
      final caption = _text.text.trim();
      await _sendPayload(text: caption, mediaUrl: url, mediaType: mt);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not upload media')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _uploading = false;
          _uploadProgress = null;
        });
      }
    }
  }

  Future<void> _loadMessages({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final r = await _api.getMarketplaceMessages(widget.conversationId);
      final body = r.data;
      if (body is Map && body['success'] == true && body['data'] is List) {
        final list = (body['data'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        if (mounted) {
          setState(() {
            _messages = list;
            _error = null;
          });
          _unreadNotify?.setActiveChatId('c:${widget.conversationId}');
          _scrollToBottom();
        }
      }
    } catch (e) {
      if (!silent && mounted) {
        setState(() {
          _error = e is DioException
              ? (e.response?.data?.toString() ?? 'Failed to load')
              : '$e';
        });
      }
    } finally {
      if (!silent && mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _unreadNotify?.setActiveChatId(null);
    _typingDebounce?.cancel();
    _typingHide?.cancel();
    _socket.removeMarketplaceMessageListener(_onSocketMessage);
    _socket.removeMarketplaceTypingListener(_onTyping);
    _socket.setMarketplaceTyping(widget.conversationId, false);
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final primary = const Color(AppConstants.primaryColor);
    final bg = widget.highContrast ? Colors.black : Colors.white;
    final fg = widget.highContrast ? Colors.white : Colors.black87;
    final subColor = widget.highContrast ? Colors.white70 : Colors.grey;

    final mainBody = _loading
        ? Center(
            child: CircularProgressIndicator(
              color: widget.highContrast ? Colors.orange : primary,
            ),
          )
        : _error != null
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: fg),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () => _loadMessages(),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              )
            : Column(
                children: [
                  if (_uploading)
                    LinearProgressIndicator(
                      value: _uploadProgress,
                      minHeight: 3,
                      backgroundColor:
                          widget.highContrast ? Colors.grey.shade800 : null,
                    ),
                  if (_typingRemote)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        '${widget.peerName} is typing…',
                        style: GoogleFonts.outfit(fontSize: 12, color: subColor),
                      ),
                    ),
                  Expanded(
                    child: ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.all(16),
                      itemCount: _messages.length,
                      itemBuilder: (context, i) {
                        final m = _messages[i];
                        final sender = m['sender'];
                        final sid = sender is Map
                            ? sender['_id']?.toString()
                            : sender?.toString();
                        final mine = _myUserId != null && sid == _myUserId;
                        final content = m['content']?.toString() ?? '';
                        final mediaUrl = m['mediaUrl']?.toString();
                        final mediaType = m['mediaType']?.toString();
                        final pn = m['productName']?.toString();
                        final bubbleMine = widget.highContrast
                            ? Colors.orange.shade800
                            : primary;
                        final bubbleOther = widget.highContrast
                            ? Colors.grey.shade900
                            : Colors.grey.shade200;
                        final textCol = mine
                            ? Colors.white
                            : (widget.highContrast
                                  ? Colors.white
                                  : Colors.black87);
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
                              maxWidth:
                                  MediaQuery.of(context).size.width * 0.78,
                            ),
                            decoration: BoxDecoration(
                              color: mine ? bubbleMine : bubbleOther,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (pn != null && pn.isNotEmpty)
                                  Text(
                                    'Product: $pn',
                                    style: GoogleFonts.outfit(
                                      fontSize: 11,
                                      color: mine
                                          ? Colors.white70
                                          : (widget.highContrast
                                                ? Colors.orangeAccent
                                                : primary),
                                    ),
                                  ),
                                if (mediaUrl != null &&
                                    mediaUrl.isNotEmpty &&
                                    (mediaType == 'image' || mediaType == 'video'))
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: ChatMediaInline(
                                      mediaUrl: mediaUrl,
                                      mediaType: mediaType!,
                                      onTapImage: mediaType == 'image'
                                          ? () => openChatImageFullscreen(
                                                context,
                                                mediaUrl,
                                              )
                                          : null,
                                    ),
                                  ),
                                if (content.isNotEmpty)
                                  Text(
                                    content,
                                    style: GoogleFonts.outfit(
                                      fontSize: 14,
                                      color: textCol,
                                    ),
                                  ),
                              ],
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
                        IconButton(
                          onPressed: _uploading ? null : _showAttachmentOptions,
                          icon: Icon(
                            Icons.attach_file_rounded,
                            color: widget.highContrast ? Colors.white70 : primary,
                          ),
                          tooltip: 'Attach photo or video',
                        ),
                        Expanded(
                          child: TextField(
                            controller: _text,
                            onChanged: _onTextChanged,
                            style: TextStyle(color: fg),
                            decoration: InputDecoration(
                              hintText: 'Quick message…',
                              hintStyle: TextStyle(
                                color: widget.highContrast
                                    ? Colors.white.withValues(alpha: 0.4)
                                    : Colors.grey,
                              ),
                              filled: true,
                              fillColor: widget.highContrast
                                  ? Colors.grey.shade900
                                  : Colors.grey.shade100,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
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
                            backgroundColor: widget.highContrast
                                ? Colors.orange.shade700
                                : primary,
                          ),
                          child: const Icon(Icons.send_rounded),
                        ),
                      ],
                    ),
                  ),
                ],
              );

    return Scaffold(
      backgroundColor: widget.highContrast ? bg : Colors.transparent,
      appBar: AppBar(
        backgroundColor: widget.highContrast ? Colors.black : Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: fg,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.peerName,
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.w600,
                color: fg,
              ),
            ),
            if (widget.peerSubtitle != null && widget.peerSubtitle!.isNotEmpty)
              Text(
                widget.peerSubtitle!,
                style: GoogleFonts.outfit(fontSize: 11, color: subColor),
              ),
          ],
        ),
      ),
      body: widget.highContrast
          ? mainBody
          : Stack(
              clipBehavior: Clip.none,
              children: [
                const EditorialBodyBackdrop(),
                Positioned.fill(child: mainBody),
              ],
            ),
    );
  }
}
