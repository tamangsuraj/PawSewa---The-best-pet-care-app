const Case = require('../models/Case');
const User = require('../models/User');
const Pet = require('../models/Pet');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Create a new case (User submits request)
 * @route   POST /api/v1/cases
 * @access  Private (Pet Owner)
 */
const createCase = asyncHandler(async (req, res) => {
  const userAgent = req.headers['user-agent'] || 'unknown';
  console.log('New Request from', userAgent + ':', JSON.stringify(req.body || {}, null, 2));

  const body = req.body || {};
  // Accept both camelCase (website) and snake_case (some clients)
  const petId = body.petId ?? body.pet_id;
  const issueDescription = body.issueDescription ?? body.issue_description;
  const location = body.location;

  if (!petId || !issueDescription || location == null || (typeof location === 'string' && location.trim() === '')) {
    return res.status(400).json({
      success: false,
      message: 'Please provide pet, issue description, and location',
    });
  }

  const pet = await Pet.findById(petId);
  if (!pet) {
    return res.status(404).json({ success: false, message: 'Pet not found' });
  }

  if (pet.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'You can only create cases for your own pets' });
  }

  const locationStr =
    typeof location === 'string'
      ? location.trim()
      : (location && typeof location === 'object' && location.address != null)
        ? String(location.address)
        : JSON.stringify(location || {});

  try {
    const newCase = await Case.create({
      customer: req.user._id,
      pet: petId,
      issueDescription: String(issueDescription),
      location: locationStr,
      status: 'pending',
    });

    const populatedCase = await Case.findById(newCase._id)
      .populate('customer', 'name email phone')
      .populate('pet', 'name breed age image');

    console.log('[POST /cases] Created case', newCase._id, 'for user', req.user._id);
    return res.status(201).json({
      success: true,
      message: 'Case submitted! Our team is assigning the best available Veterinarian to you.',
      data: populatedCase,
    });
  } catch (error) {
    console.error('[POST /cases] error:', error?.message ?? error);
    console.error('[POST /cases] stack:', error?.stack);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message || 'Validation failed' });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid data format' });
    }
    return res.status(500).json({
      success: false,
      message: 'Could not create case. Please try again.',
    });
  }
});

/**
 * @desc    Get all cases (Admin)
 * @route   GET /api/v1/cases
 * @access  Private/Admin
 */
const getAllCases = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }

  const cases = await Case.find(filter)
    .populate('customer', 'name email phone')
    .populate('pet', 'name breed age image')
    .populate('assignedVet', 'name email phone specialty specialization currentShift')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: cases.length,
    data: cases,
  });
});

/**
 * @desc    Get case by ID
 * @route   GET /api/v1/cases/:id
 * @access  Private
 */
const getCaseById = asyncHandler(async (req, res) => {
  const caseData = await Case.findById(req.params.id)
    .populate('customer', 'name email phone')
    .populate('pet', 'name breed age image')
    .populate('assignedVet', 'name email phone specialty specialization');

  if (!caseData) {
    res.status(404);
    throw new Error('Case not found');
  }

  // Check authorization
  const isCustomer = caseData.customer._id.toString() === req.user._id.toString();
  const isAssignedVet = caseData.assignedVet && caseData.assignedVet._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isCustomer && !isAssignedVet && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to view this case');
  }

  res.json({
    success: true,
    data: caseData,
  });
});

/**
 * @desc    Get my cases (Customer)
 * @route   GET /api/v1/cases/my/requests
 * @access  Private (Pet Owner)
 */
const getMyCases = asyncHandler(async (req, res) => {
  const cases = await Case.find({ customer: req.user._id })
    .populate('pet', 'name breed age image')
    .populate('assignedVet', 'name phone specialty specialization')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: cases.length,
    data: cases,
  });
});

/**
 * @desc    Get my assigned cases (Veterinarian)
 * @route   GET /api/v1/cases/my/assignments
 * @access  Private (Veterinarian)
 */
const getMyAssignments = asyncHandler(async (req, res) => {
  if (req.user.role !== 'veterinarian') {
    res.status(403);
    throw new Error('Only veterinarians can access assignments');
  }

  // Return ALL cases assigned to this vet (including completed)
  const cases = await Case.find({ 
    assignedVet: req.user._id
  })
    .populate('customer', 'name email phone')
    .populate('pet', 'name breed age image')
    .sort({ assignedAt: -1 });

  res.json({
    success: true,
    count: cases.length,
    data: cases,
  });
});

/**
 * @desc    Assign case to vet (Admin)
 * @route   PATCH /api/v1/cases/:id/assign
 * @access  Private/Admin
 */
