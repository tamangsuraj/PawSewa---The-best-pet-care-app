const mongoose = require('mongoose');

const marketplaceMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketplaceConversation',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** Set for SUPPORT threads (and optional elsewhere). */
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: '',
    },
    mediaUrl: {
      type: String,
      trim: true,
      default: '',
    },
    mediaType: {
      type: String,
      enum: ['', 'image', 'video'],
      default: '',
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    productName: {
      type: String,
      trim: true,
      default: '',
    },
    /** Denormalized for admin / analytics (set on send). */
    senderRole: {
      type: String,
      trim: true,
      default: '',
    },
    receiverRole: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

marketplaceMessageSchema.index({ conversation: 1, createdAt: 1 });

marketplaceMessageSchema.pre('validate', function validateContentOrMedia(next) {
  const text = (this.content || '').trim();
  const hasMedia =
    this.mediaUrl &&
    String(this.mediaUrl).trim() &&
    (this.mediaType === 'image' || this.mediaType === 'video');
  if (!text && !hasMedia) {
    this.invalidate('content', 'Message must include text or media');
  }
  next();
});

module.exports = mongoose.model('MarketplaceMessage', marketplaceMessageSchema);
