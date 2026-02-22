/**
 * Unified Appointment model for pawsewa_production.
 * Collection: appointments
 * Consolidates Vet visits, Grooming sessions, Hostel stays.
 * type field: vet_visit | vet_appointment | hostel_stay | grooming | spa | training
 * Use .populate('petId', 'name') and .populate('customerId', 'name') for readable Compass view.
 */
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true },
    coordinates: { lat: Number, lng: Number },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['vet_visit', 'vet_appointment', 'hostel_stay', 'grooming', 'spa', 'training'],
      required: true,
    },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserUnified', required: true },
    petId: { type: mongoose.Schema.Types.ObjectId, ref: 'PetUnified', required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserUnified' },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceUnified' },
    description: { type: String, trim: true, maxlength: 1000 },
    location: locationSchema,
    preferredDate: { type: Date },
    timeWindow: { type: String, trim: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    roomType: { type: String, trim: true },
    nights: { type: Number, min: 0 },
    totalAmount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    notes: { type: String, trim: true, maxlength: 2000 },
    visitNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, collection: 'appointments' }
);

appointmentSchema.index({ customerId: 1, createdAt: -1 });
appointmentSchema.index({ staffId: 1, status: 1 });
appointmentSchema.index({ petId: 1 });
appointmentSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('AppointmentUnified', appointmentSchema);
