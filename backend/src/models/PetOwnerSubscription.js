const mongoose = require('mongoose');

// pet owner care plans (separate from provider Subscription)
const petOwnerSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: {
      type: String,
      enum: ['basic_monthly', 'premium_monthly', 'basic_annual', 'premium_annual'],
      required: true,
    },
    billingCycle: { type: String, enum: ['monthly', 'annual'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending_payment', 'active', 'cancelling', 'cancelled', 'expired'],
      default: 'active',
    },
    price: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['khalti', 'fonepay'],
    },
    paymentRef: { type: String, trim: true },
    renewalReminder30Sent: { type: Boolean, default: false },
    renewalReminder7Sent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

petOwnerSubscriptionSchema.index({ user: 1, status: 1, plan: 1 });

module.exports = mongoose.model('PetOwnerSubscription', petOwnerSubscriptionSchema);
