const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getRtcToken } = require('../controllers/agoraController');
const { logCallSession } = require('../controllers/callLogController');

router.get('/token', protect, getRtcToken);
router.post('/log', protect, logCallSession);

module.exports = router;
