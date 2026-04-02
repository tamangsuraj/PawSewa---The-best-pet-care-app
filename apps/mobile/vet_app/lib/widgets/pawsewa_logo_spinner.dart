import 'package:flutter/material.dart';

import 'pawsewa_brand_logo.dart';

class PawSewaLogoSpinner extends StatefulWidget {
  const PawSewaLogoSpinner({super.key, this.size = 56});

  final double size;

  @override
  State<PawSewaLogoSpinner> createState() => _PawSewaLogoSpinnerState();
}

class _PawSewaLogoSpinnerState extends State<PawSewaLogoSpinner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 2),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading, $kPawSewaLogoSemanticLabel',
      child: RotationTransition(
        turns: _c,
        child: Image.asset(
          'assets/brand/pawsewa_logo.png',
          width: widget.size,
          height: widget.size,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
        ),
      ),
    );
  }
}
