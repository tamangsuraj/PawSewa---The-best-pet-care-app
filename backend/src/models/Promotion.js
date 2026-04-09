const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 240 },
    promoCode: { type: String, default: '', trim: true, maxlength: 32 },
    imageUrl: { type: String, default: '', trim: true, maxlength: 2000 },
    active: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'promotions' }
);

promotionSchema.index({ active: 1, updatedAt: -1 });

module.exports = mongoose.model('Promotion', promotionSchema);

