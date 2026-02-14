const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Category = require('../models/Category');
const cloudinary = require('../config/cloudinary');

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

  const product = await Product.create({
    name: String(name),
    description: description ? String(description) : '',
    price: numericPrice,
    stockQuantity: numericStock,
    category,
    images,
    isAvailable:
      typeof isAvailable === 'string'
        ? isAvailable === 'true'
        : isAvailable === undefined
        ? true
        : Boolean(isAvailable),
  });

  const populated = await Product.findById(product._id).populate('category', 'name slug');

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

  const populated = await Product.findById(product._id).populate('category', 'name slug');

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
// Query: search, category, page, limit, minPrice, maxPrice
const getProducts = asyncHandler(async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20, minPrice, maxPrice } = req.query;

    const filter = { isAvailable: true };
    if (category) {
      const cat = await Category.findOne({ slug: category.toString() }).select('_id');
      if (cat) {
        filter.category = cat._id;
      }
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

    let query = Product.find(filter);

    if (search && search.toString().trim() !== '') {
      query = query.find({ $text: { $search: search.toString().trim() } });
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;

    const [items, total] = await Promise.all([
      query
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: items ?? [],
      pagination: {
        total: total ?? 0,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (err) {
    console.error('SERVER CRASH:', err);
    res.status(200).json({
      success: true,
      data: [],
      pagination: { total: 0, page: 1, limit: 20 },
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
    const product = await Product.findById(id).populate('category', 'name slug').lean();
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

