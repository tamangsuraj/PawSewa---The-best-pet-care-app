const rateLimit = require('express-rate-limit');

/**
 * Client identity for limits: Express `req.ip` (first trusted X-Forwarded-For hop when
 * `app.set('trust proxy', n)` is set in server.js). Do not disable the limiter; fix proxy hops instead.
 */
function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// General API limiter (mounted at /api/v1). Admin routes are skipped — the panel issues many
// parallel requests + socket-driven refetches; 100/15min per IP was causing 429 in dev.
const generalApiMax = Number(process.env.API_RATE_LIMIT_MAX);
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(generalApiMax) && generalApiMax > 0 ? generalApiMax : 400,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientKey(req),
  skip: (req) => {
    const p = req.path || '';
    // Under app.use('/api/v1', limiter), path is relative (e.g. /admin/live-map, /appointments/...).
    // Skip admin-heavy and desk routes (parallel refresh + polling); all still require JWT where applicable.
    return (
      p.startsWith('/admin') ||
      p.startsWith('/cases') ||
      p.startsWith('/service-requests') ||
      p.startsWith('/appointments')
    );
  },
});

// Stricter limiter for authentication-sensitive endpoints like login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientKey(req),
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

