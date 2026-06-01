import 'package:intl/intl.dart';

/// Dog-only vaccination schedule (days from DOB) + annual boosters.
///
/// This is a **frontend gating + UX** helper. It does NOT change backend reminders/jobs.
class DogVaccinationSchedule {
  /// Show "Upcoming" only when within this many days of eligibility.
  static const int upcomingWindowDays = 14;
  static const int firstDoseEligibleDays = 30;
  static const int annualBoosterDays = 365;

  static final List<VaccineDose> puppyDoses = [
    const VaccineDose(
      id: 'puppy_dp_30',
      name: 'Puppy DP',
      protectsAgainst: 'Distemper, Parvovirus',
      dueAtDays: 30,
    ),
    const VaccineDose(
      id: 'dhppil_45',
      name: 'DHPPi+L',
      protectsAgainst:
          'Distemper, Hepatitis, Parvovirus, Parainfluenza, Leptospirosis',
      dueAtDays: 45,
    ),
    const VaccineDose(
      id: 'canine_corona_60',
      name: 'Canine Corona',
      protectsAgainst: 'Canine Coronavirus',
      dueAtDays: 60,
    ),
    const VaccineDose(
      id: 'dhppil_75',
      name: 'DHPPi+L',
      protectsAgainst:
          'Distemper, Hepatitis, Parvovirus, Parainfluenza, Leptospirosis',
      dueAtDays: 75,
    ),
    const VaccineDose(
      id: 'arv_corona_90',
      name: 'ARV + Canine Corona',
      protectsAgainst: 'Rabies, Canine Coronavirus',
      dueAtDays: 90,
    ),
    const VaccineDose(
      id: 'dhppil_105',
      name: 'DHPPi+L',
      protectsAgainst:
          'Distemper, Hepatitis, Parvovirus, Parainfluenza, Leptospirosis',
      dueAtDays: 105,
    ),
    const VaccineDose(
      id: 'arv_kennel_120',
      name: 'ARV + Kennel Cough',
      protectsAgainst: 'Rabies, Bordetella (Kennel Cough)',
      dueAtDays: 120,
    ),
  ];

  static DateTime? parseDob(dynamic rawDob) {
    if (rawDob == null) return null;
    if (rawDob is DateTime) return rawDob;
    return DateTime.tryParse(rawDob.toString());
  }

  static DateTime _day(DateTime d) => DateTime(d.year, d.month, d.day);

  static int ageInDays(DateTime dob, DateTime today) {
    return _day(today).difference(_day(dob)).inDays;
  }

  static String humanizeDueDeltaDays(int days) {
    if (days == 0) return 'today';
    if (days == 1) return 'tomorrow';
    if (days > 1 && days <= 6) return 'in $days days';
    if (days >= 7 && days <= 13) return 'in 1 week';
    if (days >= 14 && days <= 27) return 'in ${(days / 7).round()} weeks';
    if (days >= 28 && days <= 59) return 'in 1 month';
    return 'in ${(days / 30).round()} months';
  }

  static String humanizeOverdueDays(int daysOverdue) {
    if (daysOverdue <= 0) return 'today';
    if (daysOverdue == 1) return '1 day';
    if (daysOverdue < 7) return '$daysOverdue days';
    if (daysOverdue < 14) return '1 week';
    if (daysOverdue < 30) return '${(daysOverdue / 7).floor()} weeks';
    if (daysOverdue < 60) return '1 month';
    return '${(daysOverdue / 30).floor()} months';
  }

