const mongoose = require('mongoose');

const vetDirectMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
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
  },
  { timestamps: true }
);

vetDirectMessageSchema.index({ roomId: 1, createdAt: 1 });

vetDirectMessageSchema.pre('validate', function validateTextOrMedia() {
  const t = (this.text || '').trim();
  const hasMedia =
    this.mediaUrl &&
    String(this.mediaUrl).trim() &&
    (this.mediaType === 'image' || this.mediaType === 'video');
  if (!t && !hasMedia) {
    this.invalidate('text', 'Message must include text or media');
  }
});

module.exports = mongoose.model('VetDirectMessage', vetDirectMessageSchema);
