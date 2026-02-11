const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { generateOTP, sendOTPEmail, sendWelcomeEmail } = require('../utils/sendEmail');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Register a new user (PUBLIC - pet_owner only) with OTP verification
 * @route   POST /api/v1/users
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, location } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Please provide name, email, and password');
  }

  // Validate phone number if provided
  if (phone) {
    // Remove any spaces, dashes, or special characters
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    // Check if it's exactly 10 digits
    if (!/^\d{10}$/.test(cleanPhone)) {
      res.status(400);
      throw new Error('Phone number must be exactly 10 digits');
    }

    // Check if phone number already exists
    const phoneExists = await User.findOne({ phone: cleanPhone });
    if (phoneExists) {
      res.status(400);
      throw new Error('An account with this phone number already exists. Please login instead.');
    }
  }

  // Check if user already exists with email
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('An account with this email already exists. Please login instead.');
  }

  // Generate OTP
  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // SECURITY: Public registration is ONLY for pet_owner role
  // Veterinarians and admins must be created by admin via adminCreateUser
  const user = await User.create({
    name,
    email,
    password,
    role: 'pet_owner', // Force pet_owner role for public registration
    phone: phone ? phone.replace(/[\s\-\(\)]/g, '') : undefined, // Store cleaned phone
    location,
    isVerified: false, // Requires OTP verification
    otp,
    otpExpires,
  });

  if (user) {
    // Send OTP email
    try {
      await sendOTPEmail(email, name, otp);
      
      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email for the verification code.',
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          location: user.location,
          isVerified: user.isVerified,
          // Note: No token issued until verified
        },
      });
    } catch (error) {
      // If email fails, delete the user and return error
      await user.deleteOne();
      res.status(500);
      throw new Error('Failed to send verification email. Please try again.');
    }
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

/**
 * @desc    Login user & get token
 * @route   POST /api/v1/users/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  // Find user by email
  const user = await User.findOne({ email });

  // Check if user exists and password matches
  if (user && (await user.matchPassword(password))) {
    // Check if user is verified (except for admin-created users who are auto-verified)
    if (!user.isVerified && user.role === 'pet_owner') {
      res.status(403);
      throw new Error('Please verify your email before logging in. Check your inbox for the verification code.');
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location,
        isVerified: user.isVerified,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

/**
 * @desc    Verify OTP and activate account
 * @route   POST /api/v1/users/verify-otp
 * @access  Public
 */
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  // Validate required fields
  if (!email || !otp) {
    res.status(400);
    throw new Error('Please provide email and OTP');
  }

  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if already verified
  if (user.isVerified) {
    res.status(400);
    throw new Error('Account is already verified');
  }

  // Check if OTP matches
  if (user.otp !== otp) {
    res.status(400);
    throw new Error('Invalid OTP code');
  }

  // Check if OTP has expired
  if (user.otpExpires < Date.now()) {
    res.status(400);
    throw new Error('OTP has expired. Please request a new one.');
  }

  // Verify the user
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully! You can now log in.',
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      token: generateToken(user._id),
    },
  });
});

/**
 * @desc    Update live location for staff (vet, rider, etc.)
 * @route   PATCH /api/v1/users/me/location
 * @access  Private (non-pet_owner)
 */
const updateMyLiveLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400);
    throw new Error('Latitude and longitude are required and must be numbers');
  }

  if (!req.user || ['pet_owner'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Only staff accounts can update live location');
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.liveLocation = {
    coordinates: { lat, lng },
    updatedAt: new Date(),
  };

  await user.save();

  res.json({
    success: true,
    data: {
      coordinates: user.liveLocation.coordinates,
      updatedAt: user.liveLocation.updatedAt,
    },
  });
});

/**
 * @desc    Resend OTP
 * @route   POST /api/v1/users/resend-otp
 * @access  Public
 */
const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Please provide email');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error('Account is already verified');
  }

  // Generate new OTP
  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.otp = otp;
  user.otpExpires = otpExpires;
  await user.save();

  // Send OTP email
  try {
    await sendOTPEmail(email, user.name, otp);
    
    res.json({
      success: true,
      message: 'New verification code sent to your email',
    });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to send verification email. Please try again.');
  }
});

/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
  // req.user is set by protect middleware
  const user = await User.findById(req.user._id).select('-password');

  if (user) {
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;

    // Only update password if provided
    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        token: generateToken(updatedUser._id),
      },
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });

  res.json({
    success: true,
    count: users.length,
    data: users,
  });
});

/**
 * @desc    Delete user (Admin only)
 * @route   DELETE /api/v1/users/:id
 * @access  Private/Admin
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    await user.deleteOne();
    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

/**
 * @desc    Update user role (Admin only)
 * @route   PUT /api/v1/users/:id/role
 * @access  Private/Admin
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  const validRoles = ['pet_owner', 'veterinarian', 'admin', 'shop_owner', 'care_service', 'rider'];
  if (!role || !validRoles.includes(role)) {
    res.status(400);
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  const user = await User.findById(req.params.id);

  if (user) {
    user.role = role;
    const updatedUser = await user.save();

    res.json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
      message: `User role updated to ${role}`,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

/**
 * @desc    Get dashboard stats (Admin only)
 * @route   GET /api/v1/users/admin/stats
 * @access  Private/Admin
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const Pet = require('../models/Pet');

  // Get counts
  const totalUsers = await User.countDocuments();
  const totalPets = await Pet.countDocuments();
  const totalPetOwners = await User.countDocuments({ role: 'pet_owner' });
  const totalVets = await User.countDocuments({ role: 'veterinarian' });
  const totalShopOwners = await User.countDocuments({ role: 'shop_owner' });
  const totalCareServices = await User.countDocuments({ role: 'care_service' });
  const totalRiders = await User.countDocuments({ role: 'rider' });

  // Get recent users
  const recentUsers = await User.find({})
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalPets,
        totalPetOwners,
        totalVets,
        totalShopOwners,
        totalCareServices,
        totalRiders,
      },
      recentUsers,
    },
  });
});

/**
 * @desc    Admin creates a new user (Managed Onboarding)
 * @route   POST /api/v1/users/admin/create
 * @access  Private/Admin
 */
