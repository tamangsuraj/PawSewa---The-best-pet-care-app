const ServiceRequest = require('../models/ServiceRequest');
const ServiceRequestMessage = require('../models/ServiceRequestMessage');
const Chat = require('../models/Chat');
const Pet = require('../models/Pet');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const { notifyServiceRequestAssignment } = require('../utils/notificationService');
const { SERVICE_REQUEST_STATUS } = require('../constants/serviceRequestStatus');
const { getIO } = require('../sockets/socketStore');

function emitStatusChange(requestId, status, ownerId, previousStatus) {
  const io = getIO();
  if (!io) return;
  const payload = { requestId, status, previousStatus };
  io.to('request:' + requestId).emit('status_change', payload);
  if (ownerId) {
    io.to('user:' + ownerId.toString()).emit('status_change', payload);
  }
}

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
  const userAgent = req.headers['user-agent'] || 'unknown';
  console.log('New Request from', userAgent + ':', JSON.stringify(req.body || {}, null, 2));
  console.log('Incoming Request Body:', JSON.stringify(req.body || {}, null, 2));

  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const body = req.body || {};
    // Accept both camelCase (petId) and snake_case (pet_id) for compatibility
    const petId = body.petId ?? body.pet_id;
    const serviceType = body.serviceType ?? body.service_type;
    const preferredDate = body.preferredDate ?? body.preferred_date;
    const timeWindow = body.timeWindow ?? body.time_window;
    const notes = body.notes;
    const locationRaw = body.location;
    const paymentMethod = (body.paymentMethod ?? body.payment_method) === 'cash_on_delivery' ? 'cash_on_delivery' : 'online';

    // Validate required fields
    if (!petId || !serviceType || !preferredDate || !timeWindow) {
      return res.status(400).json({
        success: false,
        message: 'Please provide pet, service type, preferred date, and time window',
      });
    }

    // Accept location as: { address, coordinates: { lat, lng } } OR { address, coordinates: { latitude, longitude } }
    if (!locationRaw || typeof locationRaw !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid service location with address and coordinates',
      });
    }
    const address = locationRaw.address != null ? String(locationRaw.address) : null;
    const coords = locationRaw.coordinates && typeof locationRaw.coordinates === 'object' ? locationRaw.coordinates : null;
    if (!address || !coords) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid service location with address and coordinates',
      });
    }
    const lat = Number(coords.lat ?? coords.latitude);
    const lng = Number(coords.lng ?? coords.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates must be valid numbers (use lat/lng or latitude/longitude)',
      });
    }
    const location = {
      address,
      coordinates: { lat, lng },
    };

    // Verify pet belongs to user (petId may be string; Mongoose accepts it)
    let pet;
    try {
      pet = await Pet.findById(petId);
    } catch (castErr) {
      if (castErr.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid pet id format' });
      }
      throw castErr;
    }
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }

    if (pet.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only create service requests for your own pets' });
    }

    // Validate date is in the future
    const requestDate = new Date(preferredDate);
    if (Number.isNaN(requestDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid preferred date format (use YYYY-MM-DD)' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestDate < today) {
      return res.status(400).json({ success: false, message: 'Preferred date must be in the future' });
    }

    // Create service request (pre-save middleware will check for duplicates)
    const createPayload = {
      user: req.user._id,
      pet: petId,
      petPawId: pet.pawId || undefined,
      serviceType: String(serviceType),
      preferredDate: requestDate,
      timeWindow: String(timeWindow),
      location,
      status: SERVICE_REQUEST_STATUS.PENDING,
      paymentMethod,
    };
    if (notes != null && notes !== '') {
      createPayload.notes = String(notes);
    }
    const serviceRequest = await ServiceRequest.create(createPayload);

    // Populate pet and user data (pet.photoUrl is the schema field; UIs may use image as alias)
    const populatedRequest = await ServiceRequest.findById(serviceRequest._id)
      .populate('user', 'name email phone')
      .populate('pet', 'name breed age photoUrl pawId');

    console.log('[POST /service-requests] Created request', serviceRequest._id, 'status:', serviceRequest.status, 'user:', req.user._id);

    res.status(201).json({
      success: true,
      message: 'Status: Pending Review. We will notify you once a professional is assigned.',
      data: populatedRequest,
    });
  } catch (error) {
    console.error('[POST /service-requests] error:', error?.message ?? error);
    console.error('[POST /service-requests] stack:', error?.stack);

    // Pre-save middleware or our validation: return 400 with message
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    // Mongoose validation/cast errors → 400 (descriptive Bad Request instead of 500)
    if (error.name === 'ValidationError') {
      const message = error.message || 'Validation failed';
      return res.status(400).json({ success: false, message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data format (e.g. pet id or date)',
      });
    }
    // Unexpected errors still return 500 but are now visible in terminal
    return res.status(500).json({
      success: false,
      message: 'Could not create service request. Please try again.',
    });
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
    .populate('pet', 'name breed age photoUrl pawId')
    .populate('assignedStaff', 'name email phone specialty specialization')
    .sort({ createdAt: -1 });

  console.log('Admin fetching orders:', requests.length, { status: filter.status, serviceType: filter.serviceType, date: filter.preferredDate ? 'set' : 'any' });

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
    .populate('pet', 'name breed age photoUrl pawId')
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
  // Staff app (vet) sees only "Confirmed" appointments: paymentStatus='paid'.
  // Vets only see tasks once pet owner has completed Khalti payment.
  const requests = await ServiceRequest.find({
    assignedStaff: req.user._id,
    paymentStatus: 'paid',
    status: {
      $in: [
        SERVICE_REQUEST_STATUS.ASSIGNED,
        SERVICE_REQUEST_STATUS.IN_PROGRESS,
        SERVICE_REQUEST_STATUS.COMPLETED,
      ],
    },
  })
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age photoUrl medicalHistory species pawId')
    .populate('assignedStaff', 'name email phone specialty specialization')
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
    .populate('pet', 'name breed age photoUrl pawId')
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

  // Require online payment before assign only when payment method is online; cash on delivery can be assigned without pre-payment (customer pays vet later)
  const isCashOnDelivery = request.paymentMethod === 'cash_on_delivery';
  if (!isCashOnDelivery && request.paymentStatus !== 'paid') {
    res.status(400);
    throw new Error('Service fee must be paid by the pet owner before a vet can be assigned. Ask the customer to complete Khalti payment first.');
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

  // Auto-create chat room for this service request (customer + assigned staff)
  try {
    await Chat.findOneAndUpdate(
      { serviceRequest: request._id },
      {
        $setOnInsert: {
          participants: [request.user, staffId],
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[assignServiceRequest] chat upsert failed:', err?.message || err);
  }

  // Populate for response
  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email')
    .populate('pet', 'name breed age photoUrl')
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

  emitStatusChange(request._id.toString(), 'assigned', ownerId?.toString?.() || ownerId, 'pending');

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

  const previousStatus = request.status;
  request.status = 'in_progress';
  await request.save();

  emitStatusChange(request._id.toString(), 'in_progress', request.user?.toString?.() || request.user, previousStatus);

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age photoUrl');

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

  emitStatusChange(request._id.toString(), 'completed', request.user?.toString?.() || request.user, 'in_progress');

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age photoUrl medicalHistory species pawId');

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

  emitStatusChange(request._id.toString(), status, request.user?.toString?.() || request.user, current);

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age photoUrl medicalHistory species pawId')
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

  const previousStatus = request.status;
  request.status = 'cancelled';
  request.cancelledAt = new Date();
  if (reason) {
    request.cancellationReason = reason;
  }

  await request.save();

  emitStatusChange(request._id.toString(), 'cancelled', request.user?.toString?.() || request.user, previousStatus);

  const updatedRequest = await ServiceRequest.findById(request._id)
    .populate('user', 'name email phone')
    .populate('pet', 'name breed age photoUrl pawId');

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

/**
 * @desc    Get chat messages for a service request (owner, assigned staff, or admin)
 * @route   GET /api/v1/service-requests/:id/messages
 * @access  Private
 */
const getRequestMessages = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id).select('user assignedStaff').lean();
  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }
  const uid = req.user._id.toString();
  const isOwner = request.user?.toString() === uid;
  const isStaff = request.assignedStaff?.toString() === uid;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isStaff && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to view messages for this request');
  }
  const messages = await ServiceRequestMessage.find({ serviceRequest: req.params.id })
    .populate('sender', 'name')
    .sort({ createdAt: 1 })
    .lean();
  res.json({ success: true, data: messages });
});

