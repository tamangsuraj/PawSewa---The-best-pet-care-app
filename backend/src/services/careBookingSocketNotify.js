/**
 * Socket.io for Care+ bookings — admin, partner, and customer realtime.
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
    .populate('hostelId', 'name location serviceType ownerId')
    .populate('petId', 'name breed age photoUrl')
    .populate('userId', 'name email phone')
    .populate('assignedPartner', 'name email phone role')
    .lean();

  if (!booking) return;

  const payload = { booking };

  io.to('admin_room').emit('care_booking:update', payload);

  if (kind === 'new') {
    io.to('admin_room').emit('care_booking:new', payload);
    io.to('admin_room').emit('new_hostel_booking', payload);
  }

  const ownerId =
    booking.hostelId?.ownerId?.toString?.() || booking.hostelId?.ownerId || null;
  if (ownerId) {
    io.to(`user:${ownerId}`).emit('care_booking:update', payload);
    if (kind === 'new') {
      io.to(`user:${ownerId}`).emit('care_booking:new', payload);
      io.to(`user:${ownerId}`).emit('new_hostel_booking', payload);
    }
  }

  const customerId = booking.userId?._id?.toString?.() || booking.userId?.toString?.() || booking.customerId?.toString?.();
  if (customerId) {
    io.to(`user:${customerId}`).emit('care_booking:update', payload);
    if (kind === 'new') {
      io.to(`user:${customerId}`).emit('care_booking:new', payload);
      io.to(`user:${customerId}`).emit('new_hostel_booking', payload);
    }
  }

  const partner = booking.assignedPartner;
  const pid = partner && (partner._id?.toString?.() || String(partner));
  if (pid && (kind === 'assigned' || kind === 'update')) {
    io.to(`user:${pid}`).emit('care_booking:assigned', payload);
    io.to(`user:${pid}`).emit('care_booking:update', payload);
  }
}

module.exports = { broadcastCareBooking };
