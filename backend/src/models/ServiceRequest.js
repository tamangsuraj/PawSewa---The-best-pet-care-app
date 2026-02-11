const mongoose = require('mongoose');

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
      enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
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

// Pre-save middleware:
// 1) Validate location is inside Kathmandu Valley
// 2) Prevent duplicate pending requests for same pet on same date
serviceRequestSchema.pre('save', async function (next) {
  // Only check on new documents
  if (!this.isNew) {
    return next();
  }

  try {
    // 1) Validate geofence (Kathmandu Valley)
    const { location } = this;
    const lat = location?.coordinates?.lat;
    const lng = location?.coordinates?.lng;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      const error = new Error('Valid location coordinates are required');
      error.statusCode = 400;
      return next(error);
    }

    const insideKathmandu =
      lat >= KATHMANDU_BOUNDS.minLat &&
      lat <= KATHMANDU_BOUNDS.maxLat &&
      lng >= KATHMANDU_BOUNDS.minLng &&
      lng <= KATHMANDU_BOUNDS.maxLng;

    if (!insideKathmandu) {
      const error = new Error('Service is restricted to Kathmandu Valley');
      error.statusCode = 400;
      return next(error);
    }

    // 2) Check if there's already a pending request for this pet on this date
    // Check if there's already a pending request for this pet on this date
    const startOfDay = new Date(this.preferredDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(this.preferredDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingRequest = await this.constructor.findOne({
      pet: this.pet,
      preferredDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: 'pending',
    });

    if (existingRequest) {
      const error = new Error('A request for this pet is already under review for this date.');
      error.statusCode = 400;
      return next(error);
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
