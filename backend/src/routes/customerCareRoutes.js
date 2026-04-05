const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getMine,
  listConversationsAdmin,
  getMessages,
  postMessage,
  getCareProfile,
} = require('../controllers/customerCareController');

router.get('/care-profile', getCareProfile);

// Any authenticated user may open their PawSewa support thread (customers, vets, riders, sellers, …).
router.get('/mine', protect, getMine);

router.get('/conversations', protect, authorize('admin'), listConversationsAdmin);
router.get('/conversations/:id/messages', protect, getMessages);
router.post('/conversations/:id/messages', protect, postMessage);

module.exports = router;
