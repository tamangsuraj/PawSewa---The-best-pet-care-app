const asyncHandler = require('express-async-handler');
const CareBooking = require('../models/CareBooking');
const Hostel = require('../models/Hostel');
const Pet = require('../models/Pet');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');

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
    petId,
    userId: req.user._id,
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
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod,
    ownerNotes: body.ownerNotes || body.notes,
    packageName: body.packageName || body.package || null,
    addOns: addOnNames.length ? addOnNames : undefined,
    serviceDelivery: body.serviceDelivery || null,
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
const getIncomingBookings = asyncHandler(async (req, res) => {
  const hostels = await Hostel.find({ ownerId: req.user._id }).select('_id').lean();
  const hostelIds = hostels.map((h) => h._id);
  const bookings = await CareBooking.find({ hostelId: { $in: hostelIds } })
    .populate('hostelId', 'name location')
    .populate('petId', 'name breed age photoUrl')
    .populate('userId', 'name email phone')
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
  if (!['pending', 'paid'].includes(booking.status)) {
    res.status(400);
    throw new Error('Booking is already accepted or rejected');
  }

  booking.status = accept ? 'accepted' : 'rejected';
  await booking.save();

  await Notification.create({
    user: booking.userId._id,
    title: accept ? 'Booking accepted' : 'Booking rejected',
    message: accept
      ? `Your booking at ${booking.hostelId.name} has been accepted.`
      : `Your booking at ${booking.hostelId.name} was declined.`,
    type: 'care_booking',
    careBooking: booking._id,
  });

  res.json({
    success: true,
    message: accept ? 'Booking accepted' : 'Booking rejected',
    data: booking,
  });
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

module.exports = {
  createCareBooking,
  getMyBookings,
  getIncomingBookings,
  respondToBooking,
  initiateCareBookingPayment,
};
