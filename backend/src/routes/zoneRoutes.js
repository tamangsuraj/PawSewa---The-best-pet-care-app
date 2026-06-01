const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  createZone,
  getAllZones,
  updateZone,
  deleteZone,
} = require('../controllers/zoneController');
router.get('/', protect, authorize('admin', 'veterinarian', 'vet'), getAllZones);
router.post('/', protect, authorize('admin'), createZone);
router.put('/:id', protect, authorize('admin'), updateZone);
router.delete('/:id', protect, authorize('admin'), deleteZone);

module.exports = router;
