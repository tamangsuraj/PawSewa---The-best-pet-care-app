const rateLimit = require('express-rate-limit');

// General API rate limiter: 100 requests per 15 minutes per IP
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for authentication-sensitive endpoints like login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many login/register attempts from this IP, please try again after 15 minutes.',
  },
});

module.exports = {
  generalApiLimiter,
  authLimiter,
};

