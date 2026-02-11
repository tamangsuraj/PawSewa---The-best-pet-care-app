const asyncHandler = require('express-async-handler');
const CareRequest = require('../models/CareRequest');
const Pet = require('../models/Pet');
const StaffLocation = require('../models/StaffLocation');
const User = require('../models/User');

/**
 * @desc    Create a new Care+ request (draft, unpaid)
 * @route   POST /api/v1/care/request
 * @access  Private (Pet Owner)
 */
const createCareRequest = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const { petId, serviceType, preferredDate, notes, location } = req.body || {};

  if (!petId || !serviceType || !preferredDate || !location) {
    return res.status(400).json({
      success: false,
      message: 'Please provide petId, serviceType, preferredDate, and location',
    });
  }

  const pet = await Pet.findById(petId);
  if (!pet) {
    return res.status(404).json({ success: false, message: 'Pet not found' });
  }
  if (pet.owner.toString() !== userId.toString()) {
    return res
      .status(403)
      .json({ success: false, message: 'You can only create care requests for your own pets' });
  }

  const { address, coordinates } = location || {};
  if (!address || !coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Location must include address and coordinates [lng, lat]',
    });
  }

  const date = new Date(preferredDate);
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid preferredDate (use ISO format YYYY-MM-DD or full ISO date)',
    });
  }

  const careRequest = await CareRequest.create({
    user: userId,
    pet: petId,
    serviceType,
    preferredDate: date,
    notes: notes?.trim() || undefined,
    status: 'draft', // moves to pending_review only after payment verification
    paymentStatus: 'unpaid',
    location: {
      address,
      point: {
        type: 'Point',
        coordinates,
      },
    },
  });

  const populated = await CareRequest.findById(careRequest._id).populate(
    'pet',
    'name breed age photoUrl'
  );

  res.status(201).json({
    success: true,
    data: populated,
  });
});

/**
 * @desc    Get my Care+ requests
 * @route   GET /api/v1/care/my-requests
 * @access  Private (Pet Owner)
 */
const getMyCareRequests = asyncHandler(async (req, res) => {
  const list = await CareRequest.find({ user: req.user._id })
    .populate('pet', 'name breed age photoUrl')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: list.length,
    data: list,
  });
});

/**
 * @desc    Admin Care+ inbox (all care requests)
 * @route   GET /api/v1/care/inbox
 * @access  Private/Admin
 */
const adminGetCareInbox = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const list = await CareRequest.find(filter)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age photoUrl')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: list.length,
    data: list,
  });
});

/**
 * @desc    Assign a care provider (staff) to Care+ request
 * @route   PATCH /api/v1/care/:id/assign
 * @access  Private/Admin
 */
const adminAssignCareProvider = asyncHandler(async (req, res) => {
  const { staffId } = req.body || {};
  if (!staffId) {
    res.status(400);
    throw new Error('Please provide staffId');
  }

  const care = await CareRequest.findById(req.params.id);
  if (!care) {
    res.status(404);
    throw new Error('Care request not found');
  }

  care.assignedStaff = staffId;
  care.assignedAt = new Date();
  care.status = 'assigned';
  await care.save();

  const populated = await CareRequest.findById(care._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age photoUrl')
    .populate('assignedStaff', 'name email phone');

  res.json({
    success: true,
    data: populated,
  });
});

/**
 * @desc    Nearby available staff for a Care+ request (sorted by distance)
 * @route   GET /api/v1/care/available-staff?lat=&lng=
 * @access  Private/Admin
 */
const getAvailableCareStaff = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  const locations = await StaffLocation.find({
    role: { $in: ['care_service', 'veterinarian'] },
  }).populate('staff', 'name phone role isAvailable');

  const candidates = locations
    .filter((loc) => loc.staff && loc.staff.isAvailable)
    .map((loc) => {
      const s = loc.staff;
      let distanceKm = 0;
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        const dLat = ((loc.coordinates.lat - lat) * Math.PI) / 180;
        const dLng = ((loc.coordinates.lng - lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((loc.coordinates.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const R = 6371;
        distanceKm = R * c;
      }
      return {
        staffId: s._id.toString(),
        name: s.name,
        role: s.role,
        phone: s.phone,
        distanceKm,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({
    success: true,
    count: candidates.length,
    data: candidates,
  });
});

module.exports = {
  createCareRequest,
  getMyCareRequests,
  adminGetCareInbox,
  adminAssignCareProvider,
  getAvailableCareStaff,
};


