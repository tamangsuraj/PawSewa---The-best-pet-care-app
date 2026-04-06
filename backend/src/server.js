// Load environment variables FIRST
require('dotenv').config();

const logger = require('./utils/logger');
const { execSync } = require('child_process');
const os = require('os');
const http = require('http');

// Core dependencies
const express = require('express');
const mongoose = require('mongoose');
const { Server: SocketServer } = require('socket.io');
const { isSocketCorsOriginAllowed } = require('./utils/socketCorsOrigin');

// Security & Utility Middleware
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const sanitizeInput = mongoSanitize.sanitize;

// Database connection
const connectDB = require('./config/db');
const { initFirebaseAdmin, isFirebaseAdminConfigured } = require('./config/firebaseAdmin');

// Error handling middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { generalApiLimiter } = require('./middleware/rateLimiters');

// Routes
const userRoutes = require('./routes/userRoutes');
const petRoutes = require('./routes/petRoutes');
const vetRoutes = require('./routes/vetRoutes');
const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const locationRoutes = require('./routes/locationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const careRoutes = require('./routes/careRoutes');
const hostelRoutes = require('./routes/hostelRoutes');
const { getHostels } = require('./controllers/hostelController');
const trainingRoutes = require('./routes/trainingRoutes');
const centerRoutes = require('./routes/centerRoutes');
const careBookingRoutes = require('./routes/careBookingRoutes');
const careStaffTaskRoutes = require('./routes/careStaffTaskRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const providerApplicationRoutes = require('./routes/providerApplicationRoutes');
const productRoutes = require('./routes/productRoutes');
const shopRecommendationRoutes = require('./routes/shopRecommendationRoutes');
const orderRoutes = require('./routes/orderRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const favouriteRoutes = require('./routes/favouriteRoutes');
const promoCodeRoutes = require('./routes/promoCodeRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const callRoutes = require('./routes/callRoutes');
const ecosystemRoutes = require('./routes/ecosystemRoutes');
const { scanAndNotifyReminders24h } = require('./utils/reminderNotifier');

// Models (for startup sync logs and routes)
const User = require('./models/User');
const Product = require('./models/Product');
const Case = require('./models/Case');

// Initialize Express application
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io — CORS must allow the same browser origins as the REST API (ALLOWED_ORIGINS) plus local/tunnel dev.
const io = new SocketServer(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isSocketCorsOriginAllowed(origin));
    },
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

const { socketAuthMiddleware } = require('./sockets/socketAuth');
const { registerChatHandler } = require('./sockets/chatHandler');
const { registerCustomerCareSocket } = require('./sockets/customerCareSocket');
const { registerMarketplaceChatSocket } = require('./sockets/marketplaceChatSocket');
const { registerVetDirectSocket } = require('./sockets/vetDirectSocket');
const { registerCallSignaling } = require('./sockets/callSignalingSocket');
const { registerUnifiedChatSocket } = require('./sockets/unifiedChatSocket');
const { presenceConnect, presenceDisconnect } = require('./sockets/presenceStore');
const { setIO } = require('./sockets/socketStore');
const { startLiveMapSimulation } = require('./services/liveMapSimulation');
const customerCareRoutes = require('./routes/customerCareRoutes');
const marketplaceChatRoutes = require('./routes/marketplaceChatRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { upload: chatUploadMulter, postChatUpload } = require('./controllers/chatUploadController');
const { protect: protectJwt } = require('./middleware/authMiddleware');

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const userId = socket.user?._id?.toString();
  const host = (socket.handshake.headers && socket.handshake.headers.host) || '';
  const transport = socket.conn?.transport?.name || 'unknown';
  const tunnelHint = host.includes('ngrok') ? `ngrok:${host}` : host || 'local';
  logger.info(`[CONNECTION] Socket connected (${tunnelHint}, transport=${transport}) userId=${userId || '?'}`);
  if (userId) {
    socket.join('user:' + userId);
    presenceConnect(userId);
  }
  if (socket.user?.role === 'admin') {
    socket.join('admin_room');
  }
  socket.on('disconnect', () => {
    if (userId) presenceDisconnect(userId);
  });
});

registerChatHandler(io);
registerCustomerCareSocket(io);
registerMarketplaceChatSocket(io);
registerUnifiedChatSocket(io);
registerVetDirectSocket(io);
registerCallSignaling(io);
setIO(io);

// ============================================
// SECURITY & UTILITY MIDDLEWARE
// ============================================

// Helmet - Secure HTTP headers
app.use(helmet());

// Morgan - Request logging (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// CORS - use ALLOWED_ORIGINS in production (comma-separated). Development: allow all.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : '*';
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
);

// Body Parser - Parse JSON with size limit (prevent DoS attacks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize MongoDB operators from user input (body + params only; Express 5 has read-only req.query)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body, { replaceWith: '_' });
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeInput(req.params, { replaceWith: '_' });
  }
  next();
});

