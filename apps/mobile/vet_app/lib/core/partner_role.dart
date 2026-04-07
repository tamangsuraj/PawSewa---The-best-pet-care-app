/// Partner app UI panels (must match [StorageService] partner role key values).
abstract class PartnerRole {
  static const vet = 'vet';
  static const rider = 'rider';
  static const seller = 'seller';
  static const care = 'care';
}

/// Panels a signed-in user may use, derived from the API [User.role] — not user-selectable fiction.
Set<String> allowedPartnerPanelsForServerRole(String? serverRole) {
  final r = (serverRole ?? '').toLowerCase().trim();
  if (r == 'rider') return {PartnerRole.rider};
  if (r == 'shop_owner') return {PartnerRole.seller};
  if (r == 'veterinarian' || r == 'vet') return {PartnerRole.vet};
  const careLike = <String>{
    'care_service',
    'hostel_owner',
    'groomer',
    'trainer',
    'facility_owner',
    'service_provider',
  };
  if (careLike.contains(r)) return {PartnerRole.care};
  // Unknown legacy role: single vet panel (safest minimal surface).
  return {PartnerRole.vet};
}

String defaultPartnerPanelForServerRole(String? serverRole) {
  return allowedPartnerPanelsForServerRole(serverRole).first;
}

/// Care "Pet records" intake screen — clinical vets use clinic queue / assignments instead.
bool canAccessCarePetRecords(String? serverRole) {
  final r = (serverRole ?? '').toLowerCase().trim();
  return const {
    'care_service',
    'hostel_owner',
    'groomer',
    'trainer',
    'facility_owner',
    'service_provider',
  }.contains(r);
}
