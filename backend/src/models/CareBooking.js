const mongoose = require('mongoose');

const careBookingSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: true,
    },
    /** Same as hostelId — care centre / shop listing (Atlas sync). */
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null,
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
    /** Same as userId — customer reference. */
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
      enum: [
        'awaiting_approval',
        'confirmed',
        'checked_in',
        'completed',
        'declined',
        'pending',
        'paid',
        'accepted',
        'rejected',
        'cancelled',
      ],
      default: 'awaiting_approval',
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
    /** Private notes for the care facility/staff (not shown to customer). */
    facilityNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    /** Extra charges added by facility (e.g. grooming add-on, meds, damages). */
    extraCharges: {
      type: [
        {
          label: { type: String, trim: true, maxlength: 120, required: true },
          amount: { type: Number, min: 0, required: true },
          createdAt: { type: Date, default: Date.now },
          createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        },
      ],
      default: [],
    },
    /** Intake + records for the stay/session. */
    intake: {
      vaccination: { type: String, trim: true, maxlength: 200, default: '' },
      diet: { type: String, trim: true, maxlength: 500, default: '' },
      temperament: { type: String, trim: true, maxlength: 200, default: '' },
      checklist: {
        type: [
          {
            key: { type: String, trim: true, maxlength: 80, required: true },
            label: { type: String, trim: true, maxlength: 120, required: true },
            done: { type: Boolean, default: false },
          },
        ],
        default: [],
      },
      feedingSchedule: {
        type: [
          {
            time: { type: String, trim: true, maxlength: 16, required: true }, // e.g. 08:00
            food: { type: String, trim: true, maxlength: 120, default: '' },
            notes: { type: String, trim: true, maxlength: 300, default: '' },
          },
        ],
        default: [],
      },
      incidents: {
        type: [
          {
            at: { type: Date, default: Date.now },
            title: { type: String, trim: true, maxlength: 120, required: true },
            notes: { type: String, trim: true, maxlength: 1000, default: '' },
            severity: { type: String, trim: true, maxlength: 20, default: 'low' },
            createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          },
        ],
        default: [],
      },
    },
    checkedInAt: { type: Date, default: null },
    checkedOutAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    serviceType: {
      type: String,
      enum: ['Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'],
      trim: true,
    },
    packageName: { type: String, trim: true },
    addOns: { type: [String], default: [] },
    serviceDelivery: { type: String, enum: ['home_visit', 'visit_center'], trim: true },
    /** Care logistics: self_drop (customer brings pet) or pickup (professional pickup required). */
    logisticsType: {
      type: String,
      enum: ['self_drop', 'pickup'],
      default: 'self_drop',
    },
    /** Pickup address (required when logisticsType === 'pickup'). */
    pickupAddress: {
      address: { type: String, trim: true, default: '' },
      point: {
        type: {
          type: String,
          enum: ['Point'],
        },
        coordinates: { type: [Number] }, // [lng, lat] — omit when unknown; no default type (avoids invalid GeoJSON)
      },
    },
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
careBookingSchema.index({ 'pickupAddress.point': '2dsphere' });

careBookingSchema.pre('save', function syncCareBookingFields() {
  if (this.hostelId && !this.centreId) {
    this.centreId = this.hostelId;
  }
  if (this.userId && !this.customerId) {
    this.customerId = this.userId;
  }
  if (this.assignedPartner) {
    this.careAssignmentStatus = 'ASSIGNED_TO_PROFESSIONAL';
  } else {
    this.careAssignmentStatus = 'UNASSIGNED';
  }
  const pa = this.pickupAddress;
  if (pa && pa.point) {
    const c = pa.point.coordinates;
    const ok =
      Array.isArray(c) &&
      c.length === 2 &&
      Number.isFinite(Number(c[0])) &&
      Number.isFinite(Number(c[1]));
    if (!ok) {
      this.pickupAddress = pa.address && String(pa.address).trim()
        ? { address: String(pa.address).trim() }
        : undefined;
    } else if (pa.point.type !== 'Point') {
      pa.point.type = 'Point';
    }
  }
});

module.exports = mongoose.model('CareBooking', careBookingSchema);
