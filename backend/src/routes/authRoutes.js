const express = require('express');
const axios = require('axios');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { loginUser } = require('../controllers/userController');
const { authLimiter } = require('../middleware/rateLimiters');

/**
 * Default OAuth client IDs for PawSewa user_app (Firebase project pawsewa-25997).
 * Same values as apps/mobile/user_app/android/app/google-services.json — public identifiers.
 * Used when GOOGLE_CLIENT_ID is unset or still the .env.example placeholder so mobile
 * Google Sign-In keeps working in local dev.
 */
const PAWSEWA_DEFAULT_GOOGLE_CLIENT_IDS = [
  '188502859936-doe0igj265poprfntbg3hkq8coo3kndu.apps.googleusercontent.com', // Web (Android serverClientId)
  '188502859936-440q29m0o4cf2agtqcp40djepgc7kmcn.apps.googleusercontent.com', // Android
];

function isPlaceholderGoogleClientId(id) {
  const s = (id || '').trim().toLowerCase();
  if (!s) return true;
  return (
    s.includes('your-web-client-id') ||
    s.includes('your_web') ||
    s === 'your-web-client-id.apps.googleusercontent.com'
  );
}

const envGoogleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const primaryGoogleClientId = isPlaceholderGoogleClientId(envGoogleClientId)
  ? ''
  : envGoogleClientId;

const oauthClientIdForLibrary =
  primaryGoogleClientId || PAWSEWA_DEFAULT_GOOGLE_CLIENT_IDS[0];
const client = new OAuth2Client(oauthClientIdForLibrary);

/**
 * All OAuth client IDs allowed as JWT `aud` for ID tokens (Web + Android + iOS).
 * Comma-separated in GOOGLE_CLIENT_IDS, or single GOOGLE_CLIENT_ID, plus optional
 * GOOGLE_CLIENT_ID_ANDROID / GOOGLE_CLIENT_ID_IOS from Firebase console.
 */
function googleIdTokenAudiences() {
  const fromList = (process.env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromList.length) return [...new Set(fromList)];

  const fromEnv = [
    primaryGoogleClientId,
    (process.env.GOOGLE_CLIENT_ID_ANDROID || '').trim(),
    (process.env.GOOGLE_CLIENT_ID_IOS || '').trim(),
  ].filter((s) => s && !isPlaceholderGoogleClientId(s));

  const unique = [...new Set(fromEnv)];
  if (unique.length) return unique;

  return [...PAWSEWA_DEFAULT_GOOGLE_CLIENT_IDS];
}

/**
 * Web (@react-oauth/google useGoogleLogin) sends an OAuth access token.
 * Mobile sends a JWT ID token. ID tokens are verified with verifyIdToken;
 * access tokens are validated by calling Google's userinfo endpoint.
 */
async function resolveGoogleIdentity(googleToken) {
  const audiences = googleIdTokenAudiences();
  const audience = audiences.length === 1 ? audiences[0] : audiences;
  try {
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience,
    });
    const payload = ticket.getPayload() || {};
    return {
      email: (payload.email || '').toString().toLowerCase().trim(),
      sub: (payload.sub || '').toString(),
      name: (payload.name || '').toString().trim(),
    };
  } catch (verifyErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Google OAuth] verifyIdToken failed, trying userinfo fallback:', verifyErr.message);
    }
    const res = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${googleToken}` },
      validateStatus: () => true,
    });
    if (res.status !== 200 || !res.data) {
      const err = new Error('Invalid Google token');
      err.statusCode = 401;
      throw err;
    }
    const data = res.data;
    return {
      email: (data.email || '').toString().toLowerCase().trim(),
      sub: (data.sub || '').toString(),
      name: (data.name || '').toString().trim(),
    };
  }
}

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

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: 'Google token is required',
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    let identity;
    try {
      identity = await resolveGoogleIdentity(googleToken);
    } catch (e) {
      const code = e.statusCode || 401;
      return res.status(code).json({
        success: false,
        message: e.statusCode ? e.message : 'Invalid Google token',
      });
    }

    if (!identity.email) {
      return res.status(401).json({
        success: false,
        message: 'Google account has no verified email',
      });
    }

    const reqEmail = (email || '').toString().toLowerCase().trim();
    if (identity.email !== reqEmail) {
      return res.status(401).json({ success: false, message: 'Google token email mismatch' });
    }

    // Optional: only enforce when client sends the same subject as the token (some SDKs use a different id field).
    if (googleId && identity.sub && String(googleId).trim() && String(googleId) !== identity.sub) {
      return res.status(401).json({ success: false, message: 'Google account mismatch' });
    }

    const verifiedName = identity.name || (name || '').toString().trim() || identity.email.split('@')[0];

    console.log(`[INFO] Google OAuth handshake complete for user ${identity.email}.`);

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let user = await User.findOne({
      email: new RegExp(`^${escapeRegex(identity.email)}$`, 'i'),
    });

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
      name: verifiedName,
      email: identity.email,
      password: `google_${googleId || identity.sub || Date.now()}_${Math.random().toString(36)}`, // Random password for Google users
      role: 'pet_owner',
      isVerified: true, // Google accounts are pre-verified
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Return 200 so the mobile client doesn't treat it as an error path.
    res.status(200).json({
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
