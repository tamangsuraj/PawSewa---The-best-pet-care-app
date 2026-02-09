const mongoose = require('mongoose');

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

// Pre-save middleware: Prevent duplicate pending requests for same pet on same date
serviceRequestSchema.pre('save', async function (next) {
  // Only check on new documents
  if (!this.isNew) {
    return next();
  }

  try {
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
