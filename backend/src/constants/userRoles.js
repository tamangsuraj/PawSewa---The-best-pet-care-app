/**
 * Canonical user roles stored on User documents (after normalization).
 * Use these instead of string literals in new code paths.
 */
const USER_ROLES = Object.freeze({
  PET_OWNER: 'pet_owner',
  VETERINARIAN: 'veterinarian',
  ADMIN: 'admin',
  SHOP_OWNER: 'shop_owner',
  CARE_SERVICE: 'care_service',
  RIDER: 'rider',
  VET: 'vet',
});

module.exports = { USER_ROLES };
