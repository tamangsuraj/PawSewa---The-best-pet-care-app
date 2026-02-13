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
const { protect, adminOrShopOwner } = require('../middleware/authMiddleware');
const { uploadProductImages, uploadCategoryImage } = require('../middleware/upload');

// Public catalogue endpoints (used by customer app)
router.get('/products', getProducts);
router.get('/products/:id', getProductById);
router.get('/categories', getCategories);

// Admin management endpoints
router.post('/categories', protect, adminOrShopOwner, uploadCategoryImage.single('image'), createCategory);
router.post('/products', protect, adminOrShopOwner, uploadProductImages.array('images', 5), createProduct);
router.patch('/products/:id', protect, adminOrShopOwner, uploadProductImages.array('images', 5), updateProduct);
router.delete('/products/:id', protect, adminOrShopOwner, deleteProduct);

module.exports = router;

