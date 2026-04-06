const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['service_request', 'case', 'system', 'reminder', 'care_booking'],
      default: 'service_request',
    },
    serviceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRequest',
    },
    careBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CareBooking',
    },
    isRead: {
      type: Boolean,
      default: false,
    },

    // Optional: reminder notifications (health timeline)
    reminderPet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' },
    reminderId: { type: mongoose.Schema.Types.ObjectId },
    reminderDueDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
// Prevent duplicate "24h before" reminders per user/reminder/dueDate
notificationSchema.index(
  { user: 1, type: 1, reminderId: 1, reminderDueDate: 1 },
  { unique: true, partialFilterExpression: { type: 'reminder', reminderId: { $exists: true } } }
);

module.exports = mongoose.model('Notification', notificationSchema, 'notifications');

