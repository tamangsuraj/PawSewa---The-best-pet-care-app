const asyncHandler = require('express-async-handler');
const cloudinary = require('../config/cloudinary');
const Promotion = require('../models/Promotion');
const logger = require('../utils/logger');

function safeTrim(v, max = 2000) {
  if (v == null) return '';
  return String(v).trim().slice(0, max);
}

function uploadPromotionImageBuffer(buffer, mimetype) {
  return new Promise((resolve) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return resolve({ url: null, error: 'No buffer' });
    }
    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimetype || 'image/jpeg'};base64,${base64}`;
    cloudinary.uploader.upload(
      dataUri,
      {
        folder: 'pawsewa/promotions',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
        transformation: [{ width: 1200, height: 750, crop: 'fill', gravity: 'auto', quality: 'auto:good', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err) {
          logger.error('Promotion image upload failed:', err.message);
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

// Public: GET /api/v1/promotions/active
const getActivePromotion = asyncHandler(async (req, res) => {
  const row = await Promotion.findOne({ active: true }).sort({ updatedAt: -1 }).lean();
  if (!row) {
    return res.json({ success: true, data: null });
  }
  res.json({
    success: true,
    data: {
      id: String(row._id),
      title: row.title,
      description: row.description || '',
      promoCode: row.promoCode || '',
      imageUrl: row.imageUrl || '',
      active: true,
      updatedAt: row.updatedAt,
    },
  });
});

// Admin: GET /api/v1/admin/promotions
const listPromotions = asyncHandler(async (req, res) => {
  const rows = await Promotion.find({}).sort({ updatedAt: -1 }).limit(50).lean();
  res.json({ success: true, data: rows });
});

// Admin: PUT /api/v1/admin/promotions/active (multipart: title, description, promoCode, imageUrl?, active)
const upsertActivePromotion = asyncHandler(async (req, res) => {
  const title = safeTrim(req.body?.title, 80);
  const description = safeTrim(req.body?.description, 240);
  const promoCode = safeTrim(req.body?.promoCode, 32);
  const imageUrlRaw = safeTrim(req.body?.imageUrl, 2000);
  const active =
    String(req.body?.active ?? '').toLowerCase() === 'true' ||
    req.body?.active === true;

  if (!title) {
    return res.status(400).json({ success: false, message: 'Title is required.' });
  }

  let imageUrl = imageUrlRaw;
  const file = req.file;
  if (file && file.buffer) {
    const mimetype = file.mimetype && file.mimetype.startsWith('image/') ? file.mimetype : 'image/jpeg';
    const up = await uploadPromotionImageBuffer(file.buffer, mimetype);
    if (up.url) imageUrl = up.url;
    if (!up.url && up.error) {
      return res.status(400).json({ success: false, message: `Image upload failed: ${up.error}` });
    }
  }

  // If setting active=true, disable any previously active promotions.
  if (active) {
    await Promotion.updateMany({ active: true }, { $set: { active: false } }).exec();
  }

  const doc = await Promotion.create({
    title,
    description,
    promoCode,
    imageUrl,
    active,
    updatedBy: req.user?._id || null,
  });

  res.json({
    success: true,
    data: {
      id: String(doc._id),
      title: doc.title,
      description: doc.description || '',
      promoCode: doc.promoCode || '',
      imageUrl: doc.imageUrl || '',
      active: doc.active,
      updatedAt: doc.updatedAt,
    },
  });
});

// Admin: PATCH /api/v1/admin/promotions/:id (toggle only)
const updatePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await Promotion.findById(id);
  if (!doc) return res.status(404).json({ success: false, message: 'Promotion not found.' });

  if (typeof req.body?.active === 'boolean') {
    if (req.body.active) {
      await Promotion.updateMany({ active: true }, { $set: { active: false } }).exec();
      doc.active = true;
    } else {
      doc.active = false;
    }
  }
  doc.updatedBy = req.user?._id || doc.updatedBy;
  await doc.save();
  res.json({ success: true, data: doc });
});

module.exports = {
  getActivePromotion,
  listPromotions,
  upsertActivePromotion,
  updatePromotion,
};

