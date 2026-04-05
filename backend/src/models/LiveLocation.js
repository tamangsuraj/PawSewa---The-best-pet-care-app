const mongoose = require('mongoose');

/**
 * Operational pins for the admin Live Map (shops, care venues, simulated moving fleet).
 * Customer home addresses must never be stored here — only service points / venues / dispatch positions.
 */
const liveLocationSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['pet_shop', 'care_center', 'sim_rider', 'sim_vet'],
      index: true,
    },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['active', 'busy'],
      default: 'active',
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    /** Relative admin path, e.g. /shops */
    detailPath: { type: String, default: '/' },
    isDynamic: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'live_locations',
  }
);

module.exports = mongoose.model('LiveLocation', liveLocationSchema);
