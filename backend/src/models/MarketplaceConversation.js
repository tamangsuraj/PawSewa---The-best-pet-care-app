const mongoose = require('mongoose');

/**
 * Unified conversations: SUPPORT (Customer Care), SELLER, DELIVERY.
 * For SUPPORT, `partner` is the care admin (same role as legacy careAdmin).
 */
const marketplaceConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['SUPPORT', 'SELLER', 'DELIVERY'],
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** SUPPORT: care admin | SELLER: shop_owner | DELIVERY: rider */
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    lastProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    lastProductName: {
      type: String,
      trim: true,
      default: '',
    },
    deliveryChatExpiresAt: {
      type: Date,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

marketplaceConversationSchema.index(
  { type: 1, customer: 1 },
  { unique: true, partialFilterExpression: { type: 'SUPPORT' } }
);
marketplaceConversationSchema.index(
  { type: 1, customer: 1, partner: 1 },
  { unique: true, partialFilterExpression: { type: 'SELLER' } }
);
marketplaceConversationSchema.index(
  { type: 1, order: 1 },
  { unique: true, partialFilterExpression: { type: 'DELIVERY', order: { $type: 'objectId' } } }
);
marketplaceConversationSchema.index({ partner: 1, updatedAt: -1 });
marketplaceConversationSchema.index({ customer: 1, updatedAt: -1 });

module.exports = mongoose.model('MarketplaceConversation', marketplaceConversationSchema);
