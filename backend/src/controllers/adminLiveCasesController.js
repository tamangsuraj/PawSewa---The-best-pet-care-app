/**
 * Unified admin Live Cases: assistance (Case), bookable service requests, and clinic appointments (AppointmentUnified).
 */
const asyncHandler = require('express-async-handler');
const Case = require('../models/Case');
const ServiceRequest = require('../models/ServiceRequest');
const { AppointmentUnified } = require('../models/unified');
const User = require('../models/User');
const Pet = require('../models/Pet');
const logger = require('../utils/logger');

logger.info('Decommissioning standalone Appointments module.');
logger.info('Merging appointment stream into Live Cases aggregator.');
logger.success('Unified Case Management active.');

const LIVE_STATUSES = ['pending', 'assigned', 'in_progress'];
const CLINIC_TYPES = ['vet_visit', 'vet_appointment', 'vaccination', 'checkup'];

function formatDateSlot(dateVal, timeWindow) {
  const d = dateVal ? new Date(dateVal) : null;
  const dateStr = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
  const tw = (timeWindow || '').toString().trim();
  if (dateStr && tw) return `${dateStr} (${tw})`;
  if (dateStr) return dateStr;
  return tw || '';
}

function clinicDisplayType(type) {
  if (type === 'vaccination') return 'Vaccination';
  return 'Appointment';
}

function normalizeClinicStatus(raw) {
  if (raw === 'pending_admin' || raw === 'pending') return 'pending';
  if (raw === 'assigned') return 'assigned';
  if (raw === 'in_progress') return 'in_progress';
  return raw;
}

function serviceRequestDisplayType(serviceType) {
  const s = (serviceType || '').toString().toLowerCase();
  if (s.includes('vaccin')) return 'Vaccination';
  return 'Appointment';
}

function mapAssigneeFromVet(v) {
  if (!v) return null;
  const id = v._id?.toString?.() || String(v._id || v);
  return {
    _id: id,
    name: v.name || '',
    specialty: v.specialty || v.specialization || '',
    specialization: v.specialization || v.specialty || '',
  };
}

function clinicEligibleForLive(doc) {
  const amt = doc.totalAmount;
  const hasCharge = typeof amt === 'number' && amt > 0;
  if (!hasCharge) return true;
  return doc.paymentStatus === 'paid';
}

function rowFromCase(c) {
  const customer = c.customer
    ? {
        _id: c.customer._id?.toString?.() || String(c.customer),
        name: c.customer.name || '',
        email: c.customer.email,
        phone: c.customer.phone,
      }
    : null;
  const pet = c.pet
    ? {
        _id: c.pet._id?.toString?.() || String(c.pet),
        name: c.pet.name || '',
        breed: c.pet.breed,
        age: c.pet.age,
        image: c.pet.image,
        photoUrl: c.pet.photoUrl,
        pawId: c.pet.pawId,
      }
    : null;
  return {
    source: 'assistance',
    _id: c._id.toString(),
    displayType: 'Assistance',
    issueLine: c.issueDescription || '',
    locationLabel: String(c.location ?? ''),
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    status: c.status,
    customer,
    pet,
    assignee: mapAssigneeFromVet(c.assignedVet),
    createdAt: c.createdAt,
  };
}

function coordsFromServiceLocation(loc) {
  if (!loc || typeof loc !== 'object') return { latitude: null, longitude: null };
  const raw = loc.coordinates;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const lat = raw.lat ?? raw.latitude;
    const lng = raw.lng ?? raw.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') return { latitude: lat, longitude: lng };
  }
  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = Number(raw[0]);
    const lat = Number(raw[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  }
  return { latitude: null, longitude: null };
}

function rowFromServiceRequest(r) {
  const { latitude, longitude } = coordsFromServiceLocation(r.location);
  const customer = r.user
    ? {
        _id: r.user._id?.toString?.() || String(r.user),
        name: r.user.name || '',
        email: r.user.email,
        phone: r.user.phone,
      }
    : null;
  const pet = r.pet
    ? {
        _id: r.pet._id?.toString?.() || String(r.pet),
        name: r.pet.name || '',
        breed: r.pet.breed,
        age: r.pet.age,
        image: r.pet.image,
        photoUrl: r.pet.photoUrl,
        pawId: r.pet.pawId,
      }
    : null;
  const slot = formatDateSlot(r.preferredDate, r.timeWindow);
  const issueLine = `${r.serviceType || 'Service'}${slot ? ` — ${slot}` : ''}`;
  return {
    source: 'service_request',
    _id: r._id.toString(),
    displayType: serviceRequestDisplayType(r.serviceType),
    issueLine,
    locationLabel: r.location?.address || '—',
    latitude,
    longitude,
    status: r.status,
    customer,
    pet,
    assignee: mapAssigneeFromVet(r.assignedStaff),
    createdAt: r.createdAt,
    serviceType: r.serviceType,
    preferredDate: r.preferredDate,
    timeWindow: r.timeWindow,
  };
}

