/**
 * Unified Order model for pawsewa_production.
 * Collection: orders
 * E-commerce shop transactions.
 */
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: String,
    price: Number,
    quantity: Number,
  },
  { _id: false }
);

const deliveryLocationSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserUnified', required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    paymentMethod: { type: String, trim: true },
    deliveryLocation: { type: deliveryLocationSchema, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'out_for_delivery', 'delivered'],
      default: 'pending',
    },
    assignedRiderId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserUnified' },
    deliveryNotes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, collection: 'orders' }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('OrderUnified', orderSchema);
