const mongoose = require('mongoose');

const weightEntrySchema = new mongoose.Schema(
  {
    recordedAt: { type: Date, required: true, default: Date.now, index: true },
    weightKg: { type: Number, required: true, min: 0 },
    source: {
      type: String,
      enum: ['owner', 'vet', 'system'],
      default: 'owner',
    },
  },
  { _id: true, timestamps: false }
);

const reminderSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ['vaccination', 'deworming', 'flea_tick', 'checkup'],
      index: true,
    },
    title: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true, index: true },

    // Follow-up lifecycle (admin/vet ops)
    status: {
      type: String,
      enum: ['upcoming', 'completed', 'skipped'],
      default: 'upcoming',
      index: true,
    },
    called: { type: Boolean, default: false, index: true },
    calledAt: { type: Date },
    completedAt: { type: Date },

    // Overrides for real-world delayed doses
    originalDueDate: { type: Date },
    overriddenDueDate: { type: Date },
    overrideReason: { type: String, trim: true },
    overrideBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    overrideByRole: { type: String, trim: true }, // 'admin' | 'vet'

    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal',
      index: true,
    },
    engine: {
      version: { type: String, default: 'v1', trim: true },
      ruleId: { type: String, trim: true },
    },
  },
  { _id: true, timestamps: true }
);

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
    isOutdoor: {
      type: Boolean,
      default: false,
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
    /** Time-ordered weigh-ins for charts (capped on write in controller). */
    weightHistory: {
      type: [weightEntrySchema],
      default: [],
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
    /** Structured vet links for in-app "Vet chat" eligibility (optional). */
    linkedVetVisits: [
      {
        veterinarian: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        summary: { type: String, trim: true },
        recordedAt: { type: Date, default: Date.now },
      },
    ],
    lastVetVisit: { type: Date },
    vaccinationStatus: {
      type: String,
      enum: ['Up to date', 'Due soon', 'Overdue'],
    },
    nextVaccinationDate: { type: Date },

    reminders: {
      type: [reminderSchema],
      default: [],
    },
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

// Pre-save hook to ensure every pet has a globally unique pawId (new + legacy docs).
// Uses a short retry loop to guard against rare collisions.
petSchema.pre('save', async function setPawIdIfMissing() {
  if (this.pawId) return;

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
