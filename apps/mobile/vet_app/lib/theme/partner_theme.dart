import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/constants.dart';
import '../core/partner_role.dart';

/// Role-specific design tokens — colors, icons, and labels keyed by PartnerRole.
abstract final class RoleDesign {
  static Color accentFor(String role) => switch (role) {
    PartnerRole.vet    => const Color(AppConstants.vetAccent),
    PartnerRole.rider  => const Color(AppConstants.riderAccent),
    PartnerRole.seller => const Color(AppConstants.sellerAccent),
    PartnerRole.care   => const Color(AppConstants.careAccent),
    _                  => const Color(AppConstants.accentColor),
  };

  static IconData iconFor(String role) => switch (role) {
    PartnerRole.vet    => Icons.medical_services_rounded,
    PartnerRole.rider  => Icons.delivery_dining_rounded,
    PartnerRole.seller => Icons.storefront_rounded,
    PartnerRole.care   => Icons.home_work_rounded,
    _                  => Icons.work_rounded,
  };

  static String labelFor(String role) => switch (role) {
    PartnerRole.vet    => 'Vet Panel',
    PartnerRole.rider  => 'Rider Panel',
    PartnerRole.seller => 'Seller Panel',
    PartnerRole.care   => 'Care Panel',
    _                  => 'Partner',
  };

  static (Color bg, Color fg) statusColors(String status) {
    final s = status.toLowerCase().replaceAll('_', '');
    if (s.contains('complet') || s.contains('deliver') || s == 'prescribed' || s.contains('checkedout')) {
      return (const Color(AppConstants.bentoBackgroundColor), const Color(AppConstants.accentColor));
    }
    if (s.contains('progress') || s.contains('way') || s == 'diagnosed' || s.contains('active')) {
      return (const Color(0xFFF5EDE4), const Color(AppConstants.primaryColor));
    }
    if (s.contains('pend') || s.contains('wait') || s.contains('triage') || s.contains('unconfirm')) {
      return (const Color(AppConstants.sandColor), const Color(AppConstants.accentWarmColor));
    }
    if (s.contains('cancel') || s.contains('fail') || s.contains('reject')) {
      return (const Color(0xFFFFEBEE), const Color(0xFFDC2626));
    }
    if (s.contains('confirm') || s.contains('checkin') || s.contains('checkedin')) {
      return (const Color(0xFFEBE3D6), const Color(AppConstants.accentColor));
    }
    return (const Color(0xFFF5F0EA), const Color(AppConstants.inkColor));
  }
}

/// Partner app — brown + white brand; no Material default blue accents.
abstract final class PartnerTheme {
  static const Color primary = Color(AppConstants.primaryColor);
  static const Color ink = Color(AppConstants.inkColor);
  static const Color sand = Color(AppConstants.sandColor);
  static const Color cream = Color(AppConstants.bentoBackgroundColor);
  static const Color bronze = Color(AppConstants.accentColor);
  static const Color onPrimary = Colors.white;

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
      primary: primary,
      onPrimary: onPrimary,
      secondary: const Color(AppConstants.accentWarmColor),
      onSecondary: onPrimary,
      tertiary: bronze,
      onTertiary: onPrimary,
      surface: const Color(AppConstants.secondaryColor),
      onSurface: ink,
      error: const Color(0xFFDC2626),
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: Colors.white,
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
        backgroundColor: Colors.white,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.fraunces(
          fontSize: 21,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: primary.withValues(alpha: 0.12),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? primary : ink.withValues(alpha: 0.55),
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          return IconThemeData(
            color: states.contains(WidgetState.selected)
                ? primary
                : ink.withValues(alpha: 0.5),
          );
        }),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        elevation: 3,
        highlightElevation: 6,
        backgroundColor: primary,
        foregroundColor: onPrimary,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
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
          foregroundColor: primary,
          textStyle: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: primary),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return onPrimary;
          return ink.withValues(alpha: 0.35);
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return primary.withValues(alpha: 0.55);
          }
          return sand;
        }),
        trackOutlineColor: WidgetStateProperty.all(primary.withValues(alpha: 0.2)),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return primary;
          return Colors.transparent;
        }),
        checkColor: WidgetStateProperty.all(onPrimary),
        side: BorderSide(color: primary.withValues(alpha: 0.45), width: 1.5),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return primary;
          return ink.withValues(alpha: 0.4);
        }),
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: primary,
        inactiveTrackColor: primary.withValues(alpha: 0.18),
        thumbColor: primary,
        overlayColor: primary.withValues(alpha: 0.12),
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
          borderSide: const BorderSide(color: primary, width: 2),
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
        backgroundColor: sand,
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
        indicatorColor: primary,
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
        color: primary,
        circularTrackColor: primary.withValues(alpha: 0.12),
      ),
      dividerTheme: DividerThemeData(
        color: primary.withValues(alpha: 0.14),
        thickness: 1,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: primary,
        textColor: ink,
      ),
      dropdownMenuTheme: DropdownMenuThemeData(
        menuStyle: MenuStyle(
          surfaceTintColor: WidgetStateProperty.all(Colors.transparent),
        ),
      ),
      datePickerTheme: DatePickerThemeData(
        headerBackgroundColor: primary,
        headerForegroundColor: onPrimary,
        todayForegroundColor: WidgetStateProperty.all(primary),
        dayForegroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return onPrimary;
          return ink;
        }),
        dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return primary;
          return null;
        }),
      ),
      timePickerTheme: TimePickerThemeData(
        dialHandColor: primary,
        hourMinuteColor: sand,
        hourMinuteTextColor: ink,
        dayPeriodColor: primary.withValues(alpha: 0.12),
        dayPeriodTextColor: primary,
      ),
    );
  }
}
