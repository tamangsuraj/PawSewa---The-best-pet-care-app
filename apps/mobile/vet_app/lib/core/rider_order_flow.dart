import 'package:flutter/material.dart';

import 'constants.dart';

/// Shared rider delivery status helpers (home + delivery jobs screens).
abstract final class RiderOrderFlow {
  static bool isDelivered(Map<String, dynamic> o) =>
      o['status']?.toString() == 'delivered';

  static bool isActive(Map<String, dynamic> o) => !isDelivered(o);

  static String statusLabel(String status) {
    switch (status) {
      case 'pending_confirmation':
        return 'Awaiting shop';
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'ready_for_pickup':
        return 'Ready (pickup)';
      case 'packed':
        return 'Packed (pickup)';
      case 'assigned_to_rider':
        return 'Assigned to you';
      case 'out_for_delivery':
        return 'On the way';
      case 'delivered':
        return 'Delivered';
      default:
        return status;
    }
  }

  static String? nextStatus(String status) {
    switch (status) {
      case 'pending_confirmation':
      case 'pending':
        return 'processing';
      case 'processing':
        return 'packed';
      case 'packed':
      case 'ready_for_pickup':
        return 'out_for_delivery';
      case 'assigned_to_rider':
        return 'out_for_delivery';
      case 'out_for_delivery':
        return 'delivered';
      default:
        return null;
    }
  }

  static Color statusColor(String status) {
    switch (status) {
      case 'pending_confirmation':
      case 'pending':
        return const Color(AppConstants.accentWarmColor);
      case 'processing':
      case 'packed':
      case 'ready_for_pickup':
        return const Color(AppConstants.accentColor);
      case 'assigned_to_rider':
      case 'out_for_delivery':
        return const Color(AppConstants.primaryColor);
      case 'delivered':
        return const Color(AppConstants.accentColor);
      default:
        return Colors.grey;
    }
  }

  static DateTime? parseDate(dynamic v) {
    if (v is DateTime) return v;
    return DateTime.tryParse(v?.toString() ?? '');
  }

  static DateTime? deliveredAt(Map<String, dynamic> o) {
    final d = parseDate(o['deliveredAt']);
    if (d != null) return d;
    final pod = o['proofOfDelivery'];
    if (pod is Map) {
      final submitted = parseDate(pod['submittedAt']);
      if (submitted != null) return submitted;
    }
    return parseDate(o['updatedAt']);
  }

  static bool isOnCalendarDay(DateTime dt, DateTime day) =>
      dt.year == day.year && dt.month == day.month && dt.day == day.day;

  static double payoutForOrder(Map<String, dynamic> o) =>
      AppConstants.riderDeliveryEarningNpr;

  static double sumEarningsForDate(
    List<Map<String, dynamic>> delivered,
    DateTime day,
  ) {
    final anchor = DateTime(day.year, day.month, day.day);
    var sum = 0.0;
    for (final o in delivered) {
      final at = deliveredAt(o);
      if (at == null || !isOnCalendarDay(at, anchor)) continue;
      sum += payoutForOrder(o);
    }
    return sum;
  }

  static int countDeliveredOnDate(
    List<Map<String, dynamic>> delivered,
    DateTime day,
  ) {
    final anchor = DateTime(day.year, day.month, day.day);
    var n = 0;
    for (final o in delivered) {
      final at = deliveredAt(o);
      if (at != null && isOnCalendarDay(at, anchor)) n++;
    }
    return n;
  }
}
