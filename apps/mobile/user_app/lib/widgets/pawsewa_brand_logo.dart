import 'package:flutter/material.dart';

/// Accessibility label for all in-app corporate logo instances.
const String kPawSewaLogoSemanticLabel = 'PawSewa - Care and Commerce for Pets';

class PawSewaBrandLogo extends StatelessWidget {
  const PawSewaBrandLogo({super.key, this.height = 40});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: kPawSewaLogoSemanticLabel,
      image: true,
      child: Image.asset(
        'assets/brand/image_607767.png',
        height: height,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
        gaplessPlayback: true,
        errorBuilder: (_, _, _) => Image.asset(
          'assets/brand/pawsewa_logo.png',
          height: height,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          gaplessPlayback: true,
        ),
      ),
    );
  }
}
