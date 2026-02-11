const express = require('express');
const router = express.Router();

const {
  createCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getProductById,
  getCategories,
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Public catalogue endpoints (used by customer app)
router.get('/products', getProducts);
router.get('/products/:id', getProductById);
router.get('/categories', getCategories);

// Admin management endpoints
router.post('/categories', protect, admin, createCategory);
router.post('/products', protect, admin, upload.array('images', 5), createProduct);
router.patch('/products/:id', protect, admin, upload.array('images', 5), updateProduct);
router.delete('/products/:id', protect, admin, deleteProduct);

module.exports = router;

