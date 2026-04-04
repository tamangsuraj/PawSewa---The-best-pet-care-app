/**
 * Product targetPets (uppercase) + petTypes (legacy lowercase) helpers.
 */

const TARGET_TO_PET_TYPE = {
  DOG: 'dog',
  CAT: 'cat',
  RABBIT: 'rabbit',
};

const SPECIES_TO_TARGET = {
  Dog: 'DOG',
  Cat: 'CAT',
  Rabbit: 'RABBIT',
  Bird: 'BIRD',
  Hamster: 'HAMSTER',
  Fish: 'FISH',
  Other: 'OTHER',
};

const ALLOWED_TARGETS = new Set(['DOG', 'CAT', 'RABBIT', 'BIRD', 'HAMSTER', 'FISH', 'OTHER']);

function normalizeTargetPets(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const x of input) {
    const u = String(x || '')
      .trim()
      .toUpperCase();
    if (ALLOWED_TARGETS.has(u) && !out.includes(u)) out.push(u);
  }
  return out;
}

function targetPetsToPetTypes(targetPets) {
  const out = [];
  for (const t of targetPets || []) {
    const p = TARGET_TO_PET_TYPE[t];
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

function petSpeciesToTargetPetType(species) {
  if (!species || typeof species !== 'string') return null;
  return SPECIES_TO_TARGET[species] || null;
}

/**
 * @param {object} product lean
 * @param {string|null} userNorm e.g. DOG
 * @returns {'match'|'universal'|'other'|null}
 */
function recommendationTierForProduct(product, userNorm) {
  if (!userNorm) return null;
  const targets = normalizeTargetPets(product.targetPets || []);
  let effective = targets;
  if (effective.length === 0 && Array.isArray(product.petTypes) && product.petTypes.length) {
    effective = (product.petTypes || []).map((p) => String(p).toUpperCase());
  }
  if (effective.length === 0) return 'universal';
  if (effective.includes(userNorm)) return 'match';
  return 'other';
}

function parseTagsFromBody(val) {
  if (val == null || val === '') return [];
  if (Array.isArray(val)) {
    return val
      .map((t) => String(t).trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 40))
      .slice(0, 24);
  }
  if (typeof val === 'string') {
    try {
      const j = JSON.parse(val);
      if (Array.isArray(j)) return parseTagsFromBody(j);
    } catch (_) {
      /* fall through */
    }
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 40))
      .slice(0, 24);
  }
  return [];
}

function parseTargetPetsFromBody(body) {
  const universal =
    body?.targetPetsUniversal === true ||
    body?.targetPetsUniversal === 'true' ||
    body?.universal === 'true';
  if (universal) return [];

  let raw = body?.targetPets ?? body?.targetPetTypes;
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return normalizeTargetPets(j);
    } catch (_) {
      return normalizeTargetPets(raw.split(','));
    }
  }
  if (Array.isArray(raw)) return normalizeTargetPets(raw);
  return [];
}

module.exports = {
  normalizeTargetPets,
  targetPetsToPetTypes,
  petSpeciesToTargetPetType,
  recommendationTierForProduct,
  parseTagsFromBody,
  parseTargetPetsFromBody,
  ALLOWED_TARGETS,
};
