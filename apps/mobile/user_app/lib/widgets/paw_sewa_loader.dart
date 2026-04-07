import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

/// PawSewa branded loading animation (replaces [CircularProgressIndicator]).
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
    final lottie = Lottie.asset(
      _asset,
      width: width,
      height: height,
      repeat: true,
      fit: BoxFit.contain,
    );
    if (center) {
      return Center(child: lottie);
    }
    return lottie;
  }
}
