const express = require('express');
const router = express.Router();
const User = require('../models/User');

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

module.exports = router;
