const express = require('express');
const router = express.Router();
const {
  createCase,
  getAllCases,
  getCaseById,
  getMyCases,
  getMyAssignments,
  assignCase,
  updateVetShift,
  startCase,
  completeCase,
  getAvailableVets,
} = require('../controllers/caseController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public/User routes
router.post('/', protect, createCase); // Create case
router.get('/my/requests', protect, getMyCases); // Get my cases (customer)
router.get('/my/assignments', protect, getMyAssignments); // Get my assignments (vet)

// Vet routes
router.patch('/:id/start', protect, startCase); // Start case
router.patch('/:id/complete', protect, completeCase); // Complete case

// Admin routes
router.get('/', protect, admin, getAllCases); // Get all cases
router.get('/vets/available', protect, admin, getAvailableVets); // Get available vets
router.patch('/:id/assign', protect, admin, assignCase); // Assign case to vet
router.patch('/vets/:id/shift', protect, admin, updateVetShift); // Update vet shift

// Case details (accessible by customer, assigned vet, or admin)
router.get('/:id', protect, getCaseById);

module.exports = router;
