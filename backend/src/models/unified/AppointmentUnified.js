/**
 * Unified Appointment model — collection: appointments
 * Vet clinic flow: pending_admin → assigned → in_progress → completed (or cancelled).
 * Refs use core User / Pet models (same Atlas collections as the main API).
 */
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true },
    coordinates: { lat: Number, lng: Number },
  },
  { _id: false }
);

const timelineEntrySchema = new mongoose.Schema(
  {
    status: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'vet_visit',
        'vet_appointment',
        'vaccination',
        'checkup',
        'hostel_stay',
        'grooming',
        'spa',
        'training',
      ],
      required: true,
    },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true },
    /** Assigned veterinarian (PawSewa Partner) — set by admin. */
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Mirror of staffId for admin/mobile payloads; kept in sync in routes. */
    vetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
      enum: [
        'pending',
        'pending_admin',
        'assigned',
        'in_progress',
        'completed',
        'cancelled',
      ],
      default: 'pending_admin',
    },
    assignmentTimeline: { type: [timelineEntrySchema], default: [] },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    notes: { type: String, trim: true, maxlength: 2000 },
    visitNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, collection: 'appointments' }
);

appointmentSchema.pre('save', function syncVetRefs() {
  if (this.staffId && !this.vetId) this.vetId = this.staffId;
  if (this.vetId && !this.staffId) this.staffId = this.vetId;
});

appointmentSchema.index({ customerId: 1, createdAt: -1 });
appointmentSchema.index({ staffId: 1, status: 1 });
appointmentSchema.index({ vetId: 1, status: 1 });
appointmentSchema.index({ petId: 1 });
appointmentSchema.index({ type: 1, status: 1 });
appointmentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('AppointmentUnified', appointmentSchema);
