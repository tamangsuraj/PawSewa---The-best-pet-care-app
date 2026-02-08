// Load environment variables FIRST
require('dotenv').config();

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

// CORS - Professional configuration
const corsOptions = {
  origin: [
    'http://localhost:3001', // PawSewa Website
    'http://localhost:3002', // PawSewa Admin Panel
  ],
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
};
app.use(cors(corsOptions));

// Body Parser - Parse JSON with size limit (prevent DoS attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ============================================
// ROUTES
// ============================================

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

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: http://localhost:3001, http://localhost:3002`);
});
