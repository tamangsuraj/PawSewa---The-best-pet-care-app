const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  verifyOTP,
  resendOTP,
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  deleteUser,
  updateUserRole,
  getDashboardStats,
  adminCreateUser,
  getUserById,
  getUserFullProfile,
  updateStaffProfile,
} = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.post('/', registerUser); // Public registration (pet_owner only)
router.post('/login', loginUser);
router.post('/verify-otp', verifyOTP); // Verify OTP
router.post('/resend-otp', resendOTP); // Resend OTP

// Protected routes
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

// Staff routes (Veterinarian)
router.put('/staff/profile', protect, updateStaffProfile);

// Admin routes
router.get('/admin/stats', protect, admin, getDashboardStats);
router.post('/admin/create', protect, admin, adminCreateUser); // Admin creates any role
router.get('/admin/:id/full-profile', protect, admin, getUserFullProfile); // Get user with pets
router.get('/:id', protect, admin, getUserById); // Get user by ID
router.get('/', protect, admin, getAllUsers);
router.delete('/:id', protect, admin, deleteUser);
router.put('/:id/role', protect, admin, updateUserRole);

module.exports = router;
