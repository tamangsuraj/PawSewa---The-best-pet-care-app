const mongoose = require('mongoose');

const providerApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    businessName: { type: String, required: true, trim: true },
    businessLicense: { type: String, trim: true },
    businessLicenseUrl: { type: String, trim: true },
    serviceTypes: {
      type: [String],
      enum: ['Hostel', 'Daycare', 'Grooming', 'Training', 'Wash', 'Spa'],
      default: ['Hostel'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

providerApplicationSchema.index({ userId: 1 });
providerApplicationSchema.index({ status: 1 });

module.exports = mongoose.model('ProviderApplication', providerApplicationSchema);
