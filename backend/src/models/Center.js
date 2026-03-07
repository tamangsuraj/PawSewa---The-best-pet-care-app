const mongoose = require('mongoose');

const centerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: { type: [Number], default: [0, 0] },
    },
  },
  { timestamps: true }
);

centerSchema.index({ name: 1 });

module.exports = mongoose.model('Center', centerSchema, 'centers');
