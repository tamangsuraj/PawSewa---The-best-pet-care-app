const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const CallSession = require('../models/CallSession');

/**
 * @route POST /api/v1/calls/log
 * @body { channelName, durationSeconds, callType?, peerUserId, iWasCaller?, appointmentId?, careBookingId? }
 */
const logCallSession = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const channelName = String(body.channelName || '').trim().slice(0, 64);
  if (!channelName) {
    res.status(400);
    throw new Error('channelName is required');
  }

  const durationSeconds = Math.max(0, parseInt(String(body.durationSeconds ?? 0), 10) || 0);
  const callType = body.callType === 'video' ? 'video' : 'audio';

  const peerRaw = body.peerUserId != null ? String(body.peerUserId).trim() : '';
  if (!peerRaw || !mongoose.Types.ObjectId.isValid(peerRaw)) {
    res.status(400);
    throw new Error('peerUserId is required');
  }
  const peerId = new mongoose.Types.ObjectId(peerRaw);
  const me = req.user._id;
  const iWasCaller = body.iWasCaller === true;
  const caller = iWasCaller ? me : peerId;
  const callee = iWasCaller ? peerId : me;

  let appointment = undefined;
  if (body.appointmentId && mongoose.Types.ObjectId.isValid(String(body.appointmentId))) {
    appointment = body.appointmentId;
  }
  let careBooking = undefined;
  if (body.careBookingId && mongoose.Types.ObjectId.isValid(String(body.careBookingId))) {
    careBooking = body.careBookingId;
  }

  const doc = await CallSession.create({
    channelName,
    durationSeconds,
    callType,
    caller,
    callee,
    appointment,
    careBooking,
    endedAt: new Date(),
  });

  res.status(201).json({ success: true, data: { id: doc._id } });
});

module.exports = { logCallSession };
