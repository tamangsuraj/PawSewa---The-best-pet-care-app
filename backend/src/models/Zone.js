const mongoose = require('mongoose');

// service area zones for vet assignment
const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    districts: [{ type: String, trim: true }],
    polygonCoords: [[{ type: Number }]],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Zone', zoneSchema);
