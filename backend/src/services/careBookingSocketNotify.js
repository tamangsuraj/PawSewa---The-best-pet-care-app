/**
 * Socket.io for Care+ bookings — admin ops + assigned partner realtime.
 */
const { getIO } = require('../sockets/socketStore');
const CareBooking = require('../models/CareBooking');

/**
 * @param {import('mongoose').Types.ObjectId|string} bookingId
 * @param {'update'|'assigned'|'new'} kind
 */
async function broadcastCareBooking(bookingId, kind = 'update') {
  const io = getIO();
  if (!io || !bookingId) return;

  const booking = await CareBooking.findById(bookingId)
    .populate('hostelId', 'name location serviceType')
    .populate('petId', 'name breed age photoUrl')
    .populate('userId', 'name email phone')
    .populate('assignedPartner', 'name email phone role')
    .lean();

  if (!booking) return;

  const payload = { booking };

  io.to('admin_room').emit('care_booking:update', payload);

  if (kind === 'new') {
    io.to('admin_room').emit('care_booking:new', payload);
  }

  const partner = booking.assignedPartner;
  const pid = partner && (partner._id?.toString?.() || String(partner));
  if (pid && (kind === 'assigned' || kind === 'update')) {
    io.to(`user:${pid}`).emit('care_booking:assigned', payload);
    io.to(`user:${pid}`).emit('care_booking:update', payload);
  }
}

module.exports = { broadcastCareBooking };
