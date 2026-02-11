const express = require('express');
const router = express.Router();

const {
  createCareRequest,
  getMyCareRequests,
  adminGetCareInbox,
  adminAssignCareProvider,
  getAvailableCareStaff,
} = require('../controllers/careController');
const { protect, admin } = require('../middleware/authMiddleware');

// User routes
router.post('/request', protect, createCareRequest);
router.get('/my-requests', protect, getMyCareRequests);

// Admin routes
router.get('/inbox', protect, admin, adminGetCareInbox);
router.patch('/:id/assign', protect, admin, adminAssignCareProvider);
router.get('/available-staff', protect, admin, getAvailableCareStaff);

module.exports = router;

