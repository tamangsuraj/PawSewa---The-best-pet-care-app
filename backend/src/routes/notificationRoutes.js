const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  broadcastNotification,
  getBroadcastHistory,
} = require('../controllers/notificationBroadcastController');
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationCustomerController');

/** Customer / partner inbox (must be before dynamic /:id/read). */
router.get('/me', protect, getMyNotifications);
router.patch('/read-all', protect, markAllNotificationsRead);

router.post('/broadcast', protect, admin, broadcastNotification);
router.get('/broadcast/history', protect, admin, getBroadcastHistory);

router.patch('/:id/read', protect, markNotificationRead);

module.exports = router;

