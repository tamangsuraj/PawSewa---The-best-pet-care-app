const mongoose = require('mongoose');

const paymentLogSchema = new mongoose.Schema(
  {
    pidx: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    amountPaisa: { type: Number },
    status: { type: String, required: true, trim: true },
    purchaseOrderId: { type: String, trim: true },
    type: { type: String, enum: ['order', 'service', 'care'], default: 'order' },
    gateway: { type: String, default: 'khalti' },
    rawPayload: { type: Object, default: {} },
  },
  { timestamps: true }
);

paymentLogSchema.index({ pidx: 1 });
paymentLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PaymentLog', paymentLogSchema);
