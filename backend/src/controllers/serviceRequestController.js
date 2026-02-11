const ServiceRequest = require('../models/ServiceRequest');
const Pet = require('../models/Pet');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const { notifyServiceRequestAssignment } = require('../utils/notificationService');

// Simple Nominatim-based validator for Kathmandu addresses.
// NOTE: This is best-effort only – if the service is unavailable, we don't block the request.
async function validateKathmanduAddressWithNominatim({ address, lat, lng }) {
  try {
    if (!address || typeof lat !== 'number' || typeof lng !== 'number') {
      return;
    }

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('zoom', '16');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'PawSewa/1.0 (Kathmandu Vet Services)',
      },
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const addr = data.address || {};

    const isKathmandu =
      addr.city === 'Kathmandu' ||
      addr.town === 'Kathmandu' ||
      addr.county === 'Kathmandu' ||
      addr.state === 'Bagmati Province';

    if (!isKathmandu) {
      const error = new Error('Service address must be within Kathmandu (verified via OpenStreetMap).');
      error.statusCode = 400;
      throw error;
    }
  } catch (err) {
    // Swallow network / parsing errors – we still rely on coordinate geofence below.
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Nominatim validation failed:', err.message || err);
    }
  }
}

/**
 * @desc    Create a new service request
 * @route   POST /api/v1/service-requests
 * @access  Private (Pet Owner)
 */
const createServiceRequest = asyncHandler(async (req, res) => {
  const { petId, serviceType, preferredDate, timeWindow, notes, location } = req.body;

  // Validate required fields
  if (!petId || !serviceType || !preferredDate || !timeWindow) {
    res.status(400);
    throw new Error('Please provide pet, service type, preferred date, and time window');
  }

  if (
    !location ||
    !location.address ||
    !location.coordinates ||
    typeof location.coordinates.lat !== 'number' ||
    typeof location.coordinates.lng !== 'number'
  ) {
    res.status(400);
    throw new Error('Please provide a valid service location with coordinates');
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
      location,
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
    .populate('pet', 'name breed age image medicalHistory species')
    .sort({ preferredDate: 1 });

  res.json({
    success: true,
    count: requests.length,
    data: requests,
  });
});

/**
 * @desc    Live tracking data for a service request (with privacy rules)
 * @route   GET /api/v1/service-requests/:id/live
 * @access  Private (owner, assigned staff, or admin)
 */
const getServiceRequestLive = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id)
    .populate('user', 'name role')
    .populate('assignedStaff', 'name role profilePicture liveLocation');

  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }

  const viewer = req.user;
  const isOwner = viewer && request.user && request.user._id.toString() === viewer._id.toString();
  const isAssignedStaff =
    viewer &&
    request.assignedStaff &&
    request.assignedStaff._id.toString() === viewer._id.toString();
  const isAdmin = viewer && viewer.role === 'admin';

  if (!isOwner && !isAssignedStaff && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to view this tracking data');
  }

  let staffLocation = null;

  if (request.assignedStaff && request.assignedStaff.liveLocation) {
    const { coordinates, updatedAt } = request.assignedStaff.liveLocation;
    const staffRole = request.assignedStaff.role;

    if (isAssignedStaff || isAdmin) {
      // Staff and admins can always see staff live location
      staffLocation = { coordinates, updatedAt, role: staffRole };
    } else if (isOwner) {
      // Customer privacy rules (role-based)
      if (staffRole === 'rider') {
        // Riders: customer can see live location
        staffLocation = { coordinates, updatedAt, role: staffRole };
      } else if (staffRole === 'veterinarian') {
        // Veterinarians: hide live location from customer
        staffLocation = null;
      } else {
        // Other roles – default to hiding unless explicitly allowed
        staffLocation = null;
      }
    }
  }

  res.json({
    success: true,
    data: {
      serviceRequest: {
        _id: request._id,
        serviceType: request.serviceType,
        status: request.status,
        location: request.location,
        assignedStaff: request.assignedStaff
          ? {
              _id: request.assignedStaff._id,
              name: request.assignedStaff.name,
              role: request.assignedStaff.role,
              profilePicture: request.assignedStaff.profilePicture,
            }
          : null,
      },
      staffLocation,
    },
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
  const { staffId, scheduledTime } = req.body;

  if (!staffId || !scheduledTime) {
    res.status(400);
    throw new Error('Please provide staffId and scheduledTime');
  }

  // Verify staff exists and is a veterinarian
  const staff = await User.findById(staffId);
  if (!staff || staff.role !== 'veterinarian') {
    res.status(404);
    throw new Error('Staff member not found');
  }

  const scheduledDate = new Date(scheduledTime);
  if (Number.isNaN(scheduledDate.getTime())) {
    res.status(400);
    throw new Error('Invalid scheduledTime format');
  }

  // Find service request
  const request = await ServiceRequest.findById(req.params.id).populate('user', 'name email');
  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }

  // Prevent assigning if already completed/cancelled
  if (['completed', 'cancelled'].includes(request.status)) {
    res.status(400);
    throw new Error('Cannot assign a completed or cancelled request');
  }

  // Conflict check: prevent double booking for this staff within +/- 1 hour of scheduledTime
  const slotStart = new Date(scheduledDate.getTime() - 60 * 60 * 1000);
  const slotEnd = new Date(scheduledDate.getTime() + 60 * 60 * 1000);

  const existingAtSlot = await ServiceRequest.findOne({
    _id: { $ne: request._id },
    assignedStaff: staffId,
    scheduledTime: {
      $gte: slotStart,
      $lte: slotEnd,
    },
    status: { $in: ['assigned', 'in_progress'] },
  });

  if (existingAtSlot) {
    res.status(400);
    throw new Error('This staff member already has a request at the selected time.');
  }

  // Update request
  request.assignedStaff = staffId;
  request.status = 'assigned';
  request.assignedAt = new Date();
  request.scheduledTime = scheduledDate;

  await request.save();

  // Populate for response
  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email')
    .populate('pet', 'name breed age image')
    .populate('assignedStaff', 'name email phone specialty specialization profilePicture');

  const ownerId = request.user;
  const petName = (updatedRequest.pet && updatedRequest.pet.name) || 'your pet';
  const serviceType = updatedRequest.serviceType || 'Service';
  const scheduledLabel = scheduledDate.toISOString();

  await notifyServiceRequestAssignment({
    ownerId,
    staffId,
    serviceRequestId: request._id,
    petName,
    serviceType,
    scheduledTimeLabel: scheduledLabel,
    staffName: staff.name,
  });

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
  const { notes, visitNotes } = req.body;

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

  // Maintain legacy notes field while supporting dedicated visitNotes
  if (notes) {
    request.notes = notes;
  }
  if (visitNotes) {
    request.visitNotes = visitNotes;
  }

  await request.save();

  // Push visit notes into the pet's longitudinal medical history
  try {
    const pet = await Pet.findById(request.pet);
    if (pet) {
      const noteText =
        visitNotes ||
        notes ||
        `Visit completed on ${new Date().toISOString()} for service ${request.serviceType}`;

      pet.medicalHistory = pet.medicalHistory || [];
      pet.medicalHistory.push(noteText);
      await pet.save();
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Failed to push visit notes to pet history:', err.message || err);
    }
  }

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image medicalHistory species');

  res.json({
    success: true,
    message: 'Service request completed successfully',
    data: updatedRequest,
  });
});

