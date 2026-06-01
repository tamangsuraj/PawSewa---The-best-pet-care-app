import 'package:flutter/material.dart';

import '../core/constants.dart';
import 'app_spinner.dart';

/// Lightweight non-blocking overlay for API calls and form submissions.
///
/// Replaces [BrownDogLoadingOverlay] for routine loading (login, form submits, fetches).
/// [BrownDogLoadingOverlay] stays for full-screen branded moments (onboarding, etc.).
///
/// Usage:
///   final loader = AppLoaderOverlay.show(context);
///   try {
///     await apiClient.doSomething();
///   } finally {
///     loader.hide();
///   }
class AppLoaderOverlay {
  AppLoaderOverlay._();

  static AppLoaderOverlayController show(
    BuildContext context, {
    String? message,
    // Lighter scrim than BrownDogLoadingOverlay (0.35) — content remains visible.
    double barrierOpacity = 0.18,
  }) {
    final overlay = Overlay.of(context, rootOverlay: true);
    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _AppLoaderOverlayWidget(
        message: message,
        barrierOpacity: barrierOpacity,
      ),
    );
    overlay.insert(entry);
    return AppLoaderOverlayController._(entry);
  }
}

class AppLoaderOverlayController {
  AppLoaderOverlayController._(this._entry);

  final OverlayEntry _entry;
  bool _removed = false;

  void hide() {
    if (_removed) return;
    _removed = true;
    _entry.remove();
  }
}

// ─── Internal widget ──────────────────────────────────────────────────────────

class _AppLoaderOverlayWidget extends StatelessWidget {
  const _AppLoaderOverlayWidget({
    required this.barrierOpacity,
    this.message,
  });

  final double barrierOpacity;
  final String? message;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Dim barrier — lighter than dog overlay so the user can still see context.
        ModalBarrier(
          dismissible: false,
          color: Colors.black.withValues(alpha: barrierOpacity),
        ),
        Center(
          child: _LoaderCard(message: message),
        ),
      ],
    );
  }
}

class _LoaderCard extends StatelessWidget {
  const _LoaderCard({this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: message != null ? 28 : 24,
        vertical: message != null ? 22 : 20,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(AppConstants.primaryColor).withValues(alpha: 0.10),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AppSpinner(size: 10),
          if (message != null) ...[
            const SizedBox(height: 14),
            Text(
              message!,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
                color: const Color(AppConstants.inkColor),
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}
