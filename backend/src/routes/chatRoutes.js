const express = require('express');
const router = express.Router();
const {
  getMyVetsForChat,
  getMyPatientsForChat,
  getVetDirectMessages,
  postVetDirectMessage,
} = require('../controllers/chatController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/my-vets', protect, authorize('pet_owner'), getMyVetsForChat);
router.get('/my-patients', protect, authorize('veterinarian'), getMyPatientsForChat);
router.get('/vet-direct/messages', protect, getVetDirectMessages);
router.post('/vet-direct/messages', protect, postVetDirectMessage);

module.exports = router;
