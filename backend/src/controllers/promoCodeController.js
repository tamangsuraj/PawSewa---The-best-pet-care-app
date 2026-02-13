const asyncHandler = require('express-async-handler');
const PromoCode = require('../models/PromoCode');

// POST /api/v1/promocodes/validate (public - no auth)
// Body: { code: string, currentOrderAmount: number }
// Optional: alreadyAppliedCode - if set and same code, return "Code already applied."
const validatePromoCode = asyncHandler(async (req, res) => {
  const { code, currentOrderAmount, alreadyAppliedCode } = req.body || {};
  const enteredCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const orderTotal = Number(currentOrderAmount) || 0;

  if (!enteredCode) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a promo code.',
    });
  }

  const promo = await PromoCode.findOne({ code: enteredCode }).lean();
  if (!promo) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or inactive code.',
    });
  }

  if (!promo.isActive) {
    return res.status(400).json({
      success: false,
      message: 'This code is no longer active.',
    });
  }

  if (alreadyAppliedCode && alreadyAppliedCode.toUpperCase() === enteredCode) {
    return res.status(400).json({
      success: false,
      message: 'Code already applied.',
    });
  }

  if (new Date() > new Date(promo.expiryDate)) {
    return res.status(400).json({
      success: false,
      message: 'This code has expired.',
    });
  }

  if (promo.usedCount >= promo.usageLimit) {
    return res.status(400).json({
      success: false,
      message: 'This code has reached its limit.',
    });
  }

  if (orderTotal < promo.minOrderAmount) {
    const more = Math.ceil(promo.minOrderAmount - orderTotal);
    return res.status(400).json({
      success: false,
      message: `Add Rs. ${more} more to use this code!`,
    });
  }

  const discountAmountRaw = (orderTotal * promo.discountPercentage) / 100;
  const discountAmount = promo.maxDiscountAmount != null
    ? Math.min(discountAmountRaw, promo.maxDiscountAmount)
    : discountAmountRaw;

  return res.status(200).json({
    success: true,
    data: {
      code: promo.code,
      discountPercentage: promo.discountPercentage,
      discountAmount: Math.round(discountAmount * 100) / 100,
    },
  });
});

// GET /api/v1/promocodes (admin) - list all
const listPromoCodes = asyncHandler(async (req, res) => {
  const promos = await PromoCode.find({}).sort({ createdAt: -1 }).lean();
  res.status(200).json({ success: true, data: promos });
});

// POST /api/v1/promocodes (admin) - create
const createPromoCode = asyncHandler(async (req, res) => {
  const {
    code,
    discountPercentage,
    minOrderAmount,
    maxDiscountAmount,
    expiryDate,
    usageLimit,
  } = req.body || {};

  const codeStr = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!codeStr) {
    return res.status(400).json({ success: false, message: 'Code is required.' });
  }
  if (typeof discountPercentage !== 'number' || discountPercentage < 0 || discountPercentage > 100) {
    return res.status(400).json({ success: false, message: 'Discount percentage must be 0–100.' });
  }
  if (typeof minOrderAmount !== 'number' || minOrderAmount < 0) {
    return res.status(400).json({ success: false, message: 'Min order amount must be a positive number.' });
  }
  if (usageLimit == null || typeof usageLimit !== 'number' || usageLimit < 0) {
    return res.status(400).json({ success: false, message: 'Usage limit is required and must be ≥ 0.' });
  }

  const expiry = expiryDate ? new Date(expiryDate) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) {
    return res.status(400).json({ success: false, message: 'Valid expiry date is required.' });
  }

  const existing = await PromoCode.findOne({ code: codeStr });
  if (existing) {
    return res.status(400).json({ success: false, message: 'A promo with this code already exists.' });
  }

  const promo = await PromoCode.create({
    code: codeStr,
    discountPercentage,
    minOrderAmount,
    maxDiscountAmount: maxDiscountAmount != null ? Number(maxDiscountAmount) : null,
    expiryDate: expiry,
    usageLimit,
  });

  res.status(201).json({ success: true, data: promo });
});

// PATCH /api/v1/promocodes/:id (admin) - deactivate or reactivate
const updatePromoCode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body || {};
  const promo = await PromoCode.findById(id);
  if (!promo) {
    return res.status(404).json({ success: false, message: 'Promo code not found.' });
  }
  if (typeof isActive === 'boolean') {
    promo.isActive = isActive;
  }
  await promo.save();
  res.status(200).json({ success: true, data: promo });
});

// DELETE /api/v1/promocodes/:id (admin) - delete
const deletePromoCode = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findByIdAndDelete(req.params.id);
  if (!promo) {
    return res.status(404).json({ success: false, message: 'Promo code not found.' });
  }
  res.status(200).json({ success: true, message: 'Promo code deleted.' });
});

// POST /api/v1/promocodes/:id/increment-usage (internal or after order placed)
const incrementUsage = asyncHandler(async (req, res) => {
  const promo = await PromoCode.findById(req.params.id);
  if (!promo) {
    return res.status(404).json({ success: false, message: 'Promo code not found.' });
  }
  promo.usedCount += 1;
  await promo.save();
  res.status(200).json({ success: true, data: promo });
});

module.exports = {
  validatePromoCode,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  incrementUsage,
};
