const Zone = require('../models/Zone');
const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest');

/**
 * Resolve zone from address text (district name match) or optional coords.
 */
async function resolveZoneFromLocation({ address, lat, lng }) {
  const zones = await Zone.find({ isActive: true }).lean();
  if (!zones.length) return null;

  const addrLower = (address || '').toLowerCase();
  for (const z of zones) {
    const districts = z.districts || [];
    for (const d of districts) {
      if (d && addrLower.includes(String(d).toLowerCase())) {
        return z;
      }
    }
    if (Array.isArray(z.polygonCoords) && z.polygonCoords.length >= 3 && typeof lat === 'number' && typeof lng === 'number') {
      if (pointInPolygon(lat, lng, z.polygonCoords)) return z;
    }
  }
  // No fallback to zones[0] — wrong zone causes incorrect vet auto-assignment.
  return null;
}

function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Pick available vet in zone with fewest active assignments.
 */
async function autoAssignVetByZone(location, serviceType) {
  const coords = location?.coordinates || location || {};
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  const address = location?.address || '';

  const zone = await resolveZoneFromLocation({ address, lat, lng });
  if (!zone) return null;

  const vets = await User.find({
    role: { $in: ['veterinarian', 'vet', 'VET'] },
    zone: zone._id,
    isAvailable: true,
    isActive: { $ne: false },
    isVerified: true,
  })
    .select('_id name email')
    .lean();

  if (!vets.length) return null;

  const activeStatuses = ['pending', 'assigned', 'accepted', 'en_route', 'arrived', 'in_progress'];
  let best = null;
  let bestCount = Infinity;

  for (const vet of vets) {
    const count = await ServiceRequest.countDocuments({
      assignedStaff: vet._id,
      status: { $in: activeStatuses },
    });
    if (count < bestCount) {
      bestCount = count;
      best = vet;
    }
  }

  return best;
}

module.exports = { resolveZoneFromLocation, autoAssignVetByZone };
