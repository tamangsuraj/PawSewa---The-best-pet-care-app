import 'package:flutter/material.dart';

import '../core/constants.dart';

/// Solid PawSewa cream surface behind screens (partner / rider surfaces).
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
    final _ = variant;
    return ColoredBox(
      color: const Color(AppConstants.secondaryColor),
      child: child,
    );
  }
}

/// First child in a [Stack] under scrollable scaffold content (partner app).
class EditorialBodyBackdrop extends StatelessWidget {
  const EditorialBodyBackdrop({
    super.key,
    this.variant = EditorialSurfaceVariant.partner,
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
