const asyncHandler = require('express-async-handler');
const CareBooking = require('../models/CareBooking');
const Hostel = require('../models/Hostel');
const Pet = require('../models/Pet');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const { broadcastCareBooking } = require('../services/careBookingSocketNotify');
const { sendMulticastToUser } = require('../utils/fcm');
const MarketplaceConversation = require('../models/MarketplaceConversation');

/**
 * @desc    Create a care booking (pet owner)
 * @route   POST /api/v1/care-bookings
 * @access  Private
 */
const createCareBooking = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const hostelId = body.hostelId || body.hostel_id;
  const petId = body.petId || body.pet_id;
  const checkIn = body.checkIn || body.check_in;
  const checkOut = body.checkOut || body.check_out;
  const roomType = body.roomType || body.room_type;
  const paymentMethod = body.paymentMethod === 'cash_on_delivery' ? 'cash_on_delivery' : 'online';
  const logisticsRaw = (body.logisticsType || body.logistics || '').toString().trim().toLowerCase();
  const deliveryRaw = (body.serviceDelivery || '').toString().trim().toLowerCase();
  const logisticsType =
    logisticsRaw === 'pickup' || deliveryRaw === 'home_visit' ? 'pickup' : 'self_drop';

  let pickupAddress = null;
  if (logisticsType === 'pickup') {
    const pa = body.pickupAddress || body.pickup_address;
    const addr = pa && typeof pa === 'object' ? String(pa.address || '').trim() : '';
    const coords = pa && typeof pa === 'object' ? pa.coordinates || pa.coords || null : null;
    let lat;
    let lng;
    if (Array.isArray(coords) && coords.length === 2) {
      lng = Number(coords[0]);
      lat = Number(coords[1]);
    } else if (pa && typeof pa === 'object') {
      lat = Number(pa.lat);
      lng = Number(pa.lng);
    }
    if (!addr || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400);
      throw new Error('pickupAddress with address + coordinates is required for pickup logistics');
    }
    pickupAddress = { address: addr, point: { type: 'Point', coordinates: [lng, lat] } };
  }

  if (!hostelId || !petId || !checkIn || !checkOut) {
    res.status(400);
    throw new Error('Please provide hostelId, petId, checkIn, and checkOut');
  }

  const hostel = await Hostel.findById(hostelId);
  if (!hostel) {
    res.status(404);
    throw new Error('Hostel not found');
  }

  const pet = await Pet.findById(petId);
  if (!pet) {
    res.status(404);
    throw new Error('Pet not found');
  }
  if (pet.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only book for your own pets');
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    res.status(400);
    throw new Error('Invalid check-in or check-out date');
  }
  if (checkOutDate <= checkInDate) {
    res.status(400);
    throw new Error('Check-out must be after check-in');
  }

  const nights = Math.ceil((checkOutDate - checkInDate) / (24 * 60 * 60 * 1000));
  const isSessionBased = ['Grooming', 'Training', 'Wash', 'Spa'].includes(hostel.serviceType || 'Hostel');
  let unitPrice;
  if (isSessionBased) {
    const packageName = body.packageName || body.package;
    const groomingPackages = hostel.groomingPackages || [];
    const pkg = groomingPackages.find((p) => p.name === packageName);
    unitPrice = pkg ? pkg.price : (hostel.pricePerSession ?? hostel.pricePerNight ?? 0);
  } else {
    unitPrice = roomType && hostel.roomTypes?.length
      ? (hostel.roomTypes.find((r) => r.name === roomType)?.pricePerNight ?? hostel.pricePerNight)
      : hostel.pricePerNight;
  }
  const units = isSessionBased ? Math.max(1, nights) : nights;
  let subtotal = units * unitPrice;
  const addOnNames = Array.isArray(body.addOns) ? body.addOns : (body.addOn ? [body.addOn] : []);
  const addOnsList = hostel.addOns || [];
  for (const name of addOnNames) {
    const ao = addOnsList.find((a) => a.name === name);
    if (ao && ao.price) subtotal += ao.price;
  }
  const cleaningFee = hostel.serviceType === 'Hostel' ? 200 : 50;
  const serviceFee = 250;
  const feePercent = await Subscription.findOne({
    providerId: hostel.ownerId,
    status: 'active',
    validUntil: { $gt: new Date() },
  }).then((s) => (s ? Subscription.getPlanConfig(s.plan).platformFeePercent : 15));
  const platformFee = Math.round(subtotal * (feePercent / 100) * 100) / 100;
  const tax = Math.round((subtotal + cleaningFee + serviceFee + platformFee) * 0.13 * 100) / 100;
  const totalAmount = subtotal + cleaningFee + serviceFee + platformFee + tax;

  const booking = await CareBooking.create({
    hostelId,
    centreId: hostelId,
    petId,
    userId: req.user._id,
    customerId: req.user._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    roomType: roomType || null,
    nights,
    subtotal,
    cleaningFee,
    serviceFee,
    platformFee,
    tax,
    totalAmount,
    serviceType: hostel.serviceType || 'Hostel',
    status: 'awaiting_approval',
    paymentStatus: 'unpaid',
    paymentMethod,
    ownerNotes: body.ownerNotes || body.notes,
    packageName: body.packageName || body.package || null,
    addOns: addOnNames.length ? addOnNames : undefined,
    serviceDelivery: body.serviceDelivery || null,
    logisticsType,
    pickupAddress: pickupAddress || undefined,
  });

  const populated = await CareBooking.findById(booking._id)
    .populate('hostelId', 'name location pricePerNight images')
    .populate('petId', 'name breed age')
    .populate('userId', 'name email phone');

  await Notification.create({
    user: hostel.ownerId,
    title: 'New hostel booking',
    message: `${pet.name} booked ${nights} night(s) at ${hostel.name}. Check-in: ${checkInDate.toLocaleDateString()}`,
    type: 'care_booking',
    careBooking: booking._id,
  });

  await Notification.create({
    user: req.user._id,
    title: 'Care booking submitted',
    message: `We sent your request for ${hostel.name}. You will get another alert when it is accepted or if payment is required.`,
    type: 'care_booking',
    careBooking: booking._id,
  });

  await broadcastCareBooking(booking._id, 'new');

  await sendMulticastToUser(hostel.ownerId, {
    title: 'New care booking request',
    body: `${pet.name} — ${hostel.name}. Open Partner app to accept or decline.`,
    data: {
      type: 'care_booking_new',
      careBookingId: String(booking._id),
    },
  }).catch(() => {});

  res.status(201).json({
    success: true,
    message: 'Booking created. Complete payment to confirm.',
    data: populated,
  });
});

