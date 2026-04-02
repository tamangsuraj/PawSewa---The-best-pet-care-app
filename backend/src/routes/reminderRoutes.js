const express = require('express');
const router = express.Router();
const { protect, admin, authorize } = require('../middleware/authMiddleware');
const {
  adminGetTodaysReminders,
  adminGetUpcomingReminders,
  updatePetReminder,
} = require('../controllers/reminderController');

// Admin dashboard feeds
router.get('/admin/today', protect, admin, adminGetTodaysReminders);
router.get('/admin/upcoming', protect, admin, adminGetUpcomingReminders);

// Admin/Vet overrides & lifecycle updates
router.patch('/pets/:petId/:reminderId', protect, authorize('admin', 'veterinarian'), updatePetReminder);

module.exports = router;

