/**
 * Indexes customer <-> shop_owner marketplace threads (MarketplaceConversation type SELLER)
 * for admin audit and analytics. Rows are upserted when a seller thread is opened.
 */
const mongoose = require('mongoose');

const shopChatThreadSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketplaceConversation',
      required: true,
      unique: true,
    },
    /** Shop owner (same ref as Product.seller / Order.shopId). */
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'shop_chats' }
);

shopChatThreadSchema.index({ shopId: 1, lastMessageAt: -1 });
shopChatThreadSchema.index({ customerId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('ShopChat', shopChatThreadSchema);
