/**
 * Build last-6-calendar-month weight series for clinical dashboard charts.
 * Uses pet.weightHistory; if empty but pet.weight is set, a single in-memory
 * backfill point is used (updatedAt || createdAt) — not persisted.
 */

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * @param {object} pet - lean or doc-like { weightHistory, weight, createdAt, updatedAt }
 * @returns {Array<{ label: string, yearMonth: string, weightKg: number|null, hasRecord: boolean, recordedAt: string|null, source: string|null }>}
 */
function buildWeightChart6Months(pet) {
  const raw = Array.isArray(pet?.weightHistory) ? [...pet.weightHistory] : [];

  const w = Number(pet?.weight);
  if (raw.length === 0 && !Number.isNaN(w) && w > 0) {
    const at = pet.updatedAt ? new Date(pet.updatedAt) : pet.createdAt ? new Date(pet.createdAt) : new Date();
    raw.push({ recordedAt: at, weightKg: w, source: 'profile_backfill' });
  }

  const now = new Date();
  const out = [];

  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const inMonth = raw.filter((e) => {
      if (!e || e.recordedAt == null) return false;
      const t = new Date(e.recordedAt);
      return t.getFullYear() === y && t.getMonth() === m;
    });

    const row = {
      label: MONTH_LABELS[m],
      yearMonth: `${y}-${String(m + 1).padStart(2, '0')}`,
      weightKg: null,
      hasRecord: false,
      recordedAt: null,
      source: null,
    };

    if (inMonth.length) {
      const latest = inMonth.reduce((a, b) =>
        new Date(a.recordedAt) > new Date(b.recordedAt) ? a : b
      );
      const kg = Number(latest.weightKg);
      if (!Number.isNaN(kg) && kg >= 0) {
        row.weightKg = Math.round(kg * 10) / 10;
        row.hasRecord = true;
        row.recordedAt = new Date(latest.recordedAt).toISOString();
        row.source = latest.source || 'owner';
      }
    }
    out.push(row);
  }

  return out;
}

const MAX_WEIGHT_HISTORY_ENTRIES = 500;

/**
 * Append a weight reading and trim oldest if over cap.
 * @param {import('mongoose').Document} pet - Pet document with .weightHistory array
 * @param {number} weightKg
 * @param {Date} [recordedAt]
 * @param {string} [source='owner']
 */
function pushWeightHistoryEntry(pet, weightKg, recordedAt, source = 'owner') {
  if (!pet.weightHistory) {
    pet.weightHistory = [];
  }
  pet.weightHistory.push({
    recordedAt: recordedAt || new Date(),
    weightKg,
    source,
  });
  if (pet.weightHistory.length > MAX_WEIGHT_HISTORY_ENTRIES) {
    pet.weightHistory = pet.weightHistory.slice(-MAX_WEIGHT_HISTORY_ENTRIES);
  }
}

module.exports = {
  buildWeightChart6Months,
  pushWeightHistoryEntry,
  MAX_WEIGHT_HISTORY_ENTRIES,
};
