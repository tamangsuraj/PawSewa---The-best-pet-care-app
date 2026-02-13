const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  addFavourite,
  removeFavourite,
  getFavourites,
  checkFavourite,
} = require('../controllers/favouriteController');

router.use(protect);

router.post('/', addFavourite);
router.get('/', getFavourites);
router.get('/check/:productId', checkFavourite);
router.delete('/:productId', removeFavourite);

module.exports = router;
