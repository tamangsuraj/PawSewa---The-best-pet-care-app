const mongoose = require('mongoose');

const shopRecommendationEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    action: {
      type: String,
      enum: ['add_to_cart', 'view_product'],
      default: 'add_to_cart',
    },
    /** Product matched the user's primary pet type at event time */
    personalizedMatch: { type: Boolean, default: false },
    userPetType: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

shopRecommendationEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ShopRecommendationEvent', shopRecommendationEventSchema);