const adminCreateUser = asyncHandler(async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    role, 
    phone, 
    location,
    // Veterinarian fields
    clinicLocation,
    specialization,
    clinicName,
    // Shop Owner fields
    shopName,
    businessLicense,
    // Care Service fields
    serviceType,
    facilityName,
    // Rider fields
    vehicleType,
    licenseNumber
  } = req.body;

  // Validate required fields
  if (!name || !email || !password || !role) {
    res.status(400);
    throw new Error('Please provide name, email, password, and role');
  }

  // Validate role
  const validRoles = ['pet_owner', 'veterinarian', 'admin', 'shop_owner', 'care_service', 'rider'];
  if (!validRoles.includes(role)) {
    res.status(400);
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  // Check if user already exists
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists with this email');
  }

  // Create user with admin-specified role
  const userData = {
    name,
    email,
    password,
    role,
    phone,
    location,
    isVerified: true, // Admin-created users are auto-verified
  };

  // Add role-specific fields
  if (role === 'veterinarian') {
    if (clinicLocation) userData.clinicLocation = clinicLocation;
    if (specialization) userData.specialization = specialization;
    if (clinicName) userData.clinicName = clinicName;
  } else if (role === 'shop_owner') {
    if (shopName) userData.shopName = shopName;
    if (businessLicense) userData.businessLicense = businessLicense;
  } else if (role === 'care_service') {
    if (serviceType) userData.serviceType = serviceType;
    if (facilityName) userData.facilityName = facilityName;
  } else if (role === 'rider') {
    if (vehicleType) userData.vehicleType = vehicleType;
    if (licenseNumber) userData.licenseNumber = licenseNumber;
  }

  const user = await User.create(userData);

  if (user) {
    // Send welcome email with credentials (optional - doesn't block response)
    try {
      await sendWelcomeEmail(email, name, role, password);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Continue anyway - email is optional
    }

    // Prepare response data based on role
    const responseData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      location: user.location,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };

    // Add role-specific fields to response
    if (role === 'veterinarian') {
      responseData.clinicLocation = user.clinicLocation;
      responseData.specialization = user.specialization;
      responseData.clinicName = user.clinicName;
    } else if (role === 'shop_owner') {
      responseData.shopName = user.shopName;
      responseData.businessLicense = user.businessLicense;
    } else if (role === 'care_service') {
      responseData.serviceType = user.serviceType;
      responseData.facilityName = user.facilityName;
    } else if (role === 'rider') {
      responseData.vehicleType = user.vehicleType;
      responseData.licenseNumber = user.licenseNumber;
    }

    res.status(201).json({
      success: true,
      data: responseData,
      message: `${role} account created successfully`,
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

/**
 * @desc    Get user by ID (Admin only)
 * @route   GET /api/v1/users/:id
 * @access  Private/Admin
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');

  if (user) {
    res.json({
      success: true,
      data: user,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

/**
 * @desc    Get user full profile with pets (Admin only)
 * @route   GET /api/v1/users/admin/:id/full-profile
 * @access  Private/Admin
 */
const getUserFullProfile = asyncHandler(async (req, res) => {
  const Pet = require('../models/Pet');

  // Get user data
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Get user's pets
  const pets = await Pet.find({ owner: req.params.id }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      user,
      pets,
      petCount: pets.length,
    },
  });
});

/**
 * @desc    Update staff professional profile (Veterinarian)
 * @route   PUT /api/v1/users/staff/profile
 * @access  Private (Veterinarian only)
 */
const updateStaffProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Only veterinarians can update staff profile
  if (user.role !== 'veterinarian') {
    res.status(403);
    throw new Error('Only veterinarians can update staff profile');
  }

  const {
    name,
    phone,
    specialty,
    specialization,
    bio,
    profilePicture,
  } = req.body;

  // Validate bio length
  if (bio && bio.length > 500) {
    res.status(400);
    throw new Error('Bio must be 500 characters or less');
  }

  // Update fields (REMOVED: clinicName, clinicAddress, workingHours - Admin only)
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (specialty) user.specialty = specialty;
  if (specialization) user.specialization = specialization;
  if (bio) user.bio = bio;
  if (profilePicture) user.profilePicture = profilePicture;

  // Check if profile is complete (simplified - no clinic/hours required)
  const isComplete = !!(
    user.name &&
    user.phone &&
    (user.specialty || user.specialization) &&
    user.bio
  );

  user.isProfileComplete = isComplete;

  const updatedUser = await user.save();

  res.json({
    success: true,
    message: isComplete ? 'Profile completed and verified!' : 'Profile updated successfully',
    data: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      specialty: updatedUser.specialty,
      specialization: updatedUser.specialization,
      bio: updatedUser.bio,
      profilePicture: updatedUser.profilePicture,
      isProfileComplete: updatedUser.isProfileComplete,
      currentShift: updatedUser.currentShift,
      isAvailable: updatedUser.isAvailable,
    },
  });
});

module.exports = {
  registerUser,
  loginUser,
  verifyOTP,
  resendOTP,
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  deleteUser,
  updateUserRole,
  getDashboardStats,
  adminCreateUser,
  getUserById,
  getUserFullProfile,
  updateStaffProfile,
  updateMyLiveLocation,
};