/**
 * @desc    Get my bookings (pet owner)
 * @route   GET /api/v1/care-bookings/my
 * @access  Private
 */
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await CareBooking.find({ userId: req.user._id })
    .populate('hostelId', 'name location pricePerNight images')
    .populate('petId', 'name breed age')
    .sort({ createdAt: -1 })
    .lean();
  res.json({
    success: true,
    data: bookings,
  });
});

/**
 * @desc    Get incoming bookings for hostel owner
 * @route   GET /api/v1/care-bookings/incoming
 * @access  Private / hostel_owner
 */
const PARTNER_CARE_ROLES = [
  'veterinarian',
  'vet',
  'groomer',
  'trainer',
  'hostel_owner',
  'care_service',
  'service_provider',
  'facility_owner',
];

const getIncomingBookings = asyncHandler(async (req, res) => {
  const hostels = await Hostel.find({ ownerId: req.user._id }).select('_id').lean();
  const hostelIds = hostels.map((h) => h._id);
  const uid = req.user._id;
  const bookings = await CareBooking.find({
    $or: [{ hostelId: { $in: hostelIds } }, { assignedPartner: uid }],
  })
    .populate('hostelId', 'name location')
    .populate('petId', 'name breed age photoUrl')
    .populate('userId', 'name email phone')
    .populate('assignedPartner', 'name email phone role')
    .sort({ createdAt: -1 })
    .lean();
  res.json({
    success: true,
    data: bookings,
  });
});

