const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const { protect, authorize } = require('../middleware/authMiddleware');

// @route   GET /api/v1/vets/public
// @desc    Get all veterinarians (public, no auth required)
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const vets = await User.find(
      { role: 'veterinarian' },
      {
        password: 0,
        otp: 0,
        otpExpires: 0,
        __v: 0,
      }
    ).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: vets.length,
      data: vets,
    });
  } catch (error) {
    console.error('Error fetching vets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch veterinarians',
      error: error.message,
    });
  }
});

// @route   GET /api/v1/vets/public/:id
// @desc    Get single veterinarian by ID (public)
// @access  Public
router.get('/public/:id', async (req, res) => {
  try {
    const vet = await User.findOne(
      { _id: req.params.id, role: 'veterinarian' },
      {
        password: 0,
        otp: 0,
        otpExpires: 0,
        __v: 0,
      }
    );

    if (!vet) {
      return res.status(404).json({
        success: false,
        message: 'Veterinarian not found',
      });
    }

    res.json({
      success: true,
      data: vet,
    });
  } catch (error) {
    console.error('Error fetching vet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch veterinarian',
      error: error.message,
    });
  }
});

// @route   GET /api/v1/vets/earnings
// @desc    Get earnings for current vet (payments from pet owners for assigned services)
// @access  Private / veterinarian
router.get('/earnings', protect, authorize('veterinarian', 'care_service'), async (req, res) => {
  try {
    const staffId = req.user._id;
    // Find completed payments for service requests assigned to this staff
    const servicePayments = await Payment.find({
      targetType: 'service',
      status: 'completed',
    })
      .populate({
        path: 'serviceRequest',
        match: { assignedStaff: staffId },
        select: 'serviceType preferredDate user pet status',
        populate: [
          { path: 'user', select: 'name' },
          { path: 'pet', select: 'name' },
        ],
      })
      .lean();

    const CareRequest = require('../models/CareRequest');
    const carePayments = await Payment.find({
      targetType: 'care',
      status: 'completed',
    })
      .populate({
        path: 'careRequest',
        match: { assignedStaff: staffId },
        select: 'serviceType createdAt user pet status',
        populate: [
          { path: 'user', select: 'name' },
          { path: 'pet', select: 'name' },
        ],
      })
      .lean();

    const vetPayments = [
      ...servicePayments.filter((p) => p.serviceRequest != null),
      ...carePayments.filter((p) => p.careRequest != null),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const totalEarnings = vetPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const transactions = vetPayments.map((p) => {
      const req = p.serviceRequest || p.careRequest;
      return {
        _id: p._id,
        amount: p.amount,
        gateway: p.gateway,
        createdAt: p.createdAt,
        serviceType: req?.serviceType,
        preferredDate: req?.preferredDate || req?.createdAt,
        customer: req?.user?.name,
        petName: req?.pet?.name,
      };
    });

    res.json({
      success: true,
      data: {
        totalEarnings,
        transactionCount: vetPayments.length,
        transactions,
      },
    });
  } catch (error) {
    console.error('Error fetching vet earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings',
      error: error.message,
    });
  }
});

module.exports = router;
