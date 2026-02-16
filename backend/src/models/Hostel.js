const mongoose = require('mongoose');

const hostelLocationSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  { _id: false }
);

const hostelSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    location: {
      type: hostelLocationSchema,
      required: true,
    },
    pricePerNight: {
      type: Number,
      required: true,
      min: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    amenities: {
      type: [String],
      default: [],
    },
    roomTypes: [
      {
        name: { type: String, required: true },
        pricePerNight: { type: Number, required: true, min: 0 },
        description: { type: String, trim: true },
        amenities: [String],
      },
    ],
    schedule: [
      {
        time: { type: String, required: true },
        activity: { type: String, required: true },
      },
    ],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    serviceType: {
      type: String,
      enum: ['Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'],
      default: 'Hostel',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    pricePerSession: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true }
);

hostelSchema.index({ ownerId: 1 });
hostelSchema.index({ isVerified: 1, serviceType: 1 });
hostelSchema.index({ isActive: 1, isAvailable: 1, serviceType: 1 });
hostelSchema.index({ 'location.coordinates.lat': 1, 'location.coordinates.lng': 1 });

module.exports = mongoose.model('Hostel', hostelSchema);
