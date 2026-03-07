/**
 * Unified appointments API for pawsewa_production.
 * Returns appointments with populated pet name, owner name, staff, and service.
 */
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { AppointmentUnified } = require('../models/unified');
const logger = require('../utils/logger');

// POST /api/v1/appointments
// Body: { petId, vetId?, type?, preferredDate?, timeWindow?, location?, totalAmount?, description? }
// Persists into the unified appointments collection in pawsewa_production.
router.post('/', protect, async (req, res) => {
  try {
    const {
      petId,
      vetId,
      type,
      preferredDate,
      timeWindow,
      location,
      totalAmount,
      description,
    } = req.body || {};

    if (!petId) {
      return res
        .status(400)
        .json({ success: false, message: 'petId is required' });
    }

    const customerId = req.user._id;
    const staffId = vetId || undefined;

    const payload = {
      type: type || 'vet_appointment',
      customerId,
      petId,
      description: description || undefined,
    };

    if (location && typeof location === 'object') {
      payload.location = {
        address: location.address,
        coordinates: location.coordinates,
      };
    }

    if (preferredDate) {
      const d = new Date(preferredDate);
      if (!Number.isNaN(d.getTime())) {
        payload.preferredDate = d;
      }
    }

    if (timeWindow) {
      payload.timeWindow = String(timeWindow);
    }

    if (typeof totalAmount === 'number') {
      payload.totalAmount = totalAmount;
    }

    if (staffId) {
      payload.staffId = staffId;
    }

    const appointment = await AppointmentUnified.create(payload);

    logger.info('New Appointment Created: ID', appointment._id.toString(), 'for Pet', petId.toString());

    const populated = await AppointmentUnified.findById(appointment._id)
      .populate('petId', 'name pawId species breed')
      .populate('customerId', 'name email phone')
      .populate('staffId', 'name email phone')
      .populate('serviceId', 'name type location')
      .lean();

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/appointments - List all appointments (admin) with full population
router.get('/', protect, admin, async (req, res) => {
  try {
    const appointments = await AppointmentUnified.find()
      .populate('petId', 'name pawId species breed')
      .populate('customerId', 'name email phone')
      .populate('staffId', 'name email phone')
      .populate('serviceId', 'name type location')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/appointments/my - My appointments (customer or vet)
router.get('/my', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const role = req.user.role;

    const baseQuery = {};

    if (role === 'veterinarian' || role === 'VET') {
      baseQuery.staffId = userId;
    } else {
      // Default: show appointments created by this customer
      baseQuery.customerId = userId;
    }

    const appointments = await AppointmentUnified.find(baseQuery)
      .populate('petId', 'name pawId species breed')
      .populate('customerId', 'name email phone')
      .populate('staffId', 'name email phone')
      .populate('serviceId', 'name type location')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/appointments/:id - Single appointment with full population
router.get('/:id', protect, async (req, res) => {
  try {
    const appointment = await AppointmentUnified.findById(req.params.id)
      .populate('petId', 'name pawId species breed dob')
      .populate('customerId', 'name email phone')
      .populate('staffId', 'name email phone')
      .populate('serviceId', 'name type location')
      .lean();

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, data: appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v1/appointments/:id/assign - Admin assign vet to appointment (writes to pawsewa_production appointments)
router.patch('/:id/assign', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId: vetId } = req.body || {};
    if (!vetId) {
      return res.status(400).json({ success: false, message: 'staffId (vet id) is required' });
    }
    const appointment = await AppointmentUnified.findByIdAndUpdate(
      id,
      { staffId: vetId },
      { new: true }
    )
      .populate('petId', 'name pawId species breed')
      .populate('customerId', 'name email phone')
      .populate('staffId', 'name email phone')
      .lean();

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    logger.info('Appointment assigned to vet: appointment', id, 'staffId', vetId);
    res.json({ success: true, data: appointment, message: 'Vet assigned to appointment' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