function populateAppointment(query) {
  return query
    .populate({ path: 'customerId', model: User, select: 'name email phone' })
    .populate({ path: 'petId', model: Pet, select: 'name pawId species breed photoUrl image age' })
    .populate({ path: 'staffId', model: User, select: 'name email phone specialization clinicName specialty' })
    .populate({ path: 'vetId', model: User, select: 'name email phone specialization clinicName specialty' });
}

function rowFromClinicAppointment(a) {
  const customer = a.customerId
    ? {
        _id: a.customerId._id?.toString?.() || String(a.customerId),
        name: a.customerId.name || '',
        email: a.customerId.email,
        phone: a.customerId.phone,
      }
    : null;
  const pet = a.petId
    ? {
        _id: a.petId._id?.toString?.() || String(a.petId),
        name: a.petId.name || '',
        breed: a.petId.breed,
        age: a.petId.age,
        image: a.petId.image,
        photoUrl: a.petId.photoUrl,
        pawId: a.petId.pawId,
      }
    : null;
  const vetOrStaff = a.vetId || a.staffId;
  const reason = (a.description || '').trim() || clinicDisplayType(a.type);
  const slot = formatDateSlot(a.preferredDate, a.timeWindow);
  const issueLine = slot ? `${reason} — ${slot}` : reason;
  const lat = a.location?.coordinates?.lat ?? null;
  const lng = a.location?.coordinates?.lng ?? null;
  const norm = normalizeClinicStatus(a.status);
  return {
    source: 'clinic_appointment',
    _id: a._id.toString(),
    displayType: clinicDisplayType(a.type),
    issueLine,
    locationLabel: a.location?.address || '—',
    latitude: lat,
    longitude: lng,
    status: norm,
    rawClinicStatus: a.status,
    paymentStatus: a.paymentStatus,
    customer,
    pet,
    assignee: mapAssigneeFromVet(vetOrStaff),
    createdAt: a.createdAt,
    preferredDate: a.preferredDate,
    timeWindow: a.timeWindow,
  };
}

/**
 * @route GET /api/v1/admin/live-cases
 * Query: status=all|pending|assigned|in_progress, category=all|assistance|appointments
 */
const getAdminLiveCases = asyncHandler(async (req, res) => {
  const statusQ = (req.query.status || 'all').toString().toLowerCase();
  const category = (req.query.category || 'all').toString().toLowerCase();

  const caseFilter = {};
  const srFilter = {};
  let clinicStatusFilter = { $in: ['pending_admin', 'pending', 'assigned', 'in_progress'] };
  if (statusQ !== 'all' && LIVE_STATUSES.includes(statusQ)) {
    caseFilter.status = statusQ;
    srFilter.status = statusQ;
    if (statusQ === 'pending') {
      clinicStatusFilter = { $in: ['pending_admin', 'pending'] };
    } else {
      clinicStatusFilter = statusQ;
    }
  } else {
    caseFilter.status = { $in: LIVE_STATUSES };
    srFilter.status = { $in: LIVE_STATUSES };
  }

  const [cases, serviceRequests, clinicAppointments] = await Promise.all([
    Case.find(caseFilter)
      .populate('customer', 'name email phone')
      .populate('pet', 'name breed age image pawId photoUrl')
      .populate('assignedVet', 'name email phone specialty specialization currentShift')
      .sort({ createdAt: -1 })
      .lean(),
    ServiceRequest.find(srFilter)
      .populate('user', 'name email phone')
      .populate('pet', 'name breed age photoUrl pawId')
      .populate('assignedStaff', 'name email phone specialty specialization')
      .sort({ createdAt: -1 })
      .lean(),
    populateAppointment(
      AppointmentUnified.find({
        type: { $in: CLINIC_TYPES },
        status: clinicStatusFilter,
      }).sort({ createdAt: -1 }),
    ).lean(),
  ]);

  let clinicRows = clinicAppointments.filter(clinicEligibleForLive).map(rowFromClinicAppointment);
  let assistanceRows = cases.map(rowFromCase);
  let bookingRows = serviceRequests.map(rowFromServiceRequest);

  if (category === 'assistance') {
    bookingRows = [];
    clinicRows = [];
  } else if (category === 'appointments') {
    assistanceRows = [];
  }

  const merged = [...assistanceRows, ...bookingRows, ...clinicRows].filter((row) =>
    LIVE_STATUSES.includes(row.status),
  );

  const isUnassigned = (row) => !row.assignee;
  const unassignedPending = merged.filter((r) => r.status === 'pending' && isUnassigned(r));
  const rest = merged.filter((r) => r.status !== 'pending' || !isUnassigned(r));

  unassignedPending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  rest.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const data = [...unassignedPending, ...rest];

  res.json({
    success: true,
    count: data.length,
    data,
  });
});

module.exports = { getAdminLiveCases };
