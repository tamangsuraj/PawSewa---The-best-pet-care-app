const mongoose = require('mongoose');

/**
 * Per-user unread counts keyed by thread id:
 * - c:{conversationId} — marketplace / support / delivery
 * - r:{serviceRequestId}
 * - v:{ownerId}:{vetId} — vet-direct
 */
const chatUnreadStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    threads: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatUnreadState', chatUnreadStateSchema);