/**
 * @desc    Accept or reject booking (hostel owner)
 * @route   PATCH /api/v1/care-bookings/:id/respond
 * @access  Private / hostel_owner
 */
const respondToBooking = asyncHandler(async (req, res) => {
  const { accept } = req.body;
  const booking = await CareBooking.findById(req.params.id).populate('hostelId').populate('userId', 'name');
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  if (booking.hostelId.ownerId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to respond to this booking');
  }
  const awaiting = ['awaiting_approval', 'pending', 'paid'];
  if (!awaiting.includes(booking.status)) {
    res.status(400);
    throw new Error('Booking is not waiting for approval');
  }

  booking.status = accept ? 'confirmed' : 'declined';
  await booking.save();

  await broadcastCareBooking(booking._id, 'update');

  await Notification.create({
    user: booking.userId._id,
    title: accept ? 'Booking confirmed' : 'Booking declined',
    message: accept
      ? `Your booking at ${booking.hostelId.name} has been confirmed.`
      : `Your booking at ${booking.hostelId.name} was declined.`,
    type: 'care_booking',
    careBooking: booking._id,
  });

  res.json({
    success: true,
    message: accept ? 'Booking confirmed' : 'Booking declined',
    data: booking,
  });
});

async function assertFacilityAccessOrThrow({ bookingId, user }) {
  const booking = await CareBooking.findById(bookingId)
    .populate('hostelId', 'ownerId name serviceType')
    .populate('petId', 'name breed age photoUrl')
    .populate('userId', 'name email phone profilePicture')
    .lean();
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }
  const uid = String(user?._id || '');
  const isAdmin = user?.role === 'admin';
  const hostelOwnerId = booking.hostelId?.ownerId ? String(booking.hostelId.ownerId) : '';
  const assignedPartnerId = booking.assignedPartner ? String(booking.assignedPartner) : '';
  const ok = isAdmin || uid === hostelOwnerId || (assignedPartnerId && uid === assignedPartnerId);
  if (!ok) {
    const err = new Error('Not authorized to manage this booking');
    err.statusCode = 403;
    throw err;
  }
  return booking;
}

/**
 * @desc    Facility: update private notes for a booking
 * @route   PATCH /api/v1/care-bookings/:id/facility-notes
 * @access  Private / hostel_owner (and assignedPartner/admin)
 */
const updateFacilityNotes = asyncHandler(async (req, res) => {
  const bookingLean = await assertFacilityAccessOrThrow({ bookingId: req.params.id, user: req.user });
  const booking = await CareBooking.findById(bookingLean._id);
  const notes = req.body?.notes != null ? String(req.body.notes).trim().slice(0, 2000) : '';
  booking.facilityNotes = notes;
  await booking.save();
  await broadcastCareBooking(booking._id, 'update');
  res.json({ success: true, message: 'Notes updated', data: booking });
});

/**
 * @desc    Facility: add an extra charge
 * @route   POST /api/v1/care-bookings/:id/extra-charges
 * @access  Private / hostel_owner (and assignedPartner/admin)
 * Body: { label, amount }
 */
const addExtraCharge = asyncHandler(async (req, res) => {
  const bookingLean = await assertFacilityAccessOrThrow({ bookingId: req.params.id, user: req.user });
  const label = req.body?.label != null ? String(req.body.label).trim().slice(0, 120) : '';
  const amount = Number(req.body?.amount);
  if (!label || !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ success: false, message: 'label and non-negative amount are required' });
  }
  const booking = await CareBooking.findById(bookingLean._id);
  booking.extraCharges.push({ label, amount, createdBy: req.user?._id || null });
  await booking.save();
  await broadcastCareBooking(booking._id, 'update');
  res.status(201).json({ success: true, message: 'Charge added', data: booking });
});

