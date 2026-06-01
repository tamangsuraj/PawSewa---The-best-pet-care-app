import 'package:flutter/material.dart';

import '../core/pawsewa_call_channel.dart';
import '../screens/agora_vet_direct_call_screen.dart';
import '../services/socket_service.dart';

/// Agora + socket signaling for marketplace threads (rider / seller / care ↔ customer).
class MarketplaceChatCalls {
  MarketplaceChatCalls._();

  static bool channelMatches(String channelName, String conversationId) {
    return channelName == marketplaceRtcChannel(conversationId);
  }

  static Future<void> placeCall({
    required BuildContext context,
    required SocketService socket,
    required String conversationId,
    required String myUserId,
    required String peerUserId,
    required String peerName,
    required String myDisplayName,
    required bool video,
  }) async {
    final ch = marketplaceRtcChannel(conversationId);
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => AgoraVetDirectCallScreen(
          channelName: ch,
          myUserId: myUserId,
          peerUserId: peerUserId,
          peerName: peerName,
          localDisplayName: myDisplayName,
          video: video,
          iAmCaller: true,
        ),
      ),
    );
  }

  static void showIncomingDialog({
    required BuildContext context,
    required SocketService socket,
    required String conversationId,
    required String myUserId,
    required String myDisplayName,
    required Map<String, dynamic> data,
  }) {
    final ch = data['channelName']?.toString() ?? '';
    if (!channelMatches(ch, conversationId)) return;
    final fromId = data['fromUserId']?.toString() ?? '';
    if (fromId.isEmpty) return;
    final video = data['callType']?.toString() == 'video';
    final callerName = data['callerName']?.toString() ?? 'Caller';

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(video ? 'Incoming video call' : 'Incoming call'),
        content: Text('$callerName is calling…'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              socket.emitHangUp(
                toUserId: fromId,
                channelName: ch,
                durationSeconds: 0,
              );
            },
            child: const Text('Decline'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              if (!context.mounted) return;
              await Navigator.of(context, rootNavigator: true).push<void>(
                MaterialPageRoute<void>(
                  fullscreenDialog: true,
                  builder: (_) => AgoraVetDirectCallScreen(
                    channelName: ch,
                    myUserId: myUserId,
                    peerUserId: fromId,
                    peerName: callerName,
                    localDisplayName: myDisplayName,
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
  }
}
