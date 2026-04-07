import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:video_player/video_player.dart';

/// Inline photo / video preview inside a chat bubble. Tap image to expand.
class ChatMediaInline extends StatefulWidget {
  const ChatMediaInline({
    super.key,
    required this.mediaUrl,
    required this.mediaType,
    this.maxWidth = 220,
    this.borderRadius = 12,
    this.onTapImage,
  });

  final String mediaUrl;
  final String mediaType;
  final double maxWidth;
  final double borderRadius;
  final VoidCallback? onTapImage;

  @override
  State<ChatMediaInline> createState() => _ChatMediaInlineState();
}

class _ChatMediaInlineState extends State<ChatMediaInline> {
  VideoPlayerController? _video;

  @override
  void initState() {
    super.initState();
    if (widget.mediaType == 'video' && widget.mediaUrl.isNotEmpty) {
      final v = VideoPlayerController.networkUrl(Uri.parse(widget.mediaUrl));
      _video = v;
      v.initialize().then((_) {
        if (!mounted) return;
        v.addListener(() {
          if (mounted) setState(() {});
        });
        setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.mediaUrl.isEmpty) {
      return const SizedBox.shrink();
    }
    if (widget.mediaType == 'video') {
      final c = _video;
      if (c == null || !c.value.isInitialized) {
        return SizedBox(
          width: widget.maxWidth,
          height: 140,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            child: ColoredBox(
              color: Colors.black26,
              child: const Center(
                child: SizedBox(
                  width: 28,
                  height: 28,
                  child: PawSewaLoader(width: 32, center: false),
                ),
              ),
            ),
          ),
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            child: SizedBox(
              width: widget.maxWidth,
              child: AspectRatio(
                aspectRatio: c.value.aspectRatio == 0 ? 16 / 9 : c.value.aspectRatio,
                child: VideoPlayer(c),
              ),
            ),
          ),
          const SizedBox(height: 6),
          IconButton(
            onPressed: () {
              setState(() {
                c.value.isPlaying ? c.pause() : c.play();
              });
            },
            icon: Icon(c.value.isPlaying ? Icons.pause_circle : Icons.play_circle_fill),
            color: Colors.white70,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      );
    }

    final child = ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: CachedNetworkImage(
        imageUrl: widget.mediaUrl,
        width: widget.maxWidth,
        fit: BoxFit.cover,
        placeholder: (_, _) => SizedBox(
          width: widget.maxWidth,
          height: 140,
          child: const Center(child: PawSewaLoader(width: 32, center: false)),
        ),
        errorWidget: (_, _, _) => const Icon(Icons.broken_image_outlined),
      ),
    );

    return GestureDetector(
      onTap: widget.onTapImage,
      child: child,
    );
  }
}

void openChatImageFullscreen(BuildContext context, String url) {
  showDialog<void>(
    context: context,
    builder: (ctx) => Dialog(
      backgroundColor: Colors.black,
      insetPadding: EdgeInsets.zero,
      child: Stack(
        fit: StackFit.expand,
        children: [
          InteractiveViewer(
            child: Center(
              child: CachedNetworkImage(imageUrl: url, fit: BoxFit.contain),
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.of(ctx).pop(),
            ),
          ),
        ],
      ),
    ),
  );
}
