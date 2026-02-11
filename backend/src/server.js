// Load environment variables FIRST
require('dotenv').config();

const { execSync } = require('child_process');
const os = require('os');

// Core dependencies
const express = require('express');
const mongoose = require('mongoose');

// Security & Utility Middleware
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');

// Database connection
const connectDB = require('./config/db');

// Error handling middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Routes
const userRoutes = require('./routes/userRoutes');
const petRoutes = require('./routes/petRoutes');
const vetRoutes = require('./routes/vetRoutes');
const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const adminRoutes = require('./routes/adminRoutes');
const locationRoutes = require('./routes/locationRoutes');

// Models (for testing endpoints)
const User = require('./models/User');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3000;

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

// CORS - Professional configuration (Allow mobile devices on local network)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost and local network IPs
    const allowedOrigins = [
      'http://localhost:3001',
      'http://localhost:3002',
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/, // Local network IPs
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/, // Private network
    ];
    
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') return pattern === origin;
      return pattern.test(origin);
    });
    
    if (isAllowed || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
};
app.use(cors(corsOptions));

// Body Parser - Parse JSON with size limit (prevent DoS attacks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Global Error Handler (must be last)
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for localhost and local network`);
  console.log(`📱 Mobile devices can connect via: http://192.168.1.8:${PORT}`);
});
