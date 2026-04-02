const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

notificationLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema, 'notification_logs');

