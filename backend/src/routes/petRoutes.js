const express = require('express');
const router = express.Router();
const {
  createPet,
  getMyPets,
  getPetById,
  getPetHealthSummary,
  getPetMedicalHistory,
  addVetClinicalEntry,
  updatePet,
  deletePet,
  adminCreatePetForCustomer,
  getAllPets,
} = require('../controllers/petController');
const { getHomeDashboard } = require('../controllers/homeDashboardController');
const { protect, admin, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Routes
router.post('/', protect, upload.single('photo'), createPet);
router.post('/admin/:userId', protect, admin, upload.single('photo'), adminCreatePetForCustomer);
router.get('/my-pets', protect, getMyPets);
router.get('/admin', protect, admin, getAllPets);
router.get('/home-dashboard/:petId', protect, getHomeDashboard);
router.get('/:id/health-summary', protect, getPetHealthSummary);
router.get('/:id/medical-history', protect, getPetMedicalHistory);
router.post('/:id/clinical-entry', protect, authorize('veterinarian', 'admin'), addVetClinicalEntry);
router.get('/:id', protect, getPetById);
router.put('/:id', protect, upload.single('photo'), updatePet);
router.delete('/:id', protect, deletePet);

module.exports = router;
