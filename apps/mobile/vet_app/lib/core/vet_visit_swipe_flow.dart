import 'package:flutter/material.dart';

import 'constants.dart';

/// Internal markers for assistance [Case] rows (not API statuses).
const String kVetCaseSwipeStart = '__vet_case_start__';
const String kVetCaseSwipeComplete = '__vet_case_complete__';

/// Shared next step for home-visit service requests (vet app).
class VetVisitSwipeStep {
  const VetVisitSwipeStep(this.nextStatus, this.label, this.color);

  final String nextStatus;
  final String label;
  final Color color;
}

/// pending → (admin assigns) → assigned → accepted → en_route → arrived → completed
VetVisitSwipeStep? nextVetVisitSwipeStep(Map<String, dynamic> task) {
  const primary = Color(AppConstants.primaryColor);
  const accent = Color(AppConstants.accentColor);
  const success = Color(0xFF2E7D32);
  const orange = Color(0xFFE65100);
  final s = task['status']?.toString() ?? '';
  switch (s) {
    case 'assigned':
      return const VetVisitSwipeStep(
        'accepted',
        'Swipe — Accept visit',
        accent,
      );
    case 'accepted':
      return const VetVisitSwipeStep(
        'en_route',
        'Swipe — On the way',
        primary,
      );
    case 'en_route':
      return const VetVisitSwipeStep(
        'arrived',
        'Swipe — Reached',
        orange,
      );
    case 'arrived':
      return const VetVisitSwipeStep(
        'completed',
        'Swipe to complete visit',
        success,
      );
    case 'in_progress':
      return const VetVisitSwipeStep(
        'completed',
        'Swipe to complete visit',
        success,
      );
    default:
      return null;
  }
}

/// True when this row should appear on home / duty / queue as work in play.
bool vetVisitTaskIsActive(Map<String, dynamic> t) {
  final s = t['status']?.toString().trim().toLowerCase() ?? '';
  if (s.isEmpty) return false;
  if (s == 'pending' || s == 'completed' || s == 'cancelled') return false;
  return true;
}

/// Assistance case: assigned → start, in_progress → complete (handled in UI layer).
VetVisitSwipeStep? nextVetCaseSwipeStep(Map<String, dynamic> c) {
  const success = Color(0xFF2E7D32);
  final s = c['status']?.toString() ?? '';
  switch (s) {
    case 'assigned':
      return const VetVisitSwipeStep(
        kVetCaseSwipeStart,
        'Swipe — Start visit',
        Color(0xFF1565C0),
      );
    case 'in_progress':
      return const VetVisitSwipeStep(
        kVetCaseSwipeComplete,
        'Swipe — Complete visit',
        success,
      );
    default:
      return null;
  }
}
