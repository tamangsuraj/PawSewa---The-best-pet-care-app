const rateLimit = require('express-rate-limit');

// General API limiter (mounted at /api/v1). Admin routes are skipped — the panel issues many
// parallel requests + socket-driven refetches; 100/15min per IP was causing 429 in dev.
const generalApiMax = Number(process.env.API_RATE_LIMIT_MAX);
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(generalApiMax) && generalApiMax > 0 ? generalApiMax : 400,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || '';
    const url = req.originalUrl || req.url || '';
    // Khalti redirects the customer's browser here; do not throttle gateway return traffic.
    if (p.includes('khalti/callback') || url.includes('/payments/khalti/callback')) {
      return true;
    }
    // Under app.use('/api/v1', limiter), path is relative (e.g. /admin/care-bookings, /cases, /service-requests).
    // Skip admin routes and case/service-request routes when accessed by admin
    return p.startsWith('/admin') || p.startsWith('/cases') || p.startsWith('/service-requests');
  },
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

