const express = require('express');
const router = express.Router();
const {
  createPet,
  getMyPets,
  getPetById,
  getPetHealthSummary,
  updatePet,
  deletePet,
  adminCreatePetForCustomer,
  getAllPets,
} = require('../controllers/petController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Routes
router.post('/', protect, upload.single('photo'), createPet);
router.post('/admin/:userId', protect, admin, upload.single('photo'), adminCreatePetForCustomer);
router.get('/my-pets', protect, getMyPets);
router.get('/admin', protect, admin, getAllPets);
router.get('/:id/health-summary', protect, getPetHealthSummary);
router.get('/:id', protect, getPetById);
router.put('/:id', protect, upload.single('photo'), updatePet);
router.delete('/:id', protect, deletePet);

module.exports = router;
