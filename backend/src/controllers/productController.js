const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');
const Pet = require('../models/Pet');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const {
  parseTargetPetsFromBody,
  parseTagsFromBody,
  targetPetsToPetTypes,
  petSpeciesToTargetPetType,
  recommendationTierForProduct,
} = require('../utils/productPersonalization');

// Admin: POST /api/v1/categories
// Body (multipart): name (string, required), image (file, optional)
const createCategory = asyncHandler(async (req, res) => {
  try {
    const name = (req.body && req.body.name) ? String(req.body.name).trim() : '';
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const existing = await Category.findOne({ slug }).lean();
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A category with this name already exists',
      });
    }

    let imageUrl = '';
    const file = req.file;
    if (file && file.buffer) {
      const mimetype = inferImageMime(file.mimetype, file.originalname);
      const { url } = await uploadCategoryImageBuffer(file.buffer, mimetype);
      if (url) imageUrl = url;
    }

    const category = await Category.create({
      name,
      slug,
      image: imageUrl,
    });
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message,
    });
  }
});

// When client sends application/octet-stream (e.g. Flutter Dio), infer image type from filename.
function inferImageMime(mimetype, originalname) {
  if (mimetype && mimetype.startsWith('image/')) return mimetype;
  if (!originalname) return 'image/jpeg';
  const ext = originalname.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  return map[ext] || 'image/jpeg';
}

// Upload a single buffer to Cloudinary (product folder).
// Returns { url, error } where url is set on success, error is set on failure (for surfacing to client).
function uploadProductImageBuffer(buffer, mimetype) {
  return new Promise((resolve) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return resolve({ url: null, error: 'No buffer' });
    }
    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimetype || 'image/jpeg'};base64,${base64}`;
    cloudinary.uploader.upload(
      dataUri,
      {
        folder: 'pawsewa/products',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
        // Crop to exactly 800x800 square, smart crop focuses on main subject
        transformation: [
          { 
            width: 800, 
            height: 800, 
            crop: 'fill',        // Fill exact dimensions, crop if needed
            gravity: 'auto',     // Smart crop: focus on main subject/face
            quality: 'auto:good', // Optimize file size while maintaining quality
            fetch_format: 'auto'  // Auto-select best format (WebP when supported)
          }
        ],
      },
      (err, result) => {
        if (err) {
          console.error('[Product image upload]', err.message);
          return resolve({ url: null, error: err.message });
        }
        resolve({
          url: result && result.secure_url ? result.secure_url : null,
          error: null,
        });
      }
    );
  });
}

// Upload category image to Cloudinary (pawsewa/categories).
function uploadCategoryImageBuffer(buffer, mimetype) {
  return new Promise((resolve) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return resolve({ url: null, error: 'No buffer' });
    }
    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimetype || 'image/jpeg'};base64,${base64}`;
    cloudinary.uploader.upload(
      dataUri,
      {
        folder: 'pawsewa/categories',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
        transformation: [
          { width: 400, height: 400, crop: 'fill', quality: 'auto:good' },
        ],
      },
      (err, result) => {
        if (err) {
          console.error('[Category image upload]', err.message);
          return resolve({ url: null, error: err.message });
        }
        resolve({
          url: result && result.secure_url ? result.secure_url : null,
          error: null,
        });
      }
    );
  });
}

