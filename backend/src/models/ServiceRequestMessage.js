const mongoose = require('mongoose');

const serviceRequestMessageSchema = new mongoose.Schema(
  {
    serviceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 2000,
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

serviceRequestMessageSchema.index({ serviceRequest: 1, createdAt: 1 });

serviceRequestMessageSchema.pre('validate', function validateContentOrMedia() {
  const text = (this.content || '').trim();
  const hasMedia =
    this.mediaUrl &&
    String(this.mediaUrl).trim() &&
    (this.mediaType === 'image' || this.mediaType === 'video');
  if (!text && !hasMedia) {
    this.invalidate('content', 'Message must include text or media');
  }
});

module.exports = mongoose.model('ServiceRequestMessage', serviceRequestMessageSchema);
