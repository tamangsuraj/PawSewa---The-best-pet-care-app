import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Horizontal swipe-to-confirm control (same UX as rider delivery flows).
class SwipeActionButton extends StatefulWidget {
  const SwipeActionButton({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.onSwiped,
    this.disabled = false,
    this.loading = false,
  });

  final String label;
  final Color backgroundColor;
  final VoidCallback onSwiped;
  final bool disabled;
  final bool loading;

  @override
  State<SwipeActionButton> createState() => _SwipeActionButtonState();
}

class _SwipeActionButtonState extends State<SwipeActionButton> {
  double _drag = 0;
  bool _completed = false;

  @override
  void didUpdateWidget(covariant SwipeActionButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.disabled != oldWidget.disabled) {
      if (!widget.disabled) {
        setState(() {
          _drag = 0;
          _completed = false;
        });
      }
    }
    if (widget.loading && !oldWidget.loading) {
      setState(() => _completed = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.disabled) {
      return Opacity(
        opacity: widget.loading ? 0.7 : 0.6,
        child: _buildButton(context, disabled: true),
      );
    }
    return _buildButton(context, disabled: false);
  }

  Widget _buildButton(BuildContext context, {required bool disabled}) {
    return LayoutBuilder(builder: (context, constraints) {
      final width = constraints.maxWidth;
      const padding = 10.0;
      const thumbSize = 44.0;
      final double maxDrag = (width - padding * 2 - thumbSize)
          .clamp(0.0, double.infinity)
          .toDouble();
      final progress = maxDrag <= 0 ? 0.0 : (_drag / maxDrag).clamp(0.0, 1.0);

      return GestureDetector(
        onHorizontalDragUpdate: disabled
            ? null
            : (details) {
                setState(() {
                  _drag = (_drag + details.delta.dx).clamp(0.0, maxDrag).toDouble();
                });
              },
        onHorizontalDragEnd: disabled
            ? null
            : (_) {
                final shouldComplete = progress >= 0.85;
                if (shouldComplete && !_completed) {
                  setState(() => _completed = true);
                  widget.onSwiped();
                } else {
                  setState(() {
                    _drag = 0;
                    _completed = false;
                  });
                }
              },
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              height: 48,
              width: double.infinity,
              decoration: BoxDecoration(
                color: widget.backgroundColor.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: widget.backgroundColor.withValues(alpha: 0.35)),
              ),
            ),
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.only(left: 56, right: 12),
                child: Center(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      widget.loading ? 'Updating...' : widget.label,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: widget.backgroundColor,
                        letterSpacing: 0.15,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: padding + _drag,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: thumbSize,
                height: 48,
                decoration: BoxDecoration(
                  color: widget.backgroundColor,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: widget.backgroundColor.withValues(alpha: 0.35),
                      blurRadius: 14,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: _completed
                    ? const Icon(Icons.check_rounded, color: Colors.white)
                    : Icon(
                        widget.loading ? Icons.hourglass_bottom_rounded : Icons.arrow_forward_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
              ),
            ),
          ],
        ),
      );
    });
  }
}
