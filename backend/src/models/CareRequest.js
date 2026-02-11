const mongoose = require('mongoose');

const careLocationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: [true, 'Care location address is required'],
      trim: true,
    },
    // GeoJSON Point [lng, lat]
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
  { _id: false }
);

const careRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
    },
    serviceType: {
      type: String,
      enum: ['Grooming', 'Bathing', 'Training'],
      required: true,
    },
    preferredDate: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Care+ lifecycle
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'assigned', 'in_progress', 'completed'],
      default: 'draft', // becomes pending_review only after verified payment
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
    },
    location: {
      type: careLocationSchema,
      required: true,
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

careRequestSchema.index({ user: 1, status: 1, preferredDate: 1 });
careRequestSchema.index({ 'location.point': '2dsphere' });

module.exports = mongoose.model('CareRequest', careRequestSchema);

