const asyncHandler = require('express-async-handler');
const StaffLocation = require('../models/StaffLocation');
const User = require('../models/User');

/**
 * @desc    Update staff live location with 1-minute TTL cache
 * @route   POST /api/v1/location/update
 * @access  Private (Staff – non pet_owner)
 */
const updateStaffLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400);
    throw new Error('Latitude and longitude are required and must be numbers');
  }

  if (!req.user || req.user.role === 'pet_owner') {
    res.status(403);
    throw new Error('Only staff accounts can update live location');
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Persist a short-lived location record for admin map tracking
  await StaffLocation.create({
    staff: user._id,
    role: user.role,
    coordinates: { lat, lng },
  });

  // Also update the long-lived liveLocation field on the user document
  user.liveLocation = {
    coordinates: { lat, lng },
    updatedAt: new Date(),
  };
  await user.save();

  res.json({
    success: true,
    data: {
      staffId: user._id,
      role: user.role,
      coordinates: { lat, lng },
    },
  });
});

module.exports = {
  updateStaffLocation,
};

