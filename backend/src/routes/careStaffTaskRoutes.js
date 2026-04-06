const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');
const { getCareStaffTasks, putCareStaffTasks } = require('../controllers/careStaffTaskController');

router.get(
  '/',
  protect,
  authorize('hostel_owner', 'facility_owner', 'service_provider', 'groomer', 'trainer', 'admin'),
  getCareStaffTasks
);
router.put(
  '/',
  protect,
  authorize('hostel_owner', 'facility_owner', 'service_provider', 'groomer', 'trainer', 'admin'),
  putCareStaffTasks
);

module.exports = router;

