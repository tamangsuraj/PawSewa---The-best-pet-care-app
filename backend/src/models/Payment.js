const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      required: false,
    },
    careRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CareRequest',
      required: false,
    },
    targetType: {
      type: String,
      enum: ['service', 'care'],
      required: true,
    },
    amount: {
      type: Number, // NPR
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'NPR',
    },
    gateway: {
      type: String,
      enum: ['khalti', 'esewa'],
      required: true,
    },
    status: {
      type: String,
      enum: ['initiated', 'pending', 'completed', 'failed'],
      default: 'initiated',
    },
    gatewayTransactionId: {
      type: String, // e.g. pidx (Khalti) or transaction_uuid (eSewa)
    },
    rawGatewayPayload: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ user: 1, serviceRequest: 1, careRequest: 1, gateway: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

