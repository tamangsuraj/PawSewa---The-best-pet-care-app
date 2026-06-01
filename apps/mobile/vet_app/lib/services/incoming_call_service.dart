import 'dart:async';

import 'dart:convert';



import 'package:flutter/material.dart';

import 'package:permission_handler/permission_handler.dart';

import 'package:pawsewa_partner/core/agora_channel_util.dart';

import 'package:pawsewa_partner/core/app_navigator.dart';

import 'package:pawsewa_partner/core/storage_service.dart';

import 'package:pawsewa_partner/screens/agora_vet_direct_call_screen.dart';

import 'package:pawsewa_partner/services/socket_service.dart';



/// Global incoming Agora call handler (works on any screen while logged in).

class IncomingCallService {

  IncomingCallService._();

  static final IncomingCallService instance = IncomingCallService._();



  bool _initialized = false;

  bool _dialogOpen = false;



  void init() {

    if (_initialized) return;

    _initialized = true;

    final socket = SocketService.instance;

    socket.addConnectListener(_attachListener);

    socket.addIncomingCallListener(_onIncoming);

    unawaited(socket.connect());

  }



  void _attachListener() {}



  static Future<bool> _ensureCallPermissions({required bool video}) async {

    final mic = await Permission.microphone.request();

    if (!mic.isGranted) return false;

    if (video) {

      final cam = await Permission.camera.request();

      if (!cam.isGranted) return false;

    }

    return true;

  }



  Future<void> _onIncoming(Map<String, dynamic> data) async {

    if (_dialogOpen) return;

    final ctx = appNavigatorKey.currentContext;

    if (ctx == null || !ctx.mounted) return;



    final ch = sanitizeAgoraChannel(data['channelName']?.toString() ?? '');

    final fromId = data['fromUserId']?.toString() ?? '';

    if (ch.isEmpty || fromId.isEmpty) return;



    final video = data['callType']?.toString() == 'video';

    final callerName = data['callerName']?.toString() ?? 'Caller';



    final storage = StorageService();

    final raw = await storage.getUser();

    String myId = '';

    String myName = 'You';

    if (raw != null) {

      try {

        final m = jsonDecode(raw) as Map<String, dynamic>;

        myId = (m['_id'] ?? m['id'])?.toString() ?? '';

        myName = m['name']?.toString() ?? myName;

      } catch (_) {}

    }

    if (myId.isEmpty) return;



    _dialogOpen = true;

    if (!ctx.mounted) {

      _dialogOpen = false;

      return;

    }



    await showDialog<void>(

      context: ctx,

      barrierDismissible: false,

      builder: (dialogCtx) => AlertDialog(

        title: Text(video ? 'Incoming video call' : 'Incoming call'),

        content: Text('$callerName is calling…'),

        actions: [

          TextButton(

            onPressed: () {

              Navigator.pop(dialogCtx);

              SocketService.instance.emitHangUp(

                toUserId: fromId,

                channelName: ch,

                durationSeconds: 0,

              );

            },

            child: const Text('Decline'),

          ),

          FilledButton(

            onPressed: () async {

              final permitted = await _ensureCallPermissions(video: video);

              if (!permitted) {

                if (dialogCtx.mounted) {

                  ScaffoldMessenger.of(dialogCtx).showSnackBar(

                    SnackBar(

                      content: Text(

                        video

                            ? 'Camera and microphone are required for video calls.'

                            : 'Microphone permission is required for calls.',

                      ),

                    ),

                  );

                }

                return;

              }

              if (!dialogCtx.mounted) return;

              Navigator.pop(dialogCtx);

              await Future<void>.delayed(const Duration(milliseconds: 200));

              final nav = appNavigatorKey.currentContext;

              if (nav == null || !nav.mounted) return;

              await Navigator.of(nav, rootNavigator: true).push<void>(

                MaterialPageRoute<void>(

                  fullscreenDialog: true,

                  builder: (_) => AgoraVetDirectCallScreen(

                    channelName: ch,

                    myUserId: myId,

                    peerUserId: fromId,

                    peerName: callerName,

                    localDisplayName: myName,

                    video: video,

                    iAmCaller: false,

                  ),

                ),

              );

            },

            child: const Text('Accept'),

          ),

        ],

      ),

    );

    _dialogOpen = false;

  }

}


