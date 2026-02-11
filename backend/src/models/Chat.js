const mongoose = require('mongoose');

/**
 * Chat room for a single service request.
 *
 * - One Chat per ServiceRequest (enforced via unique index).
 * - participants: service owner + assigned staff.
 * - isReadOnly: set when chat is expired (e.g. 24h after completion).
 *
 * NOTE: Actual messages are stored in ServiceRequestMessage to keep
 * the history consistent with the existing implementation.
 */
const chatSchema = new mongoose.Schema(
  {
    serviceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      unique: true,
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    isReadOnly: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ serviceRequest: 1 }, { unique: true });

module.exports = mongoose.model('Chat', chatSchema);

