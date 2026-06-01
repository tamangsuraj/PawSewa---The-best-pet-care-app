/** Mongoose enum on ServiceRequest.serviceType */
const API_SERVICE_TYPES = ['Appointment', 'Health Checkup', 'Vaccination'];

/**
 * Map mobile/web marketing labels to persisted serviceType enum.
 * @param {string} raw - Client serviceType string
 * @param {string} [notes] - Optional booking notes (purpose/vaccines lines)
 * @returns {'Appointment'|'Health Checkup'|'Vaccination'}
 */
function normalizeServiceType(raw, notes = '') {
  const s = String(raw || '').trim();
  if (API_SERVICE_TYPES.includes(s)) return s;

  const lower = s.toLowerCase();
  const notesLower = String(notes || '').toLowerCase();

  if (
    lower.includes('vaccination') ||
    notesLower.includes('purpose: vaccination') ||
    notesLower.includes('vaccines:')
  ) {
    return 'Vaccination';
  }
  if (
    lower.includes('health checkup') ||
    lower.includes('check-up') ||
    lower.includes('checkup') ||
    lower.includes('nutrition')
  ) {
    return 'Health Checkup';
  }

  // Home visit, emergency, online consult, grooming, etc.
  return 'Appointment';
}

module.exports = { normalizeServiceType, API_SERVICE_TYPES };