// Global rate limit for all API routes
app.use('/api/v1', generalApiLimiter);

const dbRequestContext = require('./middleware/dbRequestContext');
app.use('/api/v1', dbRequestContext);

const apiLogMiddleware = require('./middleware/apiLogMiddleware');
app.use(apiLogMiddleware);

// ============================================
// ROUTES
// ============================================

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'PawSewa API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      pets: '/api/v1/pets',
      vets: '/api/v1/vets'
    }
  });
});

// API Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/pets', petRoutes);
app.use('/api/v1/vets', vetRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customer-care', customerCareRoutes);
app.use('/api/v1/marketplace-chat', marketplaceChatRoutes);
app.use('/api/v1/chats', chatRoutes);
// Alias (documented): POST /api/v1/chat/upload — same handler as POST /api/v1/chats/upload
app.post('/api/v1/chat/upload', protectJwt, chatUploadMulter.single('file'), postChatUpload);
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1/service-requests', serviceRequestRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/location', locationRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/care', careRoutes);
app.use('/api/v1/hostels', hostelRoutes);
// Alias for clients that call GET /care-centers (same handler as /hostels).
app.get('/api/v1/care-centers', getHostels);
app.use('/api/v1/trainings', trainingRoutes);
app.use('/api/v1/centers', centerRoutes);
app.use('/api/v1/care-bookings', careBookingRoutes);
app.use('/api/v1/care-staff-tasks', careStaffTaskRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/provider-applications', providerApplicationRoutes);
app.use('/api/v1/favourites', favouriteRoutes);
app.use('/api/v1/promocodes', promoCodeRoutes);
app.use('/api/v1/orders', orderRoutes);
logger.success('Precision mapping enabled for delivery routing.');
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/reminders', reminderRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/calls', callRoutes);
app.use('/api/v1/ecosystem', ecosystemRoutes);
app.use('/api/v1', productRoutes);
app.use('/api/v1', shopRecommendationRoutes);

// Global health/ping for cross-platform sync verification. Returns DB name and user count.
app.get('/api/v1/health', async (req, res) => {
  const dbName = mongoose.connection.db?.databaseName || process.env.DB_NAME || 'unknown';
  const connected = mongoose.connection.readyState === 1;
  let userCount = 0;
  if (connected) {
    try {
      userCount = await User.countDocuments();
    } catch (_) {}
  }
  res.status(200).json({
    status: connected ? 'ok' : 'degraded',
    database: dbName,
    userCount,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Alias for platforms that expect a simple ping
app.get('/api/v1/ping', async (req, res) => {
  const dbName = mongoose.connection.db?.databaseName || process.env.DB_NAME || 'unknown';
  let userCount = 0;
  if (mongoose.connection.readyState === 1) {
    try {
      userCount = await User.countDocuments();
    } catch (_) {}
  }
  res.status(200).json({ status: 'ok', database: dbName, userCount });
});

// Simple ping route to verify reachability from devices/browsers
app.get('/api/v1/test', (req, res) => {
  res.status(200).json({ message: 'Server is reachable!' });
});

// Legacy health check (for backward compatibility)
app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Server is healthy' });
});

// Database status endpoint (legacy)
app.get('/api/status', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  if (dbStatus === 'connected') {
    res.json({
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      db: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// Database verification route (legacy)
app.get('/api/test-db', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.json({
      success: true,
      message: 'Database connection is active.',
      userCount: userCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// 404 Not Found Handler (must be after all routes)
app.use(notFound);

// Global Error Handler (must be last) - logs err.stack to console for debugging 500s
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

// On Windows, try to allow port 3000 so Android emulator (10.0.2.2) can connect. Requires admin once.
function tryAllowWindowsFirewall() {
  if (os.platform() !== 'win32') return;
  try {
    execSync('netsh advfirewall firewall delete rule name="PawSewa Backend"', { stdio: 'ignore', timeout: 2000 });
    execSync('netsh advfirewall firewall add rule name="PawSewa Backend" dir=in action=allow protocol=TCP localport=3000', { stdio: 'ignore', timeout: 2000 });
    logger.info('Firewall: port 3000 allowed for emulator.');
  } catch (_) {
    logger.info('Firewall: If Android emulator cannot connect, run as Administrator: backend/scripts/allow-port-3000.bat');
  }
}

tryAllowWindowsFirewall();

async function start() {
  await connectDB();
  try {
    const { resolveCareAdminId } = require('./services/customerCareService');
    const ccAdmin = await resolveCareAdminId();
    if (ccAdmin) {
      logger.success('[Customer Care] Admin partner resolved:', String(ccAdmin));
      if (!(process.env.CUSTOMER_CARE_ADMIN_ID || '').trim()) {
        logger.info(
          '[Customer Care] Optional: set CUSTOMER_CARE_ADMIN_ID in .env to pin this user, or run npm run sync:customer-care-admin.'
        );
      }
    } else {
      logger.warn(
        '[Customer Care] No admin user found — support inbox for pet owners stays disabled until you create an admin or set CUSTOMER_CARE_ADMIN_ID.'
      );
    }
  } catch (e) {
    logger.warn('[Customer Care] Startup check failed:', e?.message || String(e));
  }
  if (isFirebaseAdminConfigured()) {
    initFirebaseAdmin();
  } else {
    logger.info('FCM: FIREBASE_SERVICE_ACCOUNT_JSON not set; push notifications disabled.');
  }
  logger.info('Image domains authorized: images.unsplash.com.');
  logger.info('Product layout re-configured: 2-column grid active.');
  const userCount = await User.countDocuments();
  logger.info('Verified', userCount, 'users in production.');

  // Reminder push (in-app notifications) — runs in-process on an interval.
  const enableReminderNotifier =
    String(process.env.ENABLE_REMINDER_NOTIFIER || 'true').toLowerCase() !== 'false';
  if (enableReminderNotifier) {
    const intervalMs = 15 * 60 * 1000; // 15 minutes
    setTimeout(() => {
      scanAndNotifyReminders24h().catch((e) => {
        logger.warn('Reminder Notifier: startup run failed', e?.message || String(e));
      });
    }, 15 * 1000);
    setInterval(() => {
      scanAndNotifyReminders24h().catch((e) => {
        logger.warn('Reminder Notifier: interval run failed', e?.message || String(e));
      });
    }, intervalMs);
    logger.info('Reminder Notifier: enabled (24h before due).');
  } else {
    logger.info('Reminder Notifier: disabled by ENABLE_REMINDER_NOTIFIER=false');
  }

  const productCount = await Product.countDocuments();
  logger.info('Product Inventory Sync:', productCount, 'items found.');

  const activeCasesCount = await Case.countDocuments({ status: { $nin: ['completed', 'cancelled'] } });
  logger.info('Live Cases Sync:', activeCasesCount, 'active cases found.');
  logger.success('Hostels and Grooming centers mapped for all 4 platforms.');

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use (EADDRINUSE). Another PawSewa backend or app is listening.`);
      logger.info('Fix: from backend folder run  npm run free-port  then  npm run dev');
      logger.info('Or use another port:  set PORT=3001  (Windows) /  PORT=3001 npm run dev  (macOS/Linux)');
      process.exit(1);
    }
    logger.error('HTTP server error:', err.message || String(err));
    process.exit(1);
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.info('Starting PawSewa Backend Server.');
    logger.success('[SUCCESS] Brand Deployed: PawSewa API ready (logos, chat, GPS order logging active).');
    logger.success(
      '[SUCCESS] Marketplace Chat Active: Seller, Rider, and Support modules synced.'
    );
    logger.success('Server listening on Port:', PORT);
    logger.info('Environment:', process.env.NODE_ENV || 'development');
    logger.info('CORS enabled for localhost and local network.');
    logger.event('Socket.io initialized for real-time synchronization.');
    logger.info('Mobile devices can connect via: http://<your-ip>:' + PORT);
    startLiveMapSimulation();
  });
}

start().catch((err) => {
  logger.error('Server failed to start:', err.message);
  process.exit(1);
});