/**
 * @desc    Facility: set intake details + checklist/feed schedule (merge)
 * @route   PATCH /api/v1/care-bookings/:id/intake
 * @access  Private / hostel_owner (and assignedPartner/admin)
 */
const updateIntake = asyncHandler(async (req, res) => {
  const bookingLean = await assertFacilityAccessOrThrow({ bookingId: req.params.id, user: req.user });
  const booking = await CareBooking.findById(bookingLean._id);
  booking.intake = booking.intake || {};
  const { vaccination, diet, temperament, checklist, feedingSchedule } = req.body || {};
  if (vaccination !== undefined) booking.intake.vaccination = String(vaccination).trim().slice(0, 200);
  if (diet !== undefined) booking.intake.diet = String(diet).trim().slice(0, 500);
  if (temperament !== undefined) booking.intake.temperament = String(temperament).trim().slice(0, 200);
  if (Array.isArray(checklist)) {
    booking.intake.checklist = checklist
      .filter((c) => c && typeof c === 'object')
      .slice(0, 40)
      .map((c) => ({
        key: String(c.key || c.label || '').trim().slice(0, 80) || 'item',
        label: String(c.label || c.key || '').trim().slice(0, 120) || 'Item',
        done: Boolean(c.done),
      }));
  }
  if (Array.isArray(feedingSchedule)) {
    booking.intake.feedingSchedule = feedingSchedule
      .filter((f) => f && typeof f === 'object' && String(f.time || '').trim())
      .slice(0, 30)
      .map((f) => ({
        time: String(f.time).trim().slice(0, 16),
        food: String(f.food || '').trim().slice(0, 120),
        notes: String(f.notes || '').trim().slice(0, 300),
      }));
  }
  await booking.save();
  await broadcastCareBooking(booking._id, 'update');
  res.json({ success: true, message: 'Intake updated', data: booking });
});

/**
 * @desc    Facility: add incident log entry
 * @route   POST /api/v1/care-bookings/:id/incidents
 * @access  Private / hostel_owner (and assignedPartner/admin)
 * Body: { title, notes?, severity? }
 */
const addIncident = asyncHandler(async (req, res) => {
  const bookingLean = await assertFacilityAccessOrThrow({ bookingId: req.params.id, user: req.user });
  const title = req.body?.title != null ? String(req.body.title).trim().slice(0, 120) : '';
  if (!title) {
    return res.status(400).json({ success: false, message: 'title is required' });
  }
  const notes = req.body?.notes != null ? String(req.body.notes).trim().slice(0, 1000) : '';
  const severityRaw = (req.body?.severity || 'low').toString().toLowerCase();
  const severity = ['low', 'medium', 'high'].includes(severityRaw) ? severityRaw : 'low';
  const booking = await CareBooking.findById(bookingLean._id);
  booking.intake = booking.intake || {};
  booking.intake.incidents = booking.intake.incidents || [];
  booking.intake.incidents.push({ title, notes, severity, createdBy: req.user?._id || null });
  await booking.save();
  await broadcastCareBooking(booking._id, 'update');
  res.status(201).json({ success: true, message: 'Incident logged', data: booking });
});

/**
 * @desc    Facility: mark booking completed
 * @route   PATCH /api/v1/care-bookings/:id/complete
 * @access  Private / hostel_owner (and assignedPartner/admin)
 */
const markBookingCompleted = asyncHandler(async (req, res) => {
  const bookingLean = await assertFacilityAccessOrThrow({ bookingId: req.params.id, user: req.user });
  const booking = await CareBooking.findById(bookingLean._id);
  const okFrom = ['checked_in', 'confirmed', 'accepted'];
  if (!okFrom.includes(booking.status)) {
    res.status(400);
    throw new Error('Check in the guest or confirm the booking before completing');
  }
  booking.status = 'completed';
  booking.completedAt = new Date();
  await booking.save();
  await broadcastCareBooking(booking._id, 'update');
  res.json({ success: true, message: 'Marked completed', data: booking });
});