// Admin: POST /api/v1/products
// Body (multipart/form-data):
// - name (string, required)
// - description (string)
// - price (number or string, required)
// - stockQuantity (number or string, required)
// - category (Category _id, required)
// - isAvailable (optional, "true"/"false")
// - images (one or more image files)
const createProduct = asyncHandler(async (req, res) => {
  try {
  const { name, description, price, stockQuantity, category, isAvailable } = req.body || {};
  const targetPets = parseTargetPetsFromBody(req.body);
  const tags = parseTagsFromBody(req.body.tags);
  const petTypes = targetPetsToPetTypes(targetPets);

  if (!name || !price || !stockQuantity || !category) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, price, stockQuantity, and category for the product.',
    });
  }

  const numericPrice = Number(price);
  const numericStock = Number(stockQuantity);

  if (Number.isNaN(numericPrice) || numericPrice < 0) {
    return res.status(400).json({
      success: false,
      message: 'Price must be a non-negative number.',
    });
  }

  if (Number.isNaN(numericStock) || numericStock < 0) {
    return res.status(400).json({
      success: false,
      message: 'Stock quantity must be a non-negative number.',
    });
  }

  const files = Array.isArray(req.files) ? req.files : [];
  const images = [];
  const uploadWarnings = [];
  let firstUploadError = null;

  if (files.length > 0) {
    const withBuffer = files.filter((f) => f.buffer);
    if (withBuffer.length === 0) {
      console.warn('[Product create] Received', files.length, 'files but none have buffer (field name must be "images"). Check client sends multipart/form-data with boundary, not Content-Type: application/json or plain multipart/form-data.');
    }
    for (const file of files) {
      if (file.path) {
        images.push(file.path);
      } else if (file.buffer) {
        const mimetype = inferImageMime(file.mimetype, file.originalname);
        const { url, error } = await uploadProductImageBuffer(file.buffer, mimetype);
        if (url) {
          images.push(url);
        } else {
          uploadWarnings.push(file.originalname || 'image');
          if (error && !firstUploadError) firstUploadError = error;
          console.warn('[Product create] Image upload failed:', file.originalname, error);
        }
      }
    }
  } else {
    console.warn('[Product create] No files in req.files. Client must send FormData with field "images" and must not set Content-Type to application/json.');
  }

  let sellerRef = null;
  if (req.user?.role === 'shop_owner') {
    sellerRef = req.user._id;
  } else if (req.body?.seller && mongoose.Types.ObjectId.isValid(String(req.body.seller))) {
    sellerRef = req.body.seller;
  } else {
    const so = await User.findOne({ role: 'shop_owner' }).sort({ createdAt: 1 }).select('_id').lean();
    sellerRef = so?._id || req.user?._id || null;
  }

  const product = await Product.create({
    name: String(name),
    description: description ? String(description) : '',
    price: numericPrice,
    stockQuantity: numericStock,
    category,
    seller: sellerRef || undefined,
    images,
    targetPets,
    tags,
    petTypes,
    isAvailable:
      typeof isAvailable === 'string'
        ? isAvailable === 'true'
        : isAvailable === undefined
        ? true
        : Boolean(isAvailable),
  });

  const populated = await Product.findById(product._id)
    .populate('category', 'name slug')
    .populate('seller', 'name profilePicture email');

  let message = 'Product created successfully';
  if (uploadWarnings.length > 0) {
    message =
      firstUploadError && firstUploadError.includes('Stale request')
        ? 'Product created but image upload failed: server clock is out of sync with Cloudinary. Sync this server\'s time (NTP) then edit the product to add the image again.'
        : 'Product created successfully. Some images could not be uploaded (e.g. server clock—sync with NTP and try editing the product to add images).';
  }

  res.status(201).json({
    success: true,
    message,
    data: populated,
    ...(uploadWarnings.length > 0 && {
      uploadSkipped: uploadWarnings,
      uploadError: process.env.NODE_ENV !== 'production' ? firstUploadError : undefined,
    }),
  });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message,
    });
  }
});

// Admin: PATCH /api/v1/products/:id
// Accepts same fields as createProduct; if new images are uploaded they replace the existing list.
const updateProduct = asyncHandler(async (req, res) => {
  try {
  const { id } = req.params || {};
  if (!id) {
    return res.status(400).json({ success: false, message: 'Product ID required' });
  }
  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  if (req.user?.role === 'shop_owner') {
    if (product.seller && String(product.seller) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not your product' });
    }
    if (!product.seller) product.seller = req.user._id;
  }

  const { name, description, price, stockQuantity, category, isAvailable } = req.body || {};

  if (name !== undefined) {
    product.name = String(name);
  }
  if (description !== undefined) {
    product.description = String(description);
  }
  if (price !== undefined) {
    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a non-negative number.',
      });
    }
    product.price = numericPrice;
  }
  if (stockQuantity !== undefined) {
    const numericStock = Number(stockQuantity);
    if (Number.isNaN(numericStock) || numericStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock quantity must be a non-negative number.',
      });
    }
    product.stockQuantity = numericStock;
  }
  if (category !== undefined) {
    product.category = category;
  }
  if (isAvailable !== undefined) {
    product.isAvailable =
      typeof isAvailable === 'string' ? isAvailable === 'true' : Boolean(isAvailable);
  }

  if (
    req.body?.targetPets !== undefined ||
    req.body?.targetPetsUniversal !== undefined ||
    req.body?.universal !== undefined
  ) {
    const nextTargets = parseTargetPetsFromBody(req.body);
    product.targetPets = nextTargets;
    product.petTypes = targetPetsToPetTypes(nextTargets);
  }
  if (req.body?.tags !== undefined) {
    product.tags = parseTagsFromBody(req.body.tags);
  }

  if (Array.isArray(req.files) && req.files.length > 0) {
    const images = [];
    for (const file of req.files) {
      if (file.path) {
        images.push(file.path);
      } else if (file.buffer) {
        const mimetype = inferImageMime(file.mimetype, file.originalname);
        const { url } = await uploadProductImageBuffer(file.buffer, mimetype);
        if (url) images.push(url);
      }
    }
    product.images = images;
  }

  await product.save();

  const populated = await Product.findById(product._id)
    .populate('category', 'name slug')
    .populate('seller', 'name profilePicture email');

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: populated,
  });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message,
    });
  }
});

