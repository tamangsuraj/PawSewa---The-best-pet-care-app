const mongoose = require('mongoose');
const { ALL_STATUSES } = require('../constants/serviceRequestStatus');

const KATHMANDU_BOUNDS = {
  minLat: 27.55,
  maxLat: 27.82,
  minLng: 85.18,
  maxLng: 85.55,
};

const serviceRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: [true, 'Pet is required'],
    },
    serviceType: {
      type: String,
      enum: ['Appointment', 'Health Checkup', 'Vaccination'],
      required: [true, 'Service type is required'],
    },
    preferredDate: {
      type: Date,
      required: [true, 'Preferred date is required'],
    },
    timeWindow: {
      type: String,
      enum: ['Morning (9am-12pm)', 'Afternoon (12pm-4pm)', 'Evening (4pm-8pm)'],
      required: [true, 'Time window is required'],
    },
    location: {
      address: {
        type: String,
        required: [true, 'Service location address is required'],
        trim: true,
      },
      coordinates: {
        lat: {
          type: Number,
          required: [true, 'Latitude is required'],
        },
        lng: {
          type: Number,
          required: [true, 'Longitude is required'],
        },
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ALL_STATUSES,
      default: 'pending',
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    scheduledTime: {
      type: Date,
    },
    assignedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Optional visit notes written by the veterinarian at completion time.
    // These are also pushed into the pet's medicalHistory array for a longitudinal record.
    visitNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    // Owner-submitted review after completion
    review: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, trim: true, maxlength: 1000 },
      submittedAt: { type: Date },
    },
    // Optional prescription document URL (set by staff; owner can download)
    prescriptionUrl: {
      type: String,
      trim: true,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid', 'failed'],
      default: 'unpaid',
    },
    paymentGateway: {
      type: String,
      enum: ['khalti', 'esewa', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
serviceRequestSchema.index({ user: 1, status: 1 });
serviceRequestSchema.index({ assignedStaff: 1, status: 1 });
serviceRequestSchema.index({ preferredDate: 1, status: 1 });
serviceRequestSchema.index({ pet: 1, preferredDate: 1, status: 1 });

// Pre-save middleware (async: use throw/return, do not use next())
// 1) Validate location is inside Kathmandu Valley
// 2) Prevent duplicate pending requests for same pet on same date
serviceRequestSchema.pre('save', async function () {
  if (!this.isNew) return;

  // 1) Validate geofence (Kathmandu Valley)
  const { location } = this;
  const lat = location?.coordinates?.lat;
  const lng = location?.coordinates?.lng;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    const err = new Error('Valid location coordinates are required');
    err.statusCode = 400;
    throw err;
  }

  const insideKathmandu =
    lat >= KATHMANDU_BOUNDS.minLat &&
    lat <= KATHMANDU_BOUNDS.maxLat &&
    lng >= KATHMANDU_BOUNDS.minLng &&
    lng <= KATHMANDU_BOUNDS.maxLng;

  if (!insideKathmandu) {
    const err = new Error('Service is restricted to Kathmandu Valley');
    err.statusCode = 400;
    throw err;
  }

  // 2) Duplicate check: same pet, same date, pending
  const startOfDay = new Date(this.preferredDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(this.preferredDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingRequest = await this.constructor.findOne({
    pet: this.pet,
    preferredDate: { $gte: startOfDay, $lte: endOfDay },
    status: 'pending',
  });

  if (existingRequest) {
    const err = new Error('A request for this pet is already under review for this date.');
    err.statusCode = 400;
    throw err;
  }
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
