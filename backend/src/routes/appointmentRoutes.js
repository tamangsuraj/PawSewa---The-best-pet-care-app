/**
 * Appointments API — clinic booking flow (customer → admin → vet).
 */
const express = require('express');
const router = express.Router();
const { protect, admin, authorize } = require('../middleware/authMiddleware');
const {
  createAppointment,
  listAppointmentsAdmin,
  listPendingDesk,
  listMyAppointments,
  getAppointmentById,
  assignAppointment,
  patchAppointmentStatus,
} = require('../controllers/appointmentFlowController');

router.post('/', protect, authorize('pet_owner', 'customer'), createAppointment);

router.get('/desk/pending', protect, admin, listPendingDesk);

router.get('/my', protect, listMyAppointments);

router.get('/', protect, admin, listAppointmentsAdmin);

router.patch('/:id/assign', protect, admin, assignAppointment);

router.patch('/:id/status', protect, patchAppointmentStatus);

router.get('/:id', protect, getAppointmentById);

module.exports = router;
