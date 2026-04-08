import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';

class PawSewaPromoModal extends StatelessWidget {
  const PawSewaPromoModal({
    super.key,
    required this.title,
    required this.offerText,
    this.subtitle,
    this.promoCode,
    this.promoHint,
    required this.ctaText,
    required this.image,
    this.onCtaPressed,
    required this.onClose,
  });

  final String title;
  final String offerText;
  final String? subtitle;
  final String? promoCode;
  final String? promoHint;
  final String ctaText;
  final ImageProvider image;
  final VoidCallback? onCtaPressed;
  final VoidCallback onClose;

  static const _radius = 20.0;

  @override
  Widget build(BuildContext context) {
    final brown = const Color(AppConstants.primaryColor);
    final ink = const Color(AppConstants.inkColor);
    final w = MediaQuery.sizeOf(context).width;
    final cardW = (w - 32).clamp(0, 420);

    return Material(
      type: MaterialType.transparency,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Backdrop blur + dim.
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
              child: Container(
                color: Colors.black.withValues(alpha: 0.45),
              ),
            ),
          ),

          // Card
          Align(
            alignment: Alignment.center,
            child: Transform.translate(
              offset: const Offset(0, 18),
              child: SizedBox(
                width: cardW.toDouble(),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(_radius),
                  child: DecoratedBox(
                    decoration: const BoxDecoration(color: Colors.white),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Image top half
                        AspectRatio(
                          aspectRatio: 16 / 10,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              image: DecorationImage(
                                image: image,
                                fit: BoxFit.cover,
                              ),
                            ),
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.black.withValues(alpha: 0.18),
                                    Colors.black.withValues(alpha: 0.05),
                                    Colors.transparent,
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),

                        // Content bottom half
                        Padding(
                          padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                title,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: ink.withValues(alpha: 0.75),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                offerText,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.fraunces(
                                  fontSize: 34,
                                  fontWeight: FontWeight.w800,
                                  height: 1.0,
                                  color: ink,
                                ),
                              ),
                              if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  subtitle!,
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: ink.withValues(alpha: 0.65),
                                  ),
                                ),
                              ],

                              if (promoCode != null && promoCode!.trim().isNotEmpty) ...[
                                const SizedBox(height: 14),
                                _PromoCodeBox(
                                  label: 'Use code',
                                  code: promoCode!.trim(),
                                  hint: promoHint,
                                  accent: brown,
                                ),
                              ],

                              const SizedBox(height: 16),
                              _CtaButton(
                                text: ctaText,
                                accent: brown,
                                onPressed: onCtaPressed,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Close button (bottom-center, outside the card)
          Positioned(
            bottom: 44,
            child: GestureDetector(
              onTap: onClose,
              child: Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 18,
                      offset: const Offset(0, 10),
                    ),
                  ],
                  border: Border.all(color: Colors.black.withValues(alpha: 0.08)),
                ),
                child: Icon(Icons.close, color: ink.withValues(alpha: 0.8)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PromoCodeBox extends StatelessWidget {
  const _PromoCodeBox({
    required this.label,
    required this.code,
    required this.accent,
    this.hint,
  });

  final String label;
  final String code;
  final String? hint;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final ink = const Color(AppConstants.inkColor);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(AppConstants.secondaryColor),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accent.withValues(alpha: 0.35), width: 1.4),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: ink.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: accent.withValues(alpha: 0.45)),
            ),
            child: Text(
              code,
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
                color: accent,
              ),
            ),
          ),
          if (hint != null && hint!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              hint!,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
                color: ink.withValues(alpha: 0.6),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CtaButton extends StatelessWidget {
  const _CtaButton({
    required this.text,
    required this.accent,
    this.onPressed,
  });

  final String text;
  final Color accent;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final ink = const Color(AppConstants.inkColor);
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: ink,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: ink.withValues(alpha: 0.22)),
          ),
          shadowColor: Colors.black.withValues(alpha: 0.25),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              text,
              style: GoogleFonts.outfit(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: ink,
              ),
            ),
            const SizedBox(width: 10),
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.arrow_forward, size: 18, color: accent),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> showPawSewaPromoModal(
  BuildContext context, {
  required String title,
  required String offerText,
  String? subtitle,
  String? promoCode,
  String? promoHint,
  required String ctaText,
  required ImageProvider image,
  VoidCallback? onCtaPressed,
}) async {
  await showGeneralDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierLabel: 'PawSewaPromoModal',
    pageBuilder: (ctx, _, _) {
      return PawSewaPromoModal(
        title: title,
        offerText: offerText,
        subtitle: subtitle,
        promoCode: promoCode,
        promoHint: promoHint,
        ctaText: ctaText,
        image: image,
        onCtaPressed: onCtaPressed,
        onClose: () => Navigator.of(ctx).pop(),
      );
    },
  );
}

