const express = require('express');
const router = express.Router();
const {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
  getMyReview,
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// Public
router.get('/', getReviews);

// Protected
router.get('/my', protect, getMyReview);
router.post('/', protect, createReview);
router.patch('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
