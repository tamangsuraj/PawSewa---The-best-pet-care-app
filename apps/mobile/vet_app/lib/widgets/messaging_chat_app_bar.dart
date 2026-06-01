import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';

/// Brown PawSewa chat header with white title (matches user_app).
class MessagingChatAppBar extends StatelessWidget implements PreferredSizeWidget {
  const MessagingChatAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.avatarUrl,
    this.avatarLabel,
    this.leadingIcon,
    this.actions = const [],
  });

  final String title;
  final String? subtitle;
  final String? avatarUrl;
  final String? avatarLabel;
  final IconData? leadingIcon;
  final List<Widget> actions;

  static const Color _primary = Color(AppConstants.primaryColor);

  @override
  Size get preferredSize => Size.fromHeight(
        subtitle != null && subtitle!.trim().isNotEmpty ? 64 : 56,
      );

  @override
  Widget build(BuildContext context) {
    final initial = (avatarLabel ?? title).trim();
    final letter = initial.isNotEmpty ? initial[0].toUpperCase() : '?';

    return AppBar(
      backgroundColor: _primary,
      foregroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      iconTheme: const IconThemeData(color: Colors.white),
      actionsIconTheme: const IconThemeData(color: Colors.white),
      title: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: Colors.white.withValues(alpha: 0.22),
            backgroundImage: avatarUrl != null && avatarUrl!.isNotEmpty
                ? CachedNetworkImageProvider(avatarUrl!)
                : null,
            child: avatarUrl == null || avatarUrl!.isEmpty
                ? (leadingIcon != null
                    ? Icon(leadingIcon, color: Colors.white, size: 20)
                    : Text(
                        letter,
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ))
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    color: Colors.white,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle != null && subtitle!.trim().isNotEmpty)
                  Text(
                    subtitle!,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
      actions: actions,
    );
  }
}