/**
 * Partner: pet arrived / notify check-in → checked_in
 * @route PATCH /api/v1/care-bookings/:id/check-in
 */
const notifyBookingCheckIn = asyncHandler(async (req, res) => {
  const bookingLean = await assertFacilityAccessOrThrow({ bookingId: req.params.id, user: req.user });
  const booking = await CareBooking.findById(bookingLean._id);
  if (!['confirmed', 'accepted'].includes(booking.status)) {
    res.status(400);
    throw new Error('Confirm the booking before check-in');
  }
  booking.status = 'checked_in';
  booking.checkedInAt = new Date();
  await booking.save();
  await broadcastCareBooking(booking._id, 'update');
  await Notification.create({
    user: booking.userId,
    title: 'Pet checked in',
    message: `Your pet is checked in at ${bookingLean.hostelId?.name || 'the care centre'}.`,
    type: 'care_booking',
    careBooking: booking._id,
  });
  res.json({ success: true, message: 'Checked in', data: booking });
});

/**
 * @desc    Facility: upcoming agenda + check-ins/outs in range
 * @route   GET /api/v1/care-bookings/owner/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * @access  Private / hostel_owner
 */
const getOwnerCalendar = asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return res.status(400).json({ success: false, message: 'from and to are required (YYYY-MM-DD)' });
  }
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const hostels = await Hostel.find({ ownerId: req.user._id }).select('_id name').lean();
  const hostelIds = hostels.map((h) => h._id);
  const bookings = await CareBooking.find({
    hostelId: { $in: hostelIds },
    checkIn: { $lte: end },
    checkOut: { $gte: from },
    status: {
      $in: [
        'awaiting_approval',
        'pending',
        'paid',
        'confirmed',
        'accepted',
        'checked_in',
        'completed',
      ],
    },
  })
    .populate('hostelId', 'name serviceType')
    .populate('petId', 'name breed age photoUrl')
    .populate('userId', 'name email phone profilePicture')
    .sort({ checkIn: 1 })
    .lean();

  res.json({ success: true, data: bookings });
});

/**
 * @desc    Initiate Khalti payment for care booking
 * @route   POST /api/v1/care-bookings/:id/pay
 * @access  Private
 */
const initiateCareBookingPayment = asyncHandler(async (req, res) => {
  const { initiateCareBookingKhalti } = require('./paymentController');
  const result = await initiateCareBookingKhalti({
    userId: req.user._id,
    careBookingId: req.params.id,
  });
  res.json({
    success: true,
    data: {
      paymentUrl: result.paymentUrl,
      pidx: result.pidx,
      paymentId: result.paymentId,
      amount: result.amount,
      successUrl: result.successUrl,
    },
  });
});

/**
 * Admin: assign a Care+ booking to a partner user (vet_app). Socket + DB.
 * PATCH body: { partnerId: string }
 */
const adminAssignCarePartner = asyncHandler(async (req, res) => {
  const { partnerId } = req.body || {};
  if (!partnerId) {
    return res.status(400).json({ success: false, message: 'partnerId is required' });
  }
  const partner = await User.findById(partnerId).select('role name').lean();
  if (!partner || !PARTNER_CARE_ROLES.includes(partner.role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid partner — must be a care professional role',
    });
  }

  const booking = await CareBooking.findById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  booking.assignedPartner = partnerId;
  await booking.save();

  const populated = await CareBooking.findById(booking._id)
    .populate('hostelId', 'name location serviceType')
    .populate('petId', 'name breed age photoUrl')
    .populate('userId', 'name email phone')
    .populate('assignedPartner', 'name email phone role');

  await broadcastCareBooking(booking._id, 'assigned');

  await Notification.create({
    user: partnerId,
    title: 'Care booking assigned',
    message: `You were assigned a ${booking.serviceType || 'Care'} booking (ref ${String(booking._id).slice(-6)}).`,
    type: 'care_booking',
    careBooking: booking._id,
  });

  res.json({
    success: true,
    message: 'Professional assigned',
    data: populated,
  });
});

