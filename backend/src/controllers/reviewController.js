const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Hostel = require('../models/Hostel');
const Product = require('../models/Product');

/**
 * Recalculate and update rating + reviewCount for a hostel or product
 */
async function updateTargetAggregates(targetType, targetId) {
  const agg = await Review.aggregate([
    { $match: { targetType, targetId } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0;
  const count = agg[0] ? agg[0].count : 0;

  if (targetType === 'hostel') {
    await Hostel.findByIdAndUpdate(targetId, { rating: avg, reviewCount: count });
  } else if (targetType === 'product') {
    await Product.findByIdAndUpdate(targetId, { rating: avg, reviewCount: count });
  }
}

/**
 * @desc    List reviews for a hostel or product
 * @route   GET /api/v1/reviews?targetType=hostel|product&targetId=...
 * @access  Public
 */
const getReviews = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.query;
  if (!targetType || !targetId) {
    res.status(400);
    throw new Error('targetType and targetId are required');
  }
  if (!['hostel', 'product'].includes(targetType)) {
    res.status(400);
    throw new Error('targetType must be hostel or product');
  }

  const reviews = await Review.find({ targetType, targetId })
    .populate('user', 'name profilePicture')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: reviews,
  });
});

/**
 * @desc    Create a review (hostel or product)
 * @route   POST /api/v1/reviews
 * @access  Private
 * Body: { targetType, targetId, rating, comment?, careBookingId? (for hostel), orderId? (for product) }
 */
const createReview = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { targetType, targetId, rating, comment } = req.body || {};

  if (!targetType || !targetId || rating == null) {
    res.status(400);
    throw new Error('targetType, targetId and rating are required');
  }
  if (!['hostel', 'product'].includes(targetType)) {
    res.status(400);
    throw new Error('targetType must be hostel or product');
  }
  const numRating = Number(rating);
  if (numRating < 1 || numRating > 5) {
    res.status(400);
    throw new Error('rating must be between 1 and 5');
  }

  const targetModel = targetType === 'hostel' ? 'Hostel' : 'Product';
  if (targetType === 'hostel') {
    const hostel = await Hostel.findById(targetId);
    if (!hostel) {
      res.status(404);
      throw new Error('Hostel not found');
    }
  } else {
    const product = await Product.findById(targetId);
    if (!product) {
      res.status(404);
      throw new Error('Product not found');
    }
  }

  const existing = await Review.findOne({ user: userId, targetType, targetId });
  if (existing) {
    res.status(400);
    throw new Error('You have already reviewed this item. You can edit your existing review.');
  }

  const review = await Review.create({
    user: userId,
    targetType,
    targetId,
    targetModel,
    rating: numRating,
    comment: (comment && String(comment).trim()) || '',
    careBookingId: req.body.careBookingId || null,
    orderId: req.body.orderId || null,
  });

  await updateTargetAggregates(targetType, targetId);

  const populated = await Review.findById(review._id)
    .populate('user', 'name profilePicture')
    .lean();

  res.status(201).json({
    success: true,
    message: 'Review submitted successfully',
    data: populated,
  });
});

/**
 * @desc    Update own review
 * @route   PATCH /api/v1/reviews/:id
 * @access  Private
 */
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }
  if (review.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only edit your own review');
  }

  const { rating, comment } = req.body || {};
  if (rating != null) {
    const num = Number(rating);
    if (num < 1 || num > 5) {
      res.status(400);
      throw new Error('rating must be between 1 and 5');
    }
    review.rating = num;
  }
  if (comment !== undefined) review.comment = String(comment).trim().slice(0, 2000);

  await review.save();
  await updateTargetAggregates(review.targetType, review.targetId);

  const populated = await Review.findById(review._id)
    .populate('user', 'name profilePicture')
    .lean();

  res.json({
    success: true,
    message: 'Review updated',
    data: populated,
  });
});

/**
 * @desc    Delete own review
 * @route   DELETE /api/v1/reviews/:id
 * @access  Private
 */
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }
  if (review.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only delete your own review');
  }

  const targetType = review.targetType;
  const targetId = review.targetId;
  await Review.findByIdAndDelete(review._id);
  await updateTargetAggregates(targetType, targetId);

  res.json({
    success: true,
    message: 'Review deleted',
  });
});

/**
 * @desc    Get current user's review for a target (if any)
 * @route   GET /api/v1/reviews/my?targetType=hostel|product&targetId=...
 * @access  Private
 */
const getMyReview = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.query;
  if (!targetType || !targetId) {
    res.status(400);
    throw new Error('targetType and targetId are required');
  }

  const review = await Review.findOne({
    user: req.user._id,
    targetType,
    targetId,
  })
    .populate('user', 'name profilePicture')
    .lean();

  res.json({
    success: true,
    data: review,
  });
});

module.exports = {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
  getMyReview,
};
