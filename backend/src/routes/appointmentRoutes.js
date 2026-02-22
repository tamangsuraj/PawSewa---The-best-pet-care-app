/**
 * Unified appointments API for pawsewa_production.
 * Returns appointments with populated pet name, owner name, staff, and service.
 */
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { AppointmentUnified } = require('../models/unified');

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

// GET /api/v1/appointments/my - My appointments (customer/vet/rider)
router.get('/my', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const appointments = await AppointmentUnified.find({
      $or: [{ customerId: userId }, { staffId: userId }],
    })
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
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, data: appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
