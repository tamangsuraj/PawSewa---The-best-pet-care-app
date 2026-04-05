const mongoose = require('mongoose');

const careBookingSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: true,
    },
    petId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      required: true,
    },
    roomType: {
      type: String,
      trim: true,
    },
    nights: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    cleaningFee: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'cash_on_delivery'],
      default: 'online',
    },
    ownerNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    serviceType: {
      type: String,
      enum: ['Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'],
      trim: true,
    },
    packageName: { type: String, trim: true },
    addOns: { type: [String], default: [] },
    serviceDelivery: { type: String, enum: ['home_visit', 'visit_center'], trim: true },
    /** Admin-dispatched professional (vet / groomer / etc.) — surfaces in Partner app + sockets. */
    assignedPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    careAssignmentStatus: {
      type: String,
      enum: ['UNASSIGNED', 'ASSIGNED_TO_PROFESSIONAL'],
      default: 'UNASSIGNED',
    },
  },
  { timestamps: true }
);

careBookingSchema.index({ hostelId: 1, status: 1 });
careBookingSchema.index({ userId: 1, status: 1 });
careBookingSchema.index({ serviceType: 1, status: 1 });
careBookingSchema.index({ petId: 1 });
careBookingSchema.index({ assignedPartner: 1, status: 1 });

careBookingSchema.pre('save', function syncCareAssignment() {
  if (this.assignedPartner) {
    this.careAssignmentStatus = 'ASSIGNED_TO_PROFESSIONAL';
  } else {
    this.careAssignmentStatus = 'UNASSIGNED';
  }
});

module.exports = mongoose.model('CareBooking', careBookingSchema);
