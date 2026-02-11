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
  getServiceRequestLive,
  updateServiceRequestStatus,
  getRequestMessages,
  submitReview,
  getPrescription,
} = require('../controllers/serviceRequestController');
const { protect, admin } = require('../middleware/authMiddleware');

// User routes
router.post('/', protect, createServiceRequest); // Create service request
router.get('/my/requests', protect, getMyServiceRequests); // Get my requests
router.patch('/:id/cancel', protect, cancelServiceRequest); // Cancel request

// Staff routes
router.get('/my/assignments', protect, getMyAssignedRequests); // Get my assignments
router.get('/my/tasks', protect, getMyAssignedRequests); // Alias: staff "my tasks" feed
router.patch('/:id/start', protect, startServiceRequest); // Start request
router.patch('/:id/complete', protect, completeServiceRequest); // Complete request
router.patch('/status/:id', protect, updateServiceRequestStatus); // Generic status flow for staff app

// Admin routes
router.get('/stats', protect, admin, getServiceRequestStats); // Get statistics
router.get('/', protect, admin, getAllServiceRequests); // Get all requests
router.patch('/:id/assign', protect, admin, assignServiceRequest); // Assign request

// Request details (accessible by owner, assigned staff, or admin)
router.get('/:id', protect, getServiceRequestById);
router.get('/:id/live', protect, getServiceRequestLive);
router.get('/:id/messages', protect, getRequestMessages);
router.post('/:id/review', protect, submitReview);
router.get('/:id/prescription', protect, getPrescription);

module.exports = router;
