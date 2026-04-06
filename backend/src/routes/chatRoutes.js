const express = require('express');
const router = express.Router();
const {
  getMyVetsForChat,
  getMyPatientsForChat,
  getVetDirectMessages,
  postVetDirectMessage,
  getUnreadSummary,
  clearUnreadForThread,
  markUnreadForThread,
} = require('../controllers/chatController');
const { upload, postChatUpload } = require('../controllers/chatUploadController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/unread-summary', protect, getUnreadSummary);
router.post('/unread/clear', protect, clearUnreadForThread);
router.post('/unread/mark', protect, markUnreadForThread);
router.get('/my-vets', protect, authorize('pet_owner'), getMyVetsForChat);
router.get('/my-patients', protect, authorize('veterinarian'), getMyPatientsForChat);
router.get('/vet-direct/messages', protect, getVetDirectMessages);
router.post('/vet-direct/messages', protect, postVetDirectMessage);
router.post('/upload', protect, upload.single('file'), postChatUpload);

module.exports = router;
