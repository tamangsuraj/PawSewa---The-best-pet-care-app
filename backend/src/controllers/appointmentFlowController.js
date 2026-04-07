const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { AppointmentUnified } = require('../models/unified');
const User = require('../models/User');
const Pet = require('../models/Pet');
const { sendMulticastToUser } = require('../utils/fcm');
const { broadcastAppointment } = require('../services/appointmentSocketNotify');
const logger = require('../utils/logger');

function populateAppointment(q) {
  return q
    .populate({ path: 'customerId', model: User, select: 'name email phone' })
    .populate({ path: 'petId', model: Pet, select: 'name pawId species breed photoUrl owner' })
    .populate({ path: 'staffId', model: User, select: 'name email phone specialization clinicName' })
    .populate({ path: 'vetId', model: User, select: 'name email phone specialization clinicName' });
}

const CLINIC_TYPES = new Set(['vet_visit', 'vet_appointment', 'vaccination', 'checkup']);

function vetAssignmentFilter(userId) {
  return {
    $or: [{ staffId: userId }, { vetId: userId }],
  };
}

/**
 * @desc Create appointment (customer) — awaits admin assignment
 * @route POST /api/v1/appointments
 */
const createAppointment = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const petId = body.petId;
  let type = (body.type || 'vet_appointment').toString().trim();
  if (!CLINIC_TYPES.has(type)) {
    res.status(400);
    throw new Error('type must be vet_visit, vet_appointment, vaccination, or checkup');
  }

  if (!petId) {
    res.status(400);
    throw new Error('petId is required');
  }

  const pet = await Pet.findById(petId).lean();
  if (!pet) {
    res.status(404);
    throw new Error('Pet not found');
  }
  const ownerId = pet.owner?.toString?.() || String(pet.owner);
  if (ownerId !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Pet does not belong to this account');
  }

  const preferredDate = body.preferredDate ? new Date(body.preferredDate) : null;
  if (preferredDate && Number.isNaN(preferredDate.getTime())) {
    res.status(400);
    throw new Error('Invalid preferredDate');
  }

  const timeWindow = body.timeWindow != null ? String(body.timeWindow).trim() : '';
  if (!timeWindow) {
    res.status(400);
    throw new Error('timeWindow is required');
  }

  const now = new Date();
  const payload = {
    type,
    customerId: req.user._id,
    petId,
    description: body.description != null ? String(body.description).slice(0, 1000) : undefined,
    preferredDate: preferredDate || undefined,
    timeWindow,
    status: 'pending_admin',
    staffId: undefined,
    vetId: undefined,
    assignmentTimeline: [{ status: 'pending_admin', at: now, actorId: req.user._id }],
  };

  if (body.location && typeof body.location === 'object') {
    payload.location = {
      address: body.location.address,
      coordinates: body.location.coordinates,
    };
  }

  if (typeof body.totalAmount === 'number' && body.totalAmount >= 0) {
    payload.totalAmount = body.totalAmount;
  }

  const appointment = await AppointmentUnified.create(payload);
  await broadcastAppointment(appointment._id, 'create');

  const populated = await populateAppointment(
    AppointmentUnified.findById(appointment._id),
  ).lean();

  res.status(201).json({ success: true, data: populated });
});

/**
 * @desc List appointments (admin), optional ?status=&type=
 * @route GET /api/v1/appointments
 */
const listAppointmentsAdmin = asyncHandler(async (req, res) => {
  const q = {};
  const status = (req.query.status || '').toString().trim();
  if (status) q.status = status;
  const type = (req.query.type || '').toString().trim();
  if (type) q.type = type;

  const appointments = await populateAppointment(
    AppointmentUnified.find(q).sort({ createdAt: -1 }),
  ).lean();

  res.json({
    success: true,
    count: appointments.length,
    data: appointments,
  });
});

/**
 * @desc Pending admin queue (clinic types only)
 * @route GET /api/v1/appointments/desk/pending
 */
const listPendingDesk = asyncHandler(async (req, res) => {
  const appointments = await populateAppointment(
    AppointmentUnified.find({
      status: { $in: ['pending_admin', 'pending'] },
      type: { $in: [...CLINIC_TYPES] },
    }).sort({ createdAt: -1 }),
  ).lean();

  res.json({
    success: true,
    count: appointments.length,
    data: appointments,
  });
});

/**
 * @desc My appointments (customer or vet)
 * @route GET /api/v1/appointments/my
 */
const listMyAppointments = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const role = req.user.role;

  const clinicOnly = { type: { $in: [...CLINIC_TYPES] } };
  const baseQuery =
    role === 'veterinarian' || role === 'vet' || role === 'VET'
      ? { ...vetAssignmentFilter(userId), ...clinicOnly }
      : { customerId: userId, ...clinicOnly };

  const appointments = await populateAppointment(
    AppointmentUnified.find(baseQuery).sort({ createdAt: -1 }),
  ).lean();

  res.json({
    success: true,
    count: appointments.length,
    data: appointments,
  });
});

/**
 * @desc Single appointment
 * @route GET /api/v1/appointments/:id
 */
