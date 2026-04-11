const express = require('express');
const router = express.Router();

const { protect, admin } = require('../middleware/authMiddleware');
const { uploadVetProfilePhoto } = require('../middleware/upload');
const {
  adminCreateVeterinarian,
  selfRegisterVeterinarian,
} = require('../controllers/vetController');

// Admin-managed onboarding (verified)
router.post('/', protect, admin, uploadVetProfilePhoto.single('photo'), adminCreateVeterinarian);

// Partner app self-registration (pending)
router.post(
  '/self-register',
  uploadVetProfilePhoto.single('photo'),
  selfRegisterVeterinarian,
);

module.exports = router;