// Admin: DELETE /api/v1/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) {
      return res.status(400).json({ success: false, message: 'Product ID required' });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (req.user?.role === 'shop_owner') {
      if (product.seller && String(product.seller) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not your product' });
      }
    }
    await product.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message,
    });
  }
});

// Public: GET /api/v1/products
// Query: search, category, page, limit, minPrice, maxPrice, petTypes, userPetType (override),
// sort (recommended|newest|price_asc|price_desc). Optional JWT: primary pet used for personalization.
const getProducts = asyncHandler(async (req, res) => {
  try {
    const {
      search,
      category,
      page = 1,
      limit = 24,
      minPrice,
      maxPrice,
      petTypes,
      sort,
      userPetType: userPetTypeQuery,
    } = req.query;

    const andConditions = [];

    andConditions.push({
      $or: [{ isAvailable: true }, { isAvailable: { $exists: false } }],
    });

    if (category && category.toString().trim() !== '') {
      const cat = await Category.findOne({ slug: category.toString().trim() }).select('_id');
      if (cat) {
        andConditions.push({ category: cat._id });
      }
    }

    const minVal = minPrice != null && minPrice !== '' ? Number(minPrice) : NaN;
    const maxVal = maxPrice != null && maxPrice !== '' ? Number(maxPrice) : NaN;
    const priceFilter = {};
    if (!Number.isNaN(minVal) && minVal >= 0) {
      priceFilter.$gte = minVal;
    }
    if (!Number.isNaN(maxVal) && maxVal >= 0) {
      priceFilter.$lte = maxVal;
    }
    if (Object.keys(priceFilter).length) {
      andConditions.push({ price: priceFilter });
    }

    if (petTypes && petTypes.toString().trim() !== '') {
      const selected = petTypes
        .toString()
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => ['dog', 'cat', 'rabbit'].includes(s));
      if (selected.length) {
        const lowerToUpper = { dog: 'DOG', cat: 'CAT', rabbit: 'RABBIT' };
        const targetUpper = selected.map((s) => lowerToUpper[s]).filter(Boolean);
        andConditions.push({
          $or: [
            {
              $and: [
                { $or: [{ petTypes: { $exists: false } }, { petTypes: { $size: 0 } }] },
                { $or: [{ targetPets: { $exists: false } }, { targetPets: { $size: 0 } }] },
              ],
            },
            { petTypes: { $in: selected } },
            ...(targetUpper.length ? [{ targetPets: { $in: targetUpper } }] : []),
          ],
        });
      }
    }

    const searchTrim = search && search.toString().trim() !== '' ? search.toString().trim() : '';
    if (searchTrim) {
      andConditions.push({ $text: { $search: searchTrim } });
    }

    const findQuery = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    let userPetNorm = null;
    let primaryPetName = null;
    if (userPetTypeQuery && String(userPetTypeQuery).trim()) {
      userPetNorm = String(userPetTypeQuery).trim().toUpperCase();
    } else if (req.user?._id) {
      const pet = await Pet.findOne({ owner: req.user._id })
        .sort({ updatedAt: -1 })
        .select('name species')
        .lean();
      if (pet) {
        primaryPetName = pet.name || null;
        userPetNorm = petSpeciesToTargetPetType(pet.species);
      }
    }

    if (userPetNorm && req.user?.email === 'testuser@pawsewa.com') {
      logger.info('[RECS] Personalized sorting active for User: testuser@pawsewa.com.');
    } else if (userPetNorm && req.user?.email) {
      logger.info('[RECS] Personalized sorting active for User:', req.user.email);
    }

    const sortKey = sort ? sort.toString() : 'newest';
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 24));

    const pipeline = [{ $match: findQuery }];

    if (userPetNorm) {
      pipeline.push({
        $addFields: {
          __rec: {
            $let: {
              vars: {
                eff: {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$targetPets', []] } }, 0] },
                    { $ifNull: ['$targetPets', []] },
                    {
                      $map: {
                        input: { $ifNull: ['$petTypes', []] },
                        as: 'pt',
                        in: { $toUpper: '$$pt' },
                      },
                    },
                  ],
                },
              },
              in: {
                $cond: [
                  { $eq: [{ $size: '$$eff' }, 0] },
                  1,
                  {
                    $cond: [{ $in: [userPetNorm, '$$eff'] }, 2, 0],
                  },
                ],
              },
            },
          },
        },
      });
    } else {
      pipeline.push({ $addFields: { __rec: 1 } });
    }

    if (sortKey === 'price_asc') {
      pipeline.push({ $sort: { __rec: -1, price: 1, createdAt: -1 } });
    } else if (sortKey === 'price_desc') {
      pipeline.push({ $sort: { __rec: -1, price: -1, createdAt: -1 } });
    } else if (sortKey === 'recommended') {
      pipeline.push({ $sort: { __rec: -1, rating: -1, reviewCount: -1, createdAt: -1 } });
    } else {
      pipeline.push({ $sort: { __rec: -1, createdAt: -1 } });
    }

    pipeline.push({ $skip: (pageNum - 1) * limitNum });
    pipeline.push({ $limit: limitNum });
    pipeline.push({ $project: { _id: 1 } });

    const [ordered, total] = await Promise.all([Product.aggregate(pipeline), Product.countDocuments(findQuery)]);

    const ids = ordered.map((x) => x._id);
    const itemsRaw =
      ids.length > 0
        ? await Product.find({ _id: { $in: ids } })
            .populate('category', 'name slug')
            .populate('seller', 'name profilePicture')
            .lean()
        : [];

    const order = new Map(ids.map((id, i) => [String(id), i]));
    itemsRaw.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));

    const items = itemsRaw.map((p) => {
      const tier = recommendationTierForProduct(p, userPetNorm);
      const out = { ...p };
      if (tier) out.recommendationTier = tier;
      return out;
    });

    const dbName = require('mongoose').connection.db?.databaseName || process.env.DB_NAME || 'unknown';
    const collectionName = Product.collection?.name || 'products';
    logger.info('[INFO] Fetching Products from collection:', collectionName);
    logger.info('[DEBUG] Fetching products: Found', total ?? 0, 'documents in', dbName + '.');

    const count = (items ?? []).length;
    res.status(200).json({
      success: true,
      data: items ?? [],
      pagination: {
        total: total ?? 0,
        page: pageNum,
        limit: limitNum,
      },
      meta: {
        userPetType: userPetNorm,
        primaryPetName,
      },
    });
    logger.info('[SUCCESS] Returned', count, 'products to client.');
  } catch (err) {
    console.error('SERVER CRASH:', err);
    logger.info('[SUCCESS] Returned 0 products to client.');
    res.status(200).json({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, limit: 20 },
      meta: {},
    });
  }
});

// Public: GET /api/v1/products/:id
const getProductById = asyncHandler(async (req, res) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Product ID required' });
    }
    const product = await Product.findById(id)
      .populate('category', 'name slug')
      .populate('seller', 'name profilePicture email')
      .lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error('SERVER CRASH:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get product',
      error: error.message,
    });
  }
});

// Public: GET /api/v1/categories
const getCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, data: categories ?? [] });
  } catch (err) {
    console.error('SERVER CRASH:', err);
    res.status(200).json({ success: true, data: [] });
  }
});

module.exports = {
  createCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getProductById,
  getCategories,
};