const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await populateAppointment(
    AppointmentUnified.findById(req.params.id),
  ).lean();

  if (!appointment) {
    res.status(404);
    throw new Error('Appointment not found');
  }

  const uid = req.user._id.toString();
  const role = req.user.role;
  const isAdmin = role === 'admin' || role === 'ADMIN';
  const isCustomer = appointment.customerId?._id?.toString?.() === uid || appointment.customerId?.toString?.() === uid;
  const vid = appointment.vetId?._id?.toString?.() || appointment.vetId?.toString?.();
  const sid = appointment.staffId?._id?.toString?.() || appointment.staffId?.toString?.();
  const isVet = role === 'veterinarian' || role === 'vet' || role === 'VET';
  const isAssignedVet = isVet && (vid === uid || sid === uid);

  if (!isAdmin && !isCustomer && !isAssignedVet) {
    res.status(403);
    throw new Error('Not authorized to view this appointment');
  }

  res.json({ success: true, data: appointment });
});

/**
 * @desc Admin assigns veterinarian + notifies (FCM + socket)
 * @route PATCH /api/v1/appointments/:id/assign
 */
const assignAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rawVet = req.body?.vetId ?? req.body?.staffId;
  if (!rawVet) {
    res.status(400);
    throw new Error('vetId or staffId is required');
  }

  const vet = await User.findById(rawVet).select('role name').lean();
  if (!vet) {
    res.status(404);
    throw new Error('Veterinarian not found');
  }
  const vr = (vet.role || '').toString().toLowerCase();
  if (vr !== 'veterinarian' && vr !== 'vet') {
    res.status(400);
    throw new Error('Target user is not a veterinarian');
  }

  const existing = await AppointmentUnified.findById(id).lean();
  if (!existing) {
    res.status(404);
    throw new Error('Appointment not found');
  }
  if (!['pending_admin', 'pending'].includes(existing.status)) {
    res.status(400);
    throw new Error('Only pending admin bookings can be assigned');
  }

  const vetOid = new mongoose.Types.ObjectId(String(rawVet));
  const now = new Date();

  const appointment = await AppointmentUnified.findByIdAndUpdate(
    id,
    {
      $set: {
        staffId: vetOid,
        vetId: vetOid,
        status: 'assigned',
      },
      $push: {
        assignmentTimeline: {
          status: 'assigned',
          at: now,
          actorId: req.user._id,
        },
      },
    },
    { new: true },
  );

  if (!appointment) {
    res.status(404);
    throw new Error('Appointment not found');
  }

  logger.info('Appointment assigned', id, 'vet', String(vetOid));

  await sendMulticastToUser(vetOid, {
    title: 'New appointment assigned',
    body: `You have a new PawSewa appointment. Open the Partner app to start.`,
    data: {
      type: 'appointment_assigned',
      appointmentId: String(appointment._id),
    },
  });

  await broadcastAppointment(appointment._id, 'assign');

  const populated = await populateAppointment(
    AppointmentUnified.findById(appointment._id),
  ).lean();

  res.json({
    success: true,
    data: populated,
    message: 'Vet assigned and notified',
  });
});

/**
 * @desc Vet updates status (in_progress | completed)
 * @route PATCH /api/v1/appointments/:id/status
 */
const patchAppointmentStatus = asyncHandler(async (req, res) => {
  const role = req.user.role;
  const isVet = role === 'veterinarian' || role === 'vet' || role === 'VET';
  if (!isVet) {
    res.status(403);
    throw new Error('Only veterinarians can update appointment status');
  }

  const nextStatus = (req.body?.status || '').toString().trim();
  if (!['in_progress', 'completed', 'cancelled'].includes(nextStatus)) {
    res.status(400);
    throw new Error('status must be in_progress, completed, or cancelled');
  }

  const uid = req.user._id.toString();
  const appointment = await AppointmentUnified.findById(req.params.id);
  if (!appointment) {
    res.status(404);
    throw new Error('Appointment not found');
  }

  const vid = appointment.vetId?.toString?.() || '';
  const sid = appointment.staffId?.toString?.() || '';
  if (vid !== uid && sid !== uid) {
    res.status(403);
    throw new Error('This appointment is not assigned to you');
  }

  const cur = appointment.status;
  if (nextStatus === 'in_progress' && cur !== 'assigned') {
    res.status(400);
    throw new Error('Can only start when status is assigned');
  }
  if (nextStatus === 'completed' && cur !== 'in_progress') {
    res.status(400);
    throw new Error('Start the appointment first, then mark as completed');
  }
  if (nextStatus === 'cancelled' && !['assigned', 'in_progress'].includes(cur)) {
    res.status(400);
    throw new Error('Cannot cancel from this state');
  }

  appointment.status = nextStatus;
  appointment.assignmentTimeline = appointment.assignmentTimeline || [];
  appointment.assignmentTimeline.push({
    status: nextStatus,
    at: new Date(),
    actorId: req.user._id,
  });
  if (req.body?.visitNotes != null && String(req.body.visitNotes).trim()) {
    appointment.visitNotes = String(req.body.visitNotes).slice(0, 2000);
  }
  await appointment.save();

  await broadcastAppointment(appointment._id, 'status');

  const populated = await populateAppointment(
    AppointmentUnified.findById(appointment._id),
  ).lean();

  res.json({ success: true, data: populated });
});

module.exports = {
  createAppointment,
  listAppointmentsAdmin,
  listPendingDesk,
  listMyAppointments,
  getAppointmentById,
  assignAppointment,
  patchAppointmentStatus,
};
