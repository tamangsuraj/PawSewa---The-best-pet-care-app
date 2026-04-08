const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** Mirror of [user] for APIs / analytics (customer). */
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /** Shop owner fulfilling the order (same as primary Product.seller). */
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    khaltiTransactionId: {
      type: String,
      trim: true,
      default: null,
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
    // High-precision GPS + human-readable address (synced with deliveryLocation.point)
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String, trim: true },
    },
    /** Exact device GPS lock at checkout (survives Khalti draft metadata). */
    liveLocation: {
      lat: { type: Number },
      lng: { type: Number },
      timestamp: { type: Date },
    },
    status: {
      type: String,
      enum: [
        'pending_confirmation',
        'pending',
        'processing',
        'ready_for_pickup',
        'packed',
        'assigned_to_rider',
        'out_for_delivery',
        'delivered',
        'returned',
        'refunded',
        'cancelled',
      ],
      default: 'pending_confirmation',
    },
    /** Seller / carrier tracking reference (optional). */
    trackingNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    /** When seller marked items packed (ready for rider pickup). */
    packedAt: {
      type: Date,
      default: null,
    },
    /** Set when order is returned, refunded, or cancelled (for analytics). */
    fulfillmentCloseReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    /** Workflow label for admin / analytics / sockets (derived on save). */
    assignmentStatus: {
      type: String,
      enum: [
        'NONE',
        'ASSIGNED_TO_SELLER',
        'SELLER_CONFIRMED',
        'ASSIGNED_TO_RIDER',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
      ],
      default: 'NONE',
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
    /** Care+ / marketplace: shop owner who fulfills picked items before rider pickup */
    assignedSeller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sellerConfirmedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      default: null,
      trim: true,
      maxLength: 2000,
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
    /** Set when status becomes delivered (for delivery-chat 30m grace window). */
    deliveredAt: {
      type: Date,
      default: null,
    },
    /** Rider proof-of-delivery: OTP/photo/notes recorded at delivery time. */
    proofOfDelivery: {
      otp: { type: String, trim: true, default: '' },
      photoUrl: { type: String, trim: true, default: '' },
      notes: { type: String, trim: true, default: '' },
      submittedAt: { type: Date, default: null },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common dashboard / query patterns
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ shopId: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ assignedRider: 1, status: 1 });
orderSchema.index({ assignedSeller: 1, status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'deliveryLocation.point': '2dsphere' });

// Sync deliveryCoordinates, customerId, shopId, and deliveryStatus from deliveryLocation/status
orderSchema.pre('save', function () {
  if (this.user && !this.customerId) {
    this.customerId = this.user;
  }
  if (this.assignedSeller && !this.shopId) {
    this.shopId = this.assignedSeller;
  }
  const coords = this.deliveryLocation?.point?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    this.deliveryCoordinates = { lng: coords[0], lat: coords[1] };
    const addr = this.deliveryLocation?.address || '';
    this.location = {
      lat: coords[1],
      lng: coords[0],
      address: addr,
    };
  }
  const statusMap = {
    pending_confirmation: 'Pending',
    pending: 'Pending',
    processing: 'Assigned',
    ready_for_pickup: 'Assigned',
    packed: 'Assigned',
    assigned_to_rider: 'Assigned',
    out_for_delivery: 'PickedUp',
    delivered: 'Delivered',
    returned: 'Delivered',
    refunded: 'Delivered',
    cancelled: 'Pending',
  };
  if (this.status) this.deliveryStatus = statusMap[this.status] || 'Pending';

  const st = this.status;
  if (st === 'delivered') {
    this.assignmentStatus = 'DELIVERED';
  } else if (st === 'returned' || st === 'refunded' || st === 'cancelled') {
    this.assignmentStatus = 'NONE';
  } else if (st === 'out_for_delivery') {
    this.assignmentStatus = 'OUT_FOR_DELIVERY';
  } else if (this.assignedRider || st === 'assigned_to_rider') {
    this.assignmentStatus = 'ASSIGNED_TO_RIDER';
  } else if (this.sellerConfirmedAt || st === 'ready_for_pickup' || st === 'packed') {
    this.assignmentStatus = 'SELLER_CONFIRMED';
  } else if (this.assignedSeller) {
    this.assignmentStatus = 'ASSIGNED_TO_SELLER';
  } else {
    this.assignmentStatus = 'NONE';
  }
});

module.exports = mongoose.model('Order', orderSchema);

