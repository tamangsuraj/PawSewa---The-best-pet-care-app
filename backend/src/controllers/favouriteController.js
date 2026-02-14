const asyncHandler = require('express-async-handler');
const Favourite = require('../models/Favourite');
const Product = require('../models/Product');
const Category = require('../models/Category');

const addFavourite = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.body || {};
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const existing = await Favourite.findOne({ user: userId, product: productId });
    if (existing) {
      return res.status(200).json({ success: true, message: 'Already in favourites', data: existing });
    }
    const fav = await Favourite.create({ user: userId, product: productId });
    res.status(201).json({ success: true, message: 'Added to favourites', data: fav });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(500).json({ success: false, message: 'Failed to add favourite', error: error.message });
  }
});

const removeFavourite = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params || {};
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }
    await Favourite.findOneAndDelete({ user: userId, product: productId });
    res.status(200).json({ success: true, message: 'Removed from favourites' });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(500).json({ success: false, message: 'Failed to remove favourite', error: error.message });
  }
});

const getFavourites = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { search, category, minPrice, maxPrice } = req.query || {};
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const favs = await Favourite.find({ user: userId }).select('product').lean();
    const productIds = favs.map((f) => f.product).filter(Boolean);
    if (productIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    const filter = { _id: { $in: productIds }, isAvailable: true };
    if (category && String(category).trim() !== '') {
      const cat = await Category.findOne({ slug: String(category).trim() }).select('_id').lean();
      if (cat) filter.category = cat._id;
    }
    if (search && String(search).trim() !== '') {
      filter.$text = { $search: String(search).trim() };
    }
    const minVal = minPrice != null && minPrice !== '' ? Number(minPrice) : NaN;
    const maxVal = maxPrice != null && maxPrice !== '' ? Number(maxPrice) : NaN;
    if (!Number.isNaN(minVal) && minVal >= 0) {
      filter.price = filter.price || {};
      filter.price.$gte = minVal;
    }
    if (!Number.isNaN(maxVal) && maxVal >= 0) {
      filter.price = filter.price || {};
      filter.price.$lte = maxVal;
    }
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .lean();
    const asList = Array.isArray(products) ? products : [];
    res.status(200).json({ success: true, data: asList });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(500).json({ success: true, data: [] });
  }
});

const checkFavourite = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params || {};
    if (!userId) {
      return res.status(200).json({ success: true, isFavourite: false });
    }
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }
    const fav = await Favourite.findOne({ user: userId, product: productId }).lean();
    res.status(200).json({ success: true, isFavourite: !!fav });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(200).json({ success: true, isFavourite: false });
  }
});

module.exports = {
  addFavourite,
  removeFavourite,
  getFavourites,
  checkFavourite,
};
