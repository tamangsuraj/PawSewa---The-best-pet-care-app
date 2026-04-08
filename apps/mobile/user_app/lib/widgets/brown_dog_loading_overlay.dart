import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

import '../core/constants.dart';

class BrownDogLoadingOverlay extends StatelessWidget {
  const BrownDogLoadingOverlay({
    super.key,
    this.barrierColor,
    this.circleSize = 140,
    this.offsetY = 64,
    this.strokeWidth = 4,
  });

  final Color? barrierColor;
  final double circleSize;
  final double offsetY;
  final double strokeWidth;

  static const String _asset = 'assets/animations/dog_running.json';

  static Color _brandBrown(BuildContext context) =>
      const Color(AppConstants.primaryColor);

  @override
  Widget build(BuildContext context) {
    final brown = _brandBrown(context);
    return Stack(
      children: [
        // Dim the entire screen.
        ModalBarrier(
          dismissible: false,
          color: barrierColor ?? Colors.black.withValues(alpha: 0.35),
        ),
        // Float the loader slightly below center.
        Align(
          alignment: Alignment.center,
          child: Transform.translate(
            offset: Offset(0, offsetY),
            child: Container(
              width: circleSize,
              height: circleSize,
              decoration: BoxDecoration(
                color: brown,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.22),
                    blurRadius: 26,
                    offset: const Offset(0, 14),
                  ),
                ],
              ),
              child: Center(
                child: SizedBox(
                  width: circleSize * 0.74,
                  height: circleSize * 0.74,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Spinning ring (brown-on-brown via slightly lighter tint).
                      SizedBox.expand(
                        child: CircularProgressIndicator(
                          strokeWidth: strokeWidth,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            Colors.white.withValues(alpha: 0.85),
                          ),
                        ),
                      ),
                      // Tinted dog Lottie walking animation.
                      SizedBox(
                        width: circleSize * 0.54,
                        height: circleSize * 0.54,
                        child: ColorFiltered(
                          colorFilter: ColorFilter.mode(
                            Colors.white.withValues(alpha: 0.92),
                            BlendMode.srcIn,
                          ),
                          child: Lottie.asset(
                            _asset,
                            repeat: true,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class BrownDogLoadingOverlayController {
  BrownDogLoadingOverlayController._(this._entry);

  final OverlayEntry _entry;
  bool _isShowing = true;

  static BrownDogLoadingOverlayController show(
    BuildContext context, {
    Color? barrierColor,
    double circleSize = 140,
    double offsetY = 64,
    double strokeWidth = 4,
  }) {
    final overlay = Overlay.of(context, rootOverlay: true);
    final entry = OverlayEntry(
      builder: (ctx) => BrownDogLoadingOverlay(
        barrierColor: barrierColor,
        circleSize: circleSize,
        offsetY: offsetY,
        strokeWidth: strokeWidth,
      ),
    );
    overlay.insert(entry);
    return BrownDogLoadingOverlayController._(entry);
  }

  void hide() {
    if (!_isShowing) return;
    _isShowing = false;
    _entry.remove();
  }
}

