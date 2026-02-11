import 'package:flutter/material.dart';

/// Responsive layout helpers to avoid overflow and fixed dimensions.
/// Use MediaQuery-based values for padding, spacing, and proportional sizing.
class LayoutUtils {
  LayoutUtils._();

  static double width(BuildContext context) => MediaQuery.sizeOf(context).width;
  static double height(BuildContext context) =>
      MediaQuery.sizeOf(context).height;

  /// Horizontal padding as fraction of screen width (e.g. 0.05 = 5%)
  static EdgeInsets paddingHorizontal(
    BuildContext context, [
    double fraction = 0.05,
  ]) {
    final w = width(context);
    final p = w * fraction;
    return EdgeInsets.symmetric(horizontal: (p.clamp(12.0, 32.0)).toDouble());
  }

  /// All-around padding scaled by screen
  static EdgeInsets paddingAll(BuildContext context, [double fraction = 0.05]) {
    final w = width(context);
    final p = (w * fraction).clamp(12.0, 28.0).toDouble();
    return EdgeInsets.all(p);
  }

  /// Vertical spacing as fraction of screen height
  static double verticalSpacing(
    BuildContext context, [
    double fraction = 0.02,
  ]) {
    return (height(context) * fraction).clamp(8.0, 32.0).toDouble();
  }

  /// Scale a value by the smaller of width/height ratio (for icons, logos)
  static double scale(BuildContext context, double base) {
    final w = width(context);
    final h = height(context);
    final scale = (w < h ? w : h) / 400;
    return (base * scale.clamp(0.7, 1.5)).roundToDouble();
  }
}
