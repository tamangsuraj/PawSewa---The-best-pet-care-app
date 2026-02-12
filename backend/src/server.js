// Load environment variables FIRST
require('dotenv').config();

const { execSync } = require('child_process');
const os = require('os');
const http = require('http');

// Core dependencies
const express = require('express');
const mongoose = require('mongoose');
const { Server: SocketServer } = require('socket.io');

// Security & Utility Middleware
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');

// Database connection
const connectDB = require('./config/db');

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
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Models (for testing endpoints)
const User = require('./models/User');

// Initialize Express application
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io (CORS: allow same origins as HTTP + emulator / admin)
const io = new SocketServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed =
        origin.startsWith('http://localhost:') ||
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin);
      callback(null, allowed);
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
const { setIO } = require('./sockets/socketStore');

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const userId = socket.user?._id?.toString();
  if (userId) {
    socket.join('user:' + userId);
  }
});

registerChatHandler(io);
setIO(io);

// Connect to Database
connectDB();

// ============================================
// SECURITY & UTILITY MIDDLEWARE
// ============================================

// Helmet - Secure HTTP headers
app.use(helmet());

// Morgan - Request logging (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// CORS - temporarily allow all origins to rule out connectivity issues between
// mobile app (192.168.x.x) and web (localhost). Tighten this in production.
app.use(
  cors({
    origin: '*',
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
);

// Body Parser - Parse JSON with size limit (prevent DoS attacks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize MongoDB operators from user input to mitigate NoSQL injection
app.use(
  mongoSanitize({
    replaceWith: '_',
  }),
);

// Global rate limit for all API routes
app.use('/api/v1', generalApiLimiter);

// Global request logger (simple) + structured API logger
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});
const apiLogMiddleware = require('./middleware/apiLogMiddleware');
app.use(apiLogMiddleware);

// ============================================
// ROUTES
// ============================================

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🐾 Welcome to PawSewa API',
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
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1/service-requests', serviceRequestRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/location', locationRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/care', careRoutes);
app.use('/api/v1', productRoutes);
app.use('/api/v1/orders', orderRoutes);

// Health Check & Diagnostics
app.get('/api/v1/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  
  res.status(200).json({
    status: 'UP',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
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
      message: '🐾 Database connection is active!',
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
    console.log('🔥 Firewall: port 3000 allowed for emulator.');
  } catch (_) {
    console.log('💡 If Android emulator cannot connect, run as Administrator: backend/scripts/allow-port-3000.bat');
  }
}

tryAllowWindowsFirewall();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for localhost and local network`);
  console.log(`🔌 Socket.io attached (JWT auth, user rooms, request chat)`);
  console.log(`📱 Mobile devices can connect via: http://<your-ip>:${PORT}`);
});