/**
 * @desc    Generic status update for service requests (Staff execution flow)
 * @route   PATCH /api/v1/service-requests/status/:id
 * @access  Private (Staff, Admin)
 */
const updateServiceRequestStatus = asyncHandler(async (req, res) => {
  const { status, visitNotes, reason } = req.body;

  if (!status) {
    res.status(400);
    throw new Error('Status is required');
  }

  const allowedStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  const request = await ServiceRequest.findById(req.params.id);

  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }

  const isAssignedStaff =
    request.assignedStaff && request.assignedStaff.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isAssignedStaff && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to update this service request');
  }

  // Enforce valid transitions
  const current = request.status;

  if (current === 'completed' || current === 'cancelled') {
    res.status(400);
    throw new Error('Cannot change status of a completed or cancelled request');
  }

  if (current === 'assigned' && !['in_progress', 'cancelled'].includes(status)) {
    res.status(400);
    throw new Error('Assigned requests can only move to in_progress or cancelled');
  }

  if (current === 'in_progress' && !['completed', 'cancelled'].includes(status)) {
    res.status(400);
    throw new Error('In-progress requests can only move to completed or cancelled');
  }

  // Apply transition-side effects
  if (status === 'in_progress') {
    request.status = 'in_progress';
  } else if (status === 'completed') {
    request.status = 'completed';
    request.completedAt = new Date();
    if (visitNotes) {
      request.visitNotes = visitNotes;
      request.notes = visitNotes;
    }
  } else if (status === 'cancelled') {
    request.status = 'cancelled';
    request.cancelledAt = new Date();
    if (reason) {
      request.cancellationReason = reason;
    }
  }

  await request.save();

  // If completed, also push notes into pet medical history
  if (status === 'completed') {
    try {
      const pet = await Pet.findById(request.pet);
      if (pet) {
        const noteText =
          visitNotes ||
          `Visit completed on ${new Date().toISOString()} for service ${request.serviceType}`;

        pet.medicalHistory = pet.medicalHistory || [];
        pet.medicalHistory.push(noteText);
        await pet.save();
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Failed to push visit notes to pet history (generic status):', err.message || err);
      }
    }
  }

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age image medicalHistory species')
    .populate('assignedStaff', 'name phone role');

  res.json({
    success: true,
    message: `Service request status updated to ${status}`,
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
  getServiceRequestLive,
  getServiceRequestById,
  assignServiceRequest,
  startServiceRequest,
  completeServiceRequest,
  cancelServiceRequest,
  getServiceRequestStats,
  updateServiceRequestStatus,
};
