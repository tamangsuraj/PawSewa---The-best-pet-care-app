const ServiceRequest = require('../models/ServiceRequest');
const Pet = require('../models/Pet');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Create a new service request
 * @route   POST /api/v1/service-requests
 * @access  Private (Pet Owner)
 */
const createServiceRequest = asyncHandler(async (req, res) => {
  const { petId, serviceType, preferredDate, timeWindow, notes } = req.body;

  // Validate required fields
  if (!petId || !serviceType || !preferredDate || !timeWindow) {
    res.status(400);
    throw new Error('Please provide pet, service type, preferred date, and time window');
  }

  // Verify pet belongs to user
  const pet = await Pet.findById(petId);
  if (!pet) {
    res.status(404);
    throw new Error('Pet not found');
  }

  if (pet.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only create service requests for your own pets');
  }

  // Validate date is in the future
  const requestDate = new Date(preferredDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (requestDate < today) {
    res.status(400);
    throw new Error('Preferred date must be in the future');
  }

  try {
    // Create service request (pre-save middleware will check for duplicates)
    const serviceRequest = await ServiceRequest.create({
      user: req.user._id,
      pet: petId,
      serviceType,
      preferredDate: requestDate,
      timeWindow,
      notes,
      status: 'pending',
    });

    // Populate pet and user data
    const populatedRequest = await ServiceRequest.findById(serviceRequest._id)
      .populate('user', 'name email phone')
      .populate('pet', 'name breed age image');

    res.status(201).json({
      success: true,
      message: 'Status: Pending Review. We will notify you once a professional is assigned.',
      data: populatedRequest,
    });
  } catch (error) {
    // Handle duplicate request error from pre-save middleware
    if (error.statusCode === 400) {
      res.status(400);
      throw new Error(error.message);
    }
    throw error;
  }
});

/**
 * @desc    Get all service requests (Admin)
 * @route   GET /api/v1/service-requests
 * @access  Private/Admin
 */
const getAllServiceRequests = asyncHandler(async (req, res) => {
  const { status, serviceType, date } = req.query;

  const filter = {};
  
  if (status) {
    filter.status = status;
  }
  
  if (serviceType) {
    filter.serviceType = serviceType;
  }
  
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    filter.preferredDate = {
      $gte: startOfDay,
      $lte: endOfDay,
    };
  }

  const requests = await ServiceRequest.find(filter)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image')
    .populate('assignedStaff', 'name email phone specialty specialization')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: requests.length,
    data: requests,
  });
});

/**
 * @desc    Get my service requests (Customer)
 * @route   GET /api/v1/service-requests/my/requests
 * @access  Private (Pet Owner)
 */
const getMyServiceRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const filter = { user: req.user._id };
  
  if (status) {
    filter.status = status;
  }

  const requests = await ServiceRequest.find(filter)
    .populate('pet', 'name breed age image')
    .populate('assignedStaff', 'name phone specialty specialization')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: requests.length,
    data: requests,
  });
});

/**
 * @desc    Get my assigned service requests (Staff)
 * @route   GET /api/v1/service-requests/my/assignments
 * @access  Private (Staff)
 */
const getMyAssignedRequests = asyncHandler(async (req, res) => {
  const requests = await ServiceRequest.find({
    assignedStaff: req.user._id,
    status: { $in: ['assigned', 'in_progress'] },
  })
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image')
    .sort({ preferredDate: 1 });

  res.json({
    success: true,
    count: requests.length,
    data: requests,
  });
});

/**
 * @desc    Get service request by ID
 * @route   GET /api/v1/service-requests/:id
 * @access  Private
 */
const getServiceRequestById = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image')
    .populate('assignedStaff', 'name email phone specialty specialization');

  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }

  // Check authorization
  const isOwner = request.user._id.toString() === req.user._id.toString();
  const isAssignedStaff = request.assignedStaff && request.assignedStaff._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAssignedStaff && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to view this service request');
  }

  res.json({
    success: true,
    data: request,
  });
});

/**
 * @desc    Assign service request to staff (Admin)
 * @route   PATCH /api/v1/service-requests/:id/assign
 * @access  Private/Admin
 */
