function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function normalizeSpecies(species) {
  const s = String(species || '').trim().toLowerCase();
  if (s === 'dog') return 'dog';
  if (s === 'cat') return 'cat';
  return 'other';
}

function mkReminder({ category, title, dueDate, priority = 'normal', ruleId }) {
  return {
    category,
    title,
    dueDate,
    originalDueDate: dueDate,
    priority,
    engine: { version: 'v1', ruleId },
  };
}

/**
 * Generate medical reminders based on pet DOB + species.
 * All dates are Date objects (Mongo stores as ISO).
 *
 * Scope strategy:
 * - Non-recurring core vaccines as per spec.
 * - Recurring items are generated as concrete reminders up to a horizon.
 */
function generatePetRemindersV1({ dob, species, isOutdoor = false, horizonMonths = 24 }) {
  const birth = dob instanceof Date ? dob : new Date(dob);
  if (!isValidDate(birth)) return [];

  const sp = normalizeSpecies(species);
  const reminders = [];

  const priorityFlea = isOutdoor ? 'high' : 'normal';
  const fleaEveryDays = isOutdoor ? 14 : 30; // outdoor: higher frequency

  // Vaccinations (core)
  if (sp === 'dog' || sp === 'cat') {
    const seriesName = sp === 'dog' ? 'DHPP' : 'FVRCP';
    reminders.push(
      mkReminder({
        category: 'vaccination',
        title: `${seriesName} (1st dose)`,
        dueDate: addWeeks(birth, 6),
        ruleId: `${seriesName.toLowerCase()}_6w`,
      }),
      mkReminder({
        category: 'vaccination',
        title: `${seriesName} (2nd dose)`,
        dueDate: addWeeks(birth, 10),
        ruleId: `${seriesName.toLowerCase()}_10w`,
      }),
      mkReminder({
        category: 'vaccination',
        title: `${seriesName} (3rd dose)`,
        dueDate: addWeeks(birth, 14),
        ruleId: `${seriesName.toLowerCase()}_14w`,
      }),
      mkReminder({
        category: 'vaccination',
        title: 'Rabies',
        dueDate: addWeeks(birth, 16),
        ruleId: 'rabies_16w',
      })
    );

    // Annual booster every 12 months from 16-week mark (generate within horizon)
    const boosterStart = addWeeks(birth, 16);
    const horizon = addMonths(new Date(), horizonMonths);
    for (let i = 1; i <= 10; i += 1) {
      const due = addMonths(boosterStart, i * 12);
      if (due > horizon) break;
      reminders.push(
        mkReminder({
          category: 'vaccination',
          title: 'Annual Booster',
          dueDate: due,
          ruleId: `annual_booster_${i}y`,
        })
      );
    }
  }

  // Deworming:
  // - every 2 weeks until 3 months old (~12 weeks)
  // - then monthly until 6 months
  // - then every 3 months (adults) within horizon
  const age3m = addMonths(birth, 3);
  const age6m = addMonths(birth, 6);
  const horizon = addMonths(new Date(), horizonMonths);

  // Start at 2 weeks old
  for (let w = 2; w <= 12; w += 2) {
    const due = addWeeks(birth, w);
    if (due > horizon) break;
    reminders.push(
      mkReminder({
        category: 'deworming',
        title: 'Deworming',
        dueDate: due,
        ruleId: `deworming_${w}w`,
      })
    );
  }

  // Monthly from 3 months to 6 months
  {
    let due = age3m;
    let idx = 0;
    while (due <= age6m) {
      if (due > horizon) break;
      reminders.push(
        mkReminder({
          category: 'deworming',
          title: 'Deworming',
          dueDate: due,
          ruleId: `deworming_monthly_${idx}`,
        })
      );
      due = addMonths(due, 1);
      idx += 1;
    }
  }

  // Every 3 months after 6 months
  {
    let due = addMonths(age6m, 3);
    let idx = 0;
    while (due <= horizon) {
      reminders.push(
        mkReminder({
          category: 'deworming',
          title: 'Deworming (Quarterly)',
          dueDate: due,
          ruleId: `deworming_quarterly_${idx}`,
        })
      );
      due = addMonths(due, 3);
      idx += 1;
    }
  }

  // Flea & Tick: recurring
  {
    // Start at 8 weeks (common practical baseline; configurable later)
    let due = addWeeks(birth, 8);
    let idx = 0;
    while (due <= horizon) {
      reminders.push(
        mkReminder({
          category: 'flea_tick',
          title: 'Flea & Tick Prevention',
          dueDate: due,
          priority: priorityFlea,
          ruleId: `flea_tick_${isOutdoor ? 'outdoor' : 'indoor'}_${idx}`,
        })
      );
      due = addDays(due, fleaEveryDays);
      idx += 1;
    }
  }

  // Vet checkups:
  // - every 4 weeks until 4 months old
  // - then every 6 months for adults
  const age4m = addMonths(birth, 4);
  {
    let due = addWeeks(birth, 4);
    let idx = 0;
    while (due <= age4m) {
      if (due > horizon) break;
      reminders.push(
        mkReminder({
          category: 'checkup',
          title: 'Vet Checkup',
          dueDate: due,
          ruleId: `checkup_4w_${idx}`,
        })
      );
      due = addWeeks(due, 4);
      idx += 1;
    }
  }
  {
    let due = addMonths(age4m, 6);
    let idx = 0;
    while (due <= horizon) {
      reminders.push(
        mkReminder({
          category: 'checkup',
          title: 'Vet Checkup (6-month)',
          dueDate: due,
          ruleId: `checkup_6m_${idx}`,
        })
      );
      due = addMonths(due, 6);
      idx += 1;
    }
  }

  // Sort ascending by due date for consistent UX
  reminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return reminders;
}

module.exports = {
  generatePetRemindersV1,
};

