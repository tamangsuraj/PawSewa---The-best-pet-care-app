const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Global unique identifier used across all apps (PawID)
    pawId: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide pet name'],
      trim: true,
    },
    species: {
      type: String,
      required: [true, 'Please provide species'],
      enum: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Other'],
    },
    breed: {
      type: String,
      trim: true,
    },
    dob: {
      type: Date,
    },
    age: {
      type: Number,
      min: 0,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: [true, 'Please provide gender'],
    },
    weight: {
      type: Number,
      min: 0,
    },
    photoUrl: {
      type: String,
      default: '',
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
    },
    medicalConditions: {
      type: String,
      trim: true,
    },
    behavioralNotes: {
      type: String,
      trim: true,
    },
    isVaccinated: {
      type: Boolean,
      default: false,
    },
    medicalHistory: [
      {
        type: String,
      },
    ],
    lastVetVisit: { type: Date },
    vaccinationStatus: {
      type: String,
      enum: ['Up to date', 'Due soon', 'Overdue'],
    },
    nextVaccinationDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

/**
 * Generate a PawID in the format:
 *   PAW-YYYY-XXXX
 * where XXXX is 4 random alphanumeric characters (A–Z, 0–9).
 */
function generatePawId() {
  const year = new Date().getFullYear();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    suffix += alphabet[idx];
  }
  return `PAW-${year}-${suffix}`;
}

// Pre-save hook to ensure every pet has a globally unique pawId.
// Uses a short retry loop to guard against rare collisions.
petSchema.pre('save', async function setPawIdIfMissing() {
  if (!this.isNew || this.pawId) return;

  const Pet = this.constructor;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generatePawId();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Pet.exists({ pawId: candidate });
    if (!exists) {
      this.pawId = candidate;
      return;
    }
  }

  const error = new Error('Could not generate a unique PawID. Please try again.');
  error.statusCode = 500;
  throw error;
});

module.exports = mongoose.model('Pet', petSchema);
