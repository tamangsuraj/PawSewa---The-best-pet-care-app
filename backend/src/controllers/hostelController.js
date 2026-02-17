const asyncHandler = require('express-async-handler');
const Hostel = require('../models/Hostel');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

/**
 * @desc    List services for discovery (public: verified, active, available)
 * @route   GET /api/v1/hostels
 * @access  Public
 */
const getHostels = asyncHandler(async (req, res) => {
  const { serviceType } = req.query || {};
  const filter = {
    isVerified: true,
    isActive: true,
    isAvailable: true,
  };
  const types = ['Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'];
  if (serviceType && types.includes(serviceType)) {
    filter.serviceType = serviceType;
  }
  const hostels = await Hostel.find(filter)
    .populate('ownerId', 'name profilePicture')
    .sort({ rating: -1, createdAt: -1 })
    .lean();

  // Payment wall: only show hostels whose owner has active subscription
  const activeSubs = await Subscription.find({
    status: 'active',
    validUntil: { $gt: new Date() },
    providerId: { $in: hostels.map((h) => h.ownerId?._id || h.ownerId) },
  }).lean();
  const subscribedOwnerIds = new Set(
    activeSubs.map((s) => s.providerId.toString())
  );
  const featuredIds = new Set(
    activeSubs.filter((s) => Subscription.getPlanConfig(s.plan).isFeatured).map((s) => s.providerId.toString())
  );

  const data = hostels
    .filter((h) => subscribedOwnerIds.has(String(h.ownerId?._id || h.ownerId)))
    .map((h) => ({
      ...h,
      isFeatured: featuredIds.has(String(h.ownerId?._id || h.ownerId)),
    }));

  res.json({
    success: true,
    data,
  });
});

/**
 * @desc    Get single hostel by ID
 * @route   GET /api/v1/hostels/:id
 * @access  Public
 */
const getHostelById = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id)
    .populate('ownerId', 'name profilePicture phone');
  if (!hostel) {
    res.status(404);
    throw new Error('Hostel not found');
  }
  res.json({
    success: true,
    data: hostel,
  });
});

/**
 * @desc    Create hostel (hostel owner / service provider)
 * @route   POST /api/v1/hostels
 * @access  Private
 */
const createHostel = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const providerRoles = ['hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner', 'admin'];
  if (!providerRoles.includes(req.user.role)) {
    res.status(403);
    throw new Error('Only providers can create services');
  }
  const ownerId = req.user.role === 'admin' ? (body.ownerId || req.user._id) : req.user._id;

  let sub = null;
  if (req.user.role !== 'admin') {
    sub = await Subscription.findOne({
      providerId: ownerId,
      status: 'active',
      validUntil: { $gt: new Date() },
    }).lean();
    if (!sub) {
      res.status(403);
      throw new Error('Active subscription required. Please subscribe to list your service.');
    }
    const config = Subscription.getPlanConfig(sub.plan);
    const count = await Hostel.countDocuments({ ownerId });
    if (config.maxListings >= 0 && count >= config.maxListings) {
      res.status(403);
      throw new Error(`You have reached the maximum of ${config.maxListings} listings for your plan. Upgrade to Premium for unlimited.`);
    }
    const images = Array.isArray(body.images) ? body.images : [];
    if (config.maxPhotos >= 0 && images.length > config.maxPhotos) {
      res.status(400);
      throw new Error(`Basic plan allows max ${config.maxPhotos} photos. Upgrade for unlimited.`);
    }
  }

  const images = Array.isArray(body.images) ? body.images : [];
  const hostel = await Hostel.create({
    ownerId,
    name: body.name || 'Untitled Hostel',
    description: body.description,
    location: body.location,
    pricePerNight: Number(body.pricePerNight) || 0,
    pricePerSession: body.pricePerSession != null ? Number(body.pricePerSession) : undefined,
    images,
    amenities: Array.isArray(body.amenities) ? body.amenities : [],
    roomTypes: Array.isArray(body.roomTypes) ? body.roomTypes : [],
    schedule: Array.isArray(body.schedule) ? body.schedule : [],
    serviceType: body.serviceType || 'Hostel',
    isActive: req.user.role === 'admin' ? true : Boolean(sub),
  });
  res.status(201).json({
    success: true,
    message: 'Hostel created successfully',
    data: hostel,
  });
});

/**
 * @desc    Update hostel (owner or admin)
 * @route   PATCH /api/v1/hostels/:id
 * @access  Private
 */
const updateHostel = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id);
  if (!hostel) {
    res.status(404);
    throw new Error('Hostel not found');
  }
  const isAdmin = req.user.role === 'admin';
  const isOwner = hostel.ownerId.toString() === req.user._id.toString();
  if (!isAdmin && !isOwner) {
    res.status(403);
    throw new Error('Not authorized to update this hostel');
  }
  const body = req.body || {};
  const updates = {};
  if (body.name != null) updates.name = body.name;
  if (body.description != null) updates.description = body.description;
  if (body.location != null) updates.location = body.location;
  if (body.pricePerNight != null) updates.pricePerNight = Number(body.pricePerNight);
  if (Array.isArray(body.images)) updates.images = body.images;
  if (Array.isArray(body.amenities)) updates.amenities = body.amenities;
  if (Array.isArray(body.roomTypes)) updates.roomTypes = body.roomTypes;
  if (Array.isArray(body.schedule)) updates.schedule = body.schedule;
  if (body.serviceType != null) updates.serviceType = body.serviceType;
  if (body.pricePerSession != null) updates.pricePerSession = Number(body.pricePerSession);
  if (isAdmin && body.isVerified != null) updates.isVerified = Boolean(body.isVerified);
  if (isOwner && body.isAvailable != null) updates.isAvailable = Boolean(body.isAvailable);

  Object.assign(hostel, updates);
  await hostel.save();

  res.json({
    success: true,
    message: 'Hostel updated successfully',
    data: hostel,
  });
});

/**
 * @desc    Verify hostel (admin only)
 * @route   PATCH /api/v1/hostels/:id/verify
 * @access  Private / admin
 */
const verifyHostel = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findByIdAndUpdate(
    req.params.id,
    { isVerified: true },
    { new: true }
  );
  if (!hostel) {
    res.status(404);
    throw new Error('Hostel not found');
  }
  res.json({
    success: true,
    message: 'Hostel verified successfully',
    data: hostel,
  });
});

/**
 * @desc    Get my hostels (owner)
 * @route   GET /api/v1/hostels/my/list
 * @access  Private / hostel_owner
 */
const getMyHostels = asyncHandler(async (req, res) => {
  const hostels = await Hostel.find({ ownerId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({
    success: true,
    data: hostels,
  });
});

/**
 * @desc    Toggle service availability (provider)
 * @route   PATCH /api/v1/hostels/:id/availability
 * @access  Private
 */
const toggleAvailability = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id);
  if (!hostel) {
    res.status(404);
    throw new Error('Service not found');
  }
  if (hostel.ownerId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized');
  }
  hostel.isAvailable = !hostel.isAvailable;
  await hostel.save();
  res.json({
    success: true,
    message: hostel.isAvailable ? 'Service is now available' : 'Service is now unavailable',
    data: hostel,
  });
});

module.exports = {
  getHostels,
  getHostelById,
  createHostel,
  updateHostel,
  verifyHostel,
  getMyHostels,
  toggleAvailability,
};
