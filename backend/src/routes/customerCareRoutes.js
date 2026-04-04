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

router.get('/mine', protect, authorize('pet_owner', 'customer'), getMine);

router.get('/conversations', protect, authorize('admin'), listConversationsAdmin);
router.get('/conversations/:id/messages', protect, authorize('admin', 'pet_owner', 'customer'), getMessages);
router.post('/conversations/:id/messages', protect, authorize('admin', 'pet_owner', 'customer'), postMessage);

module.exports = router;
