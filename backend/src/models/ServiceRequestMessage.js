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
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

serviceRequestMessageSchema.index({ serviceRequest: 1, createdAt: 1 });

module.exports = mongoose.model('ServiceRequestMessage', serviceRequestMessageSchema);
