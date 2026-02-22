const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: String,
        price: Number,
        quantity: Number,
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      default: null,
      trim: true,
      // e.g. 'khalti', 'cod' when set by backend
    },
    deliveryLocation: {
      address: {
        type: String,
        required: true,
        trim: true,
      },
      point: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [lng, lat]
          required: true,
        },
      },
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'out_for_delivery', 'delivered'],
      default: 'pending',
    },
    // deliveryCoordinates: { lat, lng } for navigation (derived from deliveryLocation)
    deliveryCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    assignedRider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // deliveryStatus: Pending | Assigned | PickedUp | Delivered (synced with status)
    deliveryStatus: {
      type: String,
      enum: ['Pending', 'Assigned', 'PickedUp', 'Delivered'],
      default: 'Pending',
    },
    deliveryNotes: {
      type: String,
      default: null,
      trim: true,
      maxLength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common dashboard / query patterns
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ assignedRider: 1, status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'deliveryLocation.point': '2dsphere' });

// Sync deliveryCoordinates and deliveryStatus from deliveryLocation/status
orderSchema.pre('save', function (next) {
  const coords = this.deliveryLocation?.point?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    this.deliveryCoordinates = { lng: coords[0], lat: coords[1] };
  }
  const statusMap = {
    pending: 'Pending',
    processing: 'Assigned',
    out_for_delivery: 'PickedUp',
    delivered: 'Delivered',
  };
  if (this.status) this.deliveryStatus = statusMap[this.status] || 'Pending';
  next();
});

module.exports = mongoose.model('Order', orderSchema);

