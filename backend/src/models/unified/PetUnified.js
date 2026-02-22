/**
 * Unified Pet model for pawsewa_production.
 * Collection: pets
 * Linked via ownerId -> users
 */
const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserUnified', required: true },
    pawId: { type: String, unique: true, sparse: true, trim: true },
    name: { type: String, required: true, trim: true },
    species: { type: String, required: true, trim: true },
    breed: { type: String, trim: true },
    dob: { type: Date },
    age: { type: Number, min: 0 },
    gender: { type: String, enum: ['Male', 'Female'], trim: true },
    weight: { type: Number, min: 0 },
    photoUrl: { type: String, default: '' },
    medicalConditions: { type: String, trim: true },
    isVaccinated: { type: Boolean, default: false },
    medicalHistory: [String],
  },
  { timestamps: true, collection: 'pets' }
);

petSchema.index({ ownerId: 1 });
// pawId index is created by unique: true, sparse: true on the field

module.exports = mongoose.model('PetUnified', petSchema);