const assignServiceRequest = asyncHandler(async (req, res) => {
  const { staffId } = req.body;

  if (!staffId) {
    res.status(400);
    throw new Error('Please provide staff ID');
  }

  // Verify staff exists and is a veterinarian
  const staff = await User.findById(staffId);
  if (!staff || staff.role !== 'veterinarian') {
    res.status(404);
    throw new Error('Staff member not found');
  }

  // Find service request
  const request = await ServiceRequest.findById(req.params.id);
  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }

  // Update request
  request.assignedStaff = staffId;
  request.status = 'assigned';
  request.assignedAt = new Date();

  await request.save();

  // Populate and return
  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image')
    .populate('assignedStaff', 'name email phone specialty specialization');

  res.json({
    success: true,
    message: `Service request assigned to ${staff.name}`,
    data: updatedRequest,
  });
});

/**
 * @desc    Start service request (Staff)
 * @route   PATCH /api/v1/service-requests/:id/start
 * @access  Private (Staff)
 */
const startServiceRequest = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }

  // Verify staff is assigned to this request
  if (!request.assignedStaff || request.assignedStaff.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You are not assigned to this service request');
  }

  if (request.status !== 'assigned') {
    res.status(400);
    throw new Error('Service request must be in assigned status to start');
  }

  request.status = 'in_progress';
  await request.save();

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image');

  res.json({
    success: true,
    message: 'Service request started',
    data: updatedRequest,
  });
});

/**
 * @desc    Complete service request (Staff)
 * @route   PATCH /api/v1/service-requests/:id/complete
 * @access  Private (Staff)
 */
const completeServiceRequest = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  const request = await ServiceRequest.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }

  // Verify staff is assigned to this request
  if (!request.assignedStaff || request.assignedStaff.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You are not assigned to this service request');
  }

  request.status = 'completed';
  request.completedAt = new Date();
  if (notes) {
    request.notes = notes;
  }

  await request.save();

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image');

  res.json({
    success: true,
    message: 'Service request completed successfully',
    data: updatedRequest,
  });
});

/**
 * @desc    Cancel service request (Customer or Admin)
 * @route   PATCH /api/v1/service-requests/:id/cancel
 * @access  Private
 */
const cancelServiceRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const request = await ServiceRequest.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }

  // Check authorization
  const isOwner = request.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to cancel this service request');
  }

  if (request.status === 'completed' || request.status === 'cancelled') {
    res.status(400);
    throw new Error('Cannot cancel a completed or already cancelled service request');
  }

  request.status = 'cancelled';
  request.cancelledAt = new Date();
  if (reason) {
    request.cancellationReason = reason;
  }

  await request.save();

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image');

  res.json({
    success: true,
    message: 'Service request cancelled',
    data: updatedRequest,
  });
});

/**
 * @desc    Get service request statistics (Admin)
 * @route   GET /api/v1/service-requests/stats
 * @access  Private/Admin
 */
const getServiceRequestStats = asyncHandler(async (req, res) => {
  const totalRequests = await ServiceRequest.countDocuments();
  const pendingRequests = await ServiceRequest.countDocuments({ status: 'pending' });
  const assignedRequests = await ServiceRequest.countDocuments({ status: 'assigned' });
  const inProgressRequests = await ServiceRequest.countDocuments({ status: 'in_progress' });
  const completedRequests = await ServiceRequest.countDocuments({ status: 'completed' });
  const cancelledRequests = await ServiceRequest.countDocuments({ status: 'cancelled' });

  // Get requests by service type
  const appointmentCount = await ServiceRequest.countDocuments({ serviceType: 'Appointment' });
  const healthCheckupCount = await ServiceRequest.countDocuments({ serviceType: 'Health Checkup' });
  const vaccinationCount = await ServiceRequest.countDocuments({ serviceType: 'Vaccination' });

  res.json({
    success: true,
    data: {
      total: totalRequests,
      byStatus: {
        pending: pendingRequests,
        assigned: assignedRequests,
        inProgress: inProgressRequests,
        completed: completedRequests,
        cancelled: cancelledRequests,
      },
      byServiceType: {
        appointment: appointmentCount,
        healthCheckup: healthCheckupCount,
        vaccination: vaccinationCount,
      },
    },
  });
});

module.exports = {
  createServiceRequest,
  getAllServiceRequests,
  getMyServiceRequests,
  getMyAssignedRequests,
  getServiceRequestById,
  assignServiceRequest,
  startServiceRequest,
  completeServiceRequest,
  cancelServiceRequest,
  getServiceRequestStats,
};