  /// Build age-aware vaccine entries.
  ///
  /// [reminders] is the existing backend reminders list, used only to detect completion.
  static List<VaccineEntry> build({
    required String petName,
    required DateTime today,
    required DateTime? dob,
    required List<Map<String, dynamic>> reminders,
  }) {
    if (dob == null) {
      return [
        VaccineEntry.historyIncomplete(
          title: 'Vaccination history incomplete',
          message:
              'Add $petName’s date of birth to get accurate vaccine eligibility and reminders.',
        ),
      ];
    }

    final t0 = _day(today);
    final d0 = _day(dob);
    final ageDays = ageInDays(d0, t0);

    // Hard eligibility gate: before first puppy vaccine age, show nothing at all.
    // This matches: "If puppy age = 20 days, DO NOT show pending vaccines".
    if (ageDays < firstDoseEligibleDays) {
      return const [];
    }

    bool isCompletedDose(VaccineDose dose) {
      // Backend reminder titles vary; match by keyword.
      final q = dose.name.toLowerCase();
      for (final r in reminders) {
        if ((r['category'] ?? '').toString() != 'vaccination') continue;
        final status = (r['status'] ?? '').toString();
        if (status != 'completed') continue;
        final title = (r['title'] ?? '').toString().toLowerCase();
        if (title.contains(q) || (q.contains('arv') && title.contains('rabies'))) {
          return true;
        }
      }
      return false;
    }

    final entries = <VaccineEntry>[];

    for (final dose in puppyDoses) {
      final due = d0.add(Duration(days: dose.dueAtDays));
      final due0 = _day(due);
      final delta = due0.difference(t0).inDays; // + = future

      // Eligibility gating: do not surface anything too early.
      if (delta > upcomingWindowDays) {
        continue;
      }

      final completed = isCompletedDose(dose);
      if (completed) {
        entries.add(
          VaccineEntry.completed(
            title: dose.name,
            protectsAgainst: dose.protectsAgainst,
            dueDate: due0,
            message: 'Completed',
          ),
        );
        continue;
      }

      if (delta > 0) {
        entries.add(
          VaccineEntry.upcoming(
            title: dose.name,
            protectsAgainst: dose.protectsAgainst,
            dueDate: due0,
            message: '${dose.name} vaccination will be due ${humanizeDueDeltaDays(delta)}.',
          ),
        );
      } else if (delta == 0) {
        entries.add(
          VaccineEntry.dueToday(
            title: dose.name,
            protectsAgainst: dose.protectsAgainst,
            dueDate: due0,
            message: '$petName’s ${dose.name} vaccine is due today.',
          ),
        );
      } else {
        final od = -delta;
        entries.add(
          VaccineEntry.overdue(
            title: dose.name,
            protectsAgainst: dose.protectsAgainst,
            dueDate: due0,
            message:
                '$petName missed scheduled vaccination. Overdue by ${humanizeOverdueDays(od)}.',
            overdueDays: od,
          ),
        );
      }
    }

    if (entries.isEmpty) {
      return [
        VaccineEntry.historyIncomplete(
          title: 'Vaccination history incomplete',
          message:
              'We can’t confirm which vaccines $petName has already taken. Book a visit to update the record.',
        ),
      ];
    }

    // Annual booster: due every 365 days after the last completed vaccination.
    final lastCompleted = _findLastCompletedVaccinationDate(reminders);
    if (lastCompleted != null) {
      final due = _day(lastCompleted).add(const Duration(days: annualBoosterDays));
      final delta = due.difference(t0).inDays;
      if (delta <= upcomingWindowDays) {
        if (delta > 0) {
          entries.add(
            VaccineEntry.upcoming(
              title: 'Annual booster',
              protectsAgainst: 'Core vaccine protection',
              dueDate: due,
              message: 'Time for $petName’s annual booster ${humanizeDueDeltaDays(delta)}.',
            ),
          );
        } else if (delta == 0) {
          entries.add(
            VaccineEntry.dueToday(
              title: 'Annual booster',
              protectsAgainst: 'Core vaccine protection',
              dueDate: due,
              message: '$petName’s annual booster is due today.',
            ),
          );
        } else {
          final od = -delta;
          entries.add(
            VaccineEntry.overdue(
              title: 'Annual booster',
              protectsAgainst: 'Core vaccine protection',
              dueDate: due,
              message:
                  'Vaccination protection may have expired. Annual booster overdue by ${humanizeOverdueDays(od)}.',
              overdueDays: od,
            ),
          );
        }
      }
    }

    // Sort: overdue → due today → upcoming → completed
    entries.sort((a, b) => a.sortKey.compareTo(b.sortKey));
    return entries;
  }

  static DateTime? _findLastCompletedVaccinationDate(
    List<Map<String, dynamic>> reminders,
  ) {
    DateTime? best;
    DateTime? parse(dynamic v) {
      if (v == null) return null;
      if (v is DateTime) return v;
      return DateTime.tryParse(v.toString());
    }

    for (final r in reminders) {
      if ((r['category'] ?? '').toString() != 'vaccination') continue;
      if ((r['status'] ?? '').toString() != 'completed') continue;
      final dt = parse(r['completedAt']) ?? parse(r['updatedAt']) ?? parse(r['dueDate']);
      if (dt == null) continue;
      final d = _day(dt);
      if (best == null || d.isAfter(best)) best = d;
    }
    return best;
  }

  static String formatDate(DateTime d) => DateFormat('d MMM yyyy').format(d);
}

class VaccineDose {
  const VaccineDose({
    required this.id,
    required this.name,
    required this.protectsAgainst,
    required this.dueAtDays,
  });

  final String id;
  final String name;
  final String protectsAgainst;
  final int dueAtDays;
}

enum VaccineState { upcoming, dueToday, overdue, completed, historyIncomplete }

class VaccineEntry {
  const VaccineEntry._({
    required this.state,
    required this.title,
    required this.message,
    this.protectsAgainst,
    this.dueDate,
    this.overdueDays,
  });

  final VaccineState state;
  final String title;
  final String message;
  final String? protectsAgainst;
  final DateTime? dueDate;
  final int? overdueDays;

  int get sortKey {
    switch (state) {
      case VaccineState.overdue:
        return 0;
      case VaccineState.dueToday:
        return 1;
      case VaccineState.upcoming:
        return 2;
      case VaccineState.completed:
        return 3;
      case VaccineState.historyIncomplete:
        return 4;
    }
  }

  static VaccineEntry upcoming({
    required String title,
    required String message,
    required String protectsAgainst,
    required DateTime dueDate,
  }) =>
      VaccineEntry._(
        state: VaccineState.upcoming,
        title: title,
        message: message,
        protectsAgainst: protectsAgainst,
        dueDate: dueDate,
      );

  static VaccineEntry dueToday({
    required String title,
    required String message,
    required String protectsAgainst,
    required DateTime dueDate,
  }) =>
      VaccineEntry._(
        state: VaccineState.dueToday,
        title: title,
        message: message,
        protectsAgainst: protectsAgainst,
        dueDate: dueDate,
      );

  static VaccineEntry overdue({
    required String title,
    required String message,
    required String protectsAgainst,
    required DateTime dueDate,
    required int overdueDays,
  }) =>
      VaccineEntry._(
        state: VaccineState.overdue,
        title: title,
        message: message,
        protectsAgainst: protectsAgainst,
        dueDate: dueDate,
        overdueDays: overdueDays,
      );

  static VaccineEntry completed({
    required String title,
    required String message,
    required String protectsAgainst,
    required DateTime dueDate,
  }) =>
      VaccineEntry._(
        state: VaccineState.completed,
        title: title,
        message: message,
        protectsAgainst: protectsAgainst,
        dueDate: dueDate,
      );

  static VaccineEntry historyIncomplete({
    required String title,
    required String message,
  }) =>
      VaccineEntry._(
        state: VaccineState.historyIncomplete,
        title: title,
        message: message,
      );
}

