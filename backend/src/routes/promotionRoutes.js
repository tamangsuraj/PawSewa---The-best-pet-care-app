const express = require('express');
const router = express.Router();

const { getActivePromotion } = require('../controllers/promotionController');

// Public: active promotion payload for all clients (web + mobile)
router.get('/active', getActivePromotion);

module.exports = router;