/**
 * Admin: cancel a stuck care booking
 * PATCH /api/v1/admin/care-bookings/:id/cancel
 */
const adminCareBookingCancel = asyncHandler(async (req, res) => {
  const booking = await CareBooking.findById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }
  if (['completed', 'cancelled'].includes(booking.status)) {
    return res.status(400).json({ success: false, message: 'Booking already closed' });
  }
  booking.status = 'cancelled';
  await booking.save();
  await broadcastCareBooking(booking._id, 'update');
  await Notification.create({
    user: booking.userId,
    title: 'Care booking cancelled',
    message: 'An administrator cancelled your care centre booking.',
    type: 'care_booking',
    careBooking: booking._id,
  }).catch(() => {});
  res.json({ success: true, message: 'Booking cancelled', data: booking });
});

/**
 * Admin: move booking to another care centre (reassign listing)
 * PATCH /api/v1/admin/care-bookings/:id/reassign-centre  { hostelId }
 */
const adminCareBookingReassignCentre = asyncHandler(async (req, res) => {
  const { hostelId: newHostelId } = req.body || {};
  if (!newHostelId) {
    return res.status(400).json({ success: false, message: 'hostelId is required' });
  }
  const booking = await CareBooking.findById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }
  if (['completed', 'cancelled', 'declined'].includes(booking.status)) {
    return res.status(400).json({ success: false, message: 'Cannot reassign this booking' });
  }
  const hostel = await Hostel.findById(newHostelId).lean();
  if (!hostel) {
    return res.status(404).json({ success: false, message: 'Care centre not found' });
  }
  booking.hostelId = newHostelId;
  booking.centreId = newHostelId;
  await booking.save();

  await MarketplaceConversation.updateMany(
    { type: 'CARE', careBooking: booking._id },
    { $set: { partner: hostel.ownerId } }
  ).catch(() => {});

  const populated = await CareBooking.findById(booking._id)
    .populate('hostelId', 'name location serviceType ownerId')
    .populate('petId', 'name breed age photoUrl')
    .populate('userId', 'name email phone')
    .populate('assignedPartner', 'name email phone role')
    .lean();

  await broadcastCareBooking(booking._id, 'update');

  res.json({ success: true, message: 'Booking reassigned to new centre', data: populated });
});

/**
 * Admin: transcript for customer ↔ care centre chat
 * GET /api/v1/admin/care-bookings/:id/chat
 */
const adminGetCareBookingChat = asyncHandler(async (req, res) => {
  const conv = await MarketplaceConversation.findOne({
    type: 'CARE',
    careBooking: req.params.id,
  })
    .populate('customer', 'name email phone')
    .populate('partner', 'name email phone role')
    .lean();
  if (!conv) {
    return res.json({
      success: true,
      data: { conversation: null, messages: [] },
    });
  }
  const MarketplaceMessage = require('../models/MarketplaceMessage');
  const messages = await MarketplaceMessage.find({ conversation: conv._id })
    .sort({ createdAt: 1 })
    .limit(500)
    .populate('sender', 'name email role')
    .lean();
  res.json({
    success: true,
    data: { conversation: conv, messages },
  });
});

module.exports = {
  createCareBooking,
  getMyBookings,
  getIncomingBookings,
  respondToBooking,
  initiateCareBookingPayment,
  adminAssignCarePartner,
  adminCareBookingCancel,
  adminCareBookingReassignCentre,
  adminGetCareBookingChat,
  getOwnerCalendar,
  updateFacilityNotes,
  addExtraCharge,
  updateIntake,
  addIncident,
  markBookingCompleted,
  notifyBookingCheckIn,
};
