const express = require('express');
const router = express.Router();
const Center = require('../models/Center');

/**
 * @route   GET /api/v1/centers
 * @desc    List all training centers (public)
 */
router.get('/', async (req, res) => {
  try {
    const centers = await Center.find({}).sort({ name: 1 }).lean();
    res.json({ success: true, data: centers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
