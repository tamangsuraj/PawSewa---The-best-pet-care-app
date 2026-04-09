/**
 * Canonical API user roles (aligned with backend User model normalization).
 */
export const USER_ROLES = {
  PET_OWNER: 'pet_owner',
  VETERINARIAN: 'veterinarian',
  ADMIN: 'admin',
  SHOP_OWNER: 'shop_owner',
  CARE_SERVICE: 'care_service',
  RIDER: 'rider',
} as const;

export type UserRoleValue = (typeof USER_ROLES)[keyof typeof USER_ROLES];
