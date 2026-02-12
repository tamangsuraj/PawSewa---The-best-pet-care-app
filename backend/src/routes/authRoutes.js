const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { loginUser } = require('../controllers/userController');
const { authLimiter } = require('../middleware/rateLimiters');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Email/password login alias for mobile/web clients
// @route   POST /api/v1/auth/login
// @desc    Proxy to regular loginUser controller
// @access  Public (rate-limited)
router.post('/login', authLimiter, loginUser);

// Google OAuth login
// @route   POST /api/v1/auth/google
// @desc    Google OAuth authentication
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { googleToken, email, name, googleId } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email and name are required',
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists - just issue JWT
      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            location: user.location,
            isVerified: user.isVerified,
          },
        },
      });
    }

    // User doesn't exist - create new account
    user = await User.create({
      name,
      email,
      password: `google_${googleId || Date.now()}_${Math.random().toString(36)}`, // Random password for Google users
      role: 'pet_owner',
      isVerified: true, // Google accounts are pre-verified
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          location: user.location,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({
      success: false,
      message: 'Google authentication failed',
      error: error.message,
    });
  }
});

module.exports = router;
