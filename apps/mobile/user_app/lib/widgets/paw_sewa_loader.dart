import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// PawSewa branded loading animation — SECONDARY / INTENTIONAL use only.
///
/// Use for:
///   • Full-screen content loading where the dog animation adds brand value
///   • Onboarding / first-run flows
///   • Intentional "something big is happening" moments
///
/// Do NOT use for:
///   • Inline API call spinners → use [AppSpinner] instead
///   • Blocking overlays during form submit → use [AppLoaderOverlay] instead
///   • Any loading that users will see repeatedly (login, fetch, navigation)
///
/// The Lottie asset is heavy (~200KB JSON + parse time).
/// [AppSpinner] renders on the first frame with zero asset loading.
class PawSewaLoader extends StatelessWidget {
  const PawSewaLoader({
    super.key,
    this.width = 150,
    this.height,
    this.center = true,
  });

  final double width;
  final double? height;
  final bool center;

  static const String _asset = 'assets/animations/dog_running.json';

  @override
  Widget build(BuildContext context) {
    final lottie = LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth.isFinite ? constraints.maxWidth : width;
        final clampedW = width.clamp(0.0, maxW);
        final maxH = constraints.maxHeight.isFinite ? constraints.maxHeight : null;
        final desiredH = height;
        final clampedH = (desiredH == null || maxH == null) ? desiredH : desiredH.clamp(0.0, maxH);
        return Lottie.asset(
          _asset,
          width: clampedW,
          height: clampedH,
          repeat: true,
          fit: BoxFit.contain,
        );
      },
    );
    if (center) {
      return Center(child: lottie);
    }
    return lottie;
  }
}
