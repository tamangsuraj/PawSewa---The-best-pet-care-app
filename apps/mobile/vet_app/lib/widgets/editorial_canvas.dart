import 'package:flutter/material.dart';

/// Soft editorial gradient behind screens (partner / rider surfaces).
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
    final colors = variant == EditorialSurfaceVariant.customer
        ? const <Color>[
            Color(0xFFF5EDE4),
            Colors.white,
            Color(0xFFEBE3D6),
          ]
        : const <Color>[
            Color(0xFFF5EDE4),
            Colors.white,
            Color(0xFFEBE3D6),
          ];

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
          stops: const [0.0, 0.52, 1.0],
        ),
      ),
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
