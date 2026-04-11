const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { sendWelcomeEmail } = require('../utils/sendEmail');

function defaultVetPlaceholderImage() {
  // Local static bundle exists in repo root (/assets/petcareimages). Frontends can map this.
  // Keep it as a relative path so it stays network-agnostic.
  return '/assets/petcareimages/vet_placeholder.png';
}

function randomPassword() {
  // 12-char URL-safe password; still hashed by User pre-save hook.
  return crypto.randomBytes(18).toString('base64url').slice(0, 12);
}

function normalizeSpecialization(v) {
  return (v || '').toString().trim();
}

function parseNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @desc    Admin creates a new veterinarian profile (managed onboarding)
 * @route   POST /api/v1/veterinarians
 * @access  Private/Admin
 *
 * Accepts multipart/form-data (optional `photo`).
 */
const adminCreateVeterinarian = asyncHandler(async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('[INFO] Initializing simplified Vet creation (Testing Mode).');

  const {
    name,
    email,
    password,
    phone,
    licenseNumber,
    specialization,
    yearsOfExperience,
    credentials,
    clinicAddress,
    lat,
    lng,
  } = req.body || {};

  if (!email) {
    res.status(400);
    throw new Error('Please provide email');
  }

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) {
    res.status(400);
    throw new Error('User already exists with this email');
  }

  const photoUrl = req.file?.path || '';
  const resolvedName =
    (name || '').toString().trim() ||
    String(email).toLowerCase().trim().split('@')[0] ||
    'Test Vet';
  const pw = (password || '').toString().trim() || randomPassword();
  const testPlaceholder = 'TEST_ACCOUNT';
  const resolvedSpecialization =
    normalizeSpecialization(specialization) || testPlaceholder;
  const resolvedLicense =
    (licenseNumber || '').toString().trim() || testPlaceholder;

  const user = await User.create({
    name: resolvedName,
    email: String(email).toLowerCase().trim(),
    password: pw,
    role: 'veterinarian',
    phone: phone ? String(phone).trim() : undefined,
    licenseNumber: resolvedLicense,
    specialization: resolvedSpecialization,
    specialty: resolvedSpecialization,
    yearsOfExperience: parseNumber(yearsOfExperience, 0),
    credentials: (credentials || '').toString().trim() || testPlaceholder,
    clinicAddress: clinicAddress ? String(clinicAddress).trim() : undefined,
    profilePicture: photoUrl || defaultVetPlaceholderImage(),
    isVerified: true,
    liveLocation: {
      coordinates: {
        lat: lat != null ? parseNumber(lat, undefined) : undefined,
        lng: lng != null ? parseNumber(lng, undefined) : undefined,
      },
      updatedAt: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log(`[SUCCESS] Credentials saved. Vet role assigned to ${user.email}.`);

  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      specialization: user.specialization,
      specialty: user.specialty,
      licenseNumber: user.licenseNumber,
      yearsOfExperience: user.yearsOfExperience,
      credentials: user.credentials,
      clinicAddress: user.clinicAddress,
      profilePicture: user.profilePicture,
      isVerified: user.isVerified,
      liveLocation: user.liveLocation,
      createdAt: user.createdAt,
    },
  });
});

/**
 * @desc    Self-registration for vets from partner app (pending approval)
 * @route   POST /api/v1/veterinarians/self-register
 * @access  Public
 *
 * Accepts multipart/form-data (optional `photo`).
 */
const selfRegisterVeterinarian = asyncHandler(async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('[INFO] Initializing New Veterinarian registration.');

  const {
    name,
    email,
    phone,
    licenseNumber,
    specialization,
    yearsOfExperience,
    credentials,
    clinicAddress,
    lat,
    lng,
  } = req.body || {};

  if (!name || !email) {
    res.status(400);
    throw new Error('Please provide name and email');
  }

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) {
    res.status(400);
    throw new Error('User already exists with this email');
  }

  const photoUrl = req.file?.path || '';
  const pw = randomPassword();

  const user = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password: pw,
    role: 'veterinarian',
    phone: phone ? String(phone).trim() : undefined,
    licenseNumber: licenseNumber ? String(licenseNumber).trim() : undefined,
    specialization: normalizeSpecialization(specialization),
    specialty: normalizeSpecialization(specialization),
    yearsOfExperience: parseNumber(yearsOfExperience, 0),
    credentials: credentials ? String(credentials).trim() : undefined,
    clinicAddress: clinicAddress ? String(clinicAddress).trim() : undefined,
    profilePicture: photoUrl || defaultVetPlaceholderImage(),
    isVerified: false,
    liveLocation: {
      coordinates: {
        lat: lat != null ? parseNumber(lat, undefined) : undefined,
        lng: lng != null ? parseNumber(lng, undefined) : undefined,
      },
      updatedAt: new Date(),
    },
  });

  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      specialization: user.specialization,
      licenseNumber: user.licenseNumber,
      yearsOfExperience: user.yearsOfExperience,
      credentials: user.credentials,
      clinicAddress: user.clinicAddress,
      profilePicture: user.profilePicture,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    },
    message:
      'Registration submitted. Your vet profile is pending verification by Admin. You can sign in via OTP after approval.',
  });
});

module.exports = {
  adminCreateVeterinarian,
  selfRegisterVeterinarian,
};