/**
 * @desc    Submit review for a completed service request (owner only)
 * @route   POST /api/v1/service-requests/:id/review
 * @access  Private (Owner)
 */
const submitReview = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id);
  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }
  if (request.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Only the request owner can submit a review');
  }
  if (request.status !== 'completed') {
    res.status(400);
    throw new Error('Can only review completed requests');
  }
  if (request.review?.submittedAt) {
    res.status(400);
    throw new Error('Review already submitted');
  }
  const { rating, comment } = req.body || {};
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    res.status(400);
    throw new Error('Rating must be a number between 1 and 5');
  }
  request.review = {
    rating,
    comment: typeof comment === 'string' ? comment.trim() : '',
    submittedAt: new Date(),
  };
  await request.save();
  res.json({
    success: true,
    message: 'Thank you for your review!',
    data: { review: request.review },
  });
});

/**
 * @desc    Get prescription URL for a completed request (owner, staff, or admin)
 * @route   GET /api/v1/service-requests/:id/prescription
 * @access  Private
 */
const getPrescription = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id).select('user assignedStaff status prescriptionUrl').lean();
  if (!request) {
    res.status(404);
    throw new Error('Service request not found');
  }
  const uid = req.user._id.toString();
  const isOwner = request.user?.toString() === uid;
  const isStaff = request.assignedStaff?.toString() === uid;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isStaff && !isAdmin) {
    res.status(403);
    throw new Error('Not authorized to view prescription for this request');
  }
  const url = request.prescriptionUrl || null;
  res.json({ success: true, data: { prescriptionUrl: url } });
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
  getRequestMessages,
  submitReview,
  getPrescription,
};
