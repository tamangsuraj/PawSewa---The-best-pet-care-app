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
      enum: ['pending', 'paid', 'accepted', 'rejected', 'cancelled'],
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
  },
  { timestamps: true }
);

careBookingSchema.index({ hostelId: 1, status: 1 });
careBookingSchema.index({ userId: 1, status: 1 });
careBookingSchema.index({ serviceType: 1, status: 1 });
careBookingSchema.index({ petId: 1 });

module.exports = mongoose.model('CareBooking', careBookingSchema);
