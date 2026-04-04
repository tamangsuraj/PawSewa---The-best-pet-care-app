import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';

/// Partner app — same editorial pairing as customer web; deeper ink primary for authority.
abstract final class PartnerTheme {
  static ThemeData light() {
    const primary = Color(AppConstants.primaryColor);
    const surface = Color(AppConstants.secondaryColor);
    const accent = Color(AppConstants.accentColor);
    const ink = Color(AppConstants.inkColor);
    const onPrimary = Color(0xFFFAF6F0);

    final colorScheme = ColorScheme.light(
      primary: primary,
      onPrimary: onPrimary,
      primaryContainer: const Color(AppConstants.sandColor),
      secondary: accent,
      onSecondary: Colors.white,
      tertiary: const Color(AppConstants.accentWarmColor),
      surface: surface,
      onSurface: ink,
      outline: primary.withValues(alpha: 0.2),
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: surface,
    );

    final outfit = GoogleFonts.outfitTextTheme(base.textTheme);
    final fraunces = GoogleFonts.frauncesTextTheme(base.textTheme);

    return base.copyWith(
      textTheme: outfit.copyWith(
        displaySmall: fraunces.displaySmall?.copyWith(
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        headlineMedium: fraunces.headlineMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        headlineSmall: fraunces.headlineSmall?.copyWith(
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        titleLarge: fraunces.titleLarge?.copyWith(
          fontWeight: FontWeight.w600,
          color: ink,
        ),
        titleMedium: fraunces.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: ink,
        ),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: surface,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.fraunces(
          fontSize: 21,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        elevation: 3,
        highlightElevation: 6,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: primary,
          foregroundColor: onPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
          textStyle: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            fontSize: 15,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: BorderSide(color: primary.withValues(alpha: 0.35)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          textStyle: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            fontSize: 15,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: accent,
          textStyle: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        labelStyle: GoogleFonts.outfit(color: ink.withValues(alpha: 0.65)),
        hintStyle: GoogleFonts.outfit(color: ink.withValues(alpha: 0.4)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: primary.withValues(alpha: 0.14)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: primary.withValues(alpha: 0.14)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: accent, width: 2),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: Colors.white.withValues(alpha: 0.94),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: primary.withValues(alpha: 0.1)),
        ),
        shadowColor: ink.withValues(alpha: 0.1),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(AppConstants.sandColor),
        labelStyle: GoogleFonts.outfit(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: ink,
        ),
        side: BorderSide(color: primary.withValues(alpha: 0.12)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: ink.withValues(alpha: 0.92),
        contentTextStyle: GoogleFonts.outfit(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        titleTextStyle: GoogleFonts.fraunces(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
      ),
      tabBarTheme: TabBarThemeData(
        indicatorColor: accent,
        labelColor: primary,
        unselectedLabelColor: ink.withValues(alpha: 0.5),
        labelStyle: GoogleFonts.outfit(
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: GoogleFonts.outfit(
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: accent,
        circularTrackColor: primary.withValues(alpha: 0.12),
      ),
      dividerTheme: DividerThemeData(
        color: primary.withValues(alpha: 0.14),
        thickness: 1,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
    );
  }
}
