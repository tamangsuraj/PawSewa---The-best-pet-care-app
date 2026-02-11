const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Category = require('../models/Category');

// Admin: POST /api/v1/categories
// Body: { name: string }
const createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Category name is required',
    });
  }

  const trimmed = String(name).trim();
  const slug = trimmed
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

  const category = await Category.create({ name: trimmed, slug });

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: category,
  });
});

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

  const images = [];
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      if (file.path) {
        images.push(file.path);
      }
    }
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

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: populated,
  });
});

// Admin: PATCH /api/v1/products/:id
// Accepts same fields as createProduct; if new images are uploaded they replace the existing list.
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
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
      }
    }
    product.images = images;
  }

  await product.save();

  const populated = await Product.findById(product._id).populate('category', 'name slug');

  res.json({
    success: true,
    message: 'Product updated successfully',
    data: populated,
  });
});

// Admin: DELETE /api/v1/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  await product.deleteOne();

  res.json({
    success: true,
    message: 'Product deleted successfully',
  });
});

// Public: GET /api/v1/products
// Query: search, category, page, limit
const getProducts = asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 20 } = req.query;

  const filter = { isAvailable: true };
  if (category) {
    const cat = await Category.findOne({ slug: category.toString() }).select('_id');
    if (cat) {
      filter.category = cat._id;
    }
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
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
    },
  });
});

// Public: GET /api/v1/products/:id
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug');
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, data: product });
});

// Public: GET /api/v1/categories
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({}).sort({ name: 1 });
  res.json({ success: true, data: categories });
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

