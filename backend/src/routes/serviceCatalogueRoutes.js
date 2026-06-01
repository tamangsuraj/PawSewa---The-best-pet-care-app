const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getServices,
  createService,
  updateService,
  toggleService,
} = require('../controllers/serviceCatalogueController');

router.get('/', getServices);
router.post('/', protect, authorize('admin'), createService);
router.put('/:id', protect, authorize('admin'), updateService);
router.patch('/:id/toggle', protect, authorize('admin'), toggleService);

module.exports = router;
