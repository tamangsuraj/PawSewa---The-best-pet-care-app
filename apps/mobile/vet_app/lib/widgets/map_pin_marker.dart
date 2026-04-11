import 'package:flutter/material.dart';

/// Map location pin: bundled `assets/map/map_pin.png` with canvas fallback (no remote marker URLs).
class MapPinMarker extends StatelessWidget {
  const MapPinMarker({
    super.key,
    required this.color,
    this.size = 32,
    this.borderColor = Colors.white,
    this.borderWidth,
    this.assetPath = 'assets/map/map_pin.png',
  });

  final Color color;
  final double size;
  final Color borderColor;
  final double? borderWidth;
  final String assetPath;

  @override
  Widget build(BuildContext context) {
    final h = size * 1.25;
    return SizedBox(
      width: size,
      height: h,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Image.asset(
          assetPath,
          width: size,
          height: h,
          fit: BoxFit.contain,
          errorBuilder: (context, error, stackTrace) => _CanvasMapPin(
            color: color,
            size: size,
            borderColor: borderColor,
            borderWidth: borderWidth,
          ),
        ),
      ),
    );
  }
}

class _CanvasMapPin extends StatelessWidget {
  const _CanvasMapPin({
    required this.color,
    required this.size,
    required this.borderColor,
    this.borderWidth,
  });

  final Color color;
  final double size;
  final Color borderColor;
  final double? borderWidth;

  @override
  Widget build(BuildContext context) {
    final bw = borderWidth ?? (size * 0.08).clamp(1.5, 3.0);
    final h = size * 1.25;
    return SizedBox(
      width: size,
      height: h,
      child: CustomPaint(
        painter: _MapPinPainter(
          color: color,
          borderColor: borderColor,
          borderWidth: bw,
        ),
        size: Size(size, h),
      ),
    );
  }
}

class _MapPinPainter extends CustomPainter {
  _MapPinPainter({
    required this.color,
    required this.borderColor,
    required this.borderWidth,
  });

  final Color color;
  final Color borderColor;
  final double borderWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final headR = w * 0.38;
    final cx = w / 2;
    final cy = headR + w * 0.08;

    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final stroke = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth
      ..strokeJoin = StrokeJoin.round;

    canvas.drawCircle(Offset(cx, cy), headR, fill);
    canvas.drawCircle(Offset(cx, cy), headR, stroke);

    final tip = Offset(cx, h - borderWidth * 0.5);
    final left = Offset(cx - headR * 0.72, cy + headR * 0.42);
    final right = Offset(cx + headR * 0.72, cy + headR * 0.42);
    final path = Path()
      ..moveTo(left.dx, left.dy)
      ..lineTo(right.dx, right.dy)
      ..lineTo(tip.dx, tip.dy)
      ..close();
    canvas.drawPath(path, fill);
    canvas.drawPath(path, stroke);

    final inner = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(cx, cy - headR * 0.06), headR * 0.26, inner);
  }

  @override
  bool shouldRepaint(covariant _MapPinPainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.borderColor != borderColor ||
      oldDelegate.borderWidth != borderWidth;
}

class MapDotMarker extends StatelessWidget {
  const MapDotMarker({
    super.key,
    required this.color,
    this.size = 44,
  });

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _MapDotPainter(color: color),
        size: Size(size, size),
      ),
    );
  }
}

class _MapDotPainter extends CustomPainter {
  _MapDotPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width * 0.38;
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..color = color.withValues(alpha: 0.18)
        ..style = PaintingStyle.fill,
    );
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.width * 0.055,
    );
    canvas.drawCircle(
      c,
      r * 0.45,
      Paint()
        ..color = color
        ..style = PaintingStyle.fill,
    );
    canvas.drawCircle(
      c,
      r * 0.45,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.width * 0.04,
    );
  }

  @override
  bool shouldRepaint(covariant _MapDotPainter oldDelegate) => oldDelegate.color != color;
}
