/**
 * Human-readable labels for admin / chat UIs.
 */
function formatRoleLabel(role) {
  if (!role) return 'User';
  const r = String(role).toLowerCase();
  const map = {
    pet_owner: 'Customer',
    customer: 'Customer',
    veterinarian: 'Vet',
    vet: 'Vet',
    rider: 'Rider',
    shop_owner: 'Seller',
    groomer: 'Groomer',
    trainer: 'Trainer',
    hostel_owner: 'Hostel',
    care_service: 'Care service',
    service_provider: 'Service provider',
    facility_owner: 'Facility',
    admin: 'Admin',
  };
  return map[r] || r.replace(/_/g, ' ');
}

module.exports = { formatRoleLabel };
