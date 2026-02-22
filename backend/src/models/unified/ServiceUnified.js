/**
 * Unified Service model for pawsewa_production.
 * Collection: services
 * Consolidates Hostels, Grooming centers, Spas, Training.
 * Linked via providerId -> users
 */
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  address: { type: String, required: true, trim: true },
  coordinates: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
}, { _id: false });

const serviceSchema = new mongoose.Schema({
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserUnified', required: true },
  type: {
    type: String,
    enum: ['hostel', 'grooming', 'spa', 'training', 'daycare', 'wash'],
    required: true,
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, maxlength: 2000 },
  location: { type: locationSchema, required: true },
  pricePerNight: { type: Number, min: 0 },
  pricePerSession: { type: Number, min: 0 },
  images: { type: [String], default: [] },
  amenities: { type: [String], default: [] },
  roomTypes: [{ name: String, pricePerNight: Number, description: String, amenities: [String] }],
  groomingPackages: [{ name: String, price: Number, description: String, durationMinutes: Number }],
  addOns: [{ name: String, price: Number }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false },
}, { timestamps: true, collection: 'services' });

serviceSchema.index({ providerId: 1 });
serviceSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('ServiceUnified', serviceSchema);
