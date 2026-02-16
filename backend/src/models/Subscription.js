const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['basic', 'premium'],
      required: true,
    },
    displayName: { type: String, default: 'Basic' },
    maxListings: { type: Number, default: 5 }, // -1 = unlimited
    maxPhotos: { type: Number, default: 3 },   // -1 = unlimited
    isFeatured: { type: Boolean, default: false },
    platformFeePercent: { type: Number, default: 15 }, // Basic: 15%, Premium: 5%
    monthlyPrice: { type: Number, required: true },
    yearlyPrice: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: ['basic', 'premium'],
      required: true,
      default: 'basic',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
      default: 'monthly',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending_payment'],
      default: 'pending_payment',
    },
    validFrom: { type: Date },
    validUntil: { type: Date },
    amountPaid: { type: Number, default: 0 },
    gatewayTransactionId: { type: String },
  },
  { timestamps: true }
);

subscriptionSchema.index({ providerId: 1, status: 1 });
subscriptionSchema.index({ validUntil: 1, status: 1 });

// Static: get plan config
subscriptionSchema.statics.getPlanConfig = function (plan) {
  const configs = {
    basic: {
      maxListings: 5,
      maxPhotos: 3,
      isFeatured: false,
      platformFeePercent: 15,
      monthlyPrice: 500,
      yearlyPrice: 5000,
    },
    premium: {
      maxListings: -1,
      maxPhotos: -1,
      isFeatured: true,
      platformFeePercent: 5,
      monthlyPrice: 1500,
      yearlyPrice: 15000,
    },
  };
  return configs[plan] || configs.basic;
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
