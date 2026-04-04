const mongoose = require('mongoose');

/**
 * One-to-one support thread between a pet owner (customer) and Customer Care admin.
 */
const customerCareConversationSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    careAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

customerCareConversationSchema.index({ careAdmin: 1, updatedAt: -1 });

module.exports = mongoose.model('CustomerCareConversation', customerCareConversationSchema);
