import 'package:flutter/material.dart';

import '../core/constants.dart';

/// Lightweight primary loading indicator. No assets, no Lottie, renders on first frame.
///
/// Use this everywhere you previously used [PawSewaLoader] for inline API / form loads.
/// For full-screen branded moments (onboarding, intentional waits) keep [PawSewaLoader].
///
/// Sizes:
///   AppSpinner()              — default 8px dots, for most inline use
///   AppSpinner(size: 6)       — compact, inside buttons / chips
///   AppSpinner(size: 11)      — larger, center-of-screen use
class AppSpinner extends StatefulWidget {
  const AppSpinner({
    super.key,
    this.size = 8,
    this.color,
    this.spacing,
  });

  final double size;
  final Color? color;

  /// Gap between dots. Defaults to [size] * 0.85.
  final double? spacing;

  @override
  State<AppSpinner> createState() => _AppSpinnerState();
}

class _AppSpinnerState extends State<AppSpinner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color =
        widget.color ?? const Color(AppConstants.primaryColor);
    final gap = widget.spacing ?? widget.size * 0.85;
    final totalWidth = widget.size * 3 + gap * 2;

    return Semantics(
      label: 'Loading',
      excludeSemantics: true,
      child: SizedBox(
        width: totalWidth,
        height: widget.size * 1.8,
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, _) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (i) {
                // Each dot peaks 0.33 apart in the cycle.
                // t=0..0.5 → bounce up; t=0.5..1.0 → bounce down.
                final phase = (_c.value - i * 0.33) % 1.0;
                final bounce = phase < 0.5
                    ? Curves.easeOut.transform(phase * 2)
                    : 1.0 - Curves.easeIn.transform((phase - 0.5) * 2);
                final dy = -(widget.size * 0.65) * bounce;
                final opacity = 0.35 + 0.65 * bounce;

                return Padding(
                  padding: EdgeInsets.only(right: i < 2 ? gap : 0),
                  child: Transform.translate(
                    offset: Offset(0, dy),
                    child: Opacity(
                      opacity: opacity,
                      child: Container(
                        width: widget.size,
                        height: widget.size,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            );
          },
        ),
      ),
    );
  }
}

/// Centered [AppSpinner] — equivalent to `Center(child: AppSpinner())`.
/// Mirrors the `center: true` default of the old [PawSewaLoader] for easy replacement.
class CenteredAppSpinner extends StatelessWidget {
  const CenteredAppSpinner({super.key, this.size = 8, this.color});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Center(child: AppSpinner(size: size, color: color));
  }
}
