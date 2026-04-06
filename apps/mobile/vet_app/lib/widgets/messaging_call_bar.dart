import 'package:flutter/material.dart';

import '../core/constants.dart';

/// Messenger-style audio / video shortcuts (top-right of chat app bar).
class MessagingCallBar extends StatelessWidget {
  const MessagingCallBar({
    super.key,
    required this.onAudio,
    required this.onVideo,
    this.iconColor = Colors.white,
  });

  final VoidCallback onAudio;
  final VoidCallback onVideo;
  final Color iconColor;

  static const Color _brown = Color(AppConstants.primaryColor);

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: _brown.withValues(alpha: 0.92),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onAudio,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Icon(Icons.call_rounded, size: 20, color: iconColor),
            ),
          ),
        ),
        const SizedBox(width: 6),
        Material(
          color: _brown.withValues(alpha: 0.92),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onVideo,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Icon(Icons.videocam_rounded, size: 20, color: iconColor),
            ),
          ),
        ),
      ],
    );
  }
}
