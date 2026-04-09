import 'package:flutter/material.dart';

import '../core/constants.dart';

/// Solid PawSewa cream surface behind screens (customer app).
enum EditorialSurfaceVariant { customer, partner }

class EditorialCanvas extends StatelessWidget {
  const EditorialCanvas({
    super.key,
    required this.child,
    this.variant = EditorialSurfaceVariant.customer,
  });

  final Widget child;
  final EditorialSurfaceVariant variant;

  @override
  Widget build(BuildContext context) {
    // [variant] kept for API compatibility; both use the same PawSewa cream surface.
    final _ = variant;
    return ColoredBox(
      color: const Color(AppConstants.secondaryColor),
      child: child,
    );
  }
}

/// First child in a [Stack] under scrollable scaffold content (customer app).
class EditorialBodyBackdrop extends StatelessWidget {
  const EditorialBodyBackdrop({
    super.key,
    this.variant = EditorialSurfaceVariant.customer,
  });

  final EditorialSurfaceVariant variant;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        child: EditorialCanvas(
          variant: variant,
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}
