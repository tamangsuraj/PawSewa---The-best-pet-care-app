const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  broadcastNotification,
  getBroadcastHistory,
} = require('../controllers/notificationBroadcastController');

router.post('/broadcast', protect, admin, broadcastNotification);
router.get('/broadcast/history', protect, admin, getBroadcastHistory);

module.exports = router;

