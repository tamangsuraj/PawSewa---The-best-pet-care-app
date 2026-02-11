const express = require('express');
const router = express.Router();

const { updateStaffLocation } = require('../controllers/locationController');
const { protect } = require('../middleware/authMiddleware');

// Staff location updates with TTL-backed cache (for admin map + live tracking)
router.post('/update', protect, updateStaffLocation);

module.exports = router;

