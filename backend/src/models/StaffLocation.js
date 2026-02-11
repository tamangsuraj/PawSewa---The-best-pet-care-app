const mongoose = require('mongoose');

const staffLocationSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['veterinarian', 'rider', 'shop_owner', 'care_service', 'admin'],
      required: true,
    },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    // TTL index – records automatically expire after 60 seconds
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model('StaffLocation', staffLocationSchema);

