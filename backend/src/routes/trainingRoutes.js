const express = require('express');
const router = express.Router();
const Training = require('../models/Training');
const Center = require('../models/Center');

/**
 * @route   GET /api/v1/trainings
 * @desc    List all training modules (public)
 */
router.get('/', async (req, res) => {
  try {
    const trainings = await Training.find({}).sort({ difficulty: 1, title: 1 }).lean();
    res.json({ success: true, data: trainings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
