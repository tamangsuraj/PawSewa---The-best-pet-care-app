import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';

/// Bottom message field + send button used across PawSewa chat screens.
class MessagingChatComposer extends StatelessWidget {
  const MessagingChatComposer({
    super.key,
    required this.controller,
    required this.hintText,
    required this.onSend,
    this.onChanged,
  });

  final TextEditingController controller;
  final String hintText;
  final VoidCallback onSend;
  final ValueChanged<String>? onChanged;

  static const Color _primary = Color(AppConstants.primaryColor);
  static const Color _ink = Color(AppConstants.inkColor);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.06),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  onChanged: onChanged,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  minLines: 1,
                  maxLines: 4,
                  style: GoogleFonts.outfit(fontSize: 15, color: _ink),
                  cursorColor: _primary,
                  decoration: InputDecoration(
                    hintText: hintText,
                    hintStyle: GoogleFonts.outfit(
                      color: Colors.grey.shade600,
                      fontSize: 14,
                    ),
                    filled: true,
                    fillColor: const Color(AppConstants.secondaryColor),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide: BorderSide(
                        color: _primary.withValues(alpha: 0.2),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide: BorderSide(
                        color: _primary.withValues(alpha: 0.2),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(20),
                      borderSide: const BorderSide(color: _primary, width: 1.5),
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
                onPressed: onSend,
                tooltip: 'Send',
                icon: const Icon(Icons.send_rounded, color: Colors.white),
                style: IconButton.styleFrom(
                  backgroundColor: _primary,
                  padding: const EdgeInsets.all(14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
