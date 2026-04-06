const StaffLocation = require('../models/StaffLocation');
const { getIO } = require('../sockets/socketStore');

/**
 * Maps arbitrary User.role values to StaffLocation.role enum:
 * veterinarian | rider | shop_owner | care_service | admin
 */
function normalizeStaffLocationRole(role) {
  const r = String(role || '')
    .trim()
    .toLowerCase();
  if (r === 'vet' || r === 'veterinarian') {
    return 'veterinarian';
  }
  if (r === 'rider') {
    return 'rider';
  }
  if (r === 'shop_owner') {
    return 'shop_owner';
  }
  if (r === 'admin') {
    return 'admin';
  }
  return 'care_service';
}

/**
 * Short-lived pin for admin /live-map + instant refresh for connected admins.
 */
async function recordStaffLocationPulse(staffUser, lat, lng) {
  if (!staffUser || !staffUser._id) {
    return;
  }
  const role = normalizeStaffLocationRole(staffUser.role);
  await StaffLocation.create({
    staff: staffUser._id,
    role,
    coordinates: { lat, lng },
  });
  const io = getIO();
  if (io) {
    io.to('admin_room').emit('staff:location', { ts: Date.now() });
  }
}

module.exports = {
  normalizeStaffLocationRole,
  recordStaffLocationPulse,
};
