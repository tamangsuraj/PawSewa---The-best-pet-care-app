const mongoose = require('mongoose');

/**
 * Message in a Customer Care conversation.
 * senderId / receiverId match the spec; createdAt serves as timestamp.
 */
const customerCareMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomerCareConversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
  },
  { timestamps: true }
);

customerCareMessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('CustomerCareMessage', customerCareMessageSchema);