const assignCase = asyncHandler(async (req, res) => {
  const { vetId, shift } = req.body;

  if (!vetId) {
    res.status(400);
    throw new Error('Please provide veterinarian ID');
  }

  // Verify vet exists and is a veterinarian
  const vet = await User.findById(vetId);
  if (!vet || vet.role !== 'veterinarian') {
    res.status(404);
    throw new Error('Veterinarian not found');
  }

  // Find case
  const caseData = await Case.findById(req.params.id);
  if (!caseData) {
    res.status(404);
    throw new Error('Case not found');
  }

  // Update case
  caseData.assignedVet = vetId;
  caseData.status = 'assigned';
  caseData.assignedAt = new Date();
  if (shift) {
    caseData.shift = shift;
  }

  await caseData.save();

  // Populate and return
  const updatedCase = await Case.findById(caseData._id)
    .populate('customer', 'name email phone')
    .populate('pet', 'name breed age image')
    .populate('assignedVet', 'name email phone specialty specialization currentShift');

  res.json({
    success: true,
    message: `Case assigned to Dr. ${vet.name}`,
    data: updatedCase,
  });
});

/**
 * @desc    Update vet shift (Admin)
 * @route   PATCH /api/v1/cases/vets/:id/shift
 * @access  Private/Admin
 */
const updateVetShift = asyncHandler(async (req, res) => {
  const { currentShift, isAvailable } = req.body;

  const vet = await User.findById(req.params.id);

  if (!vet || vet.role !== 'veterinarian') {
    res.status(404);
    throw new Error('Veterinarian not found');
  }

  if (currentShift !== undefined) {
    const validShifts = ['Morning', 'Evening', 'Night', 'Off'];
    if (!validShifts.includes(currentShift)) {
      res.status(400);
      throw new Error('Invalid shift. Must be Morning, Evening, Night, or Off');
    }
    vet.currentShift = currentShift;
  }

  if (isAvailable !== undefined) {
    vet.isAvailable = isAvailable;
  }

  await vet.save();

  res.json({
    success: true,
    message: 'Veterinarian shift updated',
    data: {
      _id: vet._id,
      name: vet.name,
      email: vet.email,
      currentShift: vet.currentShift,
      isAvailable: vet.isAvailable,
    },
  });
});

/**
 * @desc    Mark case as in progress (Veterinarian)
 * @route   PATCH /api/v1/cases/:id/start
 * @access  Private (Veterinarian)
 */
const startCase = asyncHandler(async (req, res) => {
  const caseData = await Case.findById(req.params.id);

  if (!caseData) {
    res.status(404);
    throw new Error('Case not found');
  }

  // Verify vet is assigned to this case
  if (!caseData.assignedVet || caseData.assignedVet.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You are not assigned to this case');
  }

  caseData.status = 'in_progress';
  await caseData.save();

  const updatedCase = await Case.findById(caseData._id)
    .populate('customer', 'name email phone')
    .populate('pet', 'name breed age image');

  res.json({
    success: true,
    message: 'Case started',
    data: updatedCase,
  });
});

/**
 * @desc    Mark case as completed (Veterinarian)
 * @route   PATCH /api/v1/cases/:id/complete
 * @access  Private (Veterinarian)
 */
const completeCase = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const caseData = await Case.findById(req.params.id);

  if (!caseData) {
    res.status(404);
    throw new Error('Case not found');
  }

  // Verify vet is assigned to this case
  if (!caseData.assignedVet || caseData.assignedVet.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You are not assigned to this case');
  }

  caseData.status = 'completed';
  caseData.completedAt = new Date();
  if (notes) {
    caseData.notes = notes;
  }

  await caseData.save();

  const updatedCase = await Case.findById(caseData._id)
    .populate('customer', 'name email phone')
    .populate('pet', 'name breed age image');

  res.json({
    success: true,
    message: 'Case completed successfully',
    data: updatedCase,
  });
});

/**
 * @desc    Get available vets (Admin - for assignment)
 * @route   GET /api/v1/cases/vets/available
 * @access  Private/Admin
 */
const getAvailableVets = asyncHandler(async (req, res) => {
  const { shift } = req.query;

  const filter = {
    role: 'veterinarian',
    isAvailable: true,
  };

  if (shift) {
    filter.currentShift = shift;
  }

  const vets = await User.find(filter)
    .select('name email phone specialty specialization currentShift isAvailable')
    .sort({ name: 1 });

  res.json({
    success: true,
    count: vets.length,
    data: vets,
  });
});

module.exports = {
  createCase,
  getAllCases,
  getCaseById,
  getMyCases,
  getMyAssignments,
  assignCase,
  updateVetShift,
  startCase,
  completeCase,
  getAvailableVets,
};
