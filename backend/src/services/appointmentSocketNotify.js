/**
 * Realtime appointment updates — admin desk + assigned vet + customer.
 */
const { getIO } = require('../sockets/socketStore');
const User = require('../models/User');
const Pet = require('../models/Pet');
const { AppointmentUnified } = require('../models/unified');

async function loadAppointmentPayload(id) {
  if (!id) return null;
  return AppointmentUnified.findById(id)
    .populate({ path: 'customerId', model: User, select: 'name email phone' })
    .populate({ path: 'petId', model: Pet, select: 'name pawId species breed photoUrl' })
    .populate({ path: 'staffId', model: User, select: 'name email phone specialization clinicName' })
    .populate({ path: 'vetId', model: User, select: 'name email phone specialization clinicName' })
    .lean();
}

/**
 * @param {import('mongoose').Types.ObjectId|string} appointmentId
 * @param {'create'|'assign'|'status'|'update'} kind
 */
async function broadcastAppointment(appointmentId, kind = 'update') {
  const io = getIO();
  if (!io || !appointmentId) return;

  const appointment = await loadAppointmentPayload(appointmentId);
  if (!appointment) return;

  const payload = { appointment, kind };

  io.to('admin_room').emit('appointment:update', payload);

  const vetId =
    appointment.vetId?._id?.toString?.() ||
    appointment.vetId?.toString?.() ||
    appointment.staffId?._id?.toString?.() ||
    appointment.staffId?.toString?.() ||
    null;
  if (vetId) {
    io.to(`user:${vetId}`).emit('appointment:update', payload);
  }

  const custId =
    appointment.customerId?._id?.toString?.() ||
    appointment.customerId?.toString?.() ||
    null;
  if (custId) {
    io.to(`user:${custId}`).emit('appointment:update', payload);
  }
}

module.exports = { broadcastAppointment, loadAppointmentPayload };
