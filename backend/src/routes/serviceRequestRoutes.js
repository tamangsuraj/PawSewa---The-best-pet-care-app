const express = require('express');
const router = express.Router();
const {
  createServiceRequest,
  getAllServiceRequests,
  getMyServiceRequests,
  getMyAssignedRequests,
  getServiceRequestById,
  assignServiceRequest,
  startServiceRequest,
  completeServiceRequest,
  cancelServiceRequest,
  getServiceRequestStats,
} = require('../controllers/serviceRequestController');
const { protect, admin } = require('../middleware/authMiddleware');

// User routes
router.post('/', protect, createServiceRequest); // Create service request
router.get('/my/requests', protect, getMyServiceRequests); // Get my requests
router.patch('/:id/cancel', protect, cancelServiceRequest); // Cancel request

// Staff routes
router.get('/my/assignments', protect, getMyAssignedRequests); // Get my assignments
router.patch('/:id/start', protect, startServiceRequest); // Start request
router.patch('/:id/complete', protect, completeServiceRequest); // Complete request

// Admin routes
router.get('/stats', protect, admin, getServiceRequestStats); // Get statistics
router.get('/', protect, admin, getAllServiceRequests); // Get all requests
router.patch('/:id/assign', protect, admin, assignServiceRequest); // Assign request

// Request details (accessible by owner, assigned staff, or admin)
router.get('/:id', protect, getServiceRequestById);

module.exports = router;
