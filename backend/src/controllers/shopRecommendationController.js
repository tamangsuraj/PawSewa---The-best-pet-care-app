const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ShopRecommendationEvent = require('../models/ShopRecommendationEvent');
const Product = require('../models/Product');
const Pet = require('../models/Pet');
const {
  petSpeciesToTargetPetType,
  recommendationTierForProduct,
} = require('../utils/productPersonalization');

const postRecommendationEvent = asyncHandler(async (req, res) => {
  const { productId, action = 'add_to_cart' } = req.body || {};
  if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
    return res.status(400).json({ success: false, message: 'productId required' });
  }
  const product = await Product.findById(productId).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const pet = await Pet.findOne({ owner: req.user._id }).sort({ updatedAt: -1 }).select('species').lean();
  const userPetType = pet ? petSpeciesToTargetPetType(pet.species) : null;
  const tier = recommendationTierForProduct(product, userPetType);
  const personalizedMatch = tier === 'match';

  await ShopRecommendationEvent.create({
    user: req.user._id,
    product: productId,
    action: action === 'view_product' ? 'view_product' : 'add_to_cart',
    personalizedMatch,
    userPetType: userPetType || '',
  });

  res.status(201).json({ success: true, message: 'Logged' });
});

const getAdminRecommendationActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const rows = await ShopRecommendationEvent.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')
    .populate('product', 'name price targetPets')
    .lean();

  res.json({
    success: true,
    data: rows,
  });
});

module.exports = {
  postRecommendationEvent,
  getAdminRecommendationActivity,
};
