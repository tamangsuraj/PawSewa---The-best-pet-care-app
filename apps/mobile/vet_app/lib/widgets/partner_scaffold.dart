import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';

/// A consistent shell for partner screens: warm surface, subtle header tint,
/// and typographic hierarchy that matches the PartnerTheme.
class PartnerScaffold extends StatelessWidget {
  const PartnerScaffold({
    super.key,
    required this.title,
    this.subtitle,
    this.actions,
    required this.body,
    this.floatingActionButton,
  });

  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final Widget body;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final surface = const Color(AppConstants.secondaryColor);
    final ink = const Color(AppConstants.inkColor);
    final primary = scheme.primary;

    return Scaffold(
      backgroundColor: surface,
      floatingActionButton: floatingActionButton,
      appBar: AppBar(
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: GoogleFonts.fraunces(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: ink,
                height: 1.1,
              ),
            ),
            if (subtitle != null && subtitle!.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  subtitle!,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: ink.withValues(alpha: 0.6),
                  ),
                ),
              ),
          ],
        ),
        actions: actions,
        centerTitle: false,
        backgroundColor: surface,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  primary.withValues(alpha: 0.0),
                  primary.withValues(alpha: 0.20),
                  primary.withValues(alpha: 0.0),
                ],
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        top: false,
        child: body,
      ),
    );
  }
}

class PartnerEmptyState extends StatelessWidget {
  const PartnerEmptyState({
    super.key,
    required this.title,
    required this.body,
    this.icon = Icons.inbox_rounded,
    this.primaryAction,
  });

  final String title;
  final String body;
  final IconData icon;
  final Widget? primaryAction;

  @override
  Widget build(BuildContext context) {
    final ink = const Color(AppConstants.inkColor);
    final primary = const Color(AppConstants.primaryColor);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: primary.withValues(alpha: 0.14)),
              ),
              child: Icon(icon, color: primary, size: 34),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.fraunces(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: ink,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              body,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(
                fontSize: 13,
                height: 1.35,
                color: ink.withValues(alpha: 0.65),
              ),
            ),
            if (primaryAction != null) ...[
              const SizedBox(height: 14),
              primaryAction!,
            ],
          ],
        ),
      ),
    );
  }
}

